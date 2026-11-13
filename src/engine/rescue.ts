/**
 * Calls for help (§10.1). With a Radio Tower, now and then someone out in the
 * Reach calls for help from a known place. A crew can go on a rescue run while
 * the call lasts; brought home alive, the person joins the guild owing their
 * rescuer a life. The run itself is played in `expedition/rescue.ts`.
 */
import { addChronicle, addGuildLog } from './chronicle.ts';
import {
  REL_FOUND,
  REL_SAVED,
  RESCUE_BONUS_POINTS,
  RESCUE_DAYS,
  RESCUE_FIRST_GAP,
  RESCUE_GAP,
  RESCUE_WAIT_DAYS,
  STAT_GEN_MAX,
} from './constants.ts';
import { getLocation } from './content/index.ts';
import { hasFreeBunk, workingLevel } from './depot/buildings.ts';
import { generateCandidate } from './depot/recruits.ts';
import { recruit } from './game.ts';
import { newId } from './ids.ts';
import { knownLocations } from './locations.ts';
import { addFlag, adjustRelationship } from './relationships.ts';
import type { Rng } from './rng.ts';
import { maxHp } from './stats.ts';
import { fill, fullName, pronounForms } from './text.ts';
import type { FoundNews, GameState, RescueCall, RescueNews, RescueTrouble, Run, Survivor } from './types.ts';
import { STAT_IDS } from './types.ts';
import { vulturesGet, vulturesTake } from './vultures.ts';

export const RESCUE_TROUBLES: readonly RescueTrouble[] = ['trapped', 'hurt', 'cornered', 'lost'];

/** What trouble someone is in, for the call and the Depot: "pinned under a fallen wall at the Drowned Mall". */
export function troubleText(call: Pick<RescueCall, 'trouble' | 'locationId'>): string {
  const place = getLocation(call.locationId).name;
  switch (call.trouble) {
    case 'trapped':
      return `pinned under a fallen wall at ${place}`;
    case 'hurt':
      return `hurt and bleeding, holed up at ${place}`;
    case 'cornered':
      return `cornered at ${place}, with something prowling outside`;
    case 'lost':
      return `lost somewhere around ${place}, and out of water`;
  }
}

/** A live call nobody has gone to answer yet, at this place (or anywhere). */
export function openCall(state: GameState, locationId?: string): RescueCall | undefined {
  const call = state.rescue.call;
  if (!call || call.runId) return undefined;
  return !locationId || call.locationId === locationId ? call : undefined;
}

/**
 * A Depot day for calls: an unanswered one goes quiet when its time is up;
 * otherwise, with a Radio Tower, a new one comes when its day comes.
 */
export function playRescueDay(state: GameState, day: number, rng: Rng): RescueCall | undefined {
  const r = state.rescue;
  if (r.call) {
    if (!r.call.runId && day >= r.call.expiresDay) {
      const place = getLocation(r.call.locationId).name;
      // Nobody went: the Vultures may have (§7.11).
      if (vulturesGet(state, rng)) vulturesTake(state, r.call.person, day, `The voice from ${place} has gone quiet. The Vultures got to {name} first.`);
      else addGuildLog(state, day, `The voice from ${place} has gone quiet. Nobody went for ${fullName(r.call.person)}.`, ['rescue']);
      delete r.call;
      r.nextDay = day + rng.int(RESCUE_GAP[0], RESCUE_GAP[1]);
    }
    return undefined;
  }
  // Calls come over the radio: none until there's a Radio Tower to hear them, and not on its first days.
  if (workingLevel(state, 'radio_tower') === 0) {
    r.nextDay = Math.max(r.nextDay, day + RESCUE_FIRST_GAP);
    return undefined;
  }
  if (day < r.nextDay) return undefined;
  return startCall(state, day, rng);
}

/** Someone calls for help from a known place. Returns the call. */
export function startCall(state: GameState, day: number, rng: Rng, locationId?: string, trouble?: RescueTrouble): RescueCall | undefined {
  const places = knownLocations(state);
  if (places.length === 0) return undefined;
  const place = locationId ?? rng.pick(places).id;
  const person = rescueCandidate(state, rng, day);
  const call: RescueCall = {
    id: newId(state, 'h'),
    locationId: place,
    person,
    trouble: trouble ?? rng.pick(RESCUE_TROUBLES),
    day,
    expiresDay: day + RESCUE_DAYS,
  };
  state.rescue.call = call;
  addGuildLog(state, day, `A voice on the radio: ${fullName(person)}, ${troubleText(call)}. ${fill("{They} won't last long out there.", person)}`, ['rescue', place]);
  return call;
}

