/**
 * Combat. See docs/DESIGN.md section 7.4; fights the player commands, §7.13.
 * A round without orders plays exactly as an automatic fight always has.
 */
import { addChronicle } from '../chronicle.ts';
import {
  AGGRESSIVE_ATTACK_BONUS,
  AIM_DAMAGE,
  AIM_TO_HIT,
  CALLED_SHOT_TO_HIT,
  CHARGE_BONUS,
  COVER_DEFENSE,
  DC,
  DRAW_FIRE_DEFENSE,
  ENCOUNTER_BASE,
  INTIMIDATE_DC,
  LEAD_WAIT,
  MEDS_HEAL,
  MEDS_HEAL_SKILLED,
  PATCH_WOUND_BONUS,
  SHORT_OUT_DC,
  SMASH_DAMAGE,
  SMASH_TO_HIT,
  SOOTHE_DC,
  SPOT_TO_HIT,
  SPRAY_TO_HIT,
  ENCOUNTER_CREW_MULT,
  ENCOUNTER_PER_DANGER,
  MAX_COMBAT_ROUNDS,
  MAX_ENEMIES,
  NEMESIS_HP_MULT,
  REL_FLED,
  REL_FLED_DOWNED,
  STRESS_COMBAT,
  HEAVY_ARMOR,
  HEAVY_ARMOR_SOAK,
  SURVIVOR_DEFENSE,
  UNARMED_DAMAGE, TOWER_TO_HIT, WALL_COVER, RAID_SHORE_COVER, RAID_MARKED_WEIGHT, RAID_WORKSHOP_TO_HIT, DOG_TO_HIT, DOG_DAMAGE } from '../constants.ts';
import { getEnemy, type EncounterDef, type EnemyDef } from '../content/index.ts';
import { ENEMIES_BREAK, FLEE_LINES, STALEMATE_LINES, WITHDRAW_FAIL, WITHDRAW_SUCCESS } from '../content/flavor.ts';
import { armorValue, itemDef, itemName, qualityMod, weaponDamage } from '../gear.ts';
import { adjustRelationship } from '../relationships.ts';
import { enemyContexts, situationalMods } from '../stats.ts';
import { fullName } from '../text.ts';
import { anyTraitHook, getTraitInstance, maxTraitHook, mulTraitHook } from '../traits.ts';
import { maxHp } from '../stats.ts';
import { pronounForms } from '../text.ts';
import type { MoveOrder, Nemesis, ResourceId, RoundOrders, StatId } from '../types.ts';
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
  dangerEdge,
  startBeat,
  toughened,
  type FightPlan,
} from './context.ts';
import { FightPause, enemyNames, fightView, validOrder, type FightAct } from './command.ts';
import { afterFight, announceNemesis, enemyRef, grudgeBonus, maybeNemesisEscape, nemesisEnemy, nemesisJoins, nemesisKilled } from './stories.ts';

export interface Enemy {
  def: EnemyDef;
  hp: number;
  maxHp: number;
  attack: number;
  /** Damage per hit: its kind's, more in dangerous places. */
  damage: number;
  defense: number;
  dead: boolean;
  /** Ran away. */
  fled: boolean;
  /** Survivors this enemy put down in the current fight. */
  downed: Member[];
  /** One of the guild's nemeses (the run's copy). */
  nemesis?: Nemesis;
  /** One of the Vultures' named people (§7.11): their member id and name. */
  vulture?: { id: string; name: string };
  /** A nemesis gets one try per fight at slipping away. */
  escapeTried?: boolean;
  /** Stunned: loses its next attack (§7.13). */
  stunned?: boolean;
}

export function newEnemy(def: EnemyDef, danger = 1): Enemy {
  const edge = dangerEdge(danger);
  const { hp, defense } = toughened(def.hp, def.defense, danger);
  return { def, hp, maxHp: hp, attack: def.attack + edge, damage: def.damage + edge, defense, dead: false, fled: false, downed: [] };
}

