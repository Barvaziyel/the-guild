/**
 * The Depot's own corners (§9.9, 2.7.0): searching the parts of the old rail
 * depot nobody has been through. One search at a time, by someone at home who
 * can work; it takes a few minutes of real time and ends through
 * `advanceTime`, like a crew coming home. The corners are data in
 * content/corners.ts.
 */
import { animalOf, adopt, newAnimal } from './animals.ts';
import { addChronicle, addGuildLog } from './chronicle.ts';
import { CORNERS, getCorner, type CornerDef, type CornerGift, type CornerOutcome } from './content/corners.ts';
import { getAnimal, getGear, getLocation } from './content/index.ts';
import { canWork, hasFreeBunk } from './depot/buildings.ts';
import { frontier } from './depot/day.ts';
import { dayAt, recruit, withRng } from './game.ts';
import { createItem } from './gear.ts';
import { generateSurvivor } from './generator.ts';
import { ensureLocationState } from './locations.ts';
import { REL_FOUND, RESCUE_WAIT_DAYS } from './constants.ts';
import { adjustRelationship } from './relationships.ts';
import type { Rng } from './rng.ts';
import { addPractice, changeStress, effectiveStat, maxHp, rollCheck } from './stats.ts';
import { fill, fillRoles, fullName } from './text.ts';
import { addTrait } from './traits.ts';
import type { CornerResult, CornerSearch, GameState, Resources, Survivor } from './types.ts';
import { RESOURCE_IDS } from './types.ts';

export type CornerStatus = 'open' | 'locked' | 'searching' | 'searched';

export function cornerStatus(state: GameState, id: string): CornerStatus {
  if (state.corners.searched.includes(id)) return 'searched';
  if (state.corners.search?.cornerId === id) return 'searching';
  const needs = getCorner(id).needs;
  if (needs && !state.corners.searched.includes(needs.corner)) return 'locked';
  return 'open';
}

/** Corners still to search, open or not. */
export function cornersLeft(state: GameState): CornerDef[] {
  return CORNERS.filter((c) => !state.corners.searched.includes(c.id));
}

/** The search someone is on, if any. */
export function searchOf(state: GameState, survivorId: string): CornerSearch | undefined {
  const s = state.corners.search;
  return s && s.by === survivorId ? s : undefined;
}

/** Why someone can't go out or move away: "is searching the signal box". */
export function searchReason(state: GameState, survivorId: string): string | undefined {
  const s = searchOf(state, survivorId);
  return s ? `is searching ${lower(getCorner(s.cornerId).name)}` : undefined;
}

/** Why this person can't search this corner now, or undefined if they can. */
export function searchProblem(state: GameState, cornerId: string, survivorId: string): string | undefined {
  const corner = CORNERS.find((c) => c.id === cornerId);
  if (!corner) return 'There is no such corner.';
  const status = cornerStatus(state, cornerId);
  if (status === 'searched') return `${corner.name} has been searched.`;
  if (status === 'locked') return corner.needs!.locked;
  const busy = state.corners.search;
  if (busy) return `${state.survivors.find((x) => x.id === busy.by)?.firstName ?? 'Someone'} is already searching ${lower(getCorner(busy.cornerId).name)}.`;
  const s = state.survivors.find((x) => x.id === survivorId);
  if (!s) return 'Nobody by that name.';
  if (s.status === 'away') return `${s.firstName} is out on a run.`;
  if (s.outpost !== undefined) return `${s.firstName} lives at the outpost at ${getLocation(s.outpost).name}.`;
  if (!canWork(s)) return `${s.firstName} is resting until healed.`;
  return undefined;
}

/** Who could search: everyone at home who can work, the best at it first. */
export function searchers(state: GameState, cornerId: string): Survivor[] {
  const stat = getCorner(cornerId).stat;
  return state.survivors.filter((s) => s.status === 'ready' && s.outpost === undefined && canWork(s)).sort((a, b) => effectiveStat(b, stat) - effectiveStat(a, stat));
}

/** Send someone to search a corner. Throws if they can't. */
export function startSearch(state: GameState, cornerId: string, survivorId: string, now: number): CornerSearch {
  const problem = searchProblem(state, cornerId, survivorId);
  if (problem) throw new Error(problem);
  const search: CornerSearch = { cornerId, by: survivorId, start: now, until: now + getCorner(cornerId).minutes * 60_000 };
  state.corners.search = search;
  return search;
}

/** A search whose time has come, at `now`. */
export function searchDue(state: GameState, now: number): boolean {
  const s = state.corners.search;
  return s !== undefined && s.until <= now;
}

/**
 * Finish the search under way if its time has come (called from
 * `advanceTime`, in order with crews coming home). The outcome is kept for its
 * card until the player has seen it.
 */
