/**
 * Developer fast-forward: plays a guild through a batch of runs at once, so
 * the screens have people with history to show before the run planner exists.
 *
 * It plays the runs forward from `now` and then slides the whole timeline back
 * by the time that took, as if the guild had been founded earlier. Day numbers
 * in Chronicles and logs stay consistent, and nothing ends up in the future.
 * Rest between runs is faked (as in scripts/career.ts) until the Depot arrives.
 */
import {
  DAY_MS,
  completeRun,
  dayAt,
  expireConditions,
  knownLocations,
  maxHp,
  rationsNeeded,
  startRun,
  unavailableReason,
  withRng,
  type GameState,
  type RunPlan,
} from '../engine/index.ts';

export interface FastForwardOptions {
  runs: number;
  /** Highest location danger the crews are sent to. */
  maxDanger: number;
  /** Days of rest after each run. */
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

  // Crews already out come home first.
  for (const run of [...state.runs].sort((a, b) => a.returnAt - b.returnAt)) {
    t = Math.max(t, run.returnAt);
    deaths += completeRun(state, run.id, t).summary.deaths.length;
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
      const run = startRun(state, plan, t);
      const report = completeRun(state, run.id, run.returnAt);
      report.read = true;
      t = run.returnAt;
      played += 1;
      deaths += report.summary.deaths.length;
    }
    t += opts.restDays * DAY_MS;
    rest(state, t, opts.restDays);
  }

  shiftTimeline(state, now - t);
  state.lastUpdate = now;
  return { runs: played, deaths, days: dayAt(state, now) - startDay };
}

/** Stand-in for Depot days: wounds close, conditions pass, nerves settle. */
function rest(state: GameState, t: number, days: number): void {
  const day = dayAt(state, t);
  for (const s of state.survivors) {
    expireConditions(s, day);
    s.hp = maxHp(s);
    s.stress = Math.max(0, s.stress - 5 * days);
  }
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

/** Move every timestamp in the save by `delta` ms. */
export function shiftTimeline(state: GameState, delta: number): void {
  state.createdAt += delta;
  state.lastUpdate += delta;
  for (const run of state.runs) {
    run.departAt += delta;
    run.returnAt += delta;
  }
  for (const report of state.reports) {
    report.departAt += delta;
    report.returnAt += delta;
  }
}
