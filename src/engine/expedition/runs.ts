/**
 * The life of a run in the real game state: sending a crew out, revealing the
 * log while they're away, and applying the outcome when they come home.
 */
import { addChronicle, addGuildLog } from '../chronicle.ts';
import { MAX_REPORTS } from '../constants.ts';
import { ENEMIES, getLocation } from '../content/index.ts';
import { dayAt, withRng } from '../game.ts';
import { newId } from '../ids.ts';
import { ensureLocationState } from '../locations.ts';
import { pairKey, relationshipLabel } from '../relationships.ts';
import { Rng } from '../rng.ts';
import { fullName } from '../text.ts';
import { addTrait, hasTrait } from '../traits.ts';
import type { Beat, GameState, Run, RunDeath, RunPlan, RunReport, RunSummary, Survivor } from '../types.ts';
import { RESOURCE_IDS, SLOTS } from '../types.ts';
import { rationsNeeded, validatePlan } from './plan.ts';
import { simulateRun } from './sim.ts';

/**
 * Send a crew out. The whole run is simulated now and stored; nothing that
 * happens at the Depot afterwards can change it. Throws if the plan is invalid.
 */
export function startRun(state: GameState, plan: RunPlan, now: number): Run {
  const problems = validatePlan(state, plan);
  if (problems.length > 0) throw new Error(`Cannot start run: ${problems.join(' ')}`);

  const seed = String(withRng(state, (rng) => rng.seed32()));
  const sim = simulateRun(state, plan, seed, now);
  // Items found on the run already have ids; keep the counter ahead of them.
  state.nextId = sim.nextId;

  const run: Run = {
    id: newId(state, 'r'),
    plan: structuredClone(plan),
    seed,
    departAt: now,
    returnAt: sim.returnAt,
    rations: sim.rations,
    beats: sim.beats,
    result: sim.result,
  };

  state.resources.rations -= rationsNeeded(state, plan);
  state.resources.meds -= plan.meds;
  state.resources.ammo -= plan.ammo;
  for (const id of plan.crew) {
    const s = state.survivors.find((x) => x.id === id)!;
    s.status = 'away';
  }
  state.runs.push(run);

  const names = plan.crew.map((id) => state.survivors.find((x) => x.id === id)!.firstName);
  addGuildLog(state, dayAt(state, now), `${names.join(', ')} set out for ${getLocation(plan.locationId).name}.`, ['run', run.id]);
  return run;
}

/** The part of a run's log that has happened by `now`. */
export function visibleBeats(run: Run, now: number): Beat[] {
  return run.beats.filter((b) => run.departAt + b.at <= now);
}

/** Runs whose crews are back and waiting to be read. */
export function dueRuns(state: GameState, now: number): Run[] {
  return state.runs.filter((r) => r.returnAt <= now);
}

function summaryOf(run: Run): RunSummary {
  const { crew: _crew, relationships: _relationships, ...summary } = run.result;
  return summary;
}

/** Those left behind: friends grieve, and the closest are changed by it. */
function mourn(state: GameState, death: RunDeath, rng: Rng, day: number): void {
  for (const s of state.survivors) {
    const label = relationshipLabel(state, s.id, death.survivorId);
    if (label !== 'friend' && label !== 'bonded') continue;
    addTrait(s, 'grieving', { day, rng });
    addChronicle(s, day, `Mourned ${death.name}.`, ['loss', death.survivorId]);
    if (label !== 'bonded') continue;
    const canAvenge = death.enemyType !== undefined && ENEMIES.some((e) => e.type === death.enemyType) && !hasTrait(s, 'vengeful');
    if (canAvenge && rng.chance(0.5)) {
      const plural = getEnemyTypeName(death.enemyType!);
      addTrait(s, 'vengeful', { day, target: death.enemyType!, source: `${death.name} was killed by ${plural}`, force: true });
    } else {
      addTrait(s, 'haunted', { day, source: `losing ${death.name}`, force: true });
    }
  }
}

const ENEMY_TYPE_NAMES: Record<string, string> = { raider: 'raiders', feral: 'ferals', hollow: 'Hollows', scrapbot: 'Scrapbots' };

/** "raiders", "ferals", ... for an enemy type id. */
export function getEnemyTypeName(type: string): string {
  return ENEMY_TYPE_NAMES[type] ?? type;
}

/**
 * Bring a crew home: apply everything the run decided to the real state and
 * file the report. Throws if the run isn't back yet.
 */
