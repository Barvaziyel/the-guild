import { LOCATIONS, getLocation, type LocationDef } from './content/index.ts';
import { DEPTHS, DEPTH_GEAR } from './constants.ts';
import type { GameState, LocationState } from './types.ts';

export function initialLocations(): Record<string, LocationState> {
  const out: Record<string, LocationState> = {};
  for (const loc of LOCATIONS) out[loc.id] = { discovered: loc.startKnown === true, explored: 0, runs: 0 };
  return out;
}

/** Read a location's state. Locations added to the content after a save was made count as fresh. */
export function locationState(state: GameState, id: string): LocationState {
  return state.locations[id] ?? { discovered: getLocation(id).startKnown === true, explored: 0, runs: 0 };
}

/** Like locationState, but makes sure the entry is stored so it can be changed. */
export function ensureLocationState(state: GameState, id: string): LocationState {
  const entry = locationState(state, id);
  state.locations[id] = entry;
  return entry;
}

/** Locations the guild knows about, nearest first. */
export function knownLocations(state: GameState): LocationDef[] {
  return LOCATIONS.filter((loc) => locationState(state, loc.id).discovered).sort((a, b) => a.durationMin - b.durationMin);
}

// ---------------------------------------------------------------- depths (§7.10)

/** How far in a plan goes: 1 the outskirts, 2 deeper in, 3 the heart of it. */
export function planDepth(plan: { depth?: number }): number {
  return Math.max(1, Math.min(DEPTHS, plan.depth ?? 1));
}

/** Explored 0..100 of one level of a place. */
export function exploredAt(state: GameState, id: string, depth: number): number {
  const here = locationState(state, id);
  return depth <= 1 ? here.explored : (here.depths?.[depth - 2] ?? 0);
}

/** A level opens once the one above it is fully explored. */
export function depthOpen(state: GameState, id: string, depth: number): boolean {
  if (depth <= 1) return true;
  if (depth > DEPTHS) return false;
  return exploredAt(state, id, depth - 1) >= 100;
}

/** The deepest level the guild can reach at a place. */
export function deepestOpen(state: GameState, id: string): number {
  let d = 1;
  while (d < DEPTHS && depthOpen(state, id, d + 1)) d += 1;
  return d;
}

/** Explore more of one level. */
export function addExplored(state: GameState, id: string, depth: number, gain: number): void {
  const here = ensureLocationState(state, id);
  if (depth <= 1) {
    here.explored = Math.min(100, here.explored + gain);
    return;
  }
  const depths = here.depths ?? [];
  while (depths.length < DEPTHS - 1) depths.push(0);
  depths[depth - 2] = Math.min(100, depths[depth - 2]! + gain);
  here.depths = depths;
}

/** A place as it is on a given level: one more danger per level down, and better odds of gear. */
export function atDepth(def: LocationDef, depth: number): LocationDef {
  const d = Math.max(0, depth - 1);
  if (d === 0) return def;
  return { ...def, danger: def.danger + d, gearChance: def.gearChance * (1 + DEPTH_GEAR * d) };
}

/** The names of the levels. */
export const DEPTH_NAMES = ['The outskirts', 'Deeper in', 'The heart of it'] as const;
