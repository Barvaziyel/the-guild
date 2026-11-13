/**
 * What the expedition screens show: plan defaults and choices, times,
 * outcomes, loot and "what changed". No React, so it can be tested in Node.
 */
import {
  amountOf,
  MAX_CREW,
  RESOURCE_IDS,
  STAT_IDS,
  checkText,
  dayAt,
  dayStart,
  effectiveStat,
  getGear,
  getTrait,
  getVehicleDef,
  getLocation,
  itemName,
  vehicleName,
  locationState,
  statName,
  unavailableReason,
  visibleBeats,
  type Approach,
  type Beat,
  type CheckInfo,
  type GameState,
  type LocationDef,
  type ResourceId,
  type RetreatOrder,
  type RiskEstimate,
  type Run,
  type RunJob,
  type RunOutcome,
  type RunPlan,
  type RunReport,
  type RunSummary,
  type Survivor,
  rationsNeeded,
  rationsPacked,
} from '../engine/index.ts';
import { clockTime } from './time.ts';
import { RESOURCE_NAMES } from './view.ts';

// ---------------------------------------------------------------- words and times

/** "Mara", "Mara and Dex", "Mara, Dex and Ava". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** "under a minute", "35 min", "1 h", "1 h 40 min". */
export function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 1) return 'under a minute';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** A ticking countdown: "4:05", "1:02:09". Never negative. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** "back in 12 min", or "due back now" once the time has passed. */
export function backIn(run: Run, now: number): string {
  const left = run.returnAt - now;
  return left <= 0 ? 'due back now' : `back in ${formatDuration(Math.max(left, 60_000))}`;
}

// ---------------------------------------------------------------- planning choices

export interface Choice<T extends string> {
  id: T;
  name: string;
  description: string;
}

export const JOBS: readonly Choice<RunJob>[] = [
  { id: 'scavenge', name: 'Scavenge', description: 'Search the place for supplies. The most loot.' },
  { id: 'scout', name: 'Scout', description: 'Map the place and look for new ones. Finds new locations three times as often.' },
  { id: 'hunt', name: 'Hunt', description: 'Go looking for a fight. Rations from ferals, and practice for the fighters.' },
];

export const APPROACHES: readonly Choice<Approach>[] = [
  { id: 'sneaky', name: 'Sneaky', description: 'Better at spotting trouble and slipping past it. Takes 15% longer.' },
  { id: 'balanced', name: 'Balanced', description: 'No tricks either way.' },
  { id: 'aggressive', name: 'Aggressive', description: 'Hit harder, but walk into more ambushes.' },
];

export const RETREATS: readonly Choice<RetreatOrder>[] = [
  { id: 'wounded', name: 'Someone is hurt', description: 'Pull out once anyone drops below half health.' },
  { id: 'downed', name: 'Someone goes down', description: 'Pull out once anyone is knocked down.' },
  { id: 'never', name: 'Never', description: 'Fight to the end. Brave, and sometimes fatal.' },
];

export const LOOT_PRIORITIES: readonly { id: ResourceId | 'any'; name: string }[] = [
  { id: 'any', name: 'Whatever is best' },
  ...RESOURCE_IDS.map((id) => ({ id, name: RESOURCE_NAMES[id] })),
];

export function choiceName<T extends string>(choices: readonly Choice<T>[], id: T): string {
  return choices.find((c) => c.id === id)?.name ?? id;
}

/** Ready survivors first, then the rest with why they can't go. */
export interface CrewOption {
  survivor: Survivor;
  /** Why they can't go, if they can't. */
  reason?: string;
  /** Effective stats in a few words: "Grit 6, Brawn 7, Aim 2, Wits 3, Nerve 4". */
  stats: string;
}

export function crewOptions(state: GameState): CrewOption[] {
  return state.survivors
    .map((s) => {
      const reason = restingReason(state, s) ?? (unavailableReason(s) ? `${s.firstName} ${unavailableReason(s)}.` : undefined);
      const stats = STAT_IDS.map((id) => `${statName(id)} ${effectiveStat(s, id)}`).join(', ');
      return reason ? { survivor: s, reason, stats } : { survivor: s, stats };
    })
    .sort((a, b) => Number(a.reason !== undefined) - Number(b.reason !== undefined) || a.survivor.firstName.localeCompare(b.survivor.firstName));
}

/** One run a game day: "Vic has been out today, and can go again at 18:00." */
export function restingReason(state: GameState, s: Survivor): string | undefined {
  if (s.status !== 'ready' || s.outpost !== undefined) return undefined;
  const tired = s.traits.find((t) => getTrait(t.id).onlyRuns);
  if (!tired || tired.expiresDay === undefined) return undefined;
  if (s.traits.some((t) => getTrait(t.id).blocksRuns && !getTrait(t.id).onlyRuns)) return undefined;
  return `${s.firstName} has been out today, and can go again at ${clockTime(dayStart(state, tired.expiresDay))}.`;
}

