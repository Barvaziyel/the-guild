/**
 * The Depot's corners (§9.9, 2.7.0) as the Yard tab shows them: what's left
 * to search, who could go, the search under way, and what the last one found.
 * Plain TypeScript so it can be tested in Node.
 */
import { CORNERS, cornerStatus, effectiveStat, getCorner, searchers, statName, type CornerStatus, type GameState } from '../engine/index.ts';
import { formatDuration, type PlannedNotice } from './runs-view.ts';
import { suppliesLine } from './dilemma-view.ts';

export interface CornerRow {
  id: string;
  name: string;
  intro: string;
  status: CornerStatus;
  /** "10 min · Wits helps". */
  meta: string;
  /** Why it's shut, while it is. */
  locked?: string;
}

/** Every corner, in the order they're listed in the yard: still to search first, then those done. */
export function cornerRows(state: GameState): CornerRow[] {
  const rows = CORNERS.map((c): CornerRow => {
    const status = cornerStatus(state, c.id);
    return {
      id: c.id,
      name: c.name,
      intro: c.intro,
      status,
      meta: `${c.minutes} min · ${statName(c.stat)} helps`,
      ...(status === 'locked' && c.needs ? { locked: c.needs.locked } : {}),
    };
  });
  const order: Record<CornerStatus, number> = { searching: 0, open: 1, locked: 2, searched: 3 };
  return rows.sort((a, b) => order[a.status] - order[b.status]);
}

/** "Searched: the ticket office, the signal box." Undefined while none has been. */
export function searchedLine(state: GameState): string | undefined {
  if (state.corners.searched.length === 0) return undefined;
  return `Searched: ${state.corners.searched.map((id) => lower(getCorner(id).name)).join(', ')}.`;
}

/** "3 of 8 searched", or undefined once every corner has been. */
export function cornersSummary(state: GameState): string | undefined {
  const done = state.corners.searched.length;
  return done >= CORNERS.length ? undefined : `${done} of ${CORNERS.length} searched`;
}

/** Who could search a corner, the best at it first: "Cora (Wits 6)". */
export function searcherChoices(state: GameState, cornerId: string): { id: string; label: string }[] {
  const stat = getCorner(cornerId).stat;
  return searchers(state, cornerId).map((s) => ({ id: s.id, label: `${s.firstName} (${statName(stat)} ${effectiveStat(s, stat)})` }));
}

/** The line over the list: the search under way, or what to do. */
export function cornersHelp(state: GameState, now: number): string {
  return (
    searchLine(state, now) ??
    (state.corners.searched.length === 0
      ? 'Send someone who’s home to search a corner.'
      : '')
  );
}

/** The search under way: "Cora is searching the signal box. Done in 6 min." */
export function searchLine(state: GameState, now: number): string | undefined {
  const s = state.corners.search;
  if (!s) return undefined;
  const who = state.survivors.find((x) => x.id === s.by)?.firstName ?? 'Someone';
  const left = s.until - now;
  return `${who} is searching ${lower(getCorner(s.cornerId).name)}. ${left > 0 ? `Done in ${formatDuration(Math.max(60_000, left))}.` : 'Done any moment.'}`;
}

export interface CornerResultCard {
  title: string;
  /** "Cora searched it." */
  who: string;
  text: string;
  /** "Ammo +6, Scrap +4." */
  supplies?: string;
  /** "In the stash: Multitool." */
  gear?: string;
}

/** What the last search found, until the player has read it. */
export function resultCard(state: GameState): CornerResultCard | undefined {
  const last = state.corners.last;
  if (!last || last.seen) return undefined;
  const who = state.survivors.find((x) => x.id === last.by)?.firstName ?? 'Someone';
  const supplies = suppliesLine(last.supplies);
  return {
    title: getCorner(last.cornerId).name,
    who: `${who} searched it.`,
    text: last.text,
    ...(supplies ? { supplies } : {}),
    ...(last.gear && last.gear.length > 0 ? { gear: `In the stash: ${last.gear.join(', ')}.` } : {}),
  };
}

/** A notice when the search is done. */
export function cornerNotices(state: GameState): PlannedNotice[] {
  const s = state.corners.search;
  if (!s) return [];
  const who = state.survivors.find((x) => x.id === s.by)?.firstName ?? 'Someone';
  return [{ id: `corner-${s.cornerId}`, at: s.until, title: `${who} is done searching`, body: `${getCorner(s.cornerId).name}: see what turned up, on the Yard.` }];
}

/** When the app should wake to finish a search. */
export function cornerWakeTimes(state: GameState): number[] {
  return state.corners.search ? [state.corners.search.until] : [];
}

/** What changes the notices: the search under way. */
export function cornerNoticeKey(state: GameState): string {
  const s = state.corners.search;
  return s ? `k${s.cornerId}@${s.until}` : 'k';
}

function lower(name: string): string {
  return name.replace(/^The /, 'the ');
}
