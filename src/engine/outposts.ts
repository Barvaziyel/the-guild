/**
 * Outposts (§7.9): camps at fully explored places. One to three people live
 * at each, send home a share of what the place gives up, shorten runs nearby,
 * give passing crews a place to rest, and get raided.
 */
import { addChronicle, addGuildLog } from './chronicle.ts';
import {
  BONDED_RELIEF,
  COWORKER_DRIFT_CHANCE,
  OUTPOST_COST,
  OUTPOST_HEAL,
  OUTPOST_RAID_BASE,
  OUTPOST_RAID_DC,
  OUTPOST_RAID_PER_DANGER,
  OUTPOST_REPAIR,
  OUTPOST_STAFF,
  PARTNER_RELIEF,
  REST_RELIEF,
} from './constants.ts';
import { getLocation, getTrait } from './content/index.ts';
import { buildingLevel, canAfford, costText, payCost } from './depot/buildings.ts';
import { addPractice, changeStress, effectiveStat, maxHp, rollCheck } from './stats.ts';
import { locationState } from './locations.ts';
import { adjustRelationship, arePartners, becomePartners, relationshipLabel, romanceChance, traitAffinity } from './relationships.ts';
import type { Rng } from './rng.ts';
import { addTrait, expireConditions, mulTraitHook } from './traits.ts';
import { RESOURCE_IDS, type GameState, type Outpost, type Resources, type Survivor } from './types.ts';

export function findOutpost(state: GameState, locationId: string): Outpost | undefined {
  return state.outposts.find((o) => o.locationId === locationId);
}

/** Everyone living at an outpost. */
export function outpostStaff(state: GameState, locationId: string): Survivor[] {
  return state.survivors.filter((s) => s.status === 'ready' && s.outpost === locationId);
}

/** How many outposts the Radio Tower can keep in contact with: one per level. */
export function outpostLimit(state: GameState): number {
  return buildingLevel(state, 'radio_tower');
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
  if (s.traits.some((t) => getTrait(t.id).blocksRuns)) return `${s.firstName} is resting until healed.`;
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

/** What one person working an outpost sends home in a day, on average: for the planner and the place screen. */
export function outpostYieldEach(locationId: string): [number, number] {
  const d = getLocation(locationId).danger;
  return [1 + Math.floor(d / 2), 2 + Math.floor(d / 2)];
}

/** One day at every outpost: people heal and rest, the place gives up supplies, and now and then raiders come. */
export function playOutpostsDay(state: GameState, day: number, rng: Rng, sent: Partial<Resources>): void {
  for (const outpost of [...state.outposts]) {
    const loc = getLocation(outpost.locationId);
    const staff = outpostStaff(state, outpost.locationId);

    for (const s of staff) {
      expireConditions(s, day);
      const max = maxHp(s);
      if (s.hp < max) s.hp = Math.min(max, s.hp + Math.max(1, Math.ceil(max * OUTPOST_HEAL)));
      const bonded = staff.some((o) => o.id !== s.id && relationshipLabel(state, s.id, o.id) === 'bonded');
      const partner = staff.some((o) => o.id !== s.id && arePartners(state, s.id, o.id));
      changeStress(s, -Math.round((REST_RELIEF + (bonded ? BONDED_RELIEF : 0) + (partner ? PARTNER_RELIEF : 0)) * mulTraitHook(s, 'stressReliefMult')), { rng, day });
    }

    // The people out here work side by side every day.
    for (let i = 0; i < staff.length; i++) {
      for (let j = i + 1; j < staff.length; j++) {
        const [a, b] = [staff[i]!, staff[j]!];
        if (rng.chance(COWORKER_DRIFT_CHANCE)) {
          const delta = traitAffinity(a, b);
          if (delta !== 0) adjustRelationship(state, a.id, b.id, delta, { day });
        }
        const p = romanceChance(state, a, b);
        if (p > 0 && rng.chance(p)) becomePartners(state, a, b, day);
      }
    }

    // What the place gives up.
    const [lo, hi] = outpostYieldEach(outpost.locationId);
    for (const s of staff) {
      if (s.traits.some((t) => getTrait(t.id).blocksRuns)) continue;
      const res = rng.weightedBy(RESOURCE_IDS, (r) => loc.loot[r]);
      let amount = rng.int(lo, hi);
      if (outpost.damaged) amount = Math.ceil(amount / 2);
      state.resources[res] += amount;
      sent[res] = (sent[res] ?? 0) + amount;
      addPractice(s, 'wits', 1, day);
    }

    if (rng.chance(OUTPOST_RAID_BASE + OUTPOST_RAID_PER_DANGER * loc.danger)) raidOutpost(state, outpost, day, rng);
  }
}

/**
 * Raiders come for an outpost. Held (only if someone is there to hold it):
 * practice and a little stress. Broken: someone is hurt and the outpost is
 * damaged, or burns if it already was. Returns what happened.
 */
export function raidOutpost(state: GameState, outpost: Outpost, day: number, rng: Rng): 'held' | 'damaged' | 'burned' {
  const loc = getLocation(outpost.locationId);
  const staff = outpostStaff(state, outpost.locationId);
  const fit = staff.filter((s) => !s.traits.some((t) => getTrait(t.id).blocksRuns));
  const best = Math.max(0, ...fit.map((s) => effectiveStat(s, 'aim')));
  const roll = rollCheck(rng, best + Math.max(0, fit.length - 1), OUTPOST_RAID_DC + loc.danger);

  if (fit.length > 0 && roll.success) {
    for (const s of fit) {
      addPractice(s, 'aim', 2, day);
      changeStress(s, 5, { rng, day, source: 'a raid' });
    }
    addGuildLog(state, day, `Raiders came for the outpost at ${loc.name}. ${listNames(fit.map((s) => s.firstName))} drove them off.`, ['outpost', loc.id]);
    return 'held';
  }

  for (const s of staff) changeStress(s, 10, { rng, day, source: 'a raid' });
  const hurt = fit.length > 0 ? rng.pick(fit) : undefined;
  if (hurt) {
    addTrait(hurt, 'wounded', { day, rng, source: `defending the outpost at ${loc.name}` });
    addChronicle(hurt, day, `Hurt holding the outpost at ${loc.name} against raiders.`, ['raid']);
  }

  if (outpost.damaged) {
    state.outposts = state.outposts.filter((o) => o !== outpost);
    for (const s of staff) {
      delete s.outpost;
      addChronicle(s, day, `Fled home when raiders burned the outpost at ${loc.name}.`, ['raid']);
    }
    const who = staff.length > 0 ? ` ${listNames(staff.map((s) => s.firstName))} made it home.` : ' Nobody was there to stop them.';
    addGuildLog(state, day, `Raiders burned the outpost at ${loc.name}.${who}`, ['outpost', loc.id]);
    return 'burned';
  }
  outpost.damaged = true;
  addGuildLog(state, day, `Raiders broke into the outpost at ${loc.name}.${hurt ? ` ${hurt.firstName} was hurt.` : ''} It sends home half until it's mended.`, ['outpost', loc.id]);
  return 'damaged';
}

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