/** Damage a hit does through armor: armor makes hits rarer, and only heavy armor takes something off them. */
export function damageThrough(damage: number, armor: number): number {
  return Math.max(1, damage - (armor >= HEAVY_ARMOR ? HEAVY_ARMOR_SOAK : 0));
}

export type CombatEnd = 'won' | 'withdrew' | 'stalemate' | 'routed';

const living = (enemies: readonly Enemy[]): Enemy[] => enemies.filter((e) => !e.dead && !e.fled);

// ---------------------------------------------------------------- building encounters

/**
 * Pick an encounter for this location and buy enemies with the threat budget.
 * A nemesis that haunts the place may lead it.
 */
export function buildEncounter(sim: Sim, type?: string): Enemy[] {
  // A nemesis only leads its own kind.
  const nemesis = nemesisJoins(sim, type);
  const every: readonly EncounterDef[] = sim.loc.encounters;
  // Only encounters with this kind of enemy, if the place has any (raiders on the road, §7.12).
  const ofType = type ? every.filter((e) => e.enemies.some((id) => getEnemy(id).type === type)) : [];
  const all = ofType.length > 0 ? ofType : every;
  const withIt = nemesis ? all.filter((e) => e.enemies.includes(nemesis.enemyId)) : [];
  const table = withIt.length > 0 ? withIt : all;
  const encounter = sim.rng.weightedBy(table, (e) => {
    // Hunters go looking for animals.
    const feral = e.enemies.some((id) => getEnemy(id).type === 'feral');
    return e.weight * (sim.plan.job === 'hunt' && feral ? 3 : 1);
  });
  const defs = encounter.enemies.map(getEnemy);
  const crewMult = ENCOUNTER_CREW_MULT[Math.min(standing(sim).length, ENCOUNTER_CREW_MULT.length) - 1] ?? 1;
  let budget = (ENCOUNTER_BASE + sim.loc.danger * ENCOUNTER_PER_DANGER) * crewMult;

  const out: Enemy[] = [];
  if (nemesis) {
    const e = nemesisEnemy(nemesis, sim.loc.danger);
    out.push(e);
    budget -= e.def.threat * NEMESIS_HP_MULT;
  }
  while (out.length < MAX_ENEMIES) {
    const affordable = defs.filter((d) => d.threat <= budget);
    if (affordable.length === 0) break;
    const def = sim.rng.pick(affordable);
    out.push(newEnemy(def, sim.loc.danger));
    budget -= def.threat;
  }
  if (out.length === 0) {
    const cheapest = defs.reduce((a, b) => (b.threat < a.threat ? b : a));
    out.push(newEnemy(cheapest, sim.loc.danger));
  }
  return out;
}

/** "three Rad-hounds", "a Raider Gunner and two Raider Scavs", "Old Notch and a Rad-hound". */
export function describeGroup(enemies: readonly Enemy[]): string {
  const parts: string[] = enemies.filter((e) => e.nemesis || e.vulture).map((e) => e.nemesis?.name ?? e.vulture!.name);
  const counts = new Map<EnemyDef, number>();
  for (const e of enemies) if (!e.nemesis && !e.vulture) counts.set(e.def, (counts.get(e.def) ?? 0) + 1);
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
  /** The player gave this round's orders: every swing gets a line (§7.13). */
  commanded: boolean;
  /** Names that tell enemies apart, for those lines. */
  names: string[];
  enemies: readonly Enemy[];
}

/** What a move adds to an attack (§7.13). */
interface AttackMods {
  toHit?: number;
  damage?: number;
  double?: boolean;
  throughArmor?: boolean;
  stun?: boolean;
  /** How the log says it, under command: "takes a called shot at" / "puts a called shot into". Only for a shot when `shot` is set. Text only. */
  words?: { miss: string; hit: string; shot?: boolean };
}

