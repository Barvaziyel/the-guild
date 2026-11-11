/**
 * The life of a run in the real game state: sending a crew out, revealing the
 * log while they're away, and applying the outcome when they come home.
 */
import { addChronicle, addGuildLog } from '../chronicle.ts';
import { MAX_REPORTS, PARTNER_GRIEF_EXTRA_DAYS, PARTNER_LOSS_STRESS, STRESS_MAX } from '../constants.ts';
import { buildingName, trimPosts } from '../depot/buildings.ts';
import { ENEMIES, getLocation } from '../content/index.ts';
import { dayAt, withRng } from '../game.ts';
import { newId } from '../ids.ts';
import { ensureLocationState } from '../locations.ts';
import { arePartners, pairKey, relationshipLabel } from '../relationships.ts';
import { Rng } from '../rng.ts';
import { changeStress } from '../stats.ts';
import { fullName, pronounForms } from '../text.ts';
import { addTrait, getTraitInstance, hasTrait } from '../traits.ts';
import type { Beat, DepartureMark, GameState, Run, RunDeath, RunPlan, RunReport, RunSummary, Survivor } from '../types.ts';
import { RESOURCE_IDS, SLOTS } from '../types.ts';
import { rationsPacked, validatePlan } from './plan.ts';
import { simulateRun } from './sim.ts';
import { gasNeeded, planVehicles, vehicleName } from '../vehicles.ts';
import { addStory, applyNemesisNews } from './stories.ts';

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

  state.resources.rations -= rationsPacked(state, plan);
  state.resources.meds -= plan.meds;
  state.resources.ammo -= plan.ammo;
  const vehicles = planVehicles(state, plan);
  if (vehicles.length > 0) {
    run.gas = gasNeeded(state, plan);
    state.resources.gas -= run.gas;
    for (const v of vehicles) v.runId = run.id;
  }
  for (const id of plan.crew) {
    const s = state.survivors.find((x) => x.id === id)!;
    run.departed = { ...run.departed, [s.id]: { traits: s.traits.map((t) => t.id), stress: s.stress, chronicle: s.chronicle.length } };
    s.status = 'away';
  }
  state.runs.push(run);

  const names = plan.crew.map((id) => state.survivors.find((x) => x.id === id)!.firstName);
  const riding = vehicles.length === 0 ? '' : ` in the ${vehicles.map(vehicleName).join(' and the ')}`;
  addGuildLog(state, dayAt(state, now), `${names.join(', ')} set out for ${getLocation(plan.locationId).name}${riding}.`, ['run', run.id]);
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

/**
 * A crew member coming home: the run's copy of them (taken at departure),
 * plus what happened to them at the Depot while they were out. Their post is
 * the Depot's to change; Grief over another crew's dead, news of a nemesis,
 * and the Chronicle lines that came with them were written to the real record.
 */
function homecoming(home: Survivor, after: Survivor, departed: DepartureMark | undefined): Survivor {
  if (home.post) after.post = home.post;
  else delete after.post;
  if (!departed) return after;
  for (const t of home.traits) {
    if (!departed.traits.includes(t.id) && !after.traits.some((x) => x.id === t.id)) after.traits.push(t);
  }
  after.stress = Math.max(0, Math.min(STRESS_MAX, after.stress + home.stress - departed.stress));
  const notes = home.chronicle.slice(departed.chronicle);
  if (notes.length > 0) after.chronicle = [...after.chronicle, ...notes].sort((a, b) => a.day - b.day);
  return after;
}

