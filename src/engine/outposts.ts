/**
 * Outposts (§7.9): camps at fully explored places. One to three people live
 * at each, keep watch, send home a share of what the place gives up, shorten
 * runs nearby, and give passing crews a place to rest. It's a hard posting:
 * rations come from the Depot, there's little rest and slow healing, trouble
 * comes calling, and raiders hit it now and then.
 */
import { addChronicle, addGuildLog } from './chronicle.ts';
import {
  BONDED_RELIEF,
  COWORKER_DRIFT_CHANCE,
  DC,
  OUTPOST_COST,
  OUTPOST_HEAL,
  OUTPOST_PROWLER_DC,
  OUTPOST_RELIEF,
  OUTPOST_TROUBLE_BASE,
  OUTPOST_TROUBLE_PER_DANGER,
  OUTPOST_WATCH_STRESS,
  OUTPOST_RAID_BASE,
  OUTPOST_RAID_PER_DANGER,
  OUTPOST_REPAIR,
  OUTPOST_STAFF,
  PARTNER_RELIEF,
} from './constants.ts';
import { getEnemy, getLocation, getTrait } from './content/index.ts';
import { buildingLevel, canAfford, costText, laidUp, payCost } from './depot/buildings.ts';
import { addPractice, changeStress, effectiveStat, hungerStress, maxHp, rollCheck } from './stats.ts';
import { locationState } from './locations.ts';
import { adjustRelationship, arePartners, becomePartners, relationshipLabel, romanceChance, traitAffinity } from './relationships.ts';
import type { Rng } from './rng.ts';
import { addTrait, expireConditions, mulTraitHook } from './traits.ts';
import { RESOURCE_IDS, type DepotRaid, type GameState, type Outpost, type Resources, type Survivor } from './types.ts';
import { scheduleRaid } from './depot/raids.ts';
import { relayOutposts } from './projects.ts';

export function findOutpost(state: GameState, locationId: string): Outpost | undefined {
  return state.outposts.find((o) => o.locationId === locationId);
}

/** Everyone living at an outpost. */
export function outpostStaff(state: GameState, locationId: string): Survivor[] {
  return state.survivors.filter((s) => s.status === 'ready' && s.outpost === locationId);
}

/** How many outposts the Radio Tower can keep in contact with: one per level. */
export function outpostLimit(state: GameState): number {
  return buildingLevel(state, 'radio_tower') + relayOutposts(state);
}

/**
 * The outpost a run to this place can start from: one at the place itself, or
 * at a place next to it on the roads (either way).
 */
export function outpostNear(state: GameState, locationId: string): Outpost | undefined {
  const here = findOutpost(state, locationId);
  if (here) return here;
  const def = getLocation(locationId);
  return state.outposts.find((o) => def.leadsTo.includes(o.locationId) || getLocation(o.locationId).leadsTo.includes(locationId));
}

// ---------------------------------------------------------------- building and mending

export function buildOutpostProblem(state: GameState, locationId: string): string | undefined {
  const here = locationState(state, locationId);
  if (!here.discovered) return 'Nobody knows where that is yet.';
  if (findOutpost(state, locationId)) return 'The guild already has an outpost here.';
  if (here.explored < 100) return `Explore the outskirts fully first (${here.explored}% so far).`;
  const limit = outpostLimit(state);
  if (limit === 0) return 'Build the Radio Tower first: it keeps the outposts in contact.';
  if (state.outposts.length >= limit) return `The Radio Tower can keep in contact with ${limit === 1 ? 'one outpost' : `${limit} outposts`}. Improve it for more.`;
  if (!canAfford(state, OUTPOST_COST)) return `Needs ${costText(OUTPOST_COST)}.`;
  return undefined;
}

export function buildOutpost(state: GameState, locationId: string, day: number): Outpost {
  const problem = buildOutpostProblem(state, locationId);
  if (problem) throw new Error(problem);
  payCost(state, OUTPOST_COST);
  const outpost: Outpost = { locationId, builtDay: day, damaged: false };
  state.outposts.push(outpost);
  addGuildLog(state, day, `Set up an outpost at ${getLocation(locationId).name}.`, ['outpost', locationId]);
  return outpost;
}