/** Note one act of a commanded fight for the battle stage (§7.13); nothing in any other fight. `said`: its line is already written. */
function act(sim: Sim, a: Omit<FightAct, 'round' | 'line'>, said = false): void {
  const rec = sim.fightActs;
  if (!rec) return;
  const lines = sim.beats.at(-1)?.lines.length ?? 0;
  rec.acts.push({ ...a, round: rec.round, line: said ? lines - 1 : lines });
}

function survivorAttack(sim: Sim, m: Member, target: Enemy, ctx: AttackContext, mods: AttackMods = {}): void {
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
      // A lookout shoots from the Watchtower (§9.8): the higher, the better.
      if (m.perch && sim.gate) toHit += sim.gate.tower * TOWER_TO_HIT;
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

  // An aimed shot (§7.13) is better, and aiming is spent on the next shot.
  const aimed = ranged && m.aimed === true;
  if (ranged) m.aimed = false;
  // At the gate the Workshop's people know where to hit a scrapbot (§9.8).
  const machines = sim.gate?.machines && target.def.type === 'scrapbot' ? sim.gate.machines * RAID_WORKSHOP_TO_HIT : 0;
  const extra = toHit + (sim.plan.approach === 'aggressive' ? AGGRESSIVE_ATTACK_BONUS : 0) + grudgeBonus(m, target) + (mods.toHit ?? 0) + (aimed ? AIM_TO_HIT : 0) + machines;
  const bonus = simBonus(sim, m, stat, ['combat', ...enemyContexts(m.s, target.def.type)], { extra });
  const roll = sim.rng.d10();
  practice(sim, m, stat, target.defense);
  const label = ctx.names[ctx.enemies.indexOf(target)] ?? target.def.name;
  const words = mods.words && (mods.words.shot === undefined || mods.words.shot === ranged) ? mods.words : undefined;
  const hitVerb = words?.hit ?? (ranged ? 'shoots' : 'hits');
  const at = ctx.enemies.indexOf(target);
  if (roll + bonus < target.defense) {
    act(sim, { by: m.s.id, at, kind: 'miss', shot: ranged });
    if (ctx.commanded) say(sim, `${m.s.firstName} ${words?.miss ?? (ranged ? 'shoots at' : 'swings at')} ${label} and misses.`);
    return;
  }

  const raw = (damage + (mods.damage ?? 0) + (aimed ? AIM_DAMAGE : 0)) * (mods.double ? 2 : 1);
  const dealt = Math.max(1, raw - (mods.throughArmor ? 0 : target.def.armor));
  target.hp -= dealt;
  if (target.hp > 0) {
    if (mods.stun) target.stunned = true;
    act(sim, { by: m.s.id, at, kind: 'hit', amount: dealt, shot: ranged, ...(mods.stun ? { stun: true } : {}) });
    if (ctx.commanded) say(sim, `${m.s.firstName} ${hitVerb} ${label} (-${dealt})${mods.stun ? ', and it reels' : ''}.`, { tone: 'good' });
    maybeNemesisEscape(sim, target);
    if (target.fled) act(sim, { by: at, kind: 'escape' }, true);
    return;
  }
  act(sim, { by: m.s.id, at, kind: 'kill', amount: dealt, shot: ranged });

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
  if (target.nemesis) {
    nemesisKilled(sim, m, target, how);
    return;
  }
  const verb = ranged ? 'drops' : 'takes down';
  say(sim, `${m.s.firstName} ${verb} ${ctx.commanded ? label : withArticle(target.def.name)} ${how}.`, { tone: 'good' });
}

// ---------------------------------------------------------------- enemy attacks

interface FightState {
  enemies: Enemy[];
  /** Names that tell enemies apart, for the lines of rounds under orders (§7.13). */
  names: string[];
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
  act(sim, { by: m.s.id, kind: 'flee' });
  say(sim, flavor(sim, FLEE_LINES, { a: m }), { tone: 'bad' });
  revealHook(sim, m, 'fleeChance');
}

