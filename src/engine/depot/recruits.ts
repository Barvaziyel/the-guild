/**
 * The recruit board: who is at the gate, and taking them in.
 */
import { RADIO_ANSWER_CHANCE, RECRUIT_BONUS_POINTS, RECRUIT_WAIT_DAYS, STAT_GEN_MAX, WANDERER_DAYS } from '../constants.ts';
import { addGuildLog } from '../chronicle.ts';
import { recruit } from '../game.ts';
import { joinFound, joinRescued } from '../rescue.ts';
import { fullName } from '../text.ts';
import { generateSurvivor } from '../generator.ts';
import type { Rng } from '../rng.ts';
import { maxHp } from '../stats.ts';
import type { Candidate, GameState, Survivor } from '../types.ts';
import { STAT_IDS } from '../types.ts';
import { bunksCap, hasFreeBunk, workingLevel } from './buildings.ts';
import { vulturesGet, vulturesTake } from '../vultures.ts';

/** The day's chance that someone answers the radio. */
export function radioAnswerChance(state: GameState): number {
  return RADIO_ANSWER_CHANCE[workingLevel(state, 'radio_tower')] ?? RADIO_ANSWER_CHANCE[RADIO_ANSWER_CHANCE.length - 1]!;
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
 * The start of a day at the gate: whoever's time is up moves on, and now and
 * then someone answers the radio (more often with a Radio Tower).
 */
export function refreshRecruits(state: GameState, day: number, rng: Rng): void {
  // Left waiting until they give up, they may go to the Vultures instead (§7.11).
  for (const c of state.depot.recruits) {
    if (c.expiresDay <= day && vulturesGet(state, rng)) vulturesTake(state, c.survivor, day, '{name} got tired of waiting at the gate, and went to the Vultures.');
  }
  state.depot.recruits = state.depot.recruits.filter((c) => c.expiresDay > day);
  if (rng.chance(radioAnswerChance(state))) addRadioRecruit(state, day, rng);
}

/** Someone answers the radio and waits at the gate a few days. */
export function addRadioRecruit(state: GameState, day: number, rng: Rng): Candidate {
  const c: Candidate = { survivor: generateCandidate(state, rng, day), expiresDay: day + RECRUIT_WAIT_DAYS };
  state.depot.recruits.push(c);
  addGuildLog(state, day, `${fullName(c.survivor)} answered the radio and is waiting at the gate.`, ['recruit', c.survivor.id]);
  return c;
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
  if (c!.found) {
    // Found out there by a crew and waiting for a bed (§10).
    joinFound(state, s, state.survivors.find((x) => x.id === c!.found!.by), c!.found.locationId, rng, day);
    return s;
  }
  recruit(state, s, rng, day, c!.wanderer ? 'Came in off the road and stayed.' : 'Answered the radio and joined the guild.');
  return s;
}