export function repairOutpostProblem(state: GameState, locationId: string): string | undefined {
  const outpost = findOutpost(state, locationId);
  if (!outpost) return 'There is no outpost here.';
  if (!outpost.damaged) return 'It is in good shape.';
  if (!canAfford(state, OUTPOST_REPAIR)) return `Needs ${costText(OUTPOST_REPAIR)}.`;
  return undefined;
}

export function repairOutpost(state: GameState, locationId: string, day: number): void {
  const problem = repairOutpostProblem(state, locationId);
  if (problem) throw new Error(problem);
  payCost(state, OUTPOST_REPAIR);
  findOutpost(state, locationId)!.damaged = false;
  addGuildLog(state, day, `Mended the outpost at ${getLocation(locationId).name}.`, ['outpost', locationId]);
}

// ---------------------------------------------------------------- who lives there

/** Why this survivor can't move out to this outpost, if they can't. */
export function stationProblem(state: GameState, survivorId: string, locationId: string): string | undefined {
  const s = state.survivors.find((x) => x.id === survivorId);
  if (!s) return 'Nobody by that name.';
  const outpost = findOutpost(state, locationId);
  if (!outpost) return 'There is no outpost here.';
  if (s.outpost === locationId) return `${s.firstName} already lives here.`;
  if (s.status === 'away') return `${s.firstName} is out on a run.`;
  if (s.status !== 'ready') return `${s.firstName} can't go.`;
  if (laidUp(s)) return `${s.firstName} is resting until healed.`;
  if (outpostStaff(state, locationId).length >= OUTPOST_STAFF) return `The outpost has room for ${OUTPOST_STAFF}.`;
  return undefined;
}

/** Send someone to live at an outpost. Their Depot post goes; they can come home any time. */
export function station(state: GameState, survivorId: string, locationId: string, day: number): void {
  const problem = stationProblem(state, survivorId, locationId);
  if (problem) throw new Error(problem);
  const s = state.survivors.find((x) => x.id === survivorId)!;
  delete s.post;
  s.outpost = locationId;
  addChronicle(s, day, `Moved out to the outpost at ${getLocation(locationId).name}.`, ['outpost', locationId]);
}

/** Bring someone home from their outpost. Always possible. */
export function bringHome(state: GameState, survivorId: string, day: number): void {
  const s = state.survivors.find((x) => x.id === survivorId);
  if (!s?.outpost) return;
  addChronicle(s, day, `Came home from the outpost at ${getLocation(s.outpost).name}.`, ['outpost', s.outpost]);
  delete s.outpost;
}

// ---------------------------------------------------------------- a day out there

/** The range one person at an outpost sends home in a day (they eat from the Depot's rations, like everyone). */
export function outpostYieldEach(locationId: string): [number, number] {
  const d = getLocation(locationId).danger;
  return [2 + Math.floor(d / 2), 3 + Math.floor(d / 2)];
}

/** Stress a day from keeping watch at this place. */
export function watchStress(locationId: string): number {
  return OUTPOST_WATCH_STRESS * Math.max(0, getLocation(locationId).danger - 1);
}

/**
 * One day at every outpost: people heal a little and keep watch, the place
 * gives up supplies, trouble comes now and then, and now and then raiders.
 * The Depot feeds them; on a hungry day they go hungry too.
 */
