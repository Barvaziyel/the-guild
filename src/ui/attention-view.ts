/**
 * Where to look (3.5.0). A player said he felt he was missing something
 * without knowing what: where to look, what he'd read and what was new.
 * The bell went; instead a red dot sits on whatever is new or waiting, on the
 * tab bar, the tabs inside a screen, and the row itself, so the dots lead the
 * way down. What can't wait (a fight or a raid waiting for orders, a crew on
 * the radio) is also a strip under the header on every screen.
 *
 * What the player has looked at is kept on the phone (`Prefs.seen`), against
 * this guild. The first time, everything there is counts as seen, so an old
 * guild doesn't light up all over.
 */
import { atDepot, canChangeGear, getLocation, havenNew, itemDef, knownLocations, locationState, type GameState, type Slot, type Survivor } from '../engine/index.ts';
import { strayRows } from './animals-view.ts';
import { resultCard } from './corners-view.ts';
import { foodWarning } from './depot-view.ts';
import { dilemmaCard } from './dilemma-view.ts';
import { fightCards } from './fight-view.ts';
import { havenReady } from './haven-view.ts';
import { radioCards } from './radio-view.ts';
import { raidCard } from './raid-view.ts';
import { callCard } from './rescue-view.ts';
import type { DepotTab, Route, SheetTab, TabScreen } from './route.ts';
import { storyCard } from './story-view.ts';

/** What the player has looked at, for one guild. */
export interface Seen {
  /** Which guild this is about: a new game starts over. */
  guild: string;
  /** How many lines of Depot news. */
  news: number;
  /** How many lines of each person's Chronicle. */
  chronicle: Record<string, number>;
  /** Places opened on the Reach. */
  places: string[];
  /** Pieces of gear seen in the stash. */
  stash: string[];
  /** Places drawn on the map when it was last looked at, and how explored (3.7.0): what's new draws in. Missing on marks from before. */
  mapped?: Record<string, number>;
  /** Building levels when the yard was last looked at (3.7.0): a new one goes up before your eyes. */
  built?: Record<string, number>;
  /** The supplies when the header last showed them (3.7.0): opening the game, they count to what's there now. */
  stores?: Record<string, number>;
}

/** A stress at which someone is close to breaking: a dot on them. */
export const NEAR_BREAKING = 80;

function guildKey(state: GameState): string {
  return `${state.seed}`;
}

/** Everything there is now, as seen. */
export function baselineSeen(state: GameState): Seen {
  return {
    guild: guildKey(state),
    news: state.log.length,
    chronicle: Object.fromEntries(state.survivors.map((s) => [s.id, s.chronicle.length])),
    places: knownLocations(state).map((l) => l.id),
    stash: state.stash.map((i) => i.uid),
    mapped: mappedNow(state),
    built: { ...state.buildings },
    stores: { ...state.resources },
  };
}

function mappedNow(state: GameState): Record<string, number> {
  return Object.fromEntries(knownLocations(state).map((l) => [l.id, locationState(state, l.id).explored]));
}

// ---------------------------------------------------------------- what moved since the last look (3.7.0)

/**
 * What's new on the map since it was last looked at: places first drawn now (their roads draw in and
 * they pop up), and how explored the others were (their rings fill up from it). Marks from before
 * 3.7.0 have no record, so nothing moves the first time.
 */
export function mapNews(state: GameState, seen: Seen): { fresh: string[]; from: Record<string, number> } {
  const was = seen.mapped;
  if (!was) return { fresh: [], from: {} };
  const now = mappedNow(state);
  const fresh = Object.keys(now).filter((id) => was[id] === undefined);
  const from: Record<string, number> = {};
  for (const [id, pct] of Object.entries(now)) if (was[id] !== undefined && was[id]! < pct) from[id] = was[id]!;
  return { fresh, from };
}

export function seeMap(state: GameState, seen: Seen): Seen {
  const now = mappedNow(state);
  const same = seen.mapped && Object.keys(now).length === Object.keys(seen.mapped).length && Object.entries(now).every(([id, pct]) => seen.mapped![id] === pct);
  return same ? seen : { ...seen, mapped: now };
}

