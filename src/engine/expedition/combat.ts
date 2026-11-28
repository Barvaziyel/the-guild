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
  CLEAN_FIGHT_LOOT,
  CLEAN_FIGHT_RELIEF,
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
  UNARMED_DAMAGE, TOWER_TO_HIT, WALL_COVER, RAID_SHORE_COVER, RAID_MARKED_WEIGHT, RAID_WORKSHOP_TO_HIT, DOG_TO_HIT, DOG_DAMAGE,
  BIG_HIT,
  PACK_TO_HIT_MAX,
  HEAVY_HIT_MULT,
  HEAVY_TO_HIT,
  NERVE_BIG_HIT,
  NERVE_DOWN,
  NERVE_FULL,
  NERVE_LEADER,
  NERVE_TALKED,
  RUN_CHANCE,
  RUN_NERVE,
  UNREACHABLE_DROP,
  BREAK_FREE_DC,
  LINED_UP_MULT,
  LINED_UP_TO_HIT,
  MEND_BELOW,
  OFF_BALANCE_TO_HIT,
  SHOVE_TO_HIT,
} from '../constants.ts';
import { getEnemy, type EncounterDef, type EnemyDef } from '../content/index.ts';
import { CLEAN_FIGHT_LINES, ENEMIES_BREAK, FLEE_LINES, STALEMATE_LINES, WITHDRAW_FAIL, WITHDRAW_SUCCESS } from '../content/flavor.ts';
import { armorValue, itemDef, itemName, qualityMod, weaponDamage } from '../gear.ts';
import { adjustRelationship } from '../relationships.ts';
import { enemyContexts, situationalMods } from '../stats.ts';
import { maxHp } from '../stats.ts';
import { fullName } from '../text.ts';
import { anyTraitHook, getTraitInstance, maxTraitHook, mulTraitHook } from '../traits.ts';
import { pronounForms } from '../text.ts';
import type { MoveOrder, Nemesis, Rank, ResourceId, RoundOrders, StatId } from '../types.ts';
import {
  absorbRads,
  active,
  alive,
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
  type SimLead,
} from './context.ts';
import { FightPause, attackKind, defaultRank, enemyNames, fightView, movesFor, validOrder, type FightAct } from './command.ts';
import { enemyReaches, reaches } from './reach.ts';
import { goalRoundEnds, goalView, goalWorker, rollGoal, settleGoal, workGoal } from './goals.ts';
import { afterFight, announceNemesis, enemyRef, grudgeBonus, maybeNemesisEscape, nemesisEnemy, nemesisJoins, nemesisKilled } from './stories.ts';
import { eliteKilled } from './elites.ts';
import { resolveWounds } from './wounds.ts';
import { Rng } from '../rng.ts';

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
  /** What it means to do this round, chosen before the crew acts (§7.4, 2.3.0). */
  intent?: EnemyIntent;
  /** On the ground, for one that gets back up (2.4.0): the round it went down, and who put it there. */
  down?: { round: number; by: Member; ranged: boolean };
  /** Got back up once already: the next time it drops, it stays down. */
  rose?: boolean;
  /** Behind a door nobody has held yet (2.5.0): not in the fight until it comes through. */
  waiting?: boolean;
  /** Lined up a shot last round (3.8.0): it goes at this one now, unless something spoils it. */
  aiming?: Member;
  /** Has one of the crew in its grip (3.8.0). */
  holding?: Member;
  /** Shoved or pinned down this round (3.8.0): everyone else hits it more easily. */
  offBalance?: boolean;
  /** Plates still on it (3.12.0): each hit that lands knocks one off instead of hurting it. */
  plates?: number;
  /** Gone under (3.12.0): nothing reaches it until it comes up again. */
  under?: boolean;
  /** One that comes when it's called (3.12.0): off the stage (`waiting`) until then. */
  reserve?: boolean;
  /** How many it has called in this fight (3.12.0). */
  called?: number;
}

/**
 * What an enemy means to do this round (§7.4, 2.3.0), shown to a commander before the orders: a hit or a big
 * hit at someone, or a run for it; since 3.8.0 also lining up a shot (`aim`) and taking it (`shot`), mending
 * one of its own, throwing a firebomb at a rank, grabbing someone, or biting the one it holds.
 */
export interface EnemyIntent {
  kind: EnemyIntentKind;
  at?: Member;
  /** Its second blow's target, for one that strikes twice (the Shepherd, 3.0.0): someone else when it can reach them. */
  also?: Member;
  /** The one of its own it mends. */
  ally?: Enemy;
  /** The rank a firebomb is thrown at. */
  rank?: Rank;
}

export type EnemyIntentKind = 'strike' | 'heavy' | 'run' | 'aim' | 'shot' | 'mend' | 'throw' | 'grab' | 'hold' | 'call' | 'sweep' | 'dive' | 'surface';

/** What a shove or a pin down breaks (3.8.0): anything wound up, and a grip. A plain hit just comes off balance. */
const WIND_UPS: readonly EnemyIntentKind[] = ['heavy', 'aim', 'shot', 'mend', 'throw', 'grab', 'hold', 'call', 'sweep', 'dive'];

/** Let go of whoever it holds (3.8.0). */
function letGo(e: Enemy): Member | undefined {
  const held = e.holding;
  if (held) held.heldBy = undefined;
  e.holding = undefined;
  return held;
}

/** Grips that can't last: the holder down, gone or dead, or the one held down or gone. */
function settleGrips(enemies: readonly Enemy[]): void {
  for (const e of enemies) {
    const held = e.holding;
    if (held && (e.dead || e.fled || e.down || held.down || held.dead || held.fled)) letGo(e);
  }
}

/** A group's nerve (§7.4, 2.3.0): deaths, their leader falling and big hits wear it down, one of the crew going down builds it up; at 0 those that can run do. */
interface Morale {
  nerve: number;
  /** What each death costs: enough that, with nothing else, they break once more than half are dead. */
  perDeath: number;
}

function loseNerve(morale: Morale | undefined, amount: number): void {
  if (morale) morale.nerve = Math.max(0, morale.nerve - amount);
}

/** One of them killed (or shut down): what it costs the rest. */
function fell(morale: Morale | undefined, e: Enemy): void {
  loseNerve(morale, (morale?.perDeath ?? 0) + (e.def.leader ? NERVE_LEADER : 0));
}

export function newEnemy(def: EnemyDef, danger = 1): Enemy {
  const edge = dangerEdge(danger);
  const { hp, defense } = toughened(def.hp, def.defense, danger);
  return { def, hp, maxHp: hp, attack: def.attack + edge, damage: def.damage + edge, defense, dead: false, fled: false, downed: [], ...(def.plates ? { plates: def.plates } : {}) };
}

/** Blows a round: the Shepherd's two (3.0.0), or two from one that's enraged at half its HP (3.12.0). */
function blowsOf(e: Enemy): number {
  return e.def.attacks ?? (e.def.enrages && e.hp * 2 <= e.maxHp ? 2 : 1);
}

/** Damage a hit does through armor: armor makes hits rarer, and only heavy armor takes something off them. */
export function damageThrough(damage: number, armor: number): number {
  return Math.max(1, damage - (armor >= HEAVY_ARMOR ? HEAVY_ARMOR_SOAK : 0));
}

export type CombatEnd = 'won' | 'withdrew' | 'stalemate' | 'routed';

const living = (enemies: readonly Enemy[]): Enemy[] => enemies.filter((e) => !e.dead && !e.fled && !e.down && !e.waiting);

