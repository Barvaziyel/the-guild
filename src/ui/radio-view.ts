/**
 * Crews calling home from a fork (§7.12): the cards that ask for an answer,
 * the notices, and what the report says about the call.
 */
import { getLocation, radioWaiting, type GameState, type Run, type RunReport, type Survivor } from '../engine/index.ts';
import type { Route } from './route.ts';
import { formatDuration, type PlannedNotice } from './runs-view.ts';
import { fightNoticeRun } from './fight-view.ts';

export interface RadioCardView {
  runId: string;
  title: string;
  place: string;
  /** Whoever is on the radio: the real survivor, for the portrait. */
  caller: Survivor | undefined;
  callerName: string;
  intro: string;
  ask: string;
  orders: { id: string; label: string }[];
  /** "They'll wait 24 more minutes. Unanswered, Mara decides by the crew's orders." */
  wait: string;
}

function callerOf(state: GameState, run: Run): { survivor: Survivor | undefined; name: string } {
  const id = run.radio!.by;
  return { survivor: state.survivors.find((s) => s.id === id), name: run.result.crew.find((s) => s.id === id)?.firstName ?? 'They' };
}

/** A fork's title inside a sentence: "a sealed door", but "the Vultures". */
export function titleInLine(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}

/** "24 more minutes", "a minute". */
function minutesLeft(ms: number): string {
  const m = Math.max(1, Math.ceil(ms / 60_000));
  return m === 1 ? 'one more minute' : `${m} more minutes`;
}

/** What the guild said, once it's said: "You told Flint: leave it. “Understood.”" */
export function answeredLine(who: string, label: string): string {
  return `You told ${who}: ${titleInLine(label)}. \u201cUnderstood.\u201d`;
}

/** A crew on the radio, waiting for the guild's answer. */
export function radioCard(state: GameState, run: Run, now: number): RadioCardView | undefined {
  const call = radioWaiting(run, now);
  if (!call) return undefined;
  const { survivor, name } = callerOf(state, run);
  return {
    runId: run.id,
    title: call.title,
    place: getLocation(run.plan.locationId).name,
    caller: survivor,
    callerName: name,
    intro: call.intro,
    ask: call.ask,
    orders: call.orders,
    wait: `${name} will wait ${minutesLeft(call.until - now)} for an answer. After that, ${name} decides by the crew's orders.`,
  };
}

/** Every crew on the radio right now, the one that called first first. */
export function radioCards(state: GameState, now: number): RadioCardView[] {
  return state.runs
    .filter((r) => radioWaiting(r, now))
    .sort((a, b) => a.radio!.at - b.radio!.at)
    .map((r) => radioCard(state, r, now)!);
}

/** A crew is on the radio: the Runs tab gets a mark. */
export function anyoneCalling(state: GameState, now: number): boolean {
  return state.runs.some((r) => radioWaiting(r, now) !== undefined);
}

/** When the screen should next look again: a call coming in, or one running out. */
export function radioWakeTimes(state: GameState, now: number): number[] {
  const out: number[] = [];
  for (const r of state.runs) {
    const call = r.radio;
    if (!call || call.answer !== undefined) continue;
    for (const t of [call.at, call.until]) if (t > now) out.push(t);
  }
  return out;
}

/** A notice when each crew calls in. Planned at departure, so it comes with the game closed. */
export function radioNotices(state: GameState): PlannedNotice[] {
  return state.runs
    .filter((r) => r.radio && r.radio.answer === undefined)
    .map((r) => {
      const call = r.radio!;
      const { name } = callerOf(state, r);
      return {
        id: `radio-${r.id}`,
        at: call.at,
        title: `${name} is on the radio`,
        body: `From ${getLocation(r.plan.locationId).name}: ${titleInLine(call.title)}. ${name} will wait ${formatDuration(call.until - call.at)} for your answer.`,
      };
    });
}

/** Changes when calls come or are answered, so notices are planned again. */
export function radioNoticeKey(state: GameState): string {
  // A led fight can move the call (§7.13), so its time is part of the key.
  return state.runs.map((r) => (r.radio ? `${r.id}:${r.radio.at}:${r.radio.answer ?? 'w'}` : '')).join(',');
}

/** The run a tapped notice is about ("radio-r12" → "r12"), if it's a radio notice. */
export function radioNoticeRun(id: string): string | undefined {
  return id.startsWith('radio-') ? id.slice('radio-'.length) : undefined;
}

/** The report's line about the call: what was asked, and who decided. */
export function radioReportLine(report: RunReport): string | undefined {
  const call = report.radio;
  if (!call) return undefined;
  const name = report.crewNames[call.by]?.split(' ')[0] ?? 'They';
  const title = titleInLine(call.title);
  const order = call.orders.find((o) => o.id === call.answer);
  if (!order) return `${name} called home about ${title}. Nobody answered in time, so ${name} made the call.`;
  return `${name} called home about ${title}. The guild said: ${titleInLine(order.label)}.`;
}

/**
 * Where a tapped notice opens: a crew's run (due back, or on the radio), or the
 * Depot for everything that waits there (decisions, calls for help, babies, birthdays).
 */
export function noticeRoute(id: string): Route {
  // Raiders seen or at the gate open the raid (§9.8).
  if (id.startsWith('raid-')) return { screen: 'raid' };
  // A crew stopped at a fight opens the fight (§7.13).
  const fight = fightNoticeRun(id);
  if (fight) return { screen: 'fight', id: fight };
  const radio = radioNoticeRun(id);
  if (radio) return { screen: 'run', id: radio };
  if (/^(dilemma|rescue|baby|grown)-/.test(id)) return { screen: 'depot' };
  return { screen: 'run', id };
}
