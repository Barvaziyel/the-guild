/**
 * One day at the Depot: people eat, work, heal, rest and get on (or don't).
 * Played for every game day that passes, in order, by advanceTime.
 */
import { addGuildLog } from '../chronicle.ts';
import {
  AMMO_PER_WITS,
  AMMO_PER_WORKER,
  AMMO_STOCK_CAP,
  BAR_DRIFT_CHANCE,
  BONDED_RELIEF,
  COWORKER_DRIFT_CHANCE,
  FIREPIT_PER_KEEPER,
  FIREPIT_PER_NERVE,
  FIREPIT_RELIEF,
  GARDEN_BASE,
  GARDEN_PER_WITS,
  GARDEN_PER_WORKER,
  HEAL_BASE,
  HEAL_PER_INFIRMARY,
  HEAL_PER_MEDIC_WITS,
  HUNGRY_HEAL_SHARE,
  INFIRMARY_SPEEDUP,
  RADIO_REVEAL_PER_LEVEL,
  RADIO_REVEAL_PER_WITS,
  PARTNER_RELIEF,
  REST_RELIEF,
  TRAINING_PRACTICE,
  UPKEEP_RATIONS,
  WORK_PRACTICE,
} from '../constants.ts';
import { LOCATIONS, getLocation, getTrait } from '../content/index.ts';
import { applyEvolutions } from '../evolution.ts';
import { ensureLocationState, locationState } from '../locations.ts';
import { adjustRelationship, arePartners, becomePartners, relationshipLabel, romanceChance, traitAffinity } from '../relationships.ts';
import type { Rng } from '../rng.ts';
import { addPractice, changeStress, effectiveStat, hungerStress, maxHp } from '../stats.ts';
import { expireConditions, maxTraitHook, mulTraitHook, removeTrait } from '../traits.ts';
import type { BuildingId, GameState, GuildLogEntry, Resources, Survivor } from '../types.ts';
import { BUILDING_IDS } from '../types.ts';
import { playOutpostsDay } from '../outposts.ts';
import { atDepot, buildingLevel, postBuilding, postStat, upkeepOf, workingAt, workingLevel } from './buildings.ts';
import { clinicHealMult, crewRations, fasterHealing, memorialRelief, postProject, workOnProjects, workingOnProject } from '../projects.ts';

/** What happened over one or more Depot days, for the "while you were away" note. */
export interface DepotSummary {
  days: number;
  grown: number;
  eaten: number;
  hungryDays: number;
  ammoMade: number;
  healed: number;
  cured: number;
  /** Guild log entries written while these days were played. */
  news: GuildLogEntry[];
  /** What the outposts sent home. */
  outposts: Partial<Resources>;
  /** What the buildings used up (1.6.2). */
  upkeep: Partial<Resources>;
  /** Buildings that worked a level lower on at least one day because their upkeep couldn't be paid. */
  unpaid: BuildingId[];
}

export function emptySummary(): DepotSummary {
  return { days: 0, grown: 0, eaten: 0, hungryDays: 0, ammoMade: 0, healed: 0, cured: 0, news: [], outposts: {}, upkeep: {}, unpaid: [] };
}

/** Round a fractional amount up or down at random, so 2.3 is 3 about a third of the time. */
export function roundChance(rng: Rng, x: number): number {
  const whole = Math.floor(x);
  return whole + (rng.chance(x - whole) ? 1 : 0);
}

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Rations the Garden grows today. */
export function gardenYield(state: GameState): number {
  const level = buildingLevel(state, 'garden');
  if (level === 0) return 0;
  const gardeners = workingAt(state, 'garden');
  return level * (GARDEN_BASE + sum(gardeners.map((s) => GARDEN_PER_WORKER + effectiveStat(s, 'wits') * GARDEN_PER_WITS)));
}

/** Rations the Depot hands out in a day: to everyone at home, and to the people at the outposts. */
export function dailyUpkeep(state: GameState): number {
  return sum(state.survivors.filter((s) => atDepot(s) || (s.status === 'ready' && s.outpost !== undefined)).map(rationsADay)) + crewRations(state);
}

/** Rations the whole guild eats in a day once everyone is back from runs: what the Garden has to keep up with. */
export function guildUpkeep(state: GameState): number {
  return sum(state.survivors.map(rationsADay)) + crewRations(state);
}

function rationsADay(s: Survivor): number {
  return Math.max(UPKEEP_RATIONS, maxTraitHook(s, 'rationUse'));
}

/** Stress everyone at the Depot sheds from the Firepit today (on top of rest). */
export function firepitRelief(state: GameState): number {
  const level = workingLevel(state, 'firepit');
  if (level === 0) return 0;
  const keepers = workingAt(state, 'firepit');
  return (FIREPIT_RELIEF[level] ?? 0) + sum(keepers.map((s) => FIREPIT_PER_KEEPER + effectiveStat(s, 'nerve') * FIREPIT_PER_NERVE));
}