export function finishSearch(state: GameState, now: number): CornerResult | undefined {
  const search = state.corners.search;
  if (!search || search.until > now) return undefined;
  delete state.corners.search;
  const corner = getCorner(search.cornerId);
  const by = state.survivors.find((x) => x.id === search.by);
  const day = dayAt(state, search.until);
  // Whoever went is gone (dead, left): the corner waits for someone else.
  if (!by) return undefined;
  state.corners.searched.push(corner.id);
  const result = withRng(state, (rng) => {
    const outcome = corner.outcomes.find((o) => !o.test || passes(o, by, rng)) ?? corner.outcomes[corner.outcomes.length - 1]!;
    const before: Resources = { ...state.resources };
    let text = fillRoles(outcome.text, { a: by });
    const gear: string[] = [];
    for (const gift of outcome.gives) {
      const extra = give(state, gift, by, corner, day, rng, gear);
      if (extra) text += ` ${extra}`;
    }
    const supplies: Partial<Resources> = {};
    for (const r of RESOURCE_IDS) if (state.resources[r] !== before[r]) supplies[r] = state.resources[r] - before[r];
    return { cornerId: corner.id, by: by.id, at: search.until, text, ...(Object.keys(supplies).length > 0 ? { supplies } : {}), ...(gear.length > 0 ? { gear } : {}) } satisfies CornerResult;
  });
  addChronicle(by, day, `Searched ${lower(corner.name)} at the Depot.`, ['corner', corner.id]);
  addGuildLog(state, day, `${corner.name}: ${result.text}`, ['corner', corner.id]);
  state.corners.last = result;
  return result;
}

/** The player has read the last search's outcome. */
export function seenSearch(state: GameState): void {
  if (state.corners.last) state.corners.last.seen = true;
}

function passes(o: CornerOutcome, by: Survivor, rng: Rng): boolean {
  const test = o.test!;
  if ('chance' in test) return rng.chance(test.chance);
  return rollCheck(rng, effectiveStat(by, test.stat), test.dc, test.stat).success;
}

/** One gift of a search. Returns a sentence to add when the story needs it (no room, an animal that moved on). */
function give(state: GameState, gift: CornerGift, by: Survivor, corner: CornerDef, day: number, rng: Rng, gear: string[]): string | undefined {
  switch (gift.kind) {
    case 'supplies':
      for (const r of RESOURCE_IDS) if (gift.change[r]) state.resources[r] = Math.max(0, state.resources[r] + gift.change[r]!);
      return undefined;
    case 'gear': {
      const item = createItem(state, gift.defId, gift.quality);
      state.stash.push(item);
      gear.push(getGear(gift.defId).name);
      return undefined;
    }
    case 'animal': {
      if (animalOf(state, gift.animal)) return `There’s already a ${getAnimal(gift.animal).name} at the Depot, and this one moves on.`;
      const a = adopt(state, newAnimal(state, gift.animal, rng, day), by, day, `in ${lower(corner.name)}`);
      return `${by.firstName} calls it ${a.name}.`;
    }
    case 'reveal': {
      const options = frontier(state);
      if (options.length === 0) return undefined;
      const id = rng.pick(options);
      ensureLocationState(state, id).discovered = true;
      return `It’s ${getLocation(id).name}, and it’s on the map now.`;
    }
    case 'person': {
      const person = generateSurvivor(state, rng, { day });
      person.hp = Math.max(1, Math.round(maxHp(person) * 0.8));
      if (hasFreeBunk(state)) {
        recruit(state, person, rng, day, `Was found living in ${lower(corner.name)} at the Depot by ${fullName(by)}, and stayed.`);
        adjustRelationship(state, by.id, person.id, REL_FOUND, { day, useTraitMult: false });
        addChronicle(by, day, `Talked ${fullName(person)} out of hiding in ${lower(corner.name)}.`, ['recruit', person.id]);
        return fill(`{First} ${person.lastName} joins the guild.`, person);
      }
      state.depot.recruits.push({ survivor: person, expiresDay: day + RESCUE_WAIT_DAYS, wanderer: true });
      return fill(`{First} ${person.lastName} would stay, but there’s no bed free, so {they} will wait at the gate a few days.`, person);
    }
    case 'practice':
      addPractice(by, gift.stat, gift.amount, day);
      return undefined;
    case 'stress':
      changeStress(by, gift.amount, { rng, day, source: lower(corner.name) });
      return undefined;
    case 'hurt':
      by.hp = Math.max(1, by.hp - gift.amount);
      if (by.hp <= maxHp(by) / 3) addTrait(by, 'wounded', { day, rng, source: lower(corner.name) });
      return undefined;
  }
}

function lower(name: string): string {
  return name.replace(/^The /, 'the ');
}