/** Does anyone in this crew carry a gun that needs ammo? */
export function crewNeedsAmmo(state: GameState, crew: readonly string[]): boolean {
  return crew.some((id) => {
    const weapon = state.survivors.find((s) => s.id === id)?.equipment.weapon;
    return weapon !== undefined && getGear(weapon.defId).usesAmmo === true;
  });
}

/** Ammo to pack by default: some if anyone has a gun, as much as the Depot can spare up to 10. */
export function suggestedAmmo(state: GameState, crew: readonly string[]): number {
  return crewNeedsAmmo(state, crew) ? Math.min(10, state.resources.ammo) : 0;
}

/** A starting plan for a location: nobody picked yet, sensible orders, a medkit's worth of meds. */
export function defaultPlan(state: GameState, locationId: string): RunPlan {
  return {
    locationId,
    crew: [],
    job: 'scavenge',
    meds: Math.min(1, state.resources.meds),
    ammo: 0,
    approach: 'balanced',
    retreat: 'downed',
  };
}

/** Toggle someone in or out of the crew, never past the limit (4 on foot, or the vehicles' seats). */
export function toggleCrew(crew: readonly string[], id: string, limit = MAX_CREW): string[] {
  if (crew.includes(id)) return crew.filter((x) => x !== id);
  return crew.length >= limit ? [...crew] : [...crew, id];
}

/** "In 50 tries, someone went down 9 times. Nobody died." */
export function riskText(risk: RiskEstimate): string {
  const down = Math.round(risk.downed * risk.samples);
  const dead = Math.round(risk.death * risk.samples);
  const downText = down === 0 ? 'nobody went down' : `someone went down ${down === 1 ? 'once' : `${down} times`}`;
  const deadText = dead === 0 ? 'Nobody died.' : dead === 1 ? 'Someone died once.' : `Someone died ${dead} times.`;
  return `In ${risk.samples} tries, ${downText}. ${deadText}`;
}

// ---------------------------------------------------------------- locations

export function dangerText(danger: number): string {
  return `Danger ${danger} of 5`;
}

export function radiationText(radiation: number): string {
  return ['No radiation', 'Some radiation', 'Heavy radiation', 'Deadly radiation'][radiation] ?? `Radiation ${radiation}`;
}

export interface LocationView {
  def: LocationDef;
  explored: number;
  runs: number;
  /** Discovered places this one leads to. */
  leadsTo: LocationDef[];
  /** How many of the places it leads to are still unknown. */
  unknownLeads: number;
  /** Crews out here right now. */
  crewsOut: Run[];
}

export function locationView(state: GameState, id: string): LocationView {
  const def = getLocation(id);
  const here = locationState(state, id);
  const leads = def.leadsTo.map((l) => getLocation(l));
  return {
    def,
    explored: here.explored,
    runs: here.runs,
    leadsTo: leads.filter((l) => locationState(state, l.id).discovered),
    unknownLeads: leads.filter((l) => !locationState(state, l.id).discovered).length,
    crewsOut: state.runs.filter((r) => r.plan.locationId === id),
  };
}

/** The line under a place's facts: visits, roads on, and what exploring it fully opens. */
export function placeNote(v: LocationView, fullyExplored: boolean): string {
  return [
    v.runs === 0 ? 'Nobody from the guild has been here yet.' : `The guild has been here ${v.runs === 1 ? 'once' : `${v.runs} times`}.`,
    v.leadsTo.length > 0 ? `Roads lead on to ${joinNames(v.leadsTo.map((l) => l.name))}.` : '',
    v.unknownLeads > 0 ? `${v.unknownLeads === 1 ? 'One road leads' : `${v.unknownLeads} roads lead`} somewhere nobody has found yet.` : '',
    fullyExplored ? '' : 'Explore the outskirts fully to open the way deeper in, and to set up an outpost.',
  ]
    .filter(Boolean)
    .join(' ');
}

// ---------------------------------------------------------------- crews out

/** First names of a run's crew as they left. */
export function runCrewNames(run: Run): string[] {
  return run.result.crew.map((s) => s.firstName);
}

/** 0 at departure, 1 when due back. */
export function runProgress(run: Run, now: number): number {
  const span = run.returnAt - run.departAt;
  return span <= 0 ? 1 : Math.max(0, Math.min(1, (now - run.departAt) / span));
}

/** The last thing that has happened on a run so far. */
export function latestBeat(run: Run, now: number): Beat | undefined {
  const seen = visibleBeats(run, now);
  return seen[seen.length - 1];
}

/** The run a survivor is out on, if any. */
export function runOfSurvivor(state: GameState, survivorId: string): Run | undefined {
  return state.runs.find((r) => r.plan.crew.includes(survivorId));
}

/** Active runs, soonest back first. */
export function activeRuns(state: GameState): Run[] {
  return [...state.runs].sort((a, b) => a.returnAt - b.returnAt);
}

// ---------------------------------------------------------------- the log

/** A check as it appears under a log line: "Mara: Wits 6+5 vs 10 ✔". */
export function checkLine(check: CheckInfo, names: Record<string, string>): string {
  const who = names[check.who];
  return who ? `${who}: ${checkText(check)}` : checkText(check);
}

