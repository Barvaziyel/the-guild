/**
 * The recruit board: who is at the gate, and taking them in.
 */
import { RECRUITS_BASE, RECRUIT_BONUS_POINTS, STAT_GEN_MAX, WANDERER_DAYS } from '../constants.ts';
import { recruit } from '../game.ts';
import { joinRescued } from '../rescue.ts';
import { generateSurvivor } from '../generator.ts';
import type { Rng } from '../rng.ts';
import { maxHp } from '../stats.ts';
import type { Candidate, GameState, Survivor } from '../types.ts';
import { STAT_IDS } from '../types.ts';
import { bunksCap, hasFreeBunk, workingLevel } from './buildings.ts';

/** How many answer the radio each day. */
export function boardSize(state: GameState): number {
  return RECRUITS_BASE + workingLevel(state, 'radio_tower');
}

/** A new face. A better Radio Tower draws people who've been around a bit. */
export function generateCandidate(state: GameState, rng: Rng, day: number): Survivor {
  const s = generateSurvivor(state, rng, { day });
  let extra = RECRUIT_BONUS_POINTS[workingLevel(state, 'radio_tower')] ?? 0;
  while (extra > 0) {
    const room = STAT_IDS.filter((id) => s.stats[id] < STAT_GEN_MAX);
    if (room.length === 0) break;
    s.stats[rng.pick(room)] += 1;
    extra -= 1;
  }
  s.hp = maxHp(s);
  return s;
}

/**
 * The start of a day at the gate: yesterday's recruits and any wanderers whose
 * time is up move on, and a fresh set answers the radio.
 */
export function refreshRecruits(state: GameState, day: number, rng: Rng): void {
  state.depot.recruits = state.depot.recruits.filter((c) => c.expiresDay > day);
  const regular = state.depot.recruits.filter((c) => !c.wanderer).length;
  for (let i = regular; i < boardSize(state); i++) {
    state.depot.recruits.push({ survivor: generateCandidate(state, rng, day), expiresDay: day + 1 });
  }
}

/** A wanderer turns up on their own and waits a few days. */
export function addWanderer(state: GameState, day: number, rng: Rng): Candidate {
  const c: Candidate = { survivor: generateCandidate(state, rng, day), expiresDay: day + WANDERER_DAYS, wanderer: true };
  state.depot.recruits.push(c);
  return c;
}

/** Why this candidate can't be taken in, or undefined if they can. */
export function recruitProblem(state: GameState, candidateId: string): string | undefined {
  if (!state.depot.recruits.some((c) => c.survivor.id === candidateId)) return 'They have moved on.';
  if (!hasFreeBunk(state)) return `All ${bunksCap(state)} beds are taken. Improve the Bunks to make room.`;
  return undefined;
}

/** Take someone in from the gate. Throws if they can't join. */
export function takeIn(state: GameState, candidateId: string, rng: Rng, day: number): Survivor {
  const problem = recruitProblem(state, candidateId);
  if (problem) throw new Error(problem);
  const index = state.depot.recruits.findIndex((c) => c.survivor.id === candidateId);
  const [c] = state.depot.recruits.splice(index, 1);
  const s = c!.survivor;
  s.joinedDay = day;
  if (c!.rescued) {
    // Brought home by a rescue run and waiting for a bed (§10.1).
    joinRescued(state, s, state.survivors.find((x) => x.id === c!.rescued!.by), c!.rescued.locationId, rng, day);
    return s;
  }
  recruit(state, s, rng, day, c!.wanderer ? 'Came in off the road and stayed.' : 'Answered the radio and joined the guild.');
  return s;
}
