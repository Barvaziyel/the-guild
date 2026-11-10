import type { GameState } from './types.ts';

/** Deterministic ids: s1, s2 for survivors, i3 for items, etc. One counter for everything. */
export function newId(state: GameState, prefix: string): string {
  const id = `${prefix}${state.nextId}`;
  state.nextId += 1;
  return id;
}