export function completeRun(state: GameState, runId: string, now: number): RunReport {
  const index = state.runs.findIndex((r) => r.id === runId);
  const run = state.runs[index];
  if (!run) throw new Error(`Unknown run: ${runId}`);
  if (now < run.returnAt) throw new Error('The crew is not back yet.');
  state.runs.splice(index, 1);

  const { result, plan } = run;
  const day = dayAt(state, run.returnAt);
  const loc = getLocation(plan.locationId);
  const crewNames: Record<string, string> = {};
  const lost = result.outcome === 'lost';

  // The crew as the run left them.
  for (const after of result.crew) {
    crewNames[after.id] = fullName(after);
    const i = state.survivors.findIndex((s) => s.id === after.id);
    if (i < 0) continue;
    if (after.status === 'dead') {
      state.survivors.splice(i, 1);
      state.memorial.push(after);
      if (!lost) bringGearHome(state, after);
      addGuildLog(state, day, `${fullName(after)} died at ${loc.name}.`, ['death', after.id]);
    } else {
      after.status = 'ready';
      state.survivors[i] = after;
    }
  }
  for (const rel of result.relationships) state.relationships[pairKey(rel.a, rel.b)] = rel;

  const rng = new Rng(`return:${run.seed}`);
  for (const death of result.deaths) mourn(state, death, rng, day);

  for (const res of RESOURCE_IDS) state.resources[res] += result.loot[res];
  state.resources.meds += result.medsLeft;
  state.resources.ammo += result.ammoLeft;
  state.stash.push(...result.items);

  const here = ensureLocationState(state, loc.id);
  here.runs += 1;
  here.explored = Math.min(100, here.explored + result.exploredGain);
  for (const id of result.discovered) {
    const found = ensureLocationState(state, id);
    if (found.discovered) continue;
    found.discovered = true;
    addGuildLog(state, day, `Discovered ${getLocation(id).name}.`, ['discovery', id]);
  }

  for (const id of result.events) state.eventsSeen[id] = (state.eventsSeen[id] ?? 0) + 1;

  const outcomeText = { completed: 'returned from', turnedBack: 'came back early from', routed: 'were routed at', lost: 'never came back from' }[result.outcome];
  addGuildLog(state, day, `The crew ${outcomeText} ${loc.name}.`, ['run', run.id]);

  const report: RunReport = {
    id: run.id,
    plan,
    departAt: run.departAt,
    returnAt: run.returnAt,
    beats: run.beats,
    summary: summaryOf(run),
    crewNames,
    read: false,
  };
  state.reports.unshift(report);
  state.reports.length = Math.min(state.reports.length, MAX_REPORTS);
  return report;
}

/**
 * Bring home every crew that is back by `now`, in the order they returned.
 * Returns the new reports, oldest first.
 */
export function completeDueRuns(state: GameState, now: number): RunReport[] {
  const due = dueRuns(state, now).sort((a, b) => a.returnAt - b.returnAt);
  return due.map((run) => completeRun(state, run.id, now));
}

/** The player has opened this report. */
export function markReportRead(state: GameState, reportId: string): void {
  const report = state.reports.find((r) => r.id === reportId);
  if (report) report.read = true;
}

/** A dead survivor's gear goes back into the stash. */
function bringGearHome(state: GameState, s: Survivor): void {
  for (const slot of SLOTS) {
    const item = s.equipment[slot];
    if (!item) continue;
    delete s.equipment[slot];
    delete item.cherishedBy;
    item.runsWithHolder = 0;
    state.stash.push(item);
  }
}

// ---------------------------------------------------------------- risk

export type RiskLabel = 'Low' | 'Moderate' | 'High' | 'Deadly';

export interface RiskEstimate {
  label: RiskLabel;
  /** Share of simulated runs where someone went down. */
  downed: number;
  /** Share of simulated runs where someone died. */
  death: number;
  /** Share of simulated runs that came home early or routed. */
  cutShort: number;
  samples: number;
}

/**
 * Estimate how dangerous a plan is by quietly simulating it many times with
 * different luck. Doesn't change the state or use up the game's random numbers.
 */
export function estimateRisk(state: GameState, plan: RunPlan, samples = 50): RiskEstimate {
  let downed = 0;
  let death = 0;
  let cutShort = 0;
  for (let i = 0; i < samples; i++) {
    const { result } = simulateRun(state, plan, `risk:${i}`, state.lastUpdate);
    if (result.deaths.length > 0) death++;
    const wentDown = result.crew.some((after) => {
      const before = state.survivors.find((s) => s.id === after.id);
      return before !== undefined && after.counters.timesDowned > before.counters.timesDowned;
    });
    if (wentDown) downed++;
    if (result.outcome !== 'completed') cutShort++;
  }
  const pDown = downed / samples;
  const pDeath = death / samples;
  const label: RiskLabel = pDeath >= 0.1 || pDown >= 0.6 ? 'Deadly' : pDown >= 0.35 ? 'High' : pDown >= 0.15 ? 'Moderate' : 'Low';
  return { label, downed: pDown, death: pDeath, cutShort: cutShort / samples, samples };
}
