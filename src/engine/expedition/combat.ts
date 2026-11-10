/**
 * Auto-resolved combat. See docs/DESIGN.md section 7.4.
 */
import { addChronicle } from '../chronicle.ts';
import {
  AGGRESSIVE_ATTACK_BONUS,
  ENCOUNTER_BASE,
  ENCOUNTER_CREW_MULT,
  ENCOUNTER_PER_DANGER,
  MAX_COMBAT_ROUNDS,
  MAX_ENEMIES,
  REL_FLED,
  REL_FLED_DOWNED,
  STRESS_COMBAT,
  SURVIVOR_DEFENSE,
  UNARMED_DAMAGE,
} from '../constants.ts';
import { getEnemy, type EncounterDef, type EnemyDef } from '../content/index.ts';
import { ENEMIES_BREAK, FLEE_LINES, STALEMATE_LINES, WITHDRAW_FAIL, WITHDRAW_SUCCESS } from '../content/flavor.ts';
import { armorValue, itemDef, itemName, qualityMod, weaponDamage } from '../gear.ts';
import { adjustRelationship } from '../relationships.ts';
import { enemyContexts, situationalMods } from '../stats.ts';
import { fullName } from '../text.ts';
import { anyTraitHook, getTraitInstance, maxTraitHook, mulTraitHook } from '../traits.ts';
import type { ResourceId, StatId } from '../types.ts';
import {
  absorbRads,
  active,
  bestBy,
  check,
  flavor,
  hurt,
  isHurt,
  listNames,
  numberWord,
  practice,
  revealHook,
  say,
  simBonus,
  simDay,
  standing,
  stress,
  withArticle,
  type Member,
  type Sim,
} from './context.ts';

export interface Enemy {
  def: EnemyDef;
  hp: number;
  dead: boolean;
  /** Ran away. */
  fled: boolean;
}

export type CombatEnd = 'won' | 'withdrew' | 'stalemate' | 'routed';

const living = (enemies: readonly Enemy[]): Enemy[] => enemies.filter((e) => !e.dead && !e.fled);

// ---------------------------------------------------------------- building encounters

/** Pick an encounter for this location and buy enemies with the threat budget. */
export function buildEncounter(sim: Sim): Enemy[] {
  const table: readonly EncounterDef[] = sim.loc.encounters;
  const encounter = sim.rng.weightedBy(table, (e) => {
    // Hunters go looking for animals.
    const feral = e.enemies.some((id) => getEnemy(id).type === 'feral');
    return e.weight * (sim.plan.job === 'hunt' && feral ? 3 : 1);
  });
  const defs = encounter.enemies.map(getEnemy);
  const crewMult = ENCOUNTER_CREW_MULT[Math.min(standing(sim).length, ENCOUNTER_CREW_MULT.length) - 1] ?? 1;
  let budget = (ENCOUNTER_BASE + sim.loc.danger * ENCOUNTER_PER_DANGER) * crewMult;

  const out: Enemy[] = [];
  while (out.length < MAX_ENEMIES) {
    const affordable = defs.filter((d) => d.threat <= budget);
    if (affordable.length === 0) break;
    const def = sim.rng.pick(affordable);
    out.push({ def, hp: def.hp, dead: false, fled: false });
    budget -= def.threat;
  }
  if (out.length === 0) {
    const cheapest = defs.reduce((a, b) => (b.threat < a.threat ? b : a));
    out.push({ def: cheapest, hp: cheapest.hp, dead: false, fled: false });
  }
  return out;
}

/** "three Rad-hounds", "a Raider Gunner and two Raider Scavs". */
export function describeGroup(enemies: readonly Enemy[]): string {
  const counts = new Map<EnemyDef, number>();
  for (const e of enemies) counts.set(e.def, (counts.get(e.def) ?? 0) + 1);
  const parts: string[] = [];
  for (const [def, n] of counts) parts.push(n === 1 ? withArticle(def.name) : `${numberWord(n)} ${def.plural}`);
  return listNames(parts);
}

