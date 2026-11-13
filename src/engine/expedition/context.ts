/**
 * Shared state and helpers for simulating one run. A Sim works on cloned
 * survivors, so nothing here touches the real GameState.
 */
import {
  BONDED_CHECK_BONUS,
  BONDED_STRESS_MULT,
  DC,
  PRACTICE_HARD,
  PRACTICE_NORMAL,
  PARTNER_DOWN_STRESS,
  STRESS_ALLY_DOWNED,
  STRESS_PER_DAMAGE,
  ENEMY_DANGER_STEP,
  ENEMY_TOUGH_FROM,
  ENEMY_TOUGH_HP,
} from '../constants.ts';
import { getTrait, type LocationDef, type RunTally, type VehicleDef } from '../content/index.ts';
import { dayAt } from '../game.ts';
import { mulGearHook, sumGearHook } from '../gear.ts';
import { arePartners, crewCohesion, getRelationship, relationshipLabel } from '../relationships.ts';
import type { CrewLines } from '../content/flavor.ts';
import type { Rng } from '../rng.ts';
import { addPractice, changeStress, checkBonus, maxHp, rollCheck, statName, type CheckResult } from '../stats.ts';
import { fillRoles } from '../text.ts';
import { mulTraitHook, revealTrait, sumTraitHook } from '../traits.ts';
import type {
  Animal,
  FoundNews,
  Beat,
  BeatKind,
  CheckInfo,
  GameState,
  ItemInstance,
  LogLine,
  Nemesis,
  NemesisNews,
  RescueTrouble,
  Resources,
  RunDeath,
  RunPlan,
  StatId,
  Survivor,
  TraitHooks,
  Vehicle,
  VultureMember,
  VultureNews,
} from '../types.ts';

export interface Member {
  s: Survivor;
  down: boolean;
  dead: boolean;
  /** Ran from the current fight. Reset when the fight ends. */
  fled: boolean;
  fleeRolled: boolean;
  /** Went down and still needs a wound roll. */
  woundPending?: { cause: string; enemyType?: string; nemesisId?: string };
  /** Name of the nemesis this member killed on the run, for nicknames. */
  killedNemesis?: string;
  /** Weapon kills at departure, to notice milestones. */
  weaponKillsAtStart: number;
  /** Counters and traits at departure: a nickname is earned on the run that crosses its mark, not on every run after. */
  countersAtStart: Survivor['counters'];
  traitsAtStart: string[];
  tally: RunTally;
  rerollFails: number;
  rerollSuccesses: number;
  /** Chronicle length at departure, to collect run highlights. */
  chronicleStart: number;
}

export interface Sim {
  /** A shell GameState holding only the cloned crew and their relationships. */
  state: GameState;
  rng: Rng;
  plan: RunPlan;
  loc: LocationDef;
  members: Member[];
  departAt: number;
  /** ms since departure of the beat being simulated. */
  offset: number;
  beats: Beat[];
  /** Fractional loot found so far. */
  loot: Resources;
  items: ItemInstance[];
  meds: number;
  ammo: number;
  mercy: boolean;
  hadCombat: boolean;
  /** The crew is heading home early. */
  turnBack: boolean;
  /** Everyone still alive is down; they crawl home with nothing. */
  routed: boolean;
  discovered: string[];
  deaths: RunDeath[];
  beatCounts: Partial<Record<BeatKind, number>>;
  /** Ids of the scripted events that happened on this run. */
  events: string[];
  /** Extra explored % earned from events. */
  exploreBonus: number;
  /** The guild's nemeses as they stand on this run (a copy; the real ones change when the crew is back). */
  nemeses: Nemesis[];
  /** What this run did to them, by nemesis id. */
  nemesisNews: Record<string, NemesisNews>;
  /** A nemesis already turned up on this run (at most one does). */
  nemesisMet: boolean;
  /** Names already given out (nicknames, weapons, nemeses), so new ones don't repeat them. */
  takenNames: Set<string>;
  /** The vehicles the crew took (copies), with who rides in each. */
  rides: Ride[];
  /** Vehicles found out here, to drive home. */
  foundVehicles: Vehicle[];
  /** Set when a wreck leaves the crew short of seats: the time they started walking home. */
  walkingFrom?: number;
  /** A rescue run (§10.1): the person who called (a copy), their trouble, and how it went. */
  rescue?: { person: Survivor; trouble: RescueTrouble; outcome?: 'saved' | 'lost' | 'missed'; by?: string };
  /** Animals following the crew home (§9.7). */
  animals: Animal[];
  /** People coming home with the crew to join (§10). */
  found: FoundNews[];
  /** The Vultures as they stand for this run (§7.11), if the place is in their turf or it's an attack on a camp. */
  vultures?: SimVultures;
  /** Finds out here are this much thinner: the Vultures work the place (§7.11). */
  thin: number;
}