/** Supplies as they were last shown, where they've changed since; nothing the first time. */
export function storesNews(state: GameState, seen: Seen): Record<string, number> {
  const was = seen.stores;
  if (!was) return {};
  return Object.fromEntries(Object.entries(state.resources).filter(([id, n]) => was[id] !== undefined && was[id] !== n).map(([id]) => [id, was[id]!]));
}

export function seeStores(state: GameState, seen: Seen): Seen {
  const was = seen.stores;
  const same = was && Object.entries(state.resources).every(([id, n]) => was[id] === n);
  return same ? seen : { ...seen, stores: { ...state.resources } };
}

/** Buildings put up or improved since the yard was last looked at. */
export function newlyBuilt(state: GameState, seen: Seen): string[] {
  const was = seen.built;
  if (!was) return [];
  return Object.entries(state.buildings)
    .filter(([id, level]) => level > 0 && level > (was[id] ?? 0))
    .map(([id]) => id);
}

export function seeBuilt(state: GameState, seen: Seen): Seen {
  const was = seen.built;
  const same = was && Object.entries(state.buildings).every(([id, level]) => (was[id] ?? 0) === level);
  return same ? seen : { ...seen, built: { ...state.buildings } };
}

/** What's been seen of this guild: what's kept, or (a new guild, or the first time) everything there is. */
export function seenFor(state: GameState, seen: Seen | undefined): Seen {
  return seen && seen.guild === guildKey(state) ? seen : baselineSeen(state);
}

// ---------------------------------------------------------------- marking things seen

export function seeNews(state: GameState, seen: Seen): Seen {
  return seen.news === state.log.length ? seen : { ...seen, news: state.log.length };
}

export function seeChronicle(state: GameState, seen: Seen, id: string): Seen {
  const n = state.survivors.find((s) => s.id === id)?.chronicle.length;
  return n === undefined || seen.chronicle[id] === n ? seen : { ...seen, chronicle: { ...seen.chronicle, [id]: n } };
}

export function seePlace(seen: Seen, id: string): Seen {
  return seen.places.includes(id) ? seen : { ...seen, places: [...seen.places, id] };
}

export function seeStash(state: GameState, seen: Seen): Seen {
  const now = state.stash.map((i) => i.uid);
  return now.every((uid) => seen.stash.includes(uid)) ? seen : { ...seen, stash: now };
}

// ---------------------------------------------------------------- what needs looking at

/**
 * The slots someone home is going without, out of weapon and armor, when the stash has something for
 * them (a player didn't notice his people had nothing on).
 */
export function missingGear(state: GameState, s: Survivor): Slot[] {
  if (!atDepot(s) || !canChangeGear(s)) return [];
  return (['weapon', 'armor'] as const).filter((slot) => !s.equipment[slot] && state.stash.some((i) => itemDef(i).slot === slot));
}

/** New Chronicle lines for someone since their sheet's Chronicle was last opened. */
export function newChronicle(state: GameState, seen: Seen, id: string): number {
  const s = state.survivors.find((x) => x.id === id);
  if (!s) return 0;
  return Math.max(0, s.chronicle.length - (seen.chronicle[id] ?? s.chronicle.length));
}

/** The tabs of someone's sheet with something on them: gear to take or close to breaking, and new Chronicle lines. */
export function sheetDots(state: GameState, seen: Seen, id: string): Partial<Record<SheetTab, true>> {
  const s = state.survivors.find((x) => x.id === id);
  if (!s) return {};
  const out: Partial<Record<SheetTab, true>> = {};
  if (missingGear(state, s).length > 0 || s.stress >= NEAR_BREAKING) out.stats = true;
  if (newChronicle(state, seen, id) > 0) out.story = true;
  return out;
}

