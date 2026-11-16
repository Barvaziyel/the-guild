/**
 * Haven (§9.11): the long goal, from the broadcast that ends the first week.
 * The guild learns about it bit by bit: clues found on runs to the places
 * that lead to them (or worked out once a building is up), and hints heard by
 * chance on runs, at the gate, from traders, on the radio, at the fire, from
 * captives and from the Vultures. The clues and hints are data in
 * content/haven.ts. Every roll here has its own dice, so nothing else in a
 * run or a Depot day comes out differently for it.
 */
import { addGuildLog } from './chronicle.ts';
import { HAVEN_FIND_CHANCE, HAVEN_FIND_SCOUT, HAVEN_FIND_TRY, HAVEN_HINT_CHANCE, HAVEN_HINT_GAP, HAVEN_VULTURES_CHANCE } from './constants.ts';
import { HAVEN_BROADCAST, HAVEN_CLUES, HAVEN_HINTS, HAVEN_ROAD, HAVEN_VULTURES, type HavenClue, type HavenHint } from './content/haven.ts';
import { getLocation } from './content/index.ts';
import { atDepot } from './depot/buildings.ts';
import { dayAt } from './game.ts';
import { planDepth } from './locations.ts';
import { Rng } from './rng.ts';
import { fillRoles } from './text.ts';
import type { GameState, HavenFound, HavenHeard, HavenHintSource, HavenNews, HavenState, RunPlan, Survivor } from './types.ts';

/** Haven from the broadcast on: an empty file. Does nothing if it's started already. */
export function startHaven(state: GameState, day: number): HavenState {
  state.haven ??= { day, found: [], tries: {}, heard: [], seen: { found: 0, heard: 0 } };
  return state.haven;
}

export function getClue(id: string): HavenClue {
  const clue = HAVEN_CLUES.find((c) => c.id === id);
  if (!clue) throw new Error(`Unknown Haven clue: ${id}`);
  return clue;
}

export function clueFound(state: GameState, id: string): boolean {
  return state.haven?.found.some((f) => f.id === id) ?? false;
}

/** A clue the guild can go after now: not found yet, and everything it follows on from is. */
export function clueOpen(state: GameState, clue: HavenClue): boolean {
  return !!state.haven && !clueFound(state, clue.id) && clue.after.every((id) => clueFound(state, id));
}

/** The leads: clues the guild can go after now, in the file's order. */
export function havenLeads(state: GameState): HavenClue[] {
  return HAVEN_CLUES.filter((c) => clueOpen(state, c));
}

/** A lead to follow on a run to this place, at this level (or one less deep). */
export function leadAt(state: GameState, locationId: string, depth: number): HavenClue | undefined {
  return havenLeads(state).find((c) => c.where.kind === 'run' && c.where.locationId === locationId && c.where.depth <= depth);
}

/** A building clue whose building is up: the player can work it out. */
export function clueReady(state: GameState, clue: HavenClue): boolean {
  if (clue.where.kind !== 'build' || !clueOpen(state, clue)) return false;
  return (state.buildings[clue.where.building] ?? 0) >= clue.where.level;
}

/** Everything that opens the road is found: the guild knows where Haven is and how to get in. */
export function havenRoadOpen(state: GameState): boolean {
  return HAVEN_ROAD.every((id) => clueFound(state, id));
}

/** How likely a run following a lead is to find it: better each time, and when scouting. */
export function findChance(tries: number, scouting: boolean): number {
  return Math.min(1, HAVEN_FIND_CHANCE + HAVEN_FIND_TRY * tries + (scouting ? HAVEN_FIND_SCOUT : 0));
}

/** The building clue worked out from the Haven tab. Throws unless its building is up. */
export function workOutClue(state: GameState, id: string, now: number): HavenFound {
  const clue = getClue(id);
  if (!clueReady(state, clue)) throw new Error(clue.where.kind === 'build' && clueOpen(state, clue) ? 'Not yet: the building isn’t up.' : 'There’s nothing to work out.');
  const day = dayAt(state, now);
  return file(state, clue.id, day);
}