/** What the crew set up this round under orders (§7.13): who is in cover, drawing fire, charging or guarding, and the enemy spotted. */
interface Tactics {
  cover: Set<Member>;
  drawFire: Set<Member>;
  charging: Set<Member>;
  /** Guarded ally → the one guarding them. */
  guards: Map<Member, Member>;
  spotted?: Enemy;
  spotter?: Member;
}

function enemyRound(sim: Sim, fight: FightState, tactics?: Tactics): void {
  for (const enemy of living(fight.enemies)) {
    // A stunned enemy loses this attack.
    if (enemy.stunned) {
      enemy.stunned = false;
      act(sim, { by: fight.enemies.indexOf(enemy), kind: 'reel' });
      continue;
    }
    // Lookouts on the Watchtower are out of reach (§9.8).
    const targets = active(sim).filter((m) => !m.perch);
    if (targets.length === 0) return;
    // Without orders this is exactly the automatic fight: one weighted pick, then the roll.
    // Raiders with a score to settle go for that person (§9.8).
    let target = sim.rng.weightedBy(
      targets,
      (m) => mulTraitHook(m.s, 'attentionWeight') * (tactics?.drawFire.has(m) ? 20 : 1) * (sim.gate?.marked === m.s.id && enemy.def.type === 'raider' ? RAID_MARKED_WEIGHT : 1),
    );
    const guard = tactics?.guards.get(target);
    if (guard && !guard.down && !guard.dead && !guard.fled) target = guard;
    const armor = target.s.equipment.armor ? armorValue(target.s.equipment.armor) : 0;
    const extra =
      (tactics
        ? (tactics.cover.has(target) ? COVER_DEFENSE : 0) + (tactics.drawFire.has(target) ? DRAW_FIRE_DEFENSE : 0) - (tactics.charging.has(target) ? CHARGE_BONUS : 0)
        : 0) + (sim.gate?.wall ? WALL_COVER : 0) + (sim.gate?.shored ? RAID_SHORE_COVER : 0);
    const shot = /shot|zapped/.test(enemy.def.hitVerb);
    if (sim.rng.d10() + enemy.attack < SURVIVOR_DEFENSE + armor + extra) {
      act(sim, { by: fight.enemies.indexOf(enemy), at: target.s.id, kind: 'miss', shot });
      continue;
    }

    const damage = damageThrough(enemy.damage, armor);
    if (enemy.def.rads) absorbRads(target, enemy.def.rads);
    const wentDown = hurt(sim, target, damage, enemyRef(enemy), enemy.def.type, enemy.nemesis?.id);
    // Under orders, the player needs to know which one it was.
    const who = tactics ? (fight.names[fight.enemies.indexOf(enemy)] ?? enemyRef(enemy)) : enemyRef(enemy);
    act(sim, { by: fight.enemies.indexOf(enemy), at: target.s.id, kind: 'hit', amount: damage, shot, ...(wentDown ? { down: true } : {}) });
    say(sim, `${target.s.firstName} is ${enemy.def.hitVerb} ${who} (-${damage} HP)${wentDown ? ' and goes down.' : '.'}`, { tone: 'bad' });
    if (wentDown) {
      enemy.downed.push(target);
      fight.downedHere.push(target);
      for (const other of active(sim)) maybeFlee(sim, other, fight);
    } else if (isHurt(target)) {
      maybeFlee(sim, target, fight);
    }
  }
}