// ---------------------------------------------------------------- survivor attacks

interface AttackContext {
  /** The crew caught the enemy off guard this round. */
  drop: boolean;
  /** The enemy caught the crew off guard (they start close). */
  ambushed: boolean;
  round: number;
  outOfAmmoSaid: Set<Member>;
}

function survivorAttack(sim: Sim, m: Member, target: Enemy, ctx: AttackContext): void {
  const weapon = m.s.equipment.weapon;
  const def = weapon ? itemDef(weapon) : undefined;
  let stat: StatId = 'brawn';
  let damage = UNARMED_DAMAGE;
  let toHit = 0;
  let ranged = false;

  if (weapon && def) {
    const needsAmmo = def.usesAmmo === true;
    if (def.weaponType === 'ranged' && (!needsAmmo || sim.ammo > 0)) {
      ranged = true;
      stat = 'aim';
      damage = weaponDamage(weapon);
      toHit = (def.toHit ?? 0) + qualityMod(weapon);
      if (needsAmmo) sim.ammo -= 1;
      // Close-range weapons are poor until the distance closes.
      if (def.hooks?.closeRange && ctx.round === 1 && !ctx.ambushed) toHit -= 2;
      // A silent weapon makes the most of surprise.
      if (def.hooks?.silent && ctx.drop) toHit += 2;
    } else if (def.weaponType === 'melee') {
      damage = weaponDamage(weapon);
      toHit = (def.toHit ?? 0) + qualityMod(weapon);
    } else if (!ctx.outOfAmmoSaid.has(m)) {
      ctx.outOfAmmoSaid.add(m);
      say(sim, `${m.s.firstName} is out of ammo and swings the ${def.name} like a club.`, { tone: 'bad' });
    }
  }

  const extra = toHit + (sim.plan.approach === 'aggressive' ? AGGRESSIVE_ATTACK_BONUS : 0);
  const bonus = simBonus(sim, m, stat, ['combat', ...enemyContexts(m.s, target.def.type)], { extra });
  const roll = sim.rng.d10();
  practice(sim, m, stat, target.def.defense);
  if (roll + bonus < target.def.defense) return;

  target.hp -= Math.max(1, damage - target.def.armor);
  if (target.hp > 0) return;

  target.dead = true;
  const c = m.s.counters;
  c.kills += 1;
  c.killsByEnemy[target.def.type] = (c.killsByEnemy[target.def.type] ?? 0) + 1;
  if (ranged) {
    c.rangedKills += 1;
    m.tally.rangedKills += 1;
  } else {
    c.meleeKills += 1;
    m.tally.meleeKills += 1;
  }
  if (weapon) weapon.kills = (weapon.kills ?? 0) + 1;
  const how = weapon ? `with the ${itemName(weapon)}` : 'bare-handed';
  const verb = ranged ? 'drops' : 'takes down';
  say(sim, `${m.s.firstName} ${verb} ${withArticle(target.def.name)} ${how}.`, { tone: 'good' });
}

// ---------------------------------------------------------------- enemy attacks

interface FightState {
  enemies: Enemy[];
  /** Members who went down during this fight. */
  downedHere: Member[];
  fledHere: Member[];
}

function maybeFlee(sim: Sim, m: Member, fight: FightState): void {
  if (m.fled || m.down || m.dead || m.fleeRolled) return;
  if (anyTraitHook(m.s, 'neverFlees')) return;
  const chance = maxTraitHook(m.s, 'fleeChance');
  if (chance <= 0) return;
  m.fleeRolled = true;
  if (!sim.rng.chance(chance)) return;
  m.fled = true;
  m.tally.fled += 1;
  fight.fledHere.push(m);
  say(sim, flavor(sim, FLEE_LINES, { a: m }), { tone: 'bad' });
  revealHook(sim, m, 'fleeChance');
}