export function playOutpostsDay(state: GameState, day: number, rng: Rng, sent: Partial<Resources>, hungry = false): void {
  for (const outpost of [...state.outposts]) {
    const loc = getLocation(outpost.locationId);
    const staff = outpostStaff(state, outpost.locationId);

    for (const s of staff) {
      expireConditions(s, day);
      const max = maxHp(s);
      if (s.hp < max) s.hp = Math.min(max, s.hp + Math.max(1, Math.ceil(max * OUTPOST_HEAL)));
      const watch = watchStress(outpost.locationId);
      if (watch > 0) changeStress(s, watch, { rng, day, source: `keeping watch at ${loc.name}` });
      if (hungry) {
        hungerStress(s, rng, day);
        continue;
      }
      const bonded = staff.some((o) => o.id !== s.id && relationshipLabel(state, s.id, o.id) === 'bonded');
      const partner = staff.some((o) => o.id !== s.id && arePartners(state, s.id, o.id));
      changeStress(s, -Math.round((OUTPOST_RELIEF + (bonded ? BONDED_RELIEF : 0) + (partner ? PARTNER_RELIEF : 0)) * mulTraitHook(s, 'stressReliefMult')), { rng, day });
    }

    // The people out here work side by side every day.
    for (let i = 0; i < staff.length; i++) {
      for (let j = i + 1; j < staff.length; j++) {
        const [a, b] = [staff[i]!, staff[j]!];
        if (rng.chance(COWORKER_DRIFT_CHANCE)) {
          const delta = traitAffinity(a, b);
          if (delta !== 0) adjustRelationship(state, a.id, b.id, delta, { day, everyday: true });
        }
        const p = romanceChance(state, a, b);
        if (p > 0 && rng.chance(p)) becomePartners(state, a, b, day);
      }
    }

    // What the place gives up.
    const [lo, hi] = outpostYieldEach(outpost.locationId);
    for (const s of staff) {
      if (laidUp(s)) continue;
      const res = rng.weightedBy(RESOURCE_IDS, (r) => loc.loot[r]);
      let amount = rng.int(lo, hi);
      if (outpost.damaged) amount = Math.ceil(amount / 2);
      state.resources[res] += amount;
      sent[res] = (sent[res] ?? 0) + amount;
      addPractice(s, 'wits', 1, day);
    }

    if (staff.length > 0 && rng.chance(OUTPOST_TROUBLE_BASE + OUTPOST_TROUBLE_PER_DANGER * loc.danger)) outpostTrouble(state, outpost, day, rng);
    if (rng.chance(OUTPOST_RAID_BASE + OUTPOST_RAID_PER_DANGER * loc.danger)) raidOutpost(state, outpost, day, rng);
  }
}

export type OutpostTrouble = 'prowlers held' | 'prowlers' | 'long night' | 'accident' | 'radiation';

/**
 * Something goes wrong out there: what prowls the place comes for the fence,
 * a night nobody sleeps, a fall through a rotten floor, or a dose of
 * radiation where the place has it. Nobody dies of it, but people get hurt.
 */
export function outpostTrouble(state: GameState, outpost: Outpost, day: number, rng: Rng): OutpostTrouble | undefined {
  const loc = getLocation(outpost.locationId);
  const staff = outpostStaff(state, outpost.locationId);
  if (staff.length === 0) return undefined;
  const fit = staff.filter((s) => !laidUp(s));
  const kind = rng.weighted<'prowlers' | 'long night' | 'accident' | 'radiation'>([
    { item: 'prowlers', weight: fit.length > 0 ? 3 : 0 },
    { item: 'long night', weight: 2 },
    { item: 'accident', weight: fit.length > 0 ? 2 : 0 },
    { item: 'radiation', weight: 2 * loc.radiation },
  ]);
  const at = `the outpost at ${loc.name}`;

  if (kind === 'prowlers') {
    const encounter = rng.weightedBy(loc.encounters, (e) => e.weight);
    const what = getEnemy(encounter.enemies[0]!).plural;
    const best = fit.reduce((a, b) => (effectiveStat(b, 'aim') > effectiveStat(a, 'aim') ? b : a));
    const roll = rollCheck(rng, effectiveStat(best, 'aim') + fit.length - 1, OUTPOST_PROWLER_DC + loc.danger);
    if (roll.success) {
      addPractice(best, 'aim', 1, day);
      for (const s of fit) changeStress(s, 3, { rng, day, source: `${what} at the fence` });
      addGuildLog(state, day, `${what} came at the fence of ${at}. ${best.firstName} drove them off.`, ['outpost', loc.id]);
      return 'prowlers held';
    }
    const hurt = rng.pick(fit);
    injure(hurt, rng.int(1, 2) + loc.danger, day, rng, `${what} at ${at}`);
    for (const s of staff) changeStress(s, 6, { rng, day, source: `${what} at the fence` });
    addChronicle(hurt, day, `Hurt when ${what.toLowerCase()} got through the fence at ${at}.`, ['outpost']);
    addGuildLog(state, day, `${what} got through the fence at ${at}. ${hurt.firstName} was hurt.`, ['outpost', loc.id]);
    return 'prowlers';
  }

  if (kind === 'long night') {
    for (const s of staff) {
      const steady = rollCheck(rng, effectiveStat(s, 'nerve'), DC.normal).success;
      changeStress(s, steady ? 2 : 6, { rng, day, source: `a long night at ${at}` });
    }
    return 'long night';
  }

  if (kind === 'accident') {
    const s = rng.pick(fit);
    if (rollCheck(rng, effectiveStat(s, 'wits'), DC.normal).success) return 'accident';
    injure(s, rng.int(1, 4), day, rng, `an accident at ${at}`);
    addChronicle(s, day, `Fell through a rotten floor at ${at}.`, ['outpost']);
    addGuildLog(state, day, `${s.firstName} fell through a rotten floor at ${at} and was hurt.`, ['outpost', loc.id]);
    return 'accident';
  }

  const s = rng.pick(staff);
  const shrugs = rng.chance(1 - mulTraitHook(s, 'radMult'));
  if (shrugs || rollCheck(rng, effectiveStat(s, 'grit'), DC.easy + 2 * loc.radiation).success) return 'radiation';
  addTrait(s, 'rad_sickness', { day, rng, source: `radiation at ${at}` });
  addGuildLog(state, day, `${s.firstName} took a dose of radiation at ${at} and is sick with it.`, ['outpost', loc.id]);
  return 'radiation';
}