/** Share of max HP healed per day at the Depot. */
export function healRate(state: GameState): number {
  const level = workingLevel(state, 'infirmary');
  const medics = level > 0 ? workingAt(state, 'infirmary') : [];
  return HEAL_BASE + HEAL_PER_INFIRMARY * level + HEAL_PER_MEDIC_WITS * sum(medics.map((s) => effectiveStat(s, 'wits')));
}

/** Play one Depot day. Events and the recruit board are handled by the caller. */
export function playDepotDay(state: GameState, day: number, rng: Rng, summary: DepotSummary): void {
  const home = state.survivors.filter(atDepot);

  // Conditions that have run their course.
  for (const s of home) expireConditions(s, day);

  // Food.
  growFood(state, rng, summary);
  const hungry = eat(state, day, summary);

  // What the upper levels use up; a building that can't be kept going works a level lower today.
  payUpkeep(state, rng, summary);

  // Work that makes things.
  makeAmmo(state, rng, summary);
  listenToRadio(state, day, rng);

  // Care.
  treat(state, day, rng, summary);
  for (const s of home) {
    const max = maxHp(s);
    if (s.hp >= max) continue;
    const before = s.hp;
    const rate = healRate(state) * clinicHealMult(state) * (hungry ? HUNGRY_HEAL_SHARE : 1);
    s.hp = Math.min(max, s.hp + Math.max(1, Math.ceil(max * rate)));
    summary.healed += s.hp - before;
  }

  for (const s of home) fasterHealing(state, s, day);

  // Nerves.
  const fire = firepitRelief(state) + memorialRelief(state);
  for (const s of home) {
    if (hungry) {
      hungerStress(s, rng, day);
      continue;
    }
    const bonded = home.some((o) => o.id !== s.id && relationshipLabel(state, s.id, o.id) === 'bonded');
    const partner = home.some((o) => o.id !== s.id && arePartners(state, s.id, o.id));
    const relief = (REST_RELIEF + fire + (bonded ? BONDED_RELIEF : 0) + (partner ? PARTNER_RELIEF : 0)) * mulTraitHook(s, 'stressReliefMult');
    changeStress(s, -Math.round(relief), { rng, day });
  }

  // Practice and the people you work beside.
  for (const s of home) {
    const b = postBuilding(s.post);
    if (!b || !s.post || 'project' in s.post || !workingAt(state, b).includes(s)) continue;
    const amount = b === 'training_yard' ? (TRAINING_PRACTICE[buildingLevel(state, 'training_yard')] ?? 0) : WORK_PRACTICE;
    addPractice(s, postStat(s, s.post), amount, day);
  }
  // The project under way: its crew works and practices (§9.6).
  workOnProjects(state, day);
  driftTogether(state, home, day, rng);
  fallForEachOther(state, home, day, rng);

  // Time at home changes people too.
  for (const s of home) {
    s.counters.daysAtDepot += 1;
    const bondedAtDepot = home.some((o) => o.id !== s.id && relationshipLabel(state, s.id, o.id) === 'bonded');
    applyEvolutions(s, { when: 'depotDay', rng, day, bondedAtDepot });
  }

  // Out at the outposts.
  playOutpostsDay(state, day, rng, summary.outposts, hungry);
  summary.days += 1;
}

/** Now and then, two Bonded people at home together become partners. */
function fallForEachOther(state: GameState, home: readonly Survivor[], day: number, rng: Rng): void {
  for (let i = 0; i < home.length; i++) {
    for (let j = i + 1; j < home.length; j++) {
      const [a, b] = [home[i]!, home[j]!];
      const p = romanceChance(state, a, b);
      if (p > 0 && rng.chance(p)) becomePartners(state, a, b, day);
    }
  }
}

/** Each building's daily upkeep (§9, 1.6.2). Unpaid ones are listed in `state.depot.unpaid` for the day. */
function payUpkeep(state: GameState, rng: Rng, summary: DepotSummary): void {
  state.depot.unpaid = [];
  for (const id of BUILDING_IDS) {
    const u = upkeepOf(state, id);
    if (!u) continue;
    const amount = roundChance(rng, u.amount);
    if (amount === 0) continue;
    if (state.resources[u.res] >= amount) {
      state.resources[u.res] -= amount;
      summary.upkeep[u.res] = (summary.upkeep[u.res] ?? 0) + amount;
    } else {
      state.depot.unpaid.push(id);
      if (!summary.unpaid.includes(id)) summary.unpaid.push(id);
    }
  }
  if (state.depot.unpaid.length === 0) delete state.depot.unpaid;
}

function growFood(state: GameState, rng: Rng, summary: DepotSummary): void {
  const grown = roundChance(rng, gardenYield(state));
  state.resources.rations += grown;
  summary.grown += grown;
}

