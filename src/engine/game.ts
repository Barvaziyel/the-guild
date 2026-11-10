import { addChronicle, addGuildLog } from './chronicle.ts';
import { DAY_MS, SAVE_VERSION, STARTING_RESOURCES, STARTING_SURVIVORS } from './constants.ts';
import { createItem } from './gear.ts';
import { generateSurvivor, pickOrigin } from './generator.ts';
import { initialLocations } from './locations.ts';
import { initRelationships } from './relationships.ts';
import { Rng } from './rng.ts';
import { fullName } from './text.ts';
import type { GameState, Survivor } from './types.ts';

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
    relationships: {},
    stash: [],
    resources: { ...STARTING_RESOURCES },
    locations: initialLocations(),
    runs: [],
    reports: [],
    eventsSeen: {},
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

  addGuildLog(state, 1, `${state.guildName} set up camp in the old rail depot.`, ['founding']);
  return state;
}