/** What a run knows of the Vultures: copies, so the real ones only change when the crew is back. */
export interface SimVultures {
  band: 'war' | 'wary' | 'truce' | 'trade';
  standing: number;
  strength: number;
  /** Their camp at this place, if any, and who holds it. */
  camp?: { locationId: string; home: boolean; leader?: VultureMember };
  /** A lieutenant from a camp next door, who may lead a crew here. */
  nearby?: VultureMember;
  /** They've been met on this run (at most once). */
  met: boolean;
  news: VultureNews;
}

/** A vehicle on a run. */
export interface Ride {
  v: Vehicle;
  def: VehicleDef;
  riders: string[];
  wrecked: boolean;
}

/** The vehicles still running. */
export function running(sim: Sim): Ride[] {
  return sim.rides.filter((r) => !r.wrecked);
}

export function newTally(): RunTally {
  return { combats: 0, fled: 0, downed: 0, rads: 0, rangedKills: 0, meleeKills: 0, scavenges: 0, nemesisKills: 0 };
}

// ---------------------------------------------------------------- crew queries

/** Alive and on their feet. */
export function standing(sim: Sim): Member[] {
  return sim.members.filter((m) => !m.down && !m.dead);
}

/** Standing and still in the current fight. */
export function active(sim: Sim): Member[] {
  return sim.members.filter((m) => !m.down && !m.dead && !m.fled);
}

export function alive(sim: Sim): Member[] {
  return sim.members.filter((m) => !m.dead);
}

export function simDay(sim: Sim): number {
  return dayAt(sim.state, sim.departAt + sim.offset);
}

export function cohesion(sim: Sim): number {
  return crewCohesion(sim.state, standing(sim).map((m) => m.s.id));
}

export function isBonded(sim: Sim, a: Member, b: Member): boolean {
  return relationshipLabel(sim.state, a.s.id, b.s.id) === 'bonded';
}

/** Does this member have a Bonded friend standing in the crew? */
export function hasBondedHere(sim: Sim, m: Member): boolean {
  return standing(sim).some((o) => o !== m && isBonded(sim, m, o));
}

function hasMentorHere(sim: Sim, m: Member): boolean {
  return standing(sim).some((o) => {
    if (o === m) return false;
    const flags = getRelationship(sim.state, m.s.id, o.s.id)?.flags ?? [];
    return flags.some((f) => f.kind === 'mentor' && f.mentor === o.s.id);
  });
}

/** The standing member with the highest score. Ties go to the earlier member. */
export function bestBy(members: readonly Member[], score: (m: Member) => number): Member | undefined {
  let best: Member | undefined;
  let bestScore = -Infinity;
  for (const m of members) {
    const value = score(m);
    if (value > bestScore) {
      best = m;
      bestScore = value;
    }
  }
  return best;
}

// ---------------------------------------------------------------- log

export function startBeat(sim: Sim, kind: BeatKind, title: string): void {
  sim.beats.push({ at: sim.offset, kind, title, lines: [] });
  sim.beatCounts[kind] = (sim.beatCounts[kind] ?? 0) + 1;
}

export function say(sim: Sim, text: string, extra: Omit<LogLine, 'text'> = {}): void {
  const beat = sim.beats[sim.beats.length - 1];
  if (!beat) throw new Error('say() before startBeat()');
  beat.lines.push({ text, ...extra });
}

