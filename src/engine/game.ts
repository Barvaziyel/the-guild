import { addChronicle, addGuildLog } from './chronicle.ts';
import { DAY_MS, DILEMMA_FIRST_DAY, NAME_MAX_LENGTH, SAVE_VERSION, STARTING_RESOURCES, STARTING_SURVIVORS } from './constants.ts';
import { defaultPosts, initialBuildings } from './depot/buildings.ts';
import { createItem } from './gear.ts';
import { generateSurvivor, pickOrigin } from './generator.ts';
import { initialLocations } from './locations.ts';
import { initRelationships } from './relationships.ts';
import { Rng } from './rng.ts';
import { fullName } from './text.ts';
import type { GameState, Survivor } from './types.ts';
import { newVultures } from './vultures.ts';

export interface NewGameOptions {
  seed: string;
  /** Epoch ms; the moment Day 1 begins. */
  now: number;
  guildName?: string;
}

/** Game day for a moment in time (Day 1 starts at createdAt). */
export function dayAt(state: GameState, now: number): number {
  return Math.floor(Math.max(0, now - state.createdAt) / DAY_MS) + 1;
}

/**
 * Run code with the game's main RNG and write its new state back.
 * Engine functions mutate the state they're given; the UI should pass a copy
 * (structuredClone) when it needs the previous state to stay untouched.
 */
export function withRng<T>(state: GameState, fn: (rng: Rng) => T): T {
  const rng = Rng.fromState(state.rng);
  const result = fn(rng);
  state.rng = rng.getState();
  return result;
}

export function getSurvivor(state: GameState, id: string): Survivor {
  const s = state.survivors.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown survivor: ${id}`);
  return s;
}

/** Trim a name the player typed and collapse inner whitespace. */
function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/** Why a name can't be used, or undefined if it's fine. */
export function nameProblem(name: string): string | undefined {
  const clean = cleanName(name);
  if (!clean) return "A name can't be empty.";
  if (clean.length > NAME_MAX_LENGTH) return `Keep it to ${NAME_MAX_LENGTH} characters.`;
  return undefined;
}

/**
 * Give a survivor a new name. If they're out on a run, the copy of them that
 * comes home gets it too, so the name survives completeRun. Old log lines and
 * reports keep the name used at the time. Throws if a name is invalid.
 */
export function renameSurvivor(state: GameState, id: string, firstName: string, lastName: string): void {
  const problem = nameProblem(firstName) ?? nameProblem(lastName);
  if (problem) throw new Error(problem);
  const first = cleanName(firstName);
  const last = cleanName(lastName);
  const child = state.children.find((c) => c.id === id);
  const copies = [child ?? getSurvivor(state, id), ...state.runs.flatMap((r) => r.result.crew.filter((c) => c.id === id))];
  for (const s of copies) {
    // The generated backstory has the first name written into it.
    s.backstory = replaceWord(s.backstory, s.firstName, first);
    s.firstName = first;
    s.lastName = last;
  }
}

/** Replace whole-word occurrences of `from` (including "from's"). */
function replaceWord(text: string, from: string, to: string): string {
  if (!from || from === to) return text;
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, 'gu'), () => to);
}

/** Add a survivor to the guild: relationships, Chronicle, guild log. */
export function recruit(state: GameState, s: Survivor, rng: Rng, day: number, joinText = 'Joined the guild.'): void {
  initRelationships(state, s, rng);
  state.survivors.push(s);
  s.joinedDay = day;
  addChronicle(s, day, joinText, ['joined']);
  addGuildLog(state, day, `${fullName(s)} joined the guild.`, ['recruit', s.id]);
}

/** Start a new game: a handful of founders with mixed origins, starting resources and stash. */
export function newGame(opts: NewGameOptions): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    seed: opts.seed,
    rng: new Rng(opts.seed).getState(),
    createdAt: opts.now,
    lastUpdate: opts.now,
    guildName: opts.guildName ?? 'The Guild',
    nextId: 1,
    survivors: [],
    memorial: [],
    departed: [],
    children: [],
    vultures: newVultures(),
    captives: [],
    relationships: {},
    stash: [],
    resources: { ...STARTING_RESOURCES },
    locations: initialLocations(),
    buildings: initialBuildings(),
    depot: { lastDay: 1, recruits: [], offers: [], strays: [] },
    runs: [],
    reports: [],
    eventsSeen: {},
    nemeses: [],
    vehicles: [],
    outposts: [],
    dilemmas: { nextDay: DILEMMA_FIRST_DAY, seen: {} },
    projects: {},
    animals: [],
    rescue: { nextDay: 1 },
    log: [],
    settings: { mercyMode: false },
  };

  withRng(state, (rng) => {
    const usedOrigins: string[] = [];
    for (let i = 0; i < STARTING_SURVIVORS; i++) {
      const origin = pickOrigin(rng, usedOrigins);
      usedOrigins.push(origin.id);
      const s = generateSurvivor(state, rng, { day: 1, origin: origin.id });
      recruit(state, s, rng, 1, 'Founded the guild at the Depot.');
    }
    state.stash.push(createItem(state, 'leather_jacket', 'common'));
    state.stash.push(createItem(state, 'crowbar', 'rusty'));
    state.stash.push(createItem(state, 'medkit', 'common'));
  });
  defaultPosts(state);

  addGuildLog(state, 1, `${state.guildName} set up camp in the old rail depot.`, ['founding']);
  return state;
}