/** The guild's dog joins in at the gate (§9.8): a bite at whichever raider is closest to the people. */
function dogBite(sim: Sim, enemies: readonly Enemy[], ctx: AttackContext): void {
  const name = sim.gate!.dog!;
  const targets = living(enemies);
  if (targets.length === 0) return;
  const target = sim.rng.weightedBy(targets, (e) => (e.hp < e.maxHp ? 2 : 1));
  const at = enemies.indexOf(target);
  const label = ctx.names[at] ?? target.def.name;
  if (sim.rng.d10() + DOG_TO_HIT < target.defense) {
    act(sim, { by: 'dog', at, kind: 'miss' });
    if (ctx.commanded) say(sim, `${name} snaps at ${label} and misses.`);
    return;
  }
  const dealt = sim.rng.int(DOG_DAMAGE[0], DOG_DAMAGE[1]);
  target.hp -= dealt;
  if (target.hp > 0) {
    act(sim, { by: 'dog', at, kind: 'hit', amount: dealt });
    say(sim, `${name} gets hold of ${label} (-${dealt}).`, { tone: 'good' });
    return;
  }
  act(sim, { by: 'dog', at, kind: 'kill', amount: dealt });
  target.dead = true;
  say(sim, `${name} brings ${label} down.`, { tone: 'good' });
}

