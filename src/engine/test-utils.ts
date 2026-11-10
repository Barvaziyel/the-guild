/** Helpers for tests only. Not exported from the engine index. */
import { newGame } from './game.ts';
import { emptyCounters } from './generator.ts';
import { emptyStats } from './stats.ts';
import type { GameState, Survivor } from './types.ts';

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
