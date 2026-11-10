import { LOCATIONS, getLocation, type LocationDef } from './content/index.ts';
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
