import { SAVE_VERSION } from './constants.ts';
import { initialLocations } from './locations.ts';
import type { GameState } from './types.ts';

/**
 * Migrations from version N to N + 1. When the GameState shape changes:
 *   1. bump SAVE_VERSION in constants.ts
 *   2. add MIGRATIONS[oldVersion] that upgrades a parsed save in place
 *   3. add a test with an old save
 */
const MIGRATIONS: Record<number, (save: Record<string, unknown>) => void> = {
  // v2: expeditions (locations, active runs, reports).
  1: (save) => {
    save.locations = initialLocations();
    save.runs = [];
    save.reports = [];
  },
  // v3: scripted run events.
  2: (save) => {
    save.eventsSeen = {};
    for (const run of (save.runs ?? []) as { result: { events?: string[] } }[]) run.result.events ??= [];
    for (const report of (save.reports ?? []) as { summary: { events?: string[] } }[]) report.summary.events ??= [];
  },
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  const data = JSON.parse(json) as Record<string, unknown>;
  let version = typeof data.version === 'number' ? data.version : 0;
  if (version > SAVE_VERSION) {
    throw new Error(`Save is from a newer version (${version}) than this game (${SAVE_VERSION}).`);
  }
  while (version < SAVE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) throw new Error(`No migration from save version ${version}.`);
    migrate(data);
    version += 1;
    data.version = version;
  }
  return data as unknown as GameState;
}