/** Someone worth the trip: a recruit with a couple of points more, who has lived through a lot. */
function rescueCandidate(state: GameState, rng: Rng, day: number): Survivor {
  const s = generateCandidate(state, rng, day);
  for (let extra = RESCUE_BONUS_POINTS; extra > 0; extra--) {
    const room = STAT_IDS.filter((id) => s.stats[id] < STAT_GEN_MAX);
    if (room.length === 0) break;
    s.stats[rng.pick(room)] += 1;
  }
  s.hp = maxHp(s);
  return s;
}

/** A crew sets out to answer the call. */
export function answerCall(state: GameState, run: Run): void {
  if (run.plan.job === 'rescue' && state.rescue.call) state.rescue.call.runId = run.id;
}

/**
 * The rescue crew is back. Brought home alive, the person joins (or waits at
 * the gate for a bed); otherwise the guild hears how it ended.
 */
export function applyRescue(state: GameState, run: Run, news: RescueNews, day: number, rng: Rng): void {
  const call = state.rescue.call;
  if (call?.runId === run.id) {
    delete state.rescue.call;
    state.rescue.nextDay = day + rng.int(RESCUE_GAP[0], RESCUE_GAP[1]);
  }
  const place = getLocation(run.plan.locationId).name;
  const person = news.person;
  const name = fullName(person);
  if (news.outcome === 'missed') {
    addGuildLog(state, day, `The crew searched ${place} for ${name} and never found ${pronounForms(person.pronouns).them}.`, ['rescue']);
    return;
  }
  if (news.outcome === 'lost') {
    addGuildLog(state, day, `${name} didn't make it out of ${place}.`, ['rescue']);
    return;
  }
  const by = news.by ? state.survivors.find((s) => s.id === news.by) : undefined;
  if (hasFreeBunk(state)) {
    joinRescued(state, person, by, run.plan.locationId, rng, day);
    return;
  }
  state.depot.recruits.push({
    survivor: person,
    expiresDay: day + RESCUE_WAIT_DAYS,
    wanderer: true,
    ...(by ? { rescued: { by: by.id, locationId: run.plan.locationId } } : {}),
  });
  addGuildLog(state, day, `${name} came home from ${place} with the crew, but there's no bed free. ${fill('{They} will wait at the gate a few days.', person)}`, ['rescue', person.id]);
}

/**
 * Someone a crew found out there (a run event) comes home with them (§10):
 * they join if a bed is free, or wait at the gate for one.
 */
export function bringHomeFound(state: GameState, run: Run, news: FoundNews, day: number, rng: Rng): void {
  const place = getLocation(run.plan.locationId).name;
  const by = state.survivors.find((s) => s.id === news.by);
  if (hasFreeBunk(state)) {
    joinFound(state, news.person, by, run.plan.locationId, rng, day);
    return;
  }
  state.depot.recruits.push({
    survivor: news.person,
    expiresDay: day + RESCUE_WAIT_DAYS,
    wanderer: true,
    ...(by ? { found: { by: by.id, locationId: run.plan.locationId } } : {}),
  });
  addGuildLog(state, day, `${fullName(news.person)} came home from ${place} with the crew, but there's no bed free. ${fill('{They} will wait at the gate a few days.', news.person)}`, ['recruit', news.person.id]);
}

/** Someone found out there joins, on good terms with whoever brought them home. */
export function joinFound(state: GameState, person: Survivor, by: Survivor | undefined, locationId: string, rng: Rng, day: number): void {
  const place = getLocation(locationId).name;
  recruit(state, person, rng, day, by ? `Came home from ${place} with ${fullName(by)} and stayed.` : `Came home from ${place} with a crew and stayed.`);
  if (!by || !state.survivors.includes(by)) return;
  adjustRelationship(state, by.id, person.id, REL_FOUND, { day, useTraitMult: false });
  addChronicle(by, day, `Brought ${fullName(person)} home from ${place}.`, ['recruit', person.id]);
}

/** A rescued person joins: they owe whoever got them out a life. */
export function joinRescued(state: GameState, person: Survivor, by: Survivor | undefined, locationId: string, rng: Rng, day: number): void {
  const place = getLocation(locationId).name;
  recruit(state, person, rng, day, by ? `Brought out of ${place} alive by ${fullName(by)}.` : `Brought out of ${place} alive.`);
  if (!by || !state.survivors.includes(by)) return;
  adjustRelationship(state, by.id, person.id, REL_SAVED, { day, useTraitMult: false });
  addFlag(state, by.id, person.id, { kind: 'owesLife', debtor: person.id });
  addChronicle(person, day, `Owes ${fullName(by)} a life after ${place}.`, ['rescue', by.id]);
}