/** Enemies that can break do so once more than half the group is dead. Returns true if any ran. */
function checkMorale(sim: Sim, fight: FightState): boolean {
  const total = fight.enemies.length;
  const dead = fight.enemies.filter((e) => e.dead).length;
  if (dead * 2 <= total) return false;
  // A nemesis doesn't run with the pack; it has its own way of getting out.
  const runners = living(fight.enemies).filter((e) => e.def.morale === 'breaks' && !e.nemesis);
  if (runners.length === 0) return false;
  for (const e of runners) {
    e.fled = true;
    act(sim, { by: fight.enemies.indexOf(e), kind: 'break' });
  }
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
  act(sim, { by: leader.s.id, kind: 'withdraw', ok: result.success });
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

// ---------------------------------------------------------------- commanded fights (§7.13)

/**
 * On a run the player leads, the crew stops at a fight and calls home. Returns
 * the player's part in it, or undefined when they fight on their own (nobody
 * came within the wait, or the run isn't led). The fight itself goes in a new
 * beat, at the time it was fought.
 */
function callHome(sim: Sim, enemies: readonly Enemy[]): FightPlan | undefined {
  const lead = sim.lead;
  if (!lead) return undefined;
  if (lead.home) {
    // A raid at the Depot (§9.8): the player is there or isn't; nobody calls.
    const plan = lead.plans[lead.stops.length];
    lead.stops.push({ at: sim.offset, by: standing(sim)[0]?.s.id ?? '', against: describeGroup(enemies), fromBeat: sim.beats.length });
    startBeat(sim, 'combat', 'At the gate');
    if (plan && (plan.rounds.length > 0 || plan.live)) say(sim, 'You take command at the gate.');
    return plan;
  }
  const caller = bestBy(standing(sim), (m) => simBonus(sim, m, 'nerve', []));
  if (!caller) return undefined;
  const plan = lead.plans[lead.stops.length];
  const kind = sim.beats.at(-1)?.kind ?? 'combat';
  say(sim, `${caller.s.firstName} gets on the radio to the Depot.`);
  lead.stops.push({ at: sim.offset, by: caller.s.id, against: describeGroup(enemies), fromBeat: sim.beats.length });
  const solo = sim.members.length === 1;
  if (!plan) {
    sim.delay += LEAD_WAIT;
    sim.offset += LEAD_WAIT;
    startBeat(sim, kind, 'No word from home');
    say(sim, solo ? `Half an hour by the radio, and no word. ${caller.s.firstName} goes in alone.` : 'Half an hour by the radio, and no word. They go in on their own.', { tone: 'bad' });
    return undefined;
  }
  // Under command the fight is played as the orders come in; once it's over, at the time it ended.
  const wait = plan.live ? 0 : plan.delay;
  sim.delay += wait;
  sim.offset += wait;
  startBeat(sim, kind, plan.rounds.length > 0 || plan.live ? 'Under orders' : 'Word from home');
  say(sim, plan.rounds.length > 0 || plan.live ? 'Orders come over the radio.' : solo ? `Word from home: fight it out. ${caller.s.firstName} goes in.` : 'Word from home: fight it out.');
  return plan;
}

/** The orders that set things up before anyone swings: cover, drawing fire, charging, guarding, spotting, aiming. */
function prepareRound(sim: Sim, enemies: readonly Enemy[], orders: RoundOrders): Tactics {
  const t: Tactics = { cover: new Set(), drawFire: new Set(), charging: new Set(), guards: new Map() };
  for (const m of active(sim)) {
    const order = orders.moves[m.s.id];
    if (!order || !validOrder(sim, m, enemies, order.move, order.target)) continue;
    if (order.move === 'cover') t.cover.add(m);
    else if (order.move === 'draw_fire') t.drawFire.add(m);
    else if (order.move === 'charge') t.charging.add(m);
    else if (order.move === 'aim') m.aimed = true;
    else if (order.move === 'guard') {
      const ally = sim.members.find((o) => o.s.id === order.target);
      if (ally) t.guards.set(ally, m);
    } else if (order.move === 'spot') {
      t.spotted = enemies[order.target as number];
      t.spotter = m;
    }
  }
  return t;
}

/** Use a med on someone mid-fight. Someone down gets back up, a little, with a better wound roll. */
export function patchUp(sim: Sim, medic: Member, ally: Member): void {
  const result = check(sim, medic, 'wits', DC.easy, ['medicine']);
  const heal = result.success ? MEDS_HEAL_SKILLED : MEDS_HEAL;
  sim.meds -= 1;
  const who = medic === ally ? `${medic.s.firstName} patches up ${pronounForms(medic.s.pronouns).their} own wounds` : `${medic.s.firstName} patches up ${ally.s.firstName}`;
  if (ally.down) {
    ally.down = false;
    ally.s.hp = Math.max(1, Math.ceil(heal / 2));
    ally.woundBonus = (ally.woundBonus ?? 0) + PATCH_WOUND_BONUS;
    act(sim, { by: medic.s.id, at: ally.s.id, kind: 'revive', amount: ally.s.hp });
    say(sim, `${medic.s.firstName} gets ${ally.s.firstName} back on ${pronounForms(ally.s.pronouns).their} feet (${ally.s.hp} HP).`, { check: result.info, tone: 'good' });
    return;
  }
  const gained = Math.min(heal, maxHp(ally.s) - ally.s.hp);
  ally.s.hp += gained;
  act(sim, { by: medic.s.id, at: ally.s.id, kind: 'heal', amount: gained });
  say(sim, `${who} (+${gained} HP).`, { check: result.info, tone: 'good' });
}

/** A check that ends one enemy's part in the fight: staring a raider down, soothing a feral, shorting out a scrapbot. */
function talkDown(sim: Sim, m: Member, target: Enemy, at: number, label: string, move: 'intimidate' | 'soothe' | 'short_out'): void {
  const spec =
    move === 'intimidate'
      ? { stat: 'nerve' as const, dc: INTIMIDATE_DC, contexts: ['intimidate'], won: `${label} breaks and runs.`, lost: `${label} laughs at ${m.s.firstName}.` }
      : move === 'soothe'
        ? { stat: 'nerve' as const, dc: SOOTHE_DC, contexts: [], won: `${m.s.firstName} talks low and steady, and ${label} slinks off.`, lost: `${label} isn't having it.` }
        : { stat: 'wits' as const, dc: SHORT_OUT_DC, contexts: ['tech'], won: `${m.s.firstName} gets a hand inside ${label}, and it shuts down.`, lost: `${m.s.firstName} can't get at ${label}'s wiring.` };
  const result = check(sim, m, spec.stat, spec.dc + sim.loc.danger, [...spec.contexts, ...enemyContexts(m.s, target.def.type)]);
  act(sim, { by: m.s.id, at, kind: 'talk', ok: result.success });
  say(sim, result.success ? spec.won : spec.lost, { check: result.info, tone: result.success ? 'good' : 'bad' });
  if (!result.success) return;
  // A machine shut down is as good as destroyed: its parts are there for the taking.
  if (move === 'short_out') target.dead = true;
  else target.fled = true;
}

/** Carry out one person's order. Returns false if they can't, and should just fight as they would on their own. */
function actOnOrder(sim: Sim, m: Member, order: MoveOrder, enemies: readonly Enemy[], ctx: AttackContext, t: Tactics): boolean {
  const choice = validOrder(sim, m, enemies, order.move, order.target);
  if (!choice) return false;
  const foe = typeof order.target === 'number' ? enemies[order.target] : undefined;
  const spot = foe && t.spotted === foe && t.spotter !== m ? SPOT_TO_HIT : 0;
  switch (order.move) {
    case 'attack':
      survivorAttack(sim, m, foe!, ctx, { toHit: spot });
      return true;
    case 'called_shot':
      survivorAttack(sim, m, foe!, ctx, { toHit: CALLED_SHOT_TO_HIT + spot, double: true, words: { miss: 'takes a called shot at', hit: 'puts a called shot into', shot: true } });
      return true;
    case 'smash':
      survivorAttack(sim, m, foe!, ctx, { toHit: SMASH_TO_HIT + spot, damage: SMASH_DAMAGE, throughArmor: true, words: { miss: 'swings hard at', hit: 'smashes', shot: false } });
      return true;
    case 'stun':
      survivorAttack(sim, m, foe!, ctx, { toHit: spot, stun: true, words: { miss: 'jabs at', hit: 'jolts', shot: false } });
      return true;
    case 'charge':
      survivorAttack(sim, m, foe!, ctx, { toHit: CHARGE_BONUS + spot, damage: CHARGE_BONUS, words: { miss: 'charges at', hit: 'charges into' } });
      return true;
    case 'spray': {
      survivorAttack(sim, m, foe!, ctx, { toHit: SPRAY_TO_HIT + spot, words: { miss: 'sprays at', hit: 'sprays', shot: true } });
      // The second shot goes to whoever else is closest: the next one still standing.
      const next = living(enemies).find((e) => e !== foe);
      if (next) survivorAttack(sim, m, next, ctx, { toHit: SPRAY_TO_HIT + (t.spotted === next && t.spotter !== m ? SPOT_TO_HIT : 0), words: { miss: 'sprays at', hit: 'sprays', shot: true } });
      return true;
    }
    case 'patch': {
      const ally = sim.members.find((o) => o.s.id === order.target);
      if (!ally) return false;
      patchUp(sim, m, ally);
      return true;
    }
    case 'intimidate':
    case 'soothe':
    case 'short_out':
      talkDown(sim, m, foe!, order.target as number, ctx.names[order.target as number] ?? foe!.def.name, order.move);
      return true;
    case 'cover':
      act(sim, { by: m.s.id, kind: 'cover' });
      say(sim, `${m.s.firstName} keeps down behind cover.`);
      return true;
    case 'draw_fire':
      act(sim, { by: m.s.id, kind: 'draw_fire' });
      say(sim, `${m.s.firstName} steps out and makes a lot of noise.`);
      return true;
    case 'guard': {
      const ally = sim.members.find((o) => o.s.id === order.target);
      act(sim, { by: m.s.id, at: order.target as string, kind: 'guard' });
      say(sim, `${m.s.firstName} stands in front of ${ally?.s.firstName ?? 'a friend'}.`);
      return true;
    }
    case 'spot':
      act(sim, { by: m.s.id, at: order.target as number, kind: 'spot' });
      say(sim, `${m.s.firstName} calls out where ${ctx.names[order.target as number] ?? 'it'} is.`);
      return true;
    case 'aim':
      act(sim, { by: m.s.id, kind: 'aim' });
      say(sim, `${m.s.firstName} takes careful aim.`);
      return true;
  }
}

export function fight(sim: Sim, enemies: Enemy[], start: FightStart): FightResult {
  const state: FightState = { enemies, names: enemyNames(enemies), downedHere: [], fledHere: [] };
  // On a led run the crew stops here and calls home first (§7.13).
  const plan = callHome(sim, enemies);
  const fightFrom = sim.beats.at(-1)?.lines.length ?? 0;
  // A fight under command notes what happens, act by act, for the battle stage.
  sim.fightActs = plan ? { round: 0, acts: [] } : undefined;
  const attackCtx: AttackContext = { drop: false, ambushed: start.ambushed, round: 0, outOfAmmoSaid: new Set(), commanded: false, names: enemyNames(enemies), enemies };
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
  for (const e of enemies) if (e.nemesis) announceNemesis(sim, e);

  let end: CombatEnd | undefined;
  let blockedSaid = false;
  const blocked = (blocker: { member: Member; enemy: EnemyDef }): void => {
    if (blockedSaid) return;
    blockedSaid = true;
    const who = blocker.member.s.firstName;
    const enemy = withArticle(blocker.enemy.name);
    say(sim, sim.members.length === 1 ? `It is time to pull out, but ${who} will not leave while ${enemy} is still standing.` : `The crew wants out, but ${who} will not leave while ${enemy} is still standing.`, { tone: 'bad' });
  };
  // Orders are used one per round the crew acts in; an ambushed crew can't act in the first.
  let given = 0;

  for (let round = 1; round <= MAX_COMBAT_ROUNDS && !end; round++) {
    attackCtx.round = round;
    if (sim.fightActs) sim.fightActs.round = round;
    attackCtx.drop = start.drop && round === 1;
    const crewActs = !(start.ambushed && round === 1);

    let orders: RoundOrders | undefined;
    if (plan && crewActs) {
      orders = plan.rounds[given];
      // Under command and out of orders: the fight waits for the next round's.
      if (!orders && plan.live) throw new FightPause(fightView(sim, enemies, round, fightFrom));
      if (orders) given++;
    }
    attackCtx.commanded = orders !== undefined;
    const tactics = orders ? prepareRound(sim, enemies, orders) : undefined;

    if (crewActs) {
      for (const m of active(sim)) {
        const targets = living(enemies);
        if (targets.length === 0) break;
        const order = orders?.moves[m.s.id];
        if (order && tactics && actOnOrder(sim, m, order, enemies, attackCtx, tactics)) continue;
        // People tend to finish what is already hurt.
        const target = sim.rng.weightedBy(targets, (e) => (e.hp < e.maxHp ? 3 : 1));
        survivorAttack(sim, m, target, attackCtx, tactics?.spotted === target && tactics.spotter !== m ? { toHit: SPOT_TO_HIT } : {});
      }
      if (sim.gate?.dog) dogBite(sim, enemies, attackCtx);
      if (living(enemies).length === 0 || (checkMorale(sim, state) && living(enemies).length === 0)) {
        end = 'won';
        break;
      }
    }

    if (!(start.drop && round === 1)) enemyRound(sim, state, tactics);

    if (active(sim).length === 0) {
      end = standing(sim).length === 0 ? 'routed' : 'withdrew';
      break;
    }
    // At the gate, lookouts on the tower can't hold it alone (§9.8).
    if (sim.gate && active(sim).every((m) => m.perch)) {
      say(sim, 'Nobody is left at the gate. The raiders are through.', { tone: 'bad' });
      end = 'withdrew';
      break;
    }

    // Under orders the crew pulls out when told to; on its own, when its standing orders say.
    if (orders ? orders.pullOut === true : retreatWanted(sim)) {
      const blocker = retreatBlocker(sim, state);
      if (blocker) blocked(blocker);
      else {
        withdraw(sim, state);
        end = active(sim).length === 0 && standing(sim).length === 0 ? 'routed' : 'withdrew';
      }
    }
  }
  for (const m of sim.members) m.aimed = false;

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

  afterFight(sim, enemies);
  // A commanded fight as it ended, for the screen that shows how it went.
  if (plan && sim.lead) sim.lead.ends[sim.lead.stops.length - 1] = fightView(sim, enemies, attackCtx.round, fightFrom, end);
  sim.fightActs = undefined;

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