/** Fill a flavor template. roles: { a: member, b: member }. vars: { loc: '...', group: '...' }. */
export function fmt(template: string, roles: Record<string, Member> = {}, vars: Record<string, string> = {}): string {
  const survivors: Record<string, Survivor> = {};
  for (const [key, m] of Object.entries(roles)) survivors[key] = m.s;
  const withVars = template.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match);
  return fillRoles(withVars, survivors);
}

/** Pick a line from a pool and fill it. */
/**
 * A line from a pool, filled in. For a CrewLines pool, someone out alone gets
 * a solo line, with {a} as them unless the caller cast someone else.
 */
export function flavor(
  sim: Sim,
  pool: readonly string[] | CrewLines,
  roles: Record<string, Member> = {},
  vars: Record<string, string> = {},
): string {
  const solo = sim.members.length === 1;
  const lines = 'crew' in pool ? (solo ? pool.solo : pool.crew) : pool;
  const cast = solo && 'crew' in pool && !roles.a ? { ...roles, a: sim.members[0]! } : roles;
  return fmt(sim.rng.pick(lines), cast, { loc: sim.loc.name, ...vars });
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function withArticle(name: string): string {
  return /^[aeiou]/i.test(name) ? `an ${name}` : `a ${name}`;
}

export function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

/** "Mara", "Mara and Dex", "Mara, Dex and Ava". */
export function listNames(items: readonly string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// ---------------------------------------------------------------- hidden traits

type HookKey = keyof TraitHooks;

/** If a hidden trait just visibly acted (it has this hook), reveal it. */
export function revealHook(sim: Sim, m: Member, key: HookKey): void {
  for (const t of m.s.traits) {
    if (!t.hidden) continue;
    const def = getTrait(t.id);
    if (def.hooks?.[key] === undefined) continue;
    revealTrait(m.s, t.id, simDay(sim));
    say(sim, `So that is how it is: ${m.s.firstName} is ${def.name}.`);
  }
}

// ---------------------------------------------------------------- checks

export interface SimCheck extends CheckResult {
  info: CheckInfo;
}

export interface CheckOptions {
  /** Extra modifier from the situation. */
  extra?: number;
  /** A check made on behalf of the whole crew: cohesion applies. */
  crew?: boolean;
  /** Attack rolls don't use Lucky/Unlucky rerolls. */
  noReroll?: boolean;
}

export function practice(sim: Sim, m: Member, stat: StatId, dc: number): void {
  let amount = dc >= DC.hard ? PRACTICE_HARD : PRACTICE_NORMAL;
  if (hasMentorHere(sim, m)) amount += 1;
  for (const up of addPractice(m.s, stat, amount, simDay(sim))) {
    say(sim, `${m.s.firstName}'s ${statName(stat)} rises to ${up.to}.`, { tone: 'good' });
  }
}

/** Total modifier for a member's check: stat, traits, gear, stress, bonds, cohesion. */
export function simBonus(sim: Sim, m: Member, stat: StatId, contexts: readonly string[], opts: CheckOptions = {}): number {
  let bonus = checkBonus(m.s, stat, contexts) + (opts.extra ?? 0);
  if (opts.crew) bonus += cohesion(sim);
  if (hasBondedHere(sim, m)) bonus += BONDED_CHECK_BONUS;
  if (sim.members.length === 1) bonus += sumTraitHook(m.s, 'soloBonus');
  return bonus;
}

/** Roll a check for a member: rerolls from luck, practice gained, and a CheckInfo for the log. */
export function check(
  sim: Sim,
  m: Member,
  stat: StatId,
  dc: number,
  contexts: readonly string[] = [],
  opts: CheckOptions = {},
): SimCheck {
  const bonus = simBonus(sim, m, stat, contexts, opts);
  let result = rollCheck(sim.rng, bonus, dc, stat);
  let rerolled = false;
  if (!opts.noReroll) {
    if (!result.success && m.rerollFails > 0) {
      m.rerollFails -= 1;
      result = rollCheck(sim.rng, bonus, dc, stat);
      rerolled = true;
      revealHook(sim, m, 'rerollFails');
    } else if (result.success && m.rerollSuccesses > 0) {
      m.rerollSuccesses -= 1;
      result = rollCheck(sim.rng, bonus, dc, stat);
      rerolled = true;
      revealHook(sim, m, 'rerollSuccesses');
    }
  }
  practice(sim, m, stat, dc);
  const info: CheckInfo = { who: m.s.id, stat, roll: result.roll, bonus, dc, success: result.success };
  if (rerolled) info.rerolled = true;
  return { ...result, info };
}

// ---------------------------------------------------------------- stress, damage, radiation

/** Change a member's stress. Bonded friends in the crew soften gains; breaking points are logged. */
export function stress(sim: Sim, m: Member, amount: number, source?: string): void {
  if (m.dead || amount === 0) return;
  const scaled = amount > 0 && hasBondedHere(sim, m) ? amount * BONDED_STRESS_MULT : amount;
  const ctx = source ? { rng: sim.rng, day: simDay(sim), source } : { rng: sim.rng, day: simDay(sim) };
  const result = changeStress(m.s, scaled, ctx);
  if (result.breakingPoint) {
    const def = getTrait(result.breakingPoint.trait);
    say(
      sim,
      result.breakingPoint.positive
        ? `Something in ${m.s.firstName} gives way, and what is left is harder. ${m.s.firstName} is now ${def.name}.`
        : `It is too much. ${m.s.firstName} breaks, and is now ${def.name}.`,
      { tone: result.breakingPoint.positive ? 'good' : 'bad' },
    );
  }
}

/**
 * Deal damage to a member. Returns true if it put them down. A downed member
 * gets a wound roll when the beat ends (see wounds.ts).
 */
export function hurt(sim: Sim, m: Member, amount: number, cause: string, enemyType?: string, nemesisId?: string): boolean {
  if (m.down || m.dead) return false;
  const damage = Math.max(0, Math.round(amount));
  m.s.hp = Math.max(0, m.s.hp - damage);
  if (m.s.hp > 0) {
    stress(sim, m, damage * STRESS_PER_DAMAGE, 'getting hurt');
    return false;
  }
  m.down = true;
  m.woundPending = { cause, ...(enemyType ? { enemyType } : {}), ...(nemesisId ? { nemesisId } : {}) };
  m.tally.downed += 1;
  m.s.counters.timesDowned += 1;
  for (const other of standing(sim)) {
    const partner = arePartners(sim.state, other.s.id, m.s.id);
    stress(sim, other, STRESS_ALLY_DOWNED + (partner ? PARTNER_DOWN_STRESS : 0), `seeing ${m.s.firstName} go down`);
  }
  return true;
}

export function isHurt(m: Member): boolean {
  return m.s.hp < maxHp(m.s) / 2;
}

/** Radiation actually absorbed after traits and gear. */
export function absorbRads(m: Member, amount: number): number {
  const taken = Math.round(amount * mulTraitHook(m.s, 'radMult') * mulGearHook(m.s, 'radMult'));
  if (taken > 0) {
    m.s.counters.rads += taken;
    m.tally.rads += taken;
  }
  return taken;
}

/** Rerolls a member starts the run with (traits + gear). */
export function startingRerolls(s: Survivor): { fails: number; successes: number } {
  return {
    fails: sumTraitHook(s, 'rerollFails') + sumGearHook(s, 'rerollFails'),
    successes: sumTraitHook(s, 'rerollSuccesses'),
  };
}

/** How much harder enemies hit at this danger: +1 attack and damage at 3, +2 at 5, +3 at 7 (the heart of the Glow). */
export function dangerEdge(danger: number): number {
  return Math.max(0, Math.floor((danger - 1) / ENEMY_DANGER_STEP));
}

/** How much tougher enemies are at this danger: 1 at danger 4, 2 at 5, up to 4 at the heart of the Glow. */
export function dangerToughness(danger: number): number {
  return Math.max(0, danger - ENEMY_TOUGH_FROM + 1);
}

/** An enemy's HP and defense at this danger. */
export function toughened(hp: number, defense: number, danger: number): { hp: number; defense: number } {
  const t = dangerToughness(danger);
  return { hp: Math.round(hp * (1 + ENEMY_TOUGH_HP * t)), defense: defense + t };
}
