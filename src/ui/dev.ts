/**
 * Developer tools: fast-forward a guild through a batch of runs, or skip ahead
 * to a crew's return.
 *
 * Both play time forward from `now` and then slide the whole timeline back by
 * the time that took, as if the guild had been founded earlier. Day numbers in
 * Chronicles and logs stay consistent, and nothing ends up in the future.
 * Depot days are played for real (eating, healing, work, events).
 */
import {
  DAY_MS,
  advanceTime,
  dailyUpkeep,
  dayAt,
  knownLocations,
  rationsNeeded,
  startRun,
  unavailableReason,
  validatePlan,
  withRng,
  type GameState,
  type RunPlan,
} from '../engine/index.ts';

export interface FastForwardOptions {
  runs: number;
  /** Highest location danger the crews are sent to. */
  maxDanger: number;
  /** Days at the Depot after each run. */
  restDays: number;
}

export interface FastForwardResult {
  runs: number;
  deaths: number;
  /** Game days that passed. */
  days: number;
}

const DEFAULTS: FastForwardOptions = { runs: 10, maxDanger: 3, restDays: 3 };

export function fastForward(state: GameState, now: number, options: Partial<FastForwardOptions> = {}): FastForwardResult {
  const opts = { ...DEFAULTS, ...options };
  const startDay = dayAt(state, now);
  let t = now;
  let played = 0;
  let deaths = 0;

  /** Play time up to `to`. Reports from fast-forward count as read. */
  const settle = (to: number): void => {
    for (const report of advanceTime(state, to).reports) {
      report.read = true;
      deaths += report.summary.deaths.length;
    }
  };

  settle(t);
  // Crews already out come home first.
  if (state.runs.length > 0) {
    t = Math.max(...state.runs.map((r) => r.returnAt));
    settle(t);
  }

  for (let i = 0; i < opts.runs; i++) {
    const ready = state.survivors.filter((s) => !unavailableReason(s));
    const options = knownLocations(state).filter((l) => l.danger <= opts.maxDanger);
    if (ready.length > 0 && options.length > 0) {
      const plan = withRng(state, (rng): RunPlan => ({
        locationId: rng.pick(options).id,
        crew: rng.sample(ready, Math.min(3, ready.length)).map((s) => s.id),
        job: rng.pick(['scavenge', 'scavenge', 'scout', 'hunt'] as const),
        meds: Math.min(1, state.resources.meds),
        ammo: Math.min(10, state.resources.ammo),
        approach: 'balanced',
        retreat: 'downed',
      }));
      // Fast-forward never stalls for food.
      state.resources.rations = Math.max(state.resources.rations, rationsNeeded(state, plan));
      // Nobody goes out while raiders are at the gate: the rest of the wait plays it out.
      if (validatePlan(state, plan).length === 0) {
        const run = startRun(state, plan, t);
        t = run.returnAt;
        played += 1;
      }
    }
    t += opts.restDays * DAY_MS;
    state.resources.rations = Math.max(state.resources.rations, dailyUpkeep(state) * (opts.restDays + 3));
    settle(t);
  }

  shiftTimeline(state, now - t);
  state.lastUpdate = now;
  return { runs: played, deaths, days: dayAt(state, now) - startDay };
}

/**
 * Developer shortcut: let time pass until a crew (or every crew, without an
 * id) is due back. The crews then come home through the normal return.
 * Returns how much time was skipped.
 */
export function skipToReturn(state: GameState, now: number, runId?: string): number {
  const runs = runId ? state.runs.filter((r) => r.id === runId) : state.runs;
  const target = Math.max(now, ...runs.map((r) => r.returnAt));
  const skipped = target - now;
  if (skipped > 0) shiftTimeline(state, -skipped);
  return skipped;
}

/** Move every timestamp in the save by `delta` ms. Day numbers stay as they are. */
export function shiftTimeline(state: GameState, delta: number): void {
  state.createdAt += delta;
  state.lastUpdate += delta;
  for (const run of state.runs) {
    run.departAt += delta;
    run.returnAt += delta;
    for (const f of run.lead?.fights ?? []) {
      f.at += delta;
      f.until += delta;
      if (f.took !== undefined) f.took += delta;
      if (f.ended !== undefined) f.ended += delta;
    }
    if (run.radio) {
      run.radio.at += delta;
      run.radio.until += delta;
      if (run.radio.answeredAt !== undefined) run.radio.answeredAt += delta;
      for (const b of Object.values(run.radio.branches ?? {})) b.returnAt += delta;
    }
  }
  for (const report of state.reports) {
    report.departAt += delta;
    report.returnAt += delta;
  }
}
