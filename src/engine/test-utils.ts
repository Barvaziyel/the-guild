/** Helpers for tests only. Not exported from the engine index. */
import { newGame } from './game.ts';
import { emptyCounters } from './generator.ts';
import { emptyStats } from './stats.ts';
import { LOCATIONS } from './content/index.ts';
import type { GameState, RunPlan, Survivor } from './types.ts';

export const T0 = Date.UTC(2026, 10, 10, 12, 0, 0);

export function testGame(seed = 'test-seed'): GameState {
  return newGame({ seed, now: T0 });
}

/** A plain survivor with all stats at 5 and no traits or gear. */
export function testSurvivor(id = 'x1', overrides: Partial<Survivor> = {}): Survivor {
  return {
    id,
    firstName: 'Test',
    lastName: 'Subject',
    pronouns: 'they',
    age: 30,
    origin: 'scrapper',
    backstory: '',
    appearance: { seed: 1, skinTone: 0, hairColor: 0, hairStyle: 0, faceShape: 0, eyes: 0, brows: 0, nose: 0, mouth: 0, facialHair: 0 },
    stats: emptyStats(5),
    practice: emptyStats(0),
    hp: 18,
    stress: 0,
    traits: [],
    equipment: {},
    counters: emptyCounters(),
    chronicle: [],
    status: 'ready',
    joinedDay: 1,
    ...overrides,
  };
}

/** A new game with every location discovered and plenty of supplies. */
export function openGame(seed = 'test-seed'): GameState {
  const state = testGame(seed);
  for (const loc of LOCATIONS) state.locations[loc.id] = { discovered: true, explored: 0, runs: 0 };
  state.resources = { scrap: 0, rations: 500, meds: 50, ammo: 200, tech: 0 };
  return state;
}

/** A sensible default plan for the first `size` survivors. */
export function testPlan(state: GameState, locationId = 'maple_street', overrides: Partial<RunPlan> = {}, size = 3): RunPlan {
  return {
    locationId,
    crew: state.survivors.slice(0, size).map((s) => s.id),
    job: 'scavenge',
    meds: 2,
    ammo: 12,
    approach: 'balanced',
    retreat: 'downed',
    ...overrides,
  };
}
