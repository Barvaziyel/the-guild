/**
 * Decisions at the Depot (§9.5), as the Depot screen shows them: the card
 * with its four answers, its deadline, and the notices around it. Plain
 * TypeScript so it can be tested in Node.
 */
import { DAY_MS, RESOURCE_IDS, dayStart, dilemmaRoles, fillRoles, getDilemma, returnUnsure, vulturesActive, type GameState, type ResourceId, type Survivor } from '../engine/index.ts';
import type { PlannedNotice } from './runs-view.ts';
import { joinNames } from './runs-view.ts';
import { clockTime } from './time.ts';
import { RESOURCE_NAMES } from './view.ts';

export interface DilemmaCard {
  title: string;
  text: string;
  /** The people it's about, a stranger included, for their faces. */
  people: Survivor[];
  /** The four answers, filled in. */
  choices: string[];
  /** "Decide by 9:40 PM." or "Decide by tomorrow, 9:40 AM." */
  deadline: string;
  /** "After that, Dex and Wren will settle it themselves." */
  otherwise: string;
}

/** What a decision put in the stores or took out (2.5.1): "Ammo +6." or "Rations −6, Tech +2." Undefined when nothing changed. */
export function suppliesLine(supplies: Partial<Record<ResourceId, number>> | undefined): string | undefined {
  const parts = RESOURCE_IDS.filter((r) => supplies?.[r]).map((r) => `${RESOURCE_NAMES[r]} ${supplies![r]! > 0 ? '+' : '−'}${Math.abs(supplies![r]!)}`);
  return parts.length > 0 ? `${parts.join(', ')}.` : undefined;
}

/** When the people involved settle it themselves, in epoch ms. */
export function dilemmaDeadline(state: GameState): number | undefined {
  const d = state.dilemmas.active;
  return d ? dayStart(state, d.deadlineDay) : undefined;
}

/** "9:40 PM", "tomorrow, 9:40 AM", or "in 2 days, at 9:40 AM". */
export function whenText(at: number, now: number): string {
  const day = (t: number): number => Math.floor((t - new Date(t).getTimezoneOffset() * 60_000) / 86_400_000);
  const diff = day(at) - day(now);
  const time = clockTime(at);
  if (diff <= 0) return time;
  if (diff === 1) return `tomorrow, ${time}`;
  return `in ${diff} days, at ${time}`;
}

/** The decision waiting at the Depot, ready to show; undefined when there's none (or it no longer matters). */
export function dilemmaCard(state: GameState, now: number): DilemmaCard | undefined {
  const d = state.dilemmas.active;
  if (!d) return undefined;
  const roles = dilemmaRoles(state, d);
  if (!roles) return undefined;
  const def = getDilemma(d.defId);
  const involved = [roles.a, roles.b].filter((s): s is Survivor => s !== undefined);
  return {
    title: def.title,
    text: fillRoles(def.text, roles),
    // The stranger, the Vultures' envoy and a prisoner of theirs get faces too (§7.11).
    people: [...involved, ...[roles.s, roles.v, roles.p].filter((x): x is Survivor => x !== undefined && !involved.includes(x))],
    choices: def.choices.map((c) => fillRoles(c.label, roles)),
    deadline: `Decide by ${whenText(dilemmaDeadline(state)!, now)}.`,
    otherwise: `After that, ${joinNames(involved.map((s) => s.firstName))} will settle it ${involved.length === 1 ? 'alone' : 'themselves'}.`,
  };
}

/** How long before the deadline the reminder comes. */
const REMIND_BEFORE = 2 * 3_600_000;

/**
 * Notices for decisions: when the next one is due to come up, and a reminder
 * before an unanswered one is settled without the player.
 */
export function dilemmaNotices(state: GameState): PlannedNotice[] {
  const d = state.dilemmas.active;
  if (d) {
    const deadline = dayStart(state, d.deadlineDay);
    return [
      {
        id: `dilemma-due-${d.day}`,
        at: deadline - Math.min(REMIND_BEFORE, DAY_MS),
        title: 'Decide soon',
        // A time, not "in two hours": a notice that comes late should still be right (3.7.4).
        body: `${getDilemma(d.defId).title}: choose by ${clockTime(deadline)}, or they'll settle it themselves.`,
      },
    ];
  }
  // The Vultures send envoys on a day of their own (§7.11).
  const due = vulturesActive(state) ? Math.min(state.dilemmas.nextDay, state.vultures.nextEnvoyDay) : state.dilemmas.nextDay;
  const next = decisionDay(state, due);
  if (next === undefined) return [];
  return [{ id: `dilemma-${next}`, at: dayStart(state, next), title: 'Something needs deciding', body: 'At the Depot. Open the game to choose what happens.' }];
}

/** Changes when `dilemmaNotices` would (with the crews out, in App's key already). */
export function dilemmaNoticeKey(state: GameState): string {
  const d = state.dilemmas.active;
  return d ? `d${d.day}` : `n${state.dilemmas.nextDay}:${vulturesActive(state) ? state.vultures.nextEnvoyDay : ''}`;
}

/** How many Depot days ahead the next decision's notice looks for someone at home. */
const LOOK_AHEAD = 16;

/**
 * The first Depot day from `from` on that begins with someone at the Depot. A
 * decision is about people there, so with everyone out it waits a day; a
 * notice for one that didn't come read like an old one (3.7.4). Crews back
 * by then count; nobody home for days to come, no notice.
 */
export function decisionDay(state: GameState, from: number): number | undefined {
  for (let day = from; day < from + LOOK_AHEAD; day++) {
    const t = dayStart(state, day);
    const back = (s: Survivor): boolean => state.runs.some((r) => r.plan.crew.includes(s.id) && !returnUnsure(r) && r.returnAt <= t);
    if (state.survivors.some((s) => s.outpost === undefined && (s.status === 'ready' || (s.status === 'away' && back(s))))) return day;
  }
  return undefined;
}