/** Everyone at home eats. Returns whether the guild went hungry. */
function eat(state: GameState, day: number, summary: DepotSummary): boolean {
  const need = dailyUpkeep(state);
  const eaten = Math.min(need, state.resources.rations);
  state.resources.rations -= eaten;
  summary.eaten += eaten;
  const hungry = eaten < need;
  if (hungry) summary.hungryDays += 1;
  if (hungry && !state.depot.hungry) addGuildLog(state, day, 'The rations ran out. The guild is going hungry.', ['hunger']);
  if (!hungry && state.depot.hungry) addGuildLog(state, day, 'There is food on the table again.', ['hunger']);
  if (hungry) state.depot.hungry = true;
  else delete state.depot.hungry;
  return hungry;
}

function makeAmmo(state: GameState, rng: Rng, summary: DepotSummary): void {
  if (workingLevel(state, 'workshop') === 0) return;
  for (const s of workingAt(state, 'workshop')) {
    if (state.resources.ammo >= AMMO_STOCK_CAP || state.resources.scrap < 1) return;
    state.resources.scrap -= 1;
    const made = roundChance(rng, AMMO_PER_WORKER + effectiveStat(s, 'wits') * AMMO_PER_WITS);
    state.resources.ammo += made;
    summary.ammoMade += made;
  }
}

/** Places the guild hasn't found that a known place leads to. */
export function frontier(state: GameState): string[] {
  const out = new Set<string>();
  for (const loc of LOCATIONS) {
    if (!locationState(state, loc.id).discovered) continue;
    for (const next of loc.leadsTo) if (!locationState(state, next).discovered) out.add(next);
  }
  return [...out];
}

function listenToRadio(state: GameState, day: number, rng: Rng): void {
  const level = workingLevel(state, 'radio_tower');
  if (level === 0) return;
  const operators = workingAt(state, 'radio_tower');
  const chance = RADIO_REVEAL_PER_LEVEL * level + RADIO_REVEAL_PER_WITS * sum(operators.map((s) => effectiveStat(s, 'wits')));
  const options = frontier(state);
  if (options.length === 0 || !rng.chance(chance)) return;
  const id = rng.pick(options);
  ensureLocationState(state, id).discovered = true;
  addGuildLog(state, day, `The radio picked up talk of ${getLocation(id).name}. It's on the map now.`, ['discovery', id]);
}

/** Conditions the Infirmary can treat with meds. */
const TREATABLE = ['rad_sickness', 'feverish'];

function treat(state: GameState, day: number, rng: Rng, summary: DepotSummary): void {
  const level = workingLevel(state, 'infirmary');
  if (level === 0) return;
  const medics = workingAt(state, 'infirmary');
  if (medics.length === 0) return;
  const home = state.survivors.filter(atDepot);

  // One treatment per medic per day, while the meds last.
  let treatments = medics.length;
  for (const s of home) {
    for (const id of TREATABLE) {
      if (treatments === 0 || state.resources.meds < 1) break;
      if (!s.traits.some((t) => t.id === id)) continue;
      state.resources.meds -= 1;
      treatments -= 1;
      removeTrait(s, id, day, 'treated in the Infirmary');
      summary.cured += 1;
    }
  }

  // Wounds close sooner with someone looking after them.
  const speedup = INFIRMARY_SPEEDUP[level] ?? 0;
  for (const s of home) {
    for (const t of s.traits) {
      if (t.expiresDay === undefined || !getTrait(t.id).blocksRuns) continue;
      if (t.expiresDay > day + 1 && rng.chance(speedup)) t.expiresDay -= 1;
    }
  }
}

/** Working side by side today: the same building, or the same project's crew. */
function sameWork(state: GameState, a: Survivor, b: Survivor): boolean {
  const pa = postProject(a.post);
  if (pa) return pa === postProject(b.post) && workingOnProject(state, pa).includes(a) && workingOnProject(state, pa).includes(b);
  const ba = postBuilding(a.post);
  return ba !== undefined && ba === postBuilding(b.post) && workingAt(state, ba).includes(a) && workingAt(state, ba).includes(b);
}

/** Co-workers drift by their affinity; a Bar warms everyone a little. */
function driftTogether(state: GameState, home: Survivor[], day: number, rng: Rng): void {
  const barChance = BAR_DRIFT_CHANCE[workingLevel(state, 'firepit')] ?? 0;
  for (let i = 0; i < home.length; i++) {
    for (let j = i + 1; j < home.length; j++) {
      const a = home[i]!;
      const b = home[j]!;
      let delta = 0;
      const together = sameWork(state, a, b);
      if (together && rng.chance(COWORKER_DRIFT_CHANCE)) delta += traitAffinity(a, b);
      if (barChance > 0 && rng.chance(barChance)) delta += 1;
      if (delta !== 0) adjustRelationship(state, a.id, b.id, delta, { day, everyday: true });
    }
  }
}