function enemyRound(sim: Sim, fight: FightState): void {
  for (const enemy of living(fight.enemies)) {
    const targets = active(sim);
    if (targets.length === 0) return;
    const target = sim.rng.weightedBy(targets, (m) => mulTraitHook(m.s, 'attentionWeight'));
    const armor = target.s.equipment.armor ? armorValue(target.s.equipment.armor) : 0;
    if (sim.rng.d10() + enemy.def.attack < SURVIVOR_DEFENSE + armor) continue;

    const damage = Math.max(1, enemy.def.damage - armor);
    if (enemy.def.rads) absorbRads(target, enemy.def.rads);
    const wentDown = hurt(sim, target, damage, withArticle(enemy.def.name), enemy.def.type);
    say(
      sim,
      `${target.s.firstName} is ${enemy.def.hitVerb} ${withArticle(enemy.def.name)} (-${damage} HP)${wentDown ? ' and goes down.' : '.'}`,
      { tone: 'bad' },
    );
    if (wentDown) {
      fight.downedHere.push(target);
      for (const other of active(sim)) maybeFlee(sim, other, fight);
    } else if (isHurt(target)) {
      maybeFlee(sim, target, fight);
    }
  }
}

/** Enemies that can break do so once more than half the group is dead. Returns true if any ran. */
function checkMorale(sim: Sim, fight: FightState): boolean {
  const total = fight.enemies.length;
  const dead = fight.enemies.filter((e) => e.dead).length;
  if (dead * 2 <= total) return false;
  const runners = living(fight.enemies).filter((e) => e.def.morale === 'breaks');
  if (runners.length === 0) return false;
  for (const e of runners) e.fled = true;
  say(sim, flavor(sim, ENEMIES_BREAK));
  return true;
}

// ---------------------------------------------------------------- retreat

function retreatWanted(sim: Sim): boolean {
  switch (sim.plan.retreat) {
    case 'never':
      return false;
    case 'downed':
      return sim.members.some((m) => m.down);
    case 'wounded':
      return sim.members.some((m) => m.down || (!m.dead && isHurt(m)));
  }
}

/** Someone who won't leave while their sworn enemy is still standing. */
function retreatBlocker(sim: Sim, fight: FightState): { member: Member; enemy: EnemyDef } | undefined {
  for (const m of active(sim)) {
    if (!anyTraitHook(m.s, 'ignoresRetreat')) continue;
    const target = getTraitInstance(m.s, 'vengeful')?.target;
    const enemy = living(fight.enemies).find((e) => e.def.type === target);
    if (enemy) return { member: m, enemy: enemy.def };
  }
  return undefined;
}

/** Try to break away. Failing gives the enemy one more round first. */
function withdraw(sim: Sim, fight: FightState): void {
  const crew = active(sim);
  const leader = bestBy(crew, (m) => simBonus(sim, m, 'wits', ['flee']))!;
  // Anyone slow (Bad Leg) holds the whole crew back.
  let drag = 0;
  for (const m of crew) if (m !== leader) drag += Math.min(0, situationalMods(m.s, undefined, ['flee']));
  const result = check(sim, leader, 'wits', 8 + sim.loc.danger, ['flee'], { crew: true, extra: drag });
  if (result.success) {
    say(sim, flavor(sim, WITHDRAW_SUCCESS, { a: leader }), { check: result.info });
  } else {
    say(sim, flavor(sim, WITHDRAW_FAIL, { a: leader }), { check: result.info, tone: 'bad' });
    enemyRound(sim, fight);
  }
}

// ---------------------------------------------------------------- the fight

export interface FightStart {
  ambushed: boolean;
  drop: boolean;
}

export interface FightResult {
  end: CombatEnd;
  /** Loot from the bodies, if the crew held the field. */
  loot: Partial<Record<ResourceId, number>>;
}

