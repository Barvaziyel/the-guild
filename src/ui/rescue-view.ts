/**
 * Calls for help (§10.1) as the screens show them: the card on the Depot, the
 * Rescue job in the planner, the line on a report, and the notices. Plain
 * TypeScript so it can be tested in Node.
 */
import {
  DAY_MS,
  dayStart,
  getLocation,
  openCall,
  troubleText,
  workingLevel,
  type GameState,
  type RescueTrouble,
  type RunJob,
  type RunPlan,
  type RunSummary,
  type Survivor,
} from '../engine/index.ts';
import { whenText } from './dilemma-view.ts';
import { joinNames, runCrewNames, type Choice, type PlannedNotice } from './runs-view.ts';

export interface CallCard {
  /** Who is calling: their face goes on the card. */
  person: Survivor;
  locationId: string;
  /** "Echo Arden is pinned under a fallen wall at The Rail Yard." */
  text: string;
  /** "Go before 9:40 PM." or, once a crew is on the way, who went. */
  when: string;
  /** The run that went to answer it. */
  runId?: string;
}

/** The call for help on the Depot, if there is one. */
export function callCard(state: GameState, now: number): CallCard | undefined {
  const call = state.rescue.call;
  if (!call) return undefined;
  const base = { person: call.person, locationId: call.locationId, text: `${call.person.firstName} ${call.person.lastName} is ${troubleText(call)}.` };
  if (call.runId) {
    const run = state.runs.find((r) => r.id === call.runId);
    return { ...base, runId: call.runId, when: run ? `${joinNames(runCrewNames(run))} ${run.plan.crew.length === 1 ? 'is' : 'are'} on the way.` : 'A crew is on the way.' };
  }
  return { ...base, when: `Go before ${whenText(dayStart(state, call.expiresDay), now)}, or the voice will go quiet.` };
}

/** The trouble, without the place: for the planner, which is already at it. */
const TROUBLE: Record<RescueTrouble, string> = {
  trapped: 'pinned under a fallen wall',
  hurt: 'hurt and bleeding',
  cornered: 'cornered, with something prowling outside',
  lost: 'lost, and out of water',
};

/** The planner's jobs, with Rescue first while someone is calling from this place. */
export function jobChoices(state: GameState, locationId: string, jobs: readonly Choice<RunJob>[]): Choice<RunJob>[] {
  const call = openCall(state, locationId);
  if (!call) return [...jobs];
  return [
    { id: 'rescue', name: 'Rescue', description: `Get ${call.person.firstName} out: ${TROUBLE[call.trouble]}. Little else gets done.` },
    ...jobs,
  ];
}

/** A new plan for this place: a rescue, while someone is calling from here. */
export function withRescue(state: GameState, plan: RunPlan): RunPlan {
  return openCall(state, plan.locationId) ? { ...plan, job: 'rescue' } : plan;
}

/** What became of the person the crew went for, for the report. */
export function rescueLine(summary: RunSummary): string | undefined {
  const r = summary.rescue;
  if (!r) return undefined;
  const name = `${r.person.firstName} ${r.person.lastName}`;
  switch (r.outcome) {
    case 'saved':
      return `Brought ${name} home alive.`;
    case 'lost':
      return `Couldn't save ${name}.`;
    case 'missed':
      return `Never found ${name}.`;
  }
}

/** Where to see someone a rescue brought home: their sheet, or the gate while they wait for a bed. */
export function rescuedWhere(state: GameState, summary: RunSummary): 'sheet' | 'gate' | undefined {
  const r = summary.rescue;
  if (r?.outcome !== 'saved') return undefined;
  if (state.survivors.some((s) => s.id === r.person.id)) return 'sheet';
  if (state.depot.recruits.some((c) => c.survivor.id === r.person.id)) return 'gate';
  return undefined;
}

/** People a crew found out there and brought home, for the report: who, and where to see them now. */
export function foundLines(state: GameState, summary: RunSummary, locationId: string): { id: string; text: string; where?: 'sheet' | 'gate' }[] {
  const place = getLocation(locationId).name;
  return (summary.found ?? []).map((f) => {
    const id = f.person.id;
    const where = state.survivors.some((s) => s.id === id) ? 'sheet' : state.depot.recruits.some((c) => c.survivor.id === id) ? 'gate' : undefined;
    return { id, text: `Brought ${f.person.firstName} ${f.person.lastName} home from ${place}.`, ...(where ? { where } : {}) };
  });
}

/** How long before a call goes quiet the reminder comes. */
const REMIND_BEFORE = 2 * 3_600_000;

/** Notices: when the next call is due (with a Radio Tower), and a reminder before an unanswered one goes quiet. */
export function rescueNotices(state: GameState): PlannedNotice[] {
  const call = state.rescue.call;
  if (call) {
    if (call.runId) return [];
    return [
      {
        id: `rescue-due-${call.day}`,
        at: dayStart(state, call.expiresDay) - Math.min(REMIND_BEFORE, DAY_MS),
        title: 'A voice is fading',
        body: `${call.person.firstName}, at ${getLocation(call.locationId).name}, won't last much longer.`,
      },
    ];
  }
  if (workingLevel(state, 'radio_tower') === 0) return [];
  const next = state.rescue.nextDay;
  return [{ id: `rescue-${next}`, at: dayStart(state, next), title: 'A call for help', body: 'Someone is calling for help over the radio.' }];
}