function file(state: GameState, id: string, day: number, by?: Survivor, at?: string): HavenFound {
  const haven = state.haven!;
  const found: HavenFound = { id, day, ...(by ? { by: by.id } : {}), ...(at ? { at } : {}) };
  haven.found.push(found);
  delete haven.tries[id];
  const title = id === HAVEN_VULTURES.id ? HAVEN_VULTURES.title : getClue(id).title;
  const where = at ? ` at ${getLocation(at).name.replace(/^The /, 'the ')}` : '';
  addGuildLog(state, day, by ? `For Haven: ${by.firstName} found ${lower(title)}${where}.` : `For Haven: ${lower(title)}.`, ['haven', id]);
  if (havenRoadOpen(state) && HAVEN_ROAD.includes(id)) addGuildLog(state, day, 'They know where Haven is now, and how to get in.', ['haven']);
  return found;
}

function lower(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}

// ---------------------------------------------------------------- runs

/** What a run will look for, decided as it sets out: the lead at its place, and whether a hint can come. */
export interface RunHaven {
  clue?: HavenClue;
  tries: number;
  /** Hints a run could come across now, the earliest first. Empty while one came too recently. */
  hints: HavenHint[];
}

export function runHaven(state: GameState, plan: RunPlan, departAt: number): RunHaven | undefined {
  if (!state.haven) return undefined;
  const clue = leadAt(state, plan.locationId, planDepth(plan));
  const day = dayAt(state, departAt);
  return {
    ...(clue ? { clue } : {}),
    tries: clue ? (state.haven.tries[clue.id] ?? 0) : 0,
    hints: hintDue(state, day) ? hintsFrom(state, 'run') : [],
  };
}

/**
 * At the end of a run that made it there and back: did they find what they
 * went for, and did anyone come across a hint on the way? Its own dice.
 * `crew` are the ones standing; the finder is whoever's sharpest.
 */
export function playRunHaven(look: RunHaven, seed: string, crew: Survivor[], scouting: boolean, wits: (s: Survivor) => number): HavenNews | undefined {
  if (crew.length === 0) return undefined;
  const rng = new Rng(`haven:${seed}`);
  const news: HavenNews = {};
  if (look.clue) {
    const found = rng.chance(findChance(look.tries, scouting));
    const by = [...crew].sort((a, b) => wits(b) - wits(a))[0]!;
    news.lead = { clue: look.clue.id, found, ...(found ? { by: by.id } : {}) };
  }
  if (look.hints.length > 0 && rng.chance(HAVEN_HINT_CHANCE.run)) {
    const hint = pickHint(look.hints, rng);
    news.hint = { id: hint.id, text: fillRoles(hint.text, { a: rng.pick(crew) }) };
  }
  return news.lead || news.hint ? news : undefined;
}

/** The run's line when they find the clue. */
export function findLine(clue: HavenClue, by: Survivor): string {
  return fillRoles(clue.find ?? `{a.first} finds ${lower(clue.title)}.`, { a: by });
}

/** A crew home: file what they found, count a try, keep a hint. */
export function applyHavenNews(state: GameState, news: HavenNews | undefined, locationId: string, day: number): void {
  const haven = state.haven;
  if (!news || !haven) return;
  if (news.lead && !clueFound(state, news.lead.clue)) {
    if (news.lead.found) file(state, news.lead.clue, day, state.survivors.find((s) => s.id === news.lead!.by), locationId);
    else haven.tries[news.lead.clue] = (haven.tries[news.lead.clue] ?? 0) + 1;
  }
  if (news.hint && !haven.heard.some((h) => h.id === news.hint!.id)) {
    hear(state, { id: news.hint.id, day, text: news.hint.text, source: 'run', at: locationId }, false);
  }
}

// ---------------------------------------------------------------- hints

/** Long enough since the last hint for another. */
function hintDue(state: GameState, day: number): boolean {
  const last = state.haven?.lastHint;
  return last === undefined || day - last >= HAVEN_HINT_GAP;
}

/** Hints not heard yet from this source, that the guild knows enough for. */
function hintsFrom(state: GameState, from: HavenHintSource): HavenHint[] {
  const haven = state.haven!;
  const heard = new Set(haven.heard.map((h) => h.id));
  const known = haven.found.filter((f) => f.id !== HAVEN_VULTURES.id).length;
  return HAVEN_HINTS.filter((h) => h.from === from && !heard.has(h.id) && h.tier <= known && (!h.needs || clueFound(state, h.needs)));
}

/** The earliest of them, so the hints darken in order. */
function pickHint(hints: HavenHint[], rng: Rng): HavenHint {
  const tier = Math.min(...hints.map((h) => h.tier));
  return rng.pick(hints.filter((h) => h.tier === tier));
}

