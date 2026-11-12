/**
 * Decisions at the Depot (§9.5), as the Depot screen shows them: the card
 * with its four answers, its deadline, and the notices around it. Plain
 * TypeScript so it can be tested in Node.
 */
import { DAY_MS, dayStart, dilemmaRoles, fillRoles, getDilemma, type GameState, type Survivor } from '../engine/index.ts';
import type { PlannedNotice } from './runs-view.ts';
import { joinNames } from './runs-view.ts';
import { clockTime } from './time.ts';

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
    people: [...involved, ...(roles.s && !involved.includes(roles.s) ? [roles.s] : [])],
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
    const at = dayStart(state, d.deadlineDay) - Math.min(REMIND_BEFORE, DAY_MS);
    return [
      {
        id: `dilemma-due-${d.day}`,
        at,
        title: 'Decide soon',
        body: `${getDilemma(d.defId).title}: unless you choose, they'll settle it themselves in about two hours.`,
      },
    ];
  }
  const next = state.dilemmas.nextDay;
  return [{ id: `dilemma-${next}`, at: dayStart(state, next), title: 'Something needs deciding', body: 'At the Depot. Open the game to choose what happens.' }];
}