/** On the ground and getting back up unless someone finishes it (2.4.0). */
const fallen = (enemies: readonly Enemy[]): Enemy[] => enemies.filter((e) => e.down !== undefined && !e.dead);

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
  let budget = encounterBudget(sim);

  const out: Enemy[] = [];
  if (nemesis) {
    const e = nemesisEnemy(nemesis, sim.loc.danger);
    out.push(e);
    budget -= e.def.threat * NEMESIS_HP_MULT;
  }
  // A patcher or a firebug comes along now and then (3.8.0), bought first so there's room for it.
  const support = encounter.support;
  if (support && sim.rng.chance(support.chance)) {
    const def = getEnemy(sim.rng.pick(support.ids));
    if (def.threat <= budget) {
      out.push(newEnemy(def, sim.loc.danger));
      budget -= def.threat;
    }
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

/** What a fight here buys with, for the size of the crew. */
export function encounterBudget(sim: Sim): number {
  const crewMult = ENCOUNTER_CREW_MULT[Math.min(standing(sim).length, ENCOUNTER_CREW_MULT.length) - 1] ?? 1;
  return (ENCOUNTER_BASE + sim.loc.danger * ENCOUNTER_PER_DANGER) * crewMult;
}

/** An elite's company (3.12.0): what's left of the budget buys more of its kind, from the place's own encounters. */
export function escortFor(sim: Sim, budget: number, type: string): Enemy[] {
  const table = sim.loc.encounters.filter((e) => e.enemies.some((id) => getEnemy(id).type === type));
  if (table.length === 0) return [];
  const encounter = sim.rng.weightedBy(table, (e) => e.weight);
  const defs = encounter.enemies.map(getEnemy).filter((d) => d.type === type);
  const out: Enemy[] = [];
  let left = budget;
  while (out.length < MAX_ENEMIES - 1) {
    const affordable = defs.filter((d) => d.threat <= left);
    if (affordable.length === 0) break;
    const def = sim.rng.pick(affordable);
    out.push(newEnemy(def, sim.loc.danger));
    left -= def.threat;
  }
  return out;
}

/** "three Rad-hounds", "a Raider Gunner and two Raider Scavs", "Old Notch and a Rad-hound". */
export function describeGroup(all: readonly Enemy[]): string {
  // Those still behind a door (2.5.0) aren't part of it yet.
  const enemies = all.filter((e) => !e.waiting);
  const parts: string[] = enemies.filter((e) => e.nemesis || e.vulture || e.def.elite).map((e) => e.nemesis?.name ?? e.vulture?.name ?? withArticle(e.def.name));
  const counts = new Map<EnemyDef, number>();
  for (const e of enemies) if (!e.nemesis && !e.vulture && !e.def.elite) counts.set(e.def, (counts.get(e.def) ?? 0) + 1);
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
  /** Their nerve, when any of them can break. */
  morale?: Morale;
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
  const extra =
    toHit +
    (sim.plan.approach === 'aggressive' ? AGGRESSIVE_ATTACK_BONUS : 0) +
    grudgeBonus(m, target) +
    (mods.toHit ?? 0) +
    (aimed ? AIM_TO_HIT : 0) +
    machines +
    (target.offBalance ? OFF_BALANCE_TO_HIT : 0);
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

  // A plate takes the hit instead (3.12.0): it comes off, and the next one gets through.
  if (target.plates) {
    target.plates -= 1;
    act(sim, { by: m.s.id, at, kind: 'plate', shot: ranged, amount: target.plates });
    const left = target.plates === 0 ? `, and that was the last of them` : '';
    if (ctx.commanded || target.plates === 0) say(sim, `${m.s.firstName} ${hitVerb} ${ctx.commanded ? label : withArticle(target.def.name)} and knocks a plate off${left}.`, { tone: 'good' });
    return;
  }
  const raw = (damage + (mods.damage ?? 0) + (aimed ? AIM_DAMAGE : 0)) * (mods.double ? 2 : 1);
  const dealt = Math.max(1, raw - (mods.throughArmor ? 0 : target.def.armor));
  target.hp -= dealt;
  // Put down or stunned, it lets go of whoever it holds (3.8.0), once the blow is told. A plain hit doesn't do it: that takes a shove.
  const loosen = (): void => {
    if (target.hp > 0 && !mods.stun) return;
    const freed = letGo(target);
    if (!freed) return;
    act(sim, { by: freed.s.id, kind: 'free', ok: true });
    say(sim, `${ctx.commanded ? capitalize(label) : capitalize(withArticle(target.def.name))} lets go of ${freed.s.firstName}.`, { tone: 'good' });
  };
  // A big hit shakes the rest of them.
  if (dealt >= BIG_HIT) loseNerve(ctx.morale, NERVE_BIG_HIT);
  if (target.hp > 0) {
    if (mods.stun) target.stunned = true;
    act(sim, { by: m.s.id, at, kind: 'hit', amount: dealt, shot: ranged, ...(mods.stun ? { stun: true } : {}) });
    if (ctx.commanded) say(sim, `${m.s.firstName} ${hitVerb} ${label} (-${dealt})${mods.stun ? ', and it reels' : ''}.`, { tone: 'good' });
    loosen();
    maybeNemesisEscape(sim, target);
    if (target.fled) act(sim, { by: at, kind: 'escape' }, true);
    return;
  }
  // One that gets back up (a hollow) drops the first time instead (2.4.0).
  if (target.def.rises && !target.rose && !target.nemesis) {
    target.hp = 0;
    target.down = { round: ctx.round, by: m, ranged };
    target.stunned = false;
    act(sim, { by: m.s.id, at, kind: 'hit', amount: dealt, shot: ranged, down: true });
    say(sim, `${m.s.firstName} ${ranged ? 'drops' : 'knocks down'} ${ctx.commanded ? label : withArticle(target.def.name)}. It's still moving.`, { tone: 'good' });
    loosen();
    return;
  }
  act(sim, { by: m.s.id, at, kind: 'kill', amount: dealt, shot: ranged });
  creditKill(sim, m, target, ctx, ranged, ranged ? 'drops' : 'takes down');
  loosen();
}

/** One of them dead for good: the kill goes to `m` (counters, the weapon's tally, a nemesis's end) and a line says so. */
function creditKill(sim: Sim, m: Member, target: Enemy, ctx: AttackContext, ranged: boolean, verb: string, say_ = true): void {
  const weapon = m.s.equipment.weapon;
  const label = ctx.names[ctx.enemies.indexOf(target)] ?? target.def.name;
  target.dead = true;
  target.down = undefined;
  fell(ctx.morale, target);
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
  if (say_) say(sim, `${m.s.firstName} ${verb} ${ctx.commanded ? label : withArticle(target.def.name)} ${how}.`, { tone: 'good' });
  // An elite's end (3.12.0): its last moment, and its prize.
  if (target.def.elite) eliteKilled(sim, m, target);
}

/** A blow at one on the ground (2.4.0): it can't miss, and it stays down. */
function finishOff(sim: Sim, m: Member, target: Enemy, ctx: AttackContext): void {
  const ranged = attackKind(sim, m) === 'shoot';
  if (ranged && m.s.equipment.weapon && itemDef(m.s.equipment.weapon).usesAmmo) sim.ammo = Math.max(0, sim.ammo - 1);
  act(sim, { by: m.s.id, at: ctx.enemies.indexOf(target), kind: 'finish', shot: ranged });
  creditKill(sim, m, target, ctx, ranged, ranged ? 'puts a last shot into' : 'finishes');
}

/** Those on the ground since an earlier round get back up, with half their HP (2.4.0). */
function riseAgain(sim: Sim, fight: FightState, round: number, commanded: boolean): void {
  for (const e of fallen(fight.enemies)) {
    if (e.down!.round >= round) continue;
    e.down = undefined;
    e.rose = true;
    e.hp = Math.ceil(e.maxHp / 2);
    act(sim, { by: fight.enemies.indexOf(e), kind: 'rise', amount: e.hp });
    const label = commanded ? (fight.names[fight.enemies.indexOf(e)] ?? enemyRef(e)) : enemyRef(e);
    say(sim, `${label.charAt(0).toUpperCase()}${label.slice(1)} drags itself back up.`, { tone: 'bad' });
  }
}

/** When the fight is over, whatever is still on the ground stays there: the kill goes to whoever dropped it. */
function settleFallen(sim: Sim, enemies: readonly Enemy[], ctx: AttackContext): void {
  for (const e of fallen(enemies)) creditKill(sim, e.down!.by, e, ctx, e.down!.ranged, '', false);
}

// ---------------------------------------------------------------- enemy attacks

interface FightState {
  enemies: Enemy[];
  /** Names that tell enemies apart, for the lines of rounds under orders (§7.13). */
  names: string[];
  /** Members who went down during this fight. */
  downedHere: Member[];
  fledHere: Member[];
  /** Their nerve, when any of them can break (2.3.0). */
  morale?: Morale;
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

/** What the crew set up this round (§7.13): who is in cover, drawing fire, charging or guarding, and the enemy spotted. On their own, only cover: someone with nothing in reach keeps down. */
interface Tactics {
  cover: Set<Member>;
  drawFire: Set<Member>;
  charging: Set<Member>;
  /** Guarded ally → the one guarding them. */
  guards: Map<Member, Member>;
  spotted?: Enemy;
  spotter?: Member;
}

/** Who an enemy can go for: anyone in the fight it can reach. Lookouts on the Watchtower are out of reach (§9.8). */
function reachableBy(sim: Sim, enemy: Enemy): Member[] {
  const crew = active(sim).filter((m) => !m.perch);
  return crew.filter((m) => enemyReaches(enemy, m, crew));
}

/** How much an enemy wants to go for someone: the Brave draw it, and raiders with a score to settle go for that person (§9.8). */
function attention(sim: Sim, enemy: Enemy, m: Member): number {
  return mulTraitHook(m.s, 'attentionWeight') * (sim.gate?.marked === m.s.id && enemy.def.type === 'raider' ? RAID_MARKED_WEIGHT : 1);
}

/**
 * What each enemy means to do this round (§7.4, 2.3.0), chosen before the crew
 * acts, so a commander sees it: a hit at someone, a big hit for those that wind
 * one up, or (hurt, with their nerve going) a run for it.
 */
function chooseIntents(sim: Sim, fight: FightState): void {
  settleGrips(fight.enemies);
  for (const enemy of fight.enemies) {
    enemy.intent = undefined;
    enemy.offBalance = false;
  }
  for (const enemy of fight.enemies) {
    if (enemy.dead || enemy.fled || enemy.down || enemy.stunned) continue;
    const morale = fight.morale;
    const canRun = enemy.def.morale === 'breaks' && !enemy.nemesis && !enemy.def.leader;
    if (canRun && morale && morale.nerve < RUN_NERVE && enemy.hp * 2 <= enemy.maxHp && sim.rng.chance(RUN_CHANCE)) {
      enemy.intent = { kind: 'run' };
      enemy.aiming = undefined;
      continue;
    }
    // One that went under comes up under someone, anyone, front or back (3.12.0).
    if (enemy.under) {
      const anyone = active(sim).filter((m) => !m.perch);
      if (anyone.length > 0) enemy.intent = { kind: 'surface', at: sim.rng.weightedBy(anyone, (m) => attention(sim, enemy, m)) };
      continue;
    }
    // One with someone in its grip keeps at them (3.8.0).
    if (enemy.holding) {
      enemy.intent = { kind: 'hold', at: enemy.holding };
      continue;
    }
    // A shot lined up last round goes now, at the same one, if they're still up (3.8.0).
    const lined = enemy.aiming;
    enemy.aiming = undefined;
    if (lined && !lined.down && !lined.dead && !lined.fled && reachableBy(sim, enemy).includes(lined)) {
      enemy.intent = { kind: 'shot', at: lined };
      continue;
    }
    // A patcher mends the worst hurt of its own (3.8.0).
    if (enemy.def.mends) {
      const hurt = living(fight.enemies).filter((o) => o !== enemy && o.hp <= o.maxHp * MEND_BELOW);
      const ally = hurt.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (ally) {
        enemy.intent = { kind: 'mend', ally };
        continue;
      }
    }
    // One that calls more in (3.12.0), while there are more to come.
    const calls = enemy.def.calls;
    if (calls && (enemy.called ?? 0) < calls.max && fight.enemies.some((o) => o.reserve && o.waiting) && sim.rng.chance(calls.chance)) {
      enemy.intent = { kind: 'call' };
      continue;
    }
    const targets = reachableBy(sim, enemy);
    if (targets.length === 0) continue;
    // One that goes under for a round (3.12.0), and lets go of whoever it holds to do it.
    if (enemy.def.dives && sim.rng.chance(enemy.def.dives)) {
      enemy.intent = { kind: 'dive' };
      continue;
    }
    // A sweep at whatever rank its mark stands in (3.12.0): a blow reaches the front, a gun anyone.
    if (enemy.def.sweeps && sim.rng.chance(enemy.def.sweeps)) {
      const at = sim.rng.weightedBy(targets, (m) => attention(sim, enemy, m));
      enemy.intent = { kind: 'sweep', at, rank: at.rank ?? 'front' };
      continue;
    }
    // A firebug throws at whatever rank its mark stands in (3.8.0).
    const throws = enemy.def.throws;
    if (throws && sim.rng.chance(throws.chance)) {
      const at = sim.rng.weightedBy(targets, (m) => attention(sim, enemy, m));
      enemy.intent = { kind: 'throw', at, rank: at.rank ?? 'front' };
      continue;
    }
    // A pack goes for one of the crew together (2.4.0).
    const packmate = enemy.def.pack ? fight.enemies.find((o) => o !== enemy && o.def.pack && o.intent?.kind === 'strike' && o.intent.at && targets.includes(o.intent.at)) : undefined;
    const at = packmate?.intent?.at ?? sim.rng.weightedBy(targets, (m) => attention(sim, enemy, m));
    // A shooter may line one up for next round instead (3.8.0).
    if (enemy.def.aims && sim.rng.chance(enemy.def.aims)) {
      enemy.intent = { kind: 'aim', at };
      continue;
    }
    // A hollow may go for a grip on someone in front, if nobody has them already (3.8.0).
    if (enemy.def.grabs && !at.heldBy && !fight.enemies.some((o) => o.intent?.kind === 'grab' && o.intent.at === at) && sim.rng.chance(enemy.def.grabs)) {
      enemy.intent = { kind: 'grab', at };
      continue;
    }
    const heavy = enemy.def.heavy !== undefined && sim.rng.chance(enemy.def.heavy);
    enemy.intent = { kind: heavy ? 'heavy' : 'strike', at };
    // A second blow goes at someone else when it can (3.0.0). Only enemies that strike twice roll for it, so every other fight is as it was.
    if (blowsOf(enemy) > 1) {
      const others = targets.filter((m) => m !== at);
      enemy.intent.also = others.length > 0 ? sim.rng.weightedBy(others, (m) => attention(sim, enemy, m)) : at;
    }
  }
}

/** How much a pack helps one of its own hit someone this round: +1 for each other one going for them, up to +2 (2.4.0). */
function packBonus(enemy: Enemy, target: Member, enemies: readonly Enemy[]): number {
  if (!enemy.def.pack) return 0;
  const others = living(enemies).filter((o) => o !== enemy && o.def.pack && !o.stunned && o.intent?.kind !== 'run' && o.intent?.at === target).length;
  return Math.min(PACK_TO_HIT_MAX, others);
}

function enemyRound(sim: Sim, fight: FightState, tactics: Tactics, commanded: boolean): void {
  for (const enemy of living(fight.enemies)) {
    const label = commanded ? (fight.names[fight.enemies.indexOf(enemy)] ?? enemyRef(enemy)) : enemyRef(enemy);
    const index = fight.enemies.indexOf(enemy);
    // A stunned enemy loses this attack, and whatever it had lined up (3.8.0).
    if (enemy.stunned) {
      enemy.stunned = false;
      enemy.aiming = undefined;
      act(sim, { by: index, kind: 'reel' });
      continue;
    }
    const intent = enemy.intent;
    // One that meant to run, does (2.3.0).
    if (intent?.kind === 'run') {
      enemy.fled = true;
      loseNerve(fight.morale, (fight.morale?.perDeath ?? 0) / 2);
      act(sim, { by: index, kind: 'break' });
      say(sim, `${capitalize(label)} breaks away and runs.`);
      continue;
    }
    // Shoved or pinned down, it lost what it was winding up (3.8.0).
    if (!intent) continue;
    // Lining up a shot for next round (3.8.0).
    if (intent.kind === 'aim' && intent.at) {
      enemy.aiming = intent.at;
      act(sim, { by: index, at: intent.at.s.id, kind: 'aim' });
      if (commanded) say(sim, `${capitalize(label)} lines up a shot at ${intent.at.s.firstName}.`);
      continue;
    }
    if (intent.kind === 'mend') {
      mend(sim, fight, enemy, intent.ally, label, commanded);
      continue;
    }
    if (intent.kind === 'throw') {
      firebomb(sim, fight, enemy, intent.rank ?? 'front', label, tactics);
      continue;
    }
    // More of them, called in (3.12.0).
    if (intent.kind === 'call') {
      callIn(sim, fight, enemy, label);
      continue;
    }
    if (intent.kind === 'sweep') {
      sweep(sim, fight, enemy, intent.rank ?? 'front', label, tactics);
      continue;
    }
    // Under, out of reach until next round (3.12.0).
    if (intent.kind === 'dive') {
      const freed = letGo(enemy);
      if (freed) act(sim, { by: freed.s.id, kind: 'free', ok: true });
      enemy.under = true;
      act(sim, { by: index, kind: 'dive' });
      say(sim, `${capitalize(label)} slides under the water${freed ? `, letting go of ${freed.s.firstName}` : ''}.`);
      continue;
    }
    if (intent.kind === 'surface') {
      enemy.under = false;
      act(sim, { by: index, kind: 'surface' });
    }
    // Its teeth in the one it holds: no roll (3.8.0). Let go of in the meantime, it lost its turn.
    if (intent.kind === 'hold') {
      const held = enemy.holding;
      if (held && held === intent.at) bite(sim, fight, enemy, held, label);
      continue;
    }
    // Most strike once a round; the Shepherd strikes twice (3.0.0), and one enraged at half its HP (3.12.0). Its big hit is the first blow.
    const blows = blowsOf(enemy);
    const surfacing = intent.kind === 'surface';
    for (let blow = 0; blow < blows; blow++) {
      // Coming up from under, it can get at anyone (3.12.0).
      const targets = surfacing && blow === 0 ? active(sim).filter((m) => !m.perch) : reachableBy(sim, enemy);
      if (targets.length === 0) {
        if (active(sim).length === 0) return;
        break;
      }
      // Who it meant to hit, if it still can; or else someone it can reach now.
      const aim = blow === 0 ? intent?.at : intent?.also;
      let target = aim && targets.includes(aim) ? aim : sim.rng.weightedBy(targets, (m) => attention(sim, enemy, m));
      // Someone drawing fire pulls it their way.
      const drawing = targets.filter((m) => tactics.drawFire.has(m));
      if (drawing.length > 0 && !drawing.includes(target)) target = drawing[0]!;
      const guard = tactics.guards.get(target);
      if (guard && !guard.down && !guard.dead && !guard.fled) target = guard;
      const armor = target.s.equipment.armor ? armorValue(target.s.equipment.armor) : 0;
      const extra =
        (tactics.cover.has(target) ? COVER_DEFENSE : 0) +
        (tactics.drawFire.has(target) ? DRAW_FIRE_DEFENSE : 0) -
        (tactics.charging.has(target) ? CHARGE_BONUS : 0) +
        (sim.gate?.wall ? WALL_COVER : 0) +
        (sim.gate?.shored ? RAID_SHORE_COVER : 0);
      const shot = /shot|zapped/.test(enemy.def.hitVerb);
      // Coming up from under is a big hit too (3.12.0).
      const heavy = blow === 0 && (intent?.kind === 'heavy' || surfacing);
      if (blow === 0 && surfacing) say(sim, `${capitalize(label)} comes up out of the water under ${target.s.firstName}.`, { tone: 'bad' });
      // A shot lined up the round before (3.8.0).
      const lined = blow === 0 && intent?.kind === 'shot';
      const toHit = (heavy ? HEAVY_TO_HIT : 0) + (lined ? LINED_UP_TO_HIT : 0) + packBonus(enemy, target, fight.enemies);
      if (sim.rng.d10() + enemy.attack + toHit < SURVIVOR_DEFENSE + armor + extra) {
        act(sim, { by: index, at: target.s.id, kind: 'miss', shot });
        if (commanded && heavy) say(sim, `${capitalize(label)}'s big hit misses ${target.s.firstName}.`);
        if (commanded && lined) say(sim, `${capitalize(label)}'s careful shot misses ${target.s.firstName}.`);
        if (commanded && blow === 0 && intent?.kind === 'grab') say(sim, `${capitalize(label)} grabs at ${target.s.firstName} and misses.`);
        continue;
      }

      const damage = damageThrough(enemy.damage * (heavy ? HEAVY_HIT_MULT : lined ? LINED_UP_MULT : 1), armor);
      if (enemy.def.rads) absorbRads(target, enemy.def.rads);
      const wentDown = hurt(sim, target, damage, enemyRef(enemy), enemy.def.type, enemy.nemesis?.id);
      act(sim, { by: index, at: target.s.id, kind: 'hit', amount: damage, shot, ...(wentDown ? { down: true } : {}) });
      say(sim, `${target.s.firstName} is ${heavy ? 'hit hard, ' : lined ? 'hit square, ' : ''}${enemy.def.hitVerb} ${label} (-${damage} HP)${wentDown ? ' and goes down.' : '.'}`, { tone: 'bad' });
      if (wentDown) {
        crewDown(sim, fight, enemy, target);
      } else {
        // A grab that lands holds on (3.8.0).
        if (blow === 0 && intent?.kind === 'grab' && !target.heldBy && !enemy.holding) {
          target.heldBy = enemy;
          enemy.holding = target;
          act(sim, { by: index, at: target.s.id, kind: 'grab' });
          say(sim, `${capitalize(label)} has ${target.s.firstName} in its grip.`, { tone: 'bad' });
        }
        if (isHurt(target)) maybeFlee(sim, target, fight);
      }
    }
  }
}

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** One of the crew down: it gives the rest of them heart, and may shake the crew (2.3.0). */
function crewDown(sim: Sim, fight: FightState, enemy: Enemy, target: Member): void {
  if (fight.morale) fight.morale.nerve = Math.min(NERVE_FULL, fight.morale.nerve + NERVE_DOWN);
  enemy.downed.push(target);
  fight.downedHere.push(target);
  settleGrips(fight.enemies);
  for (const other of active(sim)) maybeFlee(sim, other, fight);
}

/** A patcher mends one of its own (3.8.0), if it's still there and still hurt. */
function mend(sim: Sim, fight: FightState, enemy: Enemy, ally: Enemy | undefined, label: string, commanded: boolean): void {
  if (!ally || ally.dead || ally.fled || ally.down || ally.hp >= ally.maxHp) return;
  const healed = Math.min(enemy.def.mends ?? 0, ally.maxHp - ally.hp);
  ally.hp += healed;
  const at = fight.enemies.indexOf(ally);
  act(sim, { by: fight.enemies.indexOf(enemy), at, kind: 'mend', amount: healed });
  const name = commanded ? (fight.names[at] ?? enemyRef(ally)) : enemyRef(ally);
  say(sim, `${capitalize(label)} patches up ${name} (+${healed}).`, { tone: 'bad' });
}

/** A firebomb at a rank of the crew (3.8.0): everyone standing there is burned, half as badly in cover. */
function firebomb(sim: Sim, fight: FightState, enemy: Enemy, rank: Rank, label: string, tactics: Tactics): void {
  const throws = enemy.def.throws;
  if (!throws) return;
  const index = fight.enemies.indexOf(enemy);
  // Worse in dangerous places, like every hit (1.6.1).
  const burn = throws.damage + (enemy.damage - enemy.def.damage);
  const there = active(sim).filter((m) => !m.perch && (m.rank ?? 'front') === rank);
  act(sim, { by: index, kind: 'throw' });
  if (there.length === 0) {
    say(sim, `${capitalize(label)} throws a firebomb. It bursts where nobody is standing.`, { tone: 'good' });
    return;
  }
  say(sim, `${capitalize(label)} throws a firebomb ${rank === 'front' ? 'into the front' : 'over them, into the back'}.`, { tone: 'bad' });
  for (const m of there) {
    const armor = m.s.equipment.armor ? armorValue(m.s.equipment.armor) : 0;
    const covered = tactics.cover.has(m);
    const damage = damageThrough(covered ? Math.max(1, Math.floor(burn / 2)) : burn, armor);
    const wentDown = hurt(sim, m, damage, enemyRef(enemy), enemy.def.type, enemy.nemesis?.id);
    act(sim, { by: index, at: m.s.id, kind: 'burn', amount: damage, ...(wentDown ? { down: true } : {}) });
    say(sim, `${m.s.firstName} is burned (-${damage} HP)${covered ? ', down behind cover' : ''}${wentDown ? ' and goes down.' : '.'}`, { tone: 'bad' });
    if (wentDown) crewDown(sim, fight, enemy, m);
    else if (isHurt(m)) maybeFlee(sim, m, fight);
  }
}

/** One more of them comes to the call (3.12.0), from those waiting off the stage. */
function callIn(sim: Sim, fight: FightState, enemy: Enemy, label: string): void {
  const calls = enemy.def.calls;
  const next = fight.enemies.find((o) => o.reserve && o.waiting);
  if (!calls || !next) return;
  next.waiting = false;
  enemy.called = (enemy.called ?? 0) + 1;
  act(sim, { by: fight.enemies.indexOf(enemy), kind: 'call' });
  act(sim, { by: fight.enemies.indexOf(next), kind: 'arrive' });
  say(sim, `${capitalize(label)} ${calls.how}, and ${withArticle(next.def.name)} ${calls.comes}.`, { tone: 'bad' });
}

/** A sweep at a rank of the crew (3.12.0): its hit on everyone standing there, no roll, half in cover. */
function sweep(sim: Sim, fight: FightState, enemy: Enemy, rank: Rank, label: string, tactics: Tactics): void {
  const index = fight.enemies.indexOf(enemy);
  const there = active(sim).filter((m) => !m.perch && (m.rank ?? 'front') === rank);
  act(sim, { by: index, kind: 'sweep' });
  const gun = enemy.def.ranged === true;
  const where = rank === 'front' ? 'the front' : 'the back';
  if (there.length === 0) {
    say(sim, `${capitalize(label)} ${gun ? `rakes ${where} with fire` : `sweeps ${where}`}, where nobody is standing.`, { tone: 'good' });
    return;
  }
  say(sim, `${capitalize(label)} ${gun ? `rakes ${where} with fire` : `sweeps through ${where}`}.`, { tone: 'bad' });
  for (const m of there) {
    const armor = m.s.equipment.armor ? armorValue(m.s.equipment.armor) : 0;
    const covered = tactics.cover.has(m);
    const damage = damageThrough(covered ? Math.max(1, Math.floor(enemy.damage / 2)) : enemy.damage, armor);
    if (enemy.def.rads) absorbRads(m, enemy.def.rads);
    const wentDown = hurt(sim, m, damage, enemyRef(enemy), enemy.def.type, enemy.nemesis?.id);
    act(sim, { by: index, at: m.s.id, kind: 'hit', amount: damage, shot: gun, ...(wentDown ? { down: true } : {}) });
    say(sim, `${m.s.firstName} is ${enemy.def.hitVerb} ${label} (-${damage} HP)${covered ? ', down behind cover' : ''}${wentDown ? ' and goes down.' : '.'}`, { tone: 'bad' });
    if (wentDown) crewDown(sim, fight, enemy, m);
    else if (isHurt(m)) maybeFlee(sim, m, fight);
  }
}

/** A hollow's teeth in the one it holds (3.8.0): no roll. */
function bite(sim: Sim, fight: FightState, enemy: Enemy, held: Member, label: string): void {
  const armor = held.s.equipment.armor ? armorValue(held.s.equipment.armor) : 0;
  const damage = damageThrough(enemy.damage, armor);
  if (enemy.def.rads) absorbRads(held, enemy.def.rads);
  const wentDown = hurt(sim, held, damage, enemyRef(enemy), enemy.def.type, enemy.nemesis?.id);
  act(sim, { by: fight.enemies.indexOf(enemy), at: held.s.id, kind: 'hit', amount: damage, ...(wentDown ? { down: true } : {}) });
  say(sim, `${held.s.firstName}, in its grip, is ${enemy.def.hitVerb} ${label} (-${damage} HP)${wentDown ? ' and goes down.' : '.'}`, { tone: 'bad' });
  if (wentDown) crewDown(sim, fight, enemy, held);
}

/** The guild's dog joins in at the gate (§9.8): a bite at whichever raider is closest to the people. */
function dogBite(sim: Sim, enemies: readonly Enemy[], ctx: AttackContext): void {
  const name = sim.gate!.dog!;
  const targets = living(enemies).filter((e) => reaches(false, 'front', e, enemies));
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
  fell(ctx.morale, target);
  say(sim, `${name} brings ${label} down.`, { tone: 'good' });
}

/** Enemies that can break do so once their nerve is gone (2.3.0; before, once more than half the group was dead). Returns true if any ran. */
function checkMorale(sim: Sim, fight: FightState): boolean {
  if (!fight.morale || fight.morale.nerve > 0) return false;
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
    chooseIntents(sim, fight);
    enemyRound(sim, fight, noTactics(), false);
  }
}

// ---------------------------------------------------------------- the fight

export interface FightStart {
  ambushed: boolean;
  drop: boolean;
  /** How many rounds before it's called a stalemate: MAX_COMBAT_ROUNDS, or more for Haven's gate (3.0.0). */
  rounds?: number;
}

export interface FightResult {
  end: CombatEnd;
  /** Loot from the bodies, if the crew held the field. */
  loot: Partial<Record<ResourceId, number>>;
}

// ---------------------------------------------------------------- commanded fights (§7.13)

/**
 * Whether a crew on a led run calls home for this fight (3.10.0): `'yes'` at
 * every fight (or a raid, or the road east), `'no'` for a fight they handle
 * alone, `'grave'` when left alone someone would die (the call says so).
 */
type Call = 'yes' | 'no' | 'grave';

/**
 * A run that calls when it matters (`RunPlan.lead === 'matters'`, the
 * planner's default since 3.10.0) calls for a named foe (a nemesis, one of the
 * Vultures' named people), and for any fight that, fought alone, would put
 * someone down. The fight is played ahead on a copy of the run, with its own
 * copy of the dice, so the run itself is untouched and every replay comes to
 * the same answer. Decided before the fight rolls anything.
 */
function whetherToCall(sim: Sim, enemies: readonly Enemy[], start: FightStart): Call {
  if (!sim.lead || sim.lead.home || sim.plan.lead !== 'matters') return 'yes';
  // A new guild's first trip always calls: it's the player's first fight to lead (3.14.0).
  if (sim.plan.first) return 'yes';
  const ahead = foughtAlone(sim, enemies, start);
  if (ahead.dies) return 'grave';
  return ahead.down || enemies.some((e) => e.nemesis || e.vulture || e.def.elite) ? 'yes' : 'no';
}

/** The fight played ahead on a copy, the crew on their own: does anyone go down, and does anyone die of it? */
function foughtAlone(sim: Sim, enemies: readonly Enemy[], start: FightStart): { down: boolean; dies: boolean } {
  const { rng, lead: _lead, fightActs: _acts, ...rest } = sim;
  // One copy of both, so the enemies' hold on the crew (a grip, a target) points at the copy's people.
  const [data, foes] = structuredClone([rest, enemies] as const);
  const copy: Sim = { ...data, rng: new Rng(rng.getState()) };
  const theirs = copy.members.filter((m) => !m.ally && !m.dead);
  const before = new Map(theirs.map((m) => [m, m.s.counters.timesDowned]));
  fight(copy, [...foes], start);
  const down = theirs.some((m) => m.dead || m.s.counters.timesDowned > before.get(m)!);
  if (!down) return { down: false, dies: false };
  resolveWounds(copy);
  return { down, dies: theirs.some((m) => m.dead) };
}

/**
 * On a run the player leads, the crew stops at a fight and calls home. Returns
 * the player's part in it, or undefined when they fight on their own (nobody
 * came within the wait, or the run isn't led). The fight itself goes in a new
 * beat, at the time it was fought.
 */
function callHome(sim: Sim, enemies: readonly Enemy[], call: Call): FightPlan | undefined {
  const lead = sim.lead;
  if (!lead || call === 'no') return undefined;
  if (lead.home) {
    // A raid at the Depot (§9.8): the player is there or isn't; nobody calls.
    const plan = lead.plans[lead.stops.length] ?? standIn(lead);
    lead.stops.push({ at: sim.offset, by: standing(sim)[0]?.s.id ?? '', against: describeGroup(enemies), fromBeat: sim.beats.length });
    startBeat(sim, 'combat', 'At the gate');
    if (plan && (plan.rounds.length > 0 || plan.live)) say(sim, 'You take command at the gate.');
    return plan;
  }
  // One of the guild calls, never a Vulture beside them (§9.12).
  const caller = bestBy(standing(sim).filter((m) => !m.ally), (m) => simBonus(sim, m, 'nerve', []));
  if (!caller) return undefined;
  const plan = lead.plans[lead.stops.length] ?? standIn(lead);
  const kind = sim.beats.at(-1)?.kind ?? 'combat';
  // On the road east nobody is left at the Depot to call (§9.12): they wait for the word.
  const road = sim.plan.job === 'haven';
  say(sim, road ? `${caller.s.firstName} calls a halt, and they wait for the word.` : `${caller.s.firstName} gets on the radio to the Depot.`);
  lead.stops.push({ at: sim.offset, by: caller.s.id, against: describeGroup(enemies), fromBeat: sim.beats.length, ...(sim.site ? { site: sim.site } : {}), ...(call === 'grave' ? { grave: true } : {}), ...(enemies.find((e) => e.def.elite) ? { elite: enemies.find((e) => e.def.elite)!.def.id } : {}) });
  const solo = sim.members.length === 1;
  if (!plan) {
    sim.delay += LEAD_WAIT;
    sim.offset += LEAD_WAIT;
    startBeat(sim, kind, road ? 'No word' : 'No word from home');
    say(sim, road ? 'Half an hour waiting for the word, and none comes. They go in on their own.' : solo ? `Half an hour by the radio, and no word. ${caller.s.firstName} goes in alone.` : 'Half an hour by the radio, and no word. They go in on their own.', { tone: 'bad' });
    return undefined;
  }
  // Under command the fight is played as the orders come in; once it's over, at the time it ended.
  const wait = plan.live ? 0 : plan.delay;
  sim.delay += wait;
  sim.offset += wait;
  startBeat(sim, kind, plan.rounds.length > 0 || plan.live ? 'Under orders' : 'Word from home');
  const commanded = plan.rounds.length > 0 || plan.live;
  if (road) say(sim, commanded ? 'The word comes, and they go in.' : 'The word comes: fight it out.');
  else say(sim, commanded ? 'Orders come over the radio.' : solo ? `Word from home: fight it out. ${caller.s.firstName} goes in.` : 'Word from home: fight it out.');
  return plan;
}

/** A stand-in for the player (tests and measuring, 3.8.0): every fight is under command, with no wait. */
function standIn(lead: SimLead): FightPlan | undefined {
  return lead.commander ? { rounds: [], live: false, delay: 0 } : undefined;
}

function noTactics(): Tactics {
  return { cover: new Set(), drawFire: new Set(), charging: new Set(), guards: new Map() };
}

/** The orders that set things up before anyone swings: where people stand, cover, drawing fire, charging, guarding, spotting, aiming. */
function prepareRound(sim: Sim, enemies: readonly Enemy[], orders: RoundOrders): Tactics {
  const t = noTactics();
  // Where people stand comes first: it decides what they can reach (2.3.0).
  for (const m of active(sim)) {
    const rank = orders.ranks?.[m.s.id];
    // Someone in a hollow's grip stays where they are (3.8.0).
    if (rank && !m.perch && !m.heldBy) m.rank = rank;
  }
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
function talkDown(sim: Sim, m: Member, target: Enemy, at: number, label: string, move: 'intimidate' | 'soothe' | 'short_out', morale: Morale | undefined): void {
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
  if (move === 'short_out') {
    target.dead = true;
    fell(morale, target);
  } else {
    target.fled = true;
    if (move === 'intimidate') loseNerve(morale, NERVE_TALKED);
  }
}

/** Carry out one person's order. Returns false if they can't, and should just fight as they would on their own. */
function actOnOrder(sim: Sim, m: Member, given: MoveOrder, enemies: readonly Enemy[], ctx: AttackContext, t: Tactics): boolean {
  let order = given;
  let choice = validOrder(sim, m, enemies, order.move, order.target);
  // Their target went down or ran before their turn: the same move, at the enemy next to it.
  if (!choice && typeof order.target === 'number') {
    const same = movesFor(sim, m, enemies).find((c) => c.move === order.move && c.target === 'enemy' && c.targets.length > 0);
    const was = order.target;
    const next = same?.targets.map(Number).sort((a, b) => Math.abs(a - was) - Math.abs(b - was))[0];
    if (same && next !== undefined) {
      order = { ...order, target: next };
      choice = same;
      const he = pronounForms(m.s.pronouns).they;
      say(sim, `${m.s.firstName}'s target is gone. ${he[0]!.toUpperCase()}${he.slice(1)} turns to ${ctx.names[next] ?? enemies[next]!.def.name}.`);
    }
  }
  if (!choice) return false;
  const foe = typeof order.target === 'number' ? enemies[order.target] : undefined;
  const spot = foe && t.spotted === foe && t.spotter !== m ? SPOT_TO_HIT : 0;
  switch (order.move) {
    case 'attack':
      survivorAttack(sim, m, foe!, ctx, { toHit: spot });
      return true;
    case 'finish':
      finishOff(sim, m, foe!, ctx);
      return true;
    case 'job':
      act(sim, { by: m.s.id, kind: 'job', amount: workGoal(sim, m, sim.goal!) });
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
      talkDown(sim, m, foe!, order.target as number, ctx.names[order.target as number] ?? foe!.def.name, order.move, ctx.morale);
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
    case 'shove':
      shove(sim, m, foe!, ctx);
      return true;
    case 'break_free':
      breakFree(sim, m);
      return true;
  }
}

/**
 * A shove, or a shot to pin it down (3.8.0): no harm, but it breaks what the enemy was winding up (a big hit,
 * a lined-up shot, a mend, a firebomb, a grab, a grip), and it's off balance: the others hit it more easily
 * this round. A firebug drops its bomb at its own feet.
 */
function shove(sim: Sim, m: Member, target: Enemy, ctx: AttackContext): void {
  const shot = attackKind(sim, m) === 'shoot';
  const weapon = m.s.equipment.weapon;
  const def = weapon ? itemDef(weapon) : undefined;
  if (shot && def?.usesAmmo) sim.ammo -= 1;
  const stat: StatId = shot ? 'aim' : 'brawn';
  const at = ctx.enemies.indexOf(target);
  const label = ctx.names[at] ?? target.def.name;
  const bonus = simBonus(sim, m, stat, ['combat', ...enemyContexts(m.s, target.def.type)], { extra: SHOVE_TO_HIT + (weapon && def ? (def.toHit ?? 0) + qualityMod(weapon) : 0) });
  practice(sim, m, stat, target.defense);
  if (sim.rng.d10() + bonus < target.defense) {
    act(sim, { by: m.s.id, at, kind: 'shove', ok: false, shot });
    say(sim, shot ? `${m.s.firstName} fires to pin ${label} down, and misses.` : `${m.s.firstName} tries to shove ${label} and can't.`);
    return;
  }
  target.offBalance = true;
  const was = target.intent?.kind;
  const spoils = was !== undefined && WIND_UPS.includes(was);
  act(sim, { by: m.s.id, at, kind: 'shove', ok: true, shot });
  const what =
    was === 'heavy'
      ? 'and the big hit goes nowhere'
      : was === 'aim' || was === 'shot'
        ? 'and it loses its aim'
        : was === 'mend'
          ? 'and the meds go flying'
          : was === 'grab'
            ? 'before it can grab anyone'
            : was === 'hold'
              ? `and it lets go of ${target.holding?.s.firstName ?? 'them'}`
              : was === 'throw'
                ? 'and it drops the firebomb at its own feet'
                : was === 'call'
                  ? 'before it can call anyone'
                  : was === 'sweep'
                    ? 'and the sweep goes wide'
                    : was === 'dive'
                      ? 'before it can go under'
                      : 'off balance';
  say(sim, `${m.s.firstName} ${shot ? 'pins' : 'shoves'} ${label} ${spoils ? `back, ${what}` : 'off balance'}.`, { tone: 'good' });
  if (!spoils) return;
  if (was === 'hold') {
    const freed = letGo(target);
    if (freed) act(sim, { by: freed.s.id, kind: 'free', ok: true });
  }
  target.aiming = undefined;
  target.intent = undefined;
  if (was === 'throw' && target.def.throws) {
    // Its own firebomb, at its own feet.
    const burn = target.def.throws.damage + (target.damage - target.def.damage);
    target.hp -= burn;
    if (target.hp > 0) {
      act(sim, { by: at, at, kind: 'burn', amount: burn });
      return;
    }
    act(sim, { by: at, at, kind: 'burn', amount: burn });
    creditKill(sim, m, target, ctx, shot, shot ? 'drops' : 'takes down', false);
    say(sim, `${capitalize(label)} goes up in its own fire.`, { tone: 'good' });
  }
}

/** Wrenching out of a hollow's grip (3.8.0): Brawn against 8 + danger. */
function breakFree(sim: Sim, m: Member): void {
  const holder = m.heldBy;
  if (!holder) return;
  const result = check(sim, m, 'brawn', BREAK_FREE_DC + sim.loc.danger, ['combat']);
  act(sim, { by: m.s.id, kind: 'free', ok: result.success });
  if (result.success) letGo(holder);
  say(sim, result.success ? `${m.s.firstName} wrenches free.` : `${m.s.firstName} can't get out of its grip.`, { check: result.info, tone: result.success ? 'good' : 'bad' });
}

/**
 * The blows coming at them this round would put them down, if they all landed
 * (2.3.0 for a big hit; 2.4.0 for a pack or a crowd): what someone on their own
 * takes cover from. A single ordinary hit isn't worth ducking.
 */
function blowsWouldDrop(m: Member, enemies: readonly Enemy[]): boolean {
  if (m.heldBy) return false;
  const armor = m.s.equipment.armor ? armorValue(m.s.equipment.armor) : 0;
  const up = living(enemies).filter((e) => !e.stunned && e.intent);
  // Blows and shots at them; a firebomb (3.8.0) at the rank they stand in.
  const coming = up.filter((e) => e.intent!.at === m && (e.intent!.kind === 'strike' || e.intent!.kind === 'heavy' || e.intent!.kind === 'shot' || e.intent!.kind === 'grab' || e.intent!.kind === 'surface'));
  // Since 3.12.0 a sweep at the rank too.
  const bombs = up.filter((e) => (e.intent!.kind === 'throw' || e.intent!.kind === 'sweep') && e.intent!.rank === (m.rank ?? 'front'));
  const big = (e: Enemy): boolean => e.intent!.kind === 'heavy' || e.intent!.kind === 'shot' || e.intent!.kind === 'surface';
  if (coming.length + bombs.length < 2 && !coming.some(big) && bombs.length === 0) return false;
  const hits = coming.reduce((sum, e) => sum + damageThrough(e.damage * (e.intent!.kind === 'heavy' || e.intent!.kind === 'surface' ? HEAVY_HIT_MULT : e.intent!.kind === 'shot' ? LINED_UP_MULT : 1), armor), 0);
  const burns = bombs.reduce((sum, e) => sum + damageThrough(e.intent!.kind === 'sweep' ? e.damage : (e.def.throws?.damage ?? 0) + (e.damage - e.def.damage), armor), 0);
  return hits + burns >= m.s.hp;
}

/**
 * On their own, how much more the crew goes for an enemy for what it's doing: one winding up a big hit or
 * lining up a shot, a patcher at work, a firebug, and most of all one with a friend in its grip (3.8.0).
 */
function pressing(e: Enemy): number {
  if (e.holding) return 4;
  const kind = e.intent?.kind;
  return kind === 'heavy' || kind === 'aim' || kind === 'shot' || kind === 'mend' || kind === 'throw' || kind === 'call' || kind === 'sweep' || kind === 'dive' ? 2 : 1;
}

/** What one of their ordinary blows does before armor, for choosing what's worth hitting. */
function attackDamage(sim: Sim, m: Member): number {
  const w = m.s.equipment.weapon;
  if (!w) return UNARMED_DAMAGE;
  const def = itemDef(w);
  if (def.weaponType === 'ranged' && def.usesAmmo && sim.ammo <= 0) return UNARMED_DAMAGE;
  return Math.max(1, weaponDamage(w));
}

/** Nobody still in the fight can reach any of them: what's left flies, and nobody can shoot (2.3.0). */
function cannotReach(sim: Sim, enemies: readonly Enemy[]): boolean {
  // One that's gone under comes up again (3.12.0): the fight isn't over.
  if (living(enemies).some((e) => e.under)) return false;
  const left = living(enemies);
  const crew = active(sim);
  if (left.length === 0 || crew.length === 0) return false;
  return crew.every((m) => {
    const shot = attackKind(sim, m) === 'shoot';
    return !left.some((e) => reaches(shot, 'front', e, enemies));
  });
}

/** The crew pulls out from what it can't reach, under fire, and drops part of what it found to get away (2.3.0). */
function outOfReach(sim: Sim, enemies: readonly Enemy[]): void {
  const left = describeGroup(living(enemies));
  const solo = sim.members.length === 1;
  const carried = Object.values(sim.loot).some((n) => n >= 1);
  for (const k of Object.keys(sim.loot) as (keyof typeof sim.loot)[]) sim.loot[k] *= 1 - UNREACHABLE_DROP;
  const one = active(sim)[0]!;
  const who = solo ? one.s.firstName : 'The crew';
  const found = solo ? `${pronounForms(one.s.pronouns).they} found` : 'they found';
  say(sim, `Nobody can reach ${left}. ${who} pulls out under fire${carried ? `, dropping a third of what ${found} to get away` : ''}.`, { tone: 'bad' });
}

export function fight(sim: Sim, enemies: Enemy[], start: FightStart): FightResult {
  // Does a led crew call home for this one (3.10.0)? Played ahead on a copy before anything here rolls.
  const call = whetherToCall(sim, enemies, start);
  // Some fights come with a job (2.5.0); a door brings more of them, waiting behind it. Not one with an elite (3.12.0): that's job enough.
  const goal = enemies.some((e) => e.def.elite) ? undefined : rollGoal(sim, enemies);
  sim.goal = goal;
  const present = enemies.filter((e) => !e.waiting).length;
  // A group that can break has nerve (2.3.0): with nothing else, they break once more than half are dead, as before.
  const breakers = enemies.some((e) => e.def.morale === 'breaks' && !e.nemesis);
  const morale: Morale | undefined = breakers ? { nerve: NERVE_FULL, perDeath: Math.ceil(NERVE_FULL / (Math.floor(present / 2) + 1)) } : undefined;
  const state: FightState = { enemies, names: enemyNames(enemies), downedHere: [], fledHere: [], ...(morale ? { morale } : {}) };
  // On a led run the crew stops here and calls home first (§7.13).
  const plan = callHome(sim, enemies, call);
  const fightFrom = sim.beats.at(-1)?.lines.length ?? 0;
  // A fight under command notes what happens, act by act, for the battle stage.
  sim.fightActs = plan ? { round: 0, acts: [] } : undefined;
  const attackCtx: AttackContext = { drop: false, ambushed: start.ambushed, round: 0, outOfAmmoSaid: new Set(), commanded: false, names: enemyNames(enemies), enemies, ...(morale ? { morale } : {}) };
  const enemyType = enemies[0]!.def.type;
  sim.hadCombat = true;
  // For a clean fight (3.10.0): who had gone down before this one.
  const downsBefore = new Map(sim.members.map((m) => [m, m.s.counters.timesDowned]));

  // Everyone steels themselves. Holding your nerve halves the stress of the fight.
  for (const m of standing(sim)) {
    m.fled = false;
    m.fleeRolled = false;
    // Those who can shoot start at the back, everyone else in front (2.3.0).
    m.rank = defaultRank(sim, m);
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

  const rounds = start.rounds ?? MAX_COMBAT_ROUNDS;
  sim.fightRounds = rounds;
  for (let round = 1; round <= rounds && !end; round++) {
    attackCtx.round = round;
    if (sim.fightActs) sim.fightActs.round = round;
    attackCtx.drop = start.drop && round === 1;
    const crewActs = !(start.ambushed && round === 1);

    // What they mean to do this round, before anyone moves: a commander sees it (2.3.0).
    // Caught off guard, they do nothing in the first round, so they show nothing (3.8.0).
    sim.caught = start.drop && round === 1;
    if (sim.caught) for (const e of enemies) e.intent = undefined;
    else chooseIntents(sim, state);

    let orders: RoundOrders | undefined;
    if (plan && crewActs) {
      orders = plan.rounds[given] ?? sim.lead?.commander?.(fightView(sim, enemies, round, fightFrom, undefined, morale?.nerve, goal && goalView(goal)));
      // Under command and out of orders: the fight waits for the next round's.
      if (!orders && plan.live) throw new FightPause(fightView(sim, enemies, round, fightFrom, undefined, morale?.nerve, goal && goalView(goal)));
      if (orders) given++;
    }
    attackCtx.commanded = orders !== undefined;
    const tactics = orders ? prepareRound(sim, enemies, orders) : noTactics();

    if (crewActs) {
      // Those on the ground someone is already finishing this round.
      const finishing = new Set<Enemy>();
      // Who of those on their own takes the job this round (2.5.0), unless the player put someone on it.
      // Not someone the blows coming at them would put down: they keep their head down instead.
      const onIt = orders !== undefined && Object.values(orders.moves).some((o) => o.move === 'job');
      const worker = goal && !onIt ? goalWorker(sim, goal, round, active(sim).filter((m) => !orders?.moves[m.s.id] && !blowsWouldDrop(m, enemies)), (m) => attackDamage(sim, m)) : undefined;
      // Shoves and pins go first, so the others get the good of them (3.8.0).
      const shoving = (m: Member): boolean => orders?.moves[m.s.id]?.move === 'shove';
      for (const m of [...active(sim).filter(shoving), ...active(sim).filter((x) => !shoving(x))]) {
        if (living(enemies).length === 0) break;
        if (m.down || m.dead || m.fled) continue;
        const order = orders?.moves[m.s.id];
        if (order && actOnOrder(sim, m, order, enemies, attackCtx, tactics)) continue;
        // On their own, someone in a grip tries to get out of it (3.8.0).
        if (m.heldBy) {
          breakFree(sim, m);
          continue;
        }
        if (m === worker && goal?.state === 'open') {
          act(sim, { by: m.s.id, kind: 'job', amount: workGoal(sim, m, goal) });
          continue;
        }
        const shot = attackKind(sim, m) === 'shoot';
        const from = m.perch ? 'back' : (m.rank ?? 'front');
        // On their own, one on the ground in reach gets finished before it's back up (2.4.0).
        const ground = fallen(enemies).find((e) => !finishing.has(e) && reaches(shot, from, e, enemies));
        if (ground) {
          finishing.add(ground);
          finishOff(sim, m, ground, attackCtx);
          continue;
        }
        // Someone the blows coming at them would put down keeps their head down.
        if (blowsWouldDrop(m, enemies)) {
          tactics.cover.add(m);
          if (attackCtx.commanded) say(sim, `${m.s.firstName} sees it coming and keeps down.`);
          continue;
        }
        // On their own: something in reach they can hurt, the hurt first and whatever is winding up a big hit next.
        const targets = living(enemies).filter((e) => reaches(shot, from, e, enemies));
        if (targets.length === 0) {
          // Nothing in reach (2.3.0): they keep their head down.
          tactics.cover.add(m);
          continue;
        }
        const blow = attackDamage(sim, m);
        const target = sim.rng.weightedBy(targets, (e) => (e.hp < e.maxHp ? 3 : 1) * pressing(e) * Math.max(1, blow - e.def.armor) / blow);
        survivorAttack(sim, m, target, attackCtx, tactics.spotted === target && tactics.spotter !== m ? { toHit: SPOT_TO_HIT } : {});
      }
      if (sim.gate?.dog) dogBite(sim, enemies, attackCtx);
      if (living(enemies).length === 0 || (checkMorale(sim, state) && living(enemies).length === 0)) {
        end = 'won';
        break;
      }
    }

    if (!(start.drop && round === 1)) enemyRound(sim, state, tactics, attackCtx.commanded);
    riseAgain(sim, state, round, attackCtx.commanded);
    // Through a door nobody held comes another one; a job past its time is lost (2.5.0).
    if (goal) for (const e of goalRoundEnds(sim, goal, round, enemies)) act(sim, { by: enemies.indexOf(e), kind: 'arrive' });

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
    // Out on a run, a crew that can't reach what's left (drones, and nobody who can shoot) has to get out, and leaves things behind (2.3.0).
    if (!sim.gate && cannotReach(sim, enemies)) {
      outOfReach(sim, enemies);
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
  sim.caught = false;
  for (const m of sim.members) {
    m.aimed = false;
    m.heldBy = undefined;
  }
  for (const e of enemies) {
    e.holding = undefined;
    e.aiming = undefined;
    e.offBalance = false;
    e.under = false;
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

  settleFallen(sim, enemies, attackCtx);
  if (goal) settleGoal(sim, goal, end === 'won');
  sim.goal = undefined;
  afterFight(sim, enemies);
  for (const e of enemies) e.intent = undefined;
  // A clean fight (3.10.0): the player led them to a win and nobody went down. It shows, and it pays.
  const clean = given > 0 && end === 'won' && sim.members.every((m) => m.ally || (!m.dead && m.s.counters.timesDowned === downsBefore.get(m)));
  if (clean) {
    const crew = alive(sim).filter((m) => !m.ally);
    // Picked without dice: the rest of the run rolls the same either way.
    const lines = crew.length === 1 ? CLEAN_FIGHT_LINES.solo : CLEAN_FIGHT_LINES.crew;
    const one = crew[0]!.s;
    const he = one.pronouns === 'he';
    const line = lines[(sim.beats.length + one.firstName.length + attackCtx.round) % lines.length]!;
    say(sim, line.replaceAll('{name}', one.firstName).replaceAll('{his}', he ? 'his' : 'her').replaceAll('{hers}', he ? 'his' : 'hers').replaceAll('{him}', he ? 'him' : 'her').replaceAll('{himself}', he ? 'himself' : 'herself'), { tone: 'good' });
    for (const m of crew) stress(sim, m, -CLEAN_FIGHT_RELIEF);
  }
  // A commanded fight as it ended, for the screen that shows how it went.
  if (plan && sim.lead) sim.lead.ends[sim.lead.stops.length - 1] = { ...fightView(sim, enemies, attackCtx.round, fightFrom, end, morale?.nerve, goal && goalView(goal)), ...(clean ? { clean: true } : {}) };
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
    // With nobody hurt, there's time to go through the bodies properly.
    if (clean) for (const res of Object.keys(loot) as ResourceId[]) loot[res] = Math.ceil(loot[res]! * CLEAN_FIGHT_LOOT);
  }
  return { end, loot };
}