/** Minutes after departure: "+8 min". Empty for the departure itself. */
export function beatTime(beat: Beat): string {
  return beat.at <= 0 ? '' : `+${formatDuration(beat.at)}`;
}

/** Survivor id -> first name, for a run's crew. */
export function firstNames(crew: readonly Survivor[]): Record<string, string> {
  return Object.fromEntries(crew.map((s) => [s.id, s.firstName]));
}

/** Survivor id -> first name, from a report's stored full names. */
export function reportFirstNames(report: RunReport): Record<string, string> {
  return Object.fromEntries(Object.entries(report.crewNames).map(([id, full]) => [id, full.split(' ')[0] ?? full]));
}

// ---------------------------------------------------------------- reports

export function outcomeHeadline(outcome: RunOutcome, locationName: string): string {
  switch (outcome) {
    case 'completed':
      return `Back from ${locationName}`;
    case 'turnedBack':
      return `Came back early from ${locationName}`;
    case 'routed':
      return `Routed at ${locationName}`;
    case 'lost':
      return `Lost at ${locationName}`;
  }
}

export type OutcomeTone = 'good' | 'mixed' | 'bad';

export function outcomeTone(summary: RunSummary): OutcomeTone {
  if (summary.deaths.length > 0 || summary.outcome === 'lost' || summary.outcome === 'routed') return 'bad';
  return summary.outcome === 'completed' ? 'good' : 'mixed';
}

/** What came home: ["6 scrap", "7 meds", "Rusty Scrap Vest"]. Leftover supplies aren't loot. */
export function lootList(summary: RunSummary): string[] {
  const out = RESOURCE_IDS.filter((r) => summary.loot[r] > 0).map((r) => amountOf(r, summary.loot[r]));
  for (const item of summary.items) out.push(itemName(item));
  for (const v of summary.foundVehicles ?? []) out.push(`a ${vehicleName(v)} that only just runs (${v.condition}%)`);
  return out;
}

/** What became of the vehicles a crew took: ["The Hatchback: 72%", "The Motorcycle was wrecked"]. */
export function vehicleOutcomes(summary: RunSummary): string[] {
  return (summary.vehicles ?? []).map((n) => {
    const name = getVehicleDef(n.defId).name;
    return n.wrecked ? `The ${name} was wrecked and left behind.` : `The ${name} came back at ${n.condition}%.`;
  });
}

export interface ChangeGroup {
  survivorId: string;
  name: string;
  died: boolean;
  changes: string[];
}

/** "What changed", one group per crew member, in crew order. */
export function changesByPerson(report: RunReport): ChangeGroup[] {
  const dead = new Set(report.summary.deaths.map((d) => d.survivorId));
  return report.plan.crew
    .map((id) => ({
      survivorId: id,
      name: report.crewNames[id] ?? id,
      died: dead.has(id),
      changes: report.summary.highlights.filter((h) => h.survivorId === id).map((h) => h.text),
    }))
    .filter((g) => g.changes.length > 0 || g.died);
}

/** Report list entries, newest first. */
export interface ReportItem {
  report: RunReport;
  headline: string;
  crew: string;
  day: number;
  tone: OutcomeTone;
}

export function reportItems(state: GameState): ReportItem[] {
  return state.reports.map((report) => ({
    report,
    headline: outcomeHeadline(report.summary.outcome, getLocation(report.plan.locationId).name),
    crew: joinNames(Object.values(reportFirstNames(report))),
    day: dayAt(state, report.returnAt),
    tone: outcomeTone(report.summary),
  }));
}

export function unreadCount(state: GameState): number {
  return state.reports.filter((r) => !r.read).length;
}

// ---------------------------------------------------------------- notifications

export interface PlannedNotice {
  id: string;
  at: number;
  title: string;
  body: string;
}

/**
 * Android notification ids are 31-bit numbers; runs have string ids ("r12").
 * The same run always gets the same number, so a notice can be found again to cancel.
 */
export function noticeNumber(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  return (h % 2_147_483_646) + 1;
}

/** One notice per crew that is out, timed for their return. Never gives away what happened. */
export function noticesFor(state: GameState): PlannedNotice[] {
  return state.runs.map((run) => ({
    id: run.id,
    at: run.returnAt,
    title: `${joinNames(runCrewNames(run))} ${run.plan.crew.length === 1 ? 'is' : 'are'} due back`,
    body: `The run to ${getLocation(run.plan.locationId).name} is over. Open the game to read what happened.`,
  }));
}

/** The planner's line about rations: what's packed, and what happens when the Depot is short. */
export function rationsNote(state: GameState, plan: RunPlan): string {
  if (plan.crew.length === 0) return 'Rations are packed for each person automatically.';
  const need = rationsNeeded(state, plan);
  const packed = rationsPacked(state, plan);
  if (packed >= need) return `${amountOf('rations', need)} packed automatically, of ${state.resources.rations} at the Depot.`;
  if (packed === 0) return 'No rations at the Depot. The crew can still go, hungry.';
  return `Only ${packed} of the ${need} rations the crew needs: all the Depot has.`;
}