/** Hurt someone at an outpost: never below 1 health, and Wounded if it leaves them under a third. */
function injure(s: Survivor, damage: number, day: number, rng: Rng, source: string): void {
  s.hp = Math.max(1, s.hp - damage);
  if (s.hp <= maxHp(s) / 3) addTrait(s, 'wounded', { day, rng, source });
}

/** Who's raiding: "Raiders" and "raiders", or the Vultures (§7.11), who are harder to hold off. */
export interface Raiders {
  name: string;
  lower: string;
  /** Added to the defenders' DC. */
  dc: number;
}

export const RAIDERS: Raiders = { name: 'Raiders', lower: 'raiders', dc: 0 };

/**
 * Raiders come for an outpost (§9.8): fought like a raid at the gate, with a
 * notice and a wait, by whoever lives there. One raid at a time anywhere: if
 * one is on already, these pass the outpost by.
 */
export function raidOutpost(state: GameState, outpost: Outpost, day: number, rng: Rng, by: 'raiders' | 'vultures' = 'raiders'): DepotRaid | undefined {
  return scheduleRaid(state, day, rng, by, outpost.locationId);
}

/**
 * Raiders broke into an outpost: a fright for those there, the outpost
 * damaged, or burned if it already was (they go home). `fought`: the
 * defenders fought it out, so their wounds are already theirs; with nobody
 * fighting, someone there may be hurt.
 */
export function outpostBroken(state: GameState, outpost: Outpost, day: number, rng: Rng, by: Raiders, fought: boolean, tags: string[] = []): 'damaged' | 'burned' {
  const loc = getLocation(outpost.locationId);
  const staff = outpostStaff(state, outpost.locationId);
  for (const s of staff) changeStress(s, 10, { rng, day, source: 'a raid' });
  const fit = staff.filter((s) => !laidUp(s));
  const hurt = !fought && fit.length > 0 ? rng.pick(fit) : undefined;
  if (hurt) {
    addTrait(hurt, 'wounded', { day, rng, source: `defending the outpost at ${loc.name}` });
    addChronicle(hurt, day, `Hurt holding the outpost at ${loc.name} against ${by.lower}.`, ['raid']);
  }

  if (outpost.damaged) {
    state.outposts = state.outposts.filter((o) => o !== outpost);
    for (const s of staff) {
      delete s.outpost;
      addChronicle(s, day, `Fled home when ${by.lower} burned the outpost at ${loc.name}.`, ['raid']);
    }
    const who = staff.length > 0 ? ` ${listNames(staff.map((s) => s.firstName))} made it home.` : ' Nobody was there to stop them.';
    addGuildLog(state, day, `${by.name} burned the outpost at ${loc.name}.${who}`, ['outpost', loc.id, ...tags]);
    return 'burned';
  }
  outpost.damaged = true;
  addGuildLog(state, day, `${by.name} broke into the outpost at ${loc.name}.${hurt ? ` ${hurt.firstName} was hurt.` : ''} It sends home half until it's mended.`, ['outpost', loc.id, ...tags]);
  return 'damaged';
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
