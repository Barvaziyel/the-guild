/**
 * Time passing: Depot days and returning crews, in the order they happen.
 */
import { DAY_MS, MAX_CATCHUP_DAYS } from '../constants.ts';
import { completeDueRuns, settleRadio } from '../expedition/runs.ts';
import { dayAt, withRng } from '../game.ts';
import type { GameState, GuildLogEntry, RunReport } from '../types.ts';
import { emptySummary, playDepotDay, type DepotSummary } from './day.ts';
import { expireOffers, rollDepotEvents } from './events.ts';
import { refreshRecruits } from './recruits.ts';
import { playDilemmaDay } from '../dilemmas.ts';
import { playRescueDay } from '../rescue.ts';
import { playFamilyDay } from '../family.ts';
import { playVulturesDay } from '../vultures.ts';
import { expireStrays } from '../animals.ts';

export interface AdvanceResult {
  /** Crews that came home, oldest first. */
  reports: RunReport[];
  /** What the Depot days brought. */
  depot: DepotSummary;
  /** Days that were too long ago to play (the game was closed for more than a week of game days). */
  skippedDays: number;
}

/** When game day `day` begins. */
export function dayStart(state: GameState, day: number): number {
  return state.createdAt + (day - 1) * DAY_MS;
}

/** When the next Depot day begins after `now`. */
export function nextDayAt(state: GameState, now: number): number {
  return dayStart(state, dayAt(state, now) + 1);
}

/**
 * Bring the game up to `now`. Each new day is played in turn: crews due back
 * before it begins come home first, then the Depot has its day (people eat,
 * work, heal and rest, and something may happen). At most MAX_CATCHUP_DAYS
 * are played; older missed days are skipped, so a long absence can't spiral.
 */
export function advanceTime(state: GameState, now: number): AdvanceResult {
  const today = dayAt(state, now);
  const result: AdvanceResult = { reports: [], depot: emptySummary(), skippedDays: 0 };
  const firstLogged = state.log[state.log.length - 1];

  let from = state.depot.lastDay + 1;
  if (today - state.depot.lastDay > MAX_CATCHUP_DAYS) {
    from = today - MAX_CATCHUP_DAYS + 1;
    result.skippedDays = from - state.depot.lastDay - 1;
  }

  // Crews nobody answered on the radio have made the call themselves (§7.12).
  settleRadio(state, now);
  for (let day = from; day <= today; day++) {
    result.reports.push(...completeDueRuns(state, dayStart(state, day)));
    withRng(state, (rng) => {
      expireOffers(state, day);
      expireStrays(state, day);
      playDepotDay(state, day, rng, result.depot);
      rollDepotEvents(state, day, rng);
      refreshRecruits(state, day, rng);
      playDilemmaDay(state, day, rng);
      playRescueDay(state, day, rng);
      playFamilyDay(state, day, rng);
      playVulturesDay(state, day, rng);
    });
    state.depot.lastDay = day;
  }
  if (today > state.depot.lastDay) state.depot.lastDay = today;

  result.reports.push(...completeDueRuns(state, now));
  state.lastUpdate = Math.max(state.lastUpdate, now);
  result.depot.news = newsSince(state, firstLogged);
  return result;
}

/** Log entries written after `last` (all of them if it's gone). */
function newsSince(state: GameState, last: GuildLogEntry | undefined): GuildLogEntry[] {
  if (!last) return [...state.log];
  const index = state.log.lastIndexOf(last);
  return index < 0 ? [...state.log] : state.log.slice(index + 1);
}
