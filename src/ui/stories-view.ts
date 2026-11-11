/**
 * Nemeses on screen: the guild's list, the ones haunting a place, and the
 * scores a survivor has to settle. Plain TypeScript so it can be tested in Node.
 */
import { getEnemy, getLocation, type GameState, type Nemesis, type Survivor } from '../engine/index.ts';
import { joinNames } from './runs-view.ts';

/** Names like "the Janitor" start a heading or a sentence with a capital. */
const capitalized = (name: string): string => name[0]!.toUpperCase() + name.slice(1);

const article = (name: string): string => (/^[AEIOU]/.test(name) ? `an ${name}` : `a ${name}`);

/** "a Rad-hound", "an Old Hollow": what the nemesis is. */
export function nemesisKind(n: Nemesis): string {
  return article(getEnemy(n.enemyId).name);
}

/** First names (or "someone") for survivor ids, from the living and the dead. */
function firstNames(state: GameState, ids: readonly string[]): string[] {
  return ids.map((id) => [...state.survivors, ...state.memorial].find((s) => s.id === id)?.firstName ?? 'someone');
}

export interface NemesisRow {
  id: string;
  name: string;
  kind: string;
  atLarge: boolean;
  /** "Haunts Maple Street." / "Killed by Dex Arlo on day 40." */
  status: string;
  /** "Put Mara and Dex down. Killed Ava." */
  record: string;
  /** "Day 4: Put Mara Vance down at Maple Street, and got away." */
  story: string[];
}

function rowFor(state: GameState, n: Nemesis): NemesisRow {
  const place = getLocation(n.locationId).name;
  const killer = n.killedBy ? [...state.survivors, ...state.memorial].find((s) => s.id === n.killedBy) : undefined;
  const status =
    n.status === 'atLarge'
      ? `Haunts ${place}.`
      : `Killed${killer ? ` by ${killer.firstName} ${killer.lastName}` : ''}${n.diedDay ? ` on day ${n.diedDay}` : ''}.`;
  const downedOnly = n.downed.filter((id) => !n.killed.includes(id));
  const parts: string[] = [];
  if (downedOnly.length > 0) parts.push(`Put ${joinNames(firstNames(state, downedOnly))} down.`);
  if (n.killed.length > 0) parts.push(`Killed ${joinNames(firstNames(state, n.killed))}.`);
  if (n.escapes > 1) parts.push(n.escapes === 2 ? 'Got away twice.' : `Got away ${n.escapes} times.`);
  return {
    id: n.id,
    name: capitalized(n.name),
    kind: nemesisKind(n),
    atLarge: n.status === 'atLarge',
    status,
    record: parts.join(' '),
    story: n.history.map((l) => `Day ${l.day}: ${l.text}`),
  };
}

/** The guild's nemeses: those still out there first, then the dead, most recent first. */
export function nemesisRows(state: GameState): NemesisRow[] {
  const all = [...(state.nemeses ?? [])];
  all.sort((a, b) => Number(b.status === 'atLarge') - Number(a.status === 'atLarge') || (b.diedDay ?? b.bornDay) - (a.diedDay ?? a.bornDay));
  return all.map((n) => rowFor(state, n));
}

/** Nemeses still haunting this place. */
export function nemesesAt(state: GameState, locationId: string): NemesisRow[] {
  return (state.nemeses ?? []).filter((n) => n.status === 'atLarge' && n.locationId === locationId).map((n) => rowFor(state, n));
}

export interface ScoreToSettle {
  name: string;
  kind: string;
  /** "Put Mara down at Maple Street. Still out there." */
  line: string;
}

/** The nemeses that put this survivor down, with how things stand. */
export function scoresToSettle(state: GameState, s: Survivor): ScoreToSettle[] {
  return (state.nemeses ?? [])
    .filter((n) => n.downed.includes(s.id))
    .map((n) => {
      const where = getLocation(n.locationId).name;
      const now = n.status === 'atLarge' ? 'Still out there.' : n.killedBy === s.id ? `${s.firstName} saw to that.` : 'Dead now.';
      return { name: capitalized(n.name), kind: nemesisKind(n), line: `Put ${s.firstName} down at ${where}. ${now}` };
    });
}