/** Those left behind: friends grieve, and the closest are changed by it. */
function mourn(state: GameState, death: RunDeath, rng: Rng, day: number): void {
  for (const s of state.survivors) {
    const label = relationshipLabel(state, s.id, death.survivorId);
    if (label !== 'friend' && label !== 'bonded') continue;
    addTrait(s, 'grieving', { day, rng });
    if (arePartners(state, s.id, death.survivorId)) {
      // Losing a partner hits harder: a longer grief, and a heavy weight.
      const grief = getTraitInstance(s, 'grieving');
      if (grief?.expiresDay !== undefined) grief.expiresDay += PARTNER_GRIEF_EXTRA_DAYS;
      addChronicle(s, day, `Lost ${death.name}, ${pronounForms(s.pronouns).their} partner.`, ['loss', death.survivorId]);
      changeStress(s, PARTNER_LOSS_STRESS, { rng, day, source: `losing ${death.name}` });
    } else {
      addChronicle(s, day, `Mourned ${death.name}.`, ['loss', death.survivorId]);
    }
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

  // The crew as the run left them, with what happened to them at home meanwhile.
  for (const ran of result.crew) {
    const i = state.survivors.findIndex((s) => s.id === ran.id);
    if (i < 0) continue;
    const after = homecoming(state.survivors[i]!, ran, run.departed?.[ran.id]);
    crewNames[after.id] = fullName(after);
    if (after.status === 'dead') {
      state.survivors.splice(i, 1);
      state.memorial.push(after);
      if (!lost) bringGearHome(state, after, day, loc.name);
      addGuildLog(state, day, `${fullName(after)} died at ${loc.name}.`, ['death', after.id]);
    } else {
      after.status = 'ready';
      state.survivors[i] = after;
    }
  }
  for (const rel of result.relationships) state.relationships[pairKey(rel.a, rel.b)] = rel;

  const rng = new Rng(`return:${run.seed}`);
  for (const death of result.deaths) mourn(state, death, rng, day);
  for (const news of result.nemeses ?? []) applyNemesisNews(state, news, result.crew, day, rng);

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
  for (const { survivor, building } of trimPosts(state)) {
    addGuildLog(state, day, `The ${buildingName(state, building)} had no room left, so ${fullName(survivor)} is off it now.`, ['post', survivor.id]);
  }

  const solo = result.crew.length === 1 ? result.crew[0]!.firstName : undefined;
  bringVehiclesHome(state, run, day, solo);
  const outcomeText = { completed: 'returned from', turnedBack: 'came back early from', routed: solo ? 'was routed at' : 'were routed at', lost: 'never came back from' }[result.outcome];
  addGuildLog(state, day, `${solo ?? 'The crew'} ${outcomeText} ${loc.name}.`, ['run', run.id]);

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

/** Vehicles come back worn, or not at all; anything found out there joins the guild. */
function bringVehiclesHome(state: GameState, run: Run, day: number, solo: string | undefined): void {
  const { result } = run;
  const place = getLocation(run.plan.locationId).name;
  for (const news of result.vehicles ?? []) {
    const i = state.vehicles.findIndex((v) => v.id === news.id);
    if (i < 0) continue;
    const v = state.vehicles[i]!;
    if (news.wrecked) {
      state.vehicles.splice(i, 1);
      const text = result.outcome === 'lost' ? `The ${vehicleName(v)} never came back from ${place} either.` : `The ${vehicleName(v)} was wrecked at ${place} and left there.`;
      addGuildLog(state, day, text, ['vehicle', v.id]);
      continue;
    }
    v.condition = news.condition;
    v.runs += 1;
    delete v.runId;
    if (v.condition === 0) addGuildLog(state, day, `The ${vehicleName(v)} limped home from ${place}. It needs repairs before it runs again.`, ['vehicle', v.id]);
  }
  for (const found of result.foundVehicles ?? []) {
    const v = structuredClone(found);
    state.vehicles.push(v);
    addGuildLog(state, day, `${solo ?? 'The crew'} brought home a ${vehicleName(v)} found at ${place}. It runs, just (${v.condition}%).`, ['vehicle', v.id]);
  }
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
function bringGearHome(state: GameState, s: Survivor, day: number, place: string): void {
  for (const slot of SLOTS) {
    const item = s.equipment[slot];
    if (!item) continue;
    if (item.name) addStory((item.history ??= []), { day, text: `Came home from ${place} without ${fullName(s)}.` });
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