/** Keep a hint, and put it in the news (a run's is in its report already). */
function hear(state: GameState, heard: HavenHeard, log: boolean): void {
  state.haven!.heard.push(heard);
  state.haven!.lastHint = Math.max(state.haven!.lastHint ?? heard.day, heard.day);
  if (log) addGuildLog(state, heard.day, heard.text, ['haven', heard.id]);
}

/** Maybe a hint from someone who just joined. */
export function gateHint(state: GameState, s: Survivor, day: number): HavenHeard | undefined {
  return maybeHint(state, 'gate', day, HAVEN_HINT_CHANCE.gate, `gate:${s.id}`, s);
}

/** Maybe a hint from a trader at the gate. */
export function traderHint(state: GameState, day: number): HavenHeard | undefined {
  return maybeHint(state, 'trader', day, HAVEN_HINT_CHANCE.trader, `trader:${day}`);
}

function maybeHint(state: GameState, from: HavenHintSource, day: number, chance: number, seed: string, person?: Survivor): HavenHeard | undefined {
  if (!state.haven || !hintDue(state, day)) return undefined;
  const pool = hintsFrom(state, from);
  if (pool.length === 0) return undefined;
  const rng = new Rng(`haven:${state.seed}:${seed}`);
  if (!rng.chance(chance)) return undefined;
  const hint = pickHint(pool, rng);
  const heard: HavenHeard = { id: hint.id, day, text: person ? fillRoles(hint.text, { a: person }) : hint.text, source: from };
  hear(state, heard, true);
  return heard;
}

// ---------------------------------------------------------------- a Depot day

/**
 * Haven's part of a Depot day: a guild without the first week hears the
 * broadcast once it has a Radio Tower; the Vultures come about the list; and
 * now and then a hint from the radio, the fire, a captive or the Vultures.
 */
export function playHavenDay(state: GameState, day: number): void {
  if (!state.haven) {
    // A guild older than the first week hears it once it's on the air (with the week, its last step does it).
    if (state.story || (state.buildings.radio_tower ?? 0) < 1) return;
    startHaven(state, day);
    addGuildLog(state, day, `On the radio, a woman’s voice, calm and clear: “${HAVEN_BROADCAST}” It comes again every hour. Nobody here has heard of Haven.`, ['haven']);
    return;
  }
  const rng = new Rng(`haven:${state.seed}:day:${day}`);
  if (!clueFound(state, HAVEN_VULTURES.id) && HAVEN_VULTURES.after.every((id) => clueFound(state, id)) && state.vultures.arrived && rng.chance(HAVEN_VULTURES_CHANCE)) {
    file(state, HAVEN_VULTURES.id, day);
    addGuildLog(state, day, HAVEN_VULTURES.text, ['haven', 'vultures']);
    return;
  }
  if (!hintDue(state, day) || !rng.chance(HAVEN_HINT_CHANCE.day)) return;
  const home = state.survivors.filter(atDepot);
  const sources: { from: HavenHintSource; person?: Survivor }[] = [];
  if ((state.buildings.radio_tower ?? 0) >= 1) sources.push({ from: 'radio' });
  if (home.length > 0) sources.push({ from: 'fire', person: rng.pick(home) });
  if (state.captives.length > 0) sources.push({ from: 'captive', person: rng.pick(state.captives).person });
  if (state.vultures.arrived) sources.push({ from: 'vultures' });
  const open = sources.filter((s) => hintsFrom(state, s.from).length > 0);
  if (open.length === 0) return;
  const { from, person } = rng.pick(open);
  const hint = pickHint(hintsFrom(state, from), rng);
  hear(state, { id: hint.id, day, text: person ? fillRoles(hint.text, { a: person }) : hint.text, source: from }, true);
}

/** The player has looked at the Haven tab: what's there now isn't new. */
export function seenHaven(state: GameState): void {
  const haven = state.haven;
  if (haven) haven.seen = { found: haven.found.length, heard: haven.heard.length };
}

/** Found or heard since the player last looked. */
export function havenNew(state: GameState): number {
  const haven = state.haven;
  return haven ? Math.max(0, haven.found.length - haven.seen.found) + Math.max(0, haven.heard.length - haven.seen.heard) : 0;
}

/** For the run's departure copy: what the run needs to know, without the hints' text. */
export function havenForRun(haven: HavenState | undefined): HavenState | undefined {
  return haven && { ...haven, heard: haven.heard.map((h) => ({ id: h.id, day: h.day, text: '', source: h.source })) };
}