/** What's waiting on the Today tab: anything to decide or deal with at the Depot. */
export function todayReasons(state: GameState, now: number): string[] {
  const out: string[] = [];
  if (dilemmaCard(state, now)) out.push('decision');
  if (state.depot.recruits.length > 0) out.push('recruits');
  if (state.depot.offers.length > 0) out.push('trader');
  if (strayRows(state, now).length > 0) out.push('stray');
  const call = callCard(state, now);
  if (call && !call.runId) out.push('call');
  if (foodWarning(state)) out.push('food');
  // On the road east no raid comes (§9.12): the Depot stands empty, and that's nothing to worry about.
  if (state.survivors.length > 0 && state.survivors.filter(atDepot).length === 0 && !state.haven?.road) out.push('empty');
  return out;
}

/** Something under the yard: a first-week step done, its reward waiting (not while the tour hides it), or a corner searched. */
function yardWaiting(state: GameState, touring: boolean): boolean {
  return (storyCard(state)?.met === true && !touring) || resultCard(state) !== undefined;
}

export interface Dots {
  tabs: Partial<Record<TabScreen, true>>;
  depot: Partial<Record<DepotTab, true>>;
  survivors: Record<string, true>;
  places: Record<string, true>;
}

/** Every red dot there is now. */
export function dots(state: GameState, now: number, seen: Seen, opts: { touring?: boolean } = {}): Dots {
  const out: Dots = { tabs: {}, depot: {}, survivors: {}, places: {} };
  if (yardWaiting(state, opts.touring === true)) out.depot.yard = true;
  if (todayReasons(state, now).length > 0) out.depot.today = true;
  if (state.log.length > seen.news) out.depot.news = true;
  if (out.depot.yard || out.depot.today || out.depot.news) out.tabs.depot = true;

  for (const s of state.survivors) {
    const d = sheetDots(state, seen, s.id);
    if (d.stats || d.story) out.survivors[s.id] = true;
  }
  if (Object.keys(out.survivors).length > 0) out.tabs.roster = true;

  if (state.survivors.some((s) => missingGear(state, s).length > 0) || state.stash.some((i) => !seen.stash.includes(i.uid))) out.tabs.gear = true;

  for (const l of knownLocations(state)) if (!seen.places.includes(l.id)) out.places[l.id] = true;
  const call = callCard(state, now);
  if (call && !call.runId) out.places[call.locationId] = true;
  for (const o of state.outposts) if (o.damaged) out.places[o.locationId] = true;
  if (Object.keys(out.places).length > 0) out.tabs.reach = true;

  if (state.reports.some((r) => !r.read) || urgentItems(state, now).some((u) => u.icon !== 'raid')) out.tabs.runs = true;
  if (state.haven && (havenNew(state) > 0 || havenReady(state).length > 0)) out.tabs.haven = true;
  return out;
}

// ---------------------------------------------------------------- the strip

export interface UrgentItem {
  id: string;
  icon: 'fight' | 'raid' | 'radio';
  text: string;
  to: Route;
}

/** What can't wait: shown as a strip under the header on every screen. */
export function urgentItems(state: GameState, now: number): UrgentItem[] {
  const out: UrgentItem[] = [];
  const raid = raidCard(state, now);
  if (raid) out.push({ id: 'raid', icon: 'raid', text: raid.kind === 'seen' ? raid.title : raid.inCommand ? `${raid.title}: you’re in command` : `${raid.title}: waiting for your orders`, to: { screen: 'raid' } });
  for (const f of fightCards(state, now)) out.push({ id: `fight-${f.runId}`, icon: 'fight', text: `${f.callerName}, ${f.place}: ${f.inCommand ? 'you’re in command' : 'a fight waits for your orders'}`, to: { screen: 'fight', id: f.runId } });
  for (const c of radioCards(state, now)) out.push({ id: `radio-${c.runId}`, icon: 'radio', text: `${c.callerName} on the radio from ${c.place}`, to: { screen: 'run', id: c.runId } });
  return out;
}

/** Where a place with a dot sends the player: a call for help or a broken outpost opens its tab. */
export function placeDotReason(state: GameState, now: number, id: string): string | undefined {
  const call = callCard(state, now);
  if (call && !call.runId && call.locationId === id) return 'A call for help';
  if (state.outposts.some((o) => o.locationId === id && o.damaged)) return 'The outpost needs mending';
  return knownLocations(state).some((l) => l.id === id) ? `New: ${getLocation(id).name}` : undefined;
}