export function fight(sim: Sim, enemies: Enemy[], start: FightStart): FightResult {
  const state: FightState = { enemies, downedHere: [], fledHere: [] };
  const attackCtx: AttackContext = { drop: false, ambushed: start.ambushed, round: 0, outOfAmmoSaid: new Set() };
  const enemyType = enemies[0]!.def.type;
  sim.hadCombat = true;

  // Everyone steels themselves. Holding your nerve halves the stress of the fight.
  for (const m of standing(sim)) {
    m.fled = false;
    m.fleeRolled = false;
    m.s.counters.combats += 1;
    m.tally.combats += 1;
    const nerve = check(sim, m, 'nerve', 7 + sim.loc.danger, ['combat', ...enemyContexts(m.s, enemyType)]);
    const base = sim.rng.int(STRESS_COMBAT[0], STRESS_COMBAT[1]);
    stress(sim, m, nerve.success ? base / 2 : base, 'the fighting');
  }

  let end: CombatEnd | undefined;
  let blockedSaid = false;

  for (let round = 1; round <= MAX_COMBAT_ROUNDS && !end; round++) {
    attackCtx.round = round;
    attackCtx.drop = start.drop && round === 1;

    if (!(start.ambushed && round === 1)) {
      for (const m of active(sim)) {
        const targets = living(enemies);
        if (targets.length === 0) break;
        // People tend to finish what is already hurt.
        const target = sim.rng.weightedBy(targets, (e) => (e.hp < e.def.hp ? 3 : 1));
        survivorAttack(sim, m, target, attackCtx);
      }
      if (living(enemies).length === 0 || (checkMorale(sim, state) && living(enemies).length === 0)) {
        end = 'won';
        break;
      }
    }

    if (!(start.drop && round === 1)) enemyRound(sim, state);

    if (active(sim).length === 0) {
      end = standing(sim).length === 0 ? 'routed' : 'withdrew';
      break;
    }

    if (retreatWanted(sim)) {
      const blocker = retreatBlocker(sim, state);
      if (blocker) {
        if (!blockedSaid) {
          blockedSaid = true;
          say(sim, `The crew wants out, but ${blocker.member.s.firstName} will not leave while ${withArticle(blocker.enemy.name)} is still standing.`, { tone: 'bad' });
        }
      } else {
        withdraw(sim, state);
        end = active(sim).length === 0 && standing(sim).length === 0 ? 'routed' : 'withdrew';
      }
    }
  }

  if (!end) {
    end = 'stalemate';
    say(sim, flavor(sim, STALEMATE_LINES));
  }

  // Consequences for those who ran.
  const day = simDay(sim);
  for (const runner of state.fledHere) {
    const abandoned = state.downedHere.filter((d) => d !== runner);
    if (abandoned.length > 0) {
      addChronicle(runner.s, day, `Ran from a fight at ${sim.loc.name} while ${listNames(abandoned.map((d) => fullName(d.s)))} lay bleeding.`, ['fled']);
    }
    for (const other of sim.members) {
      if (other === runner || other.dead) continue;
      const delta = abandoned.includes(other) ? REL_FLED_DOWNED : REL_FLED;
      adjustRelationship(sim.state, runner.s.id, other.s.id, delta, { day });
    }
    runner.fled = false;
  }
  if (state.fledHere.length > 0 && end !== 'routed') {
    say(sim, `${listNames(state.fledHere.map((m) => m.s.firstName))} ${state.fledHere.length === 1 ? 'creeps' : 'creep'} back once it is over. Nobody says anything.`);
  }

  const loot: Partial<Record<ResourceId, number>> = {};
  if (end === 'won') {
    for (const e of enemies) {
      if (!e.dead) continue;
      for (const [res, range] of Object.entries(e.def.loot) as [ResourceId, [number, number]][]) {
        let amount = sim.rng.int(range[0], range[1]);
        if (res === 'rations' && sim.plan.job === 'hunt') amount = Math.ceil(amount * 1.5) + 1;
        if (amount > 0) loot[res] = (loot[res] ?? 0) + amount;
      }
    }
  }
  return { end, loot };
}
