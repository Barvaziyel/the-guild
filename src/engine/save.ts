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
  // v4: reports remember whether they've been read. Old ones count as read.
  3: (save) => {
    for (const report of (save.reports ?? []) as { read?: boolean }[]) report.read = true;
  },
};

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

/**
 * Parse a save and upgrade it to the current version. Throws with a readable
 * message if the text isn't a save, is from a newer game, or is damaged.
 */
export function deserialize(json: string): GameState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('This is not a save: it is not valid JSON.');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('This is not a save.');
  }
  const data = parsed as Record<string, unknown>;
  if (typeof data.version !== 'number') throw new Error('This is not a save.');
  let version = data.version;
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
  const problem = shapeProblem(data);
  if (problem) throw new Error(`This save is damaged: ${problem}.`);
  return data as unknown as GameState;
}

/**
 * A light structural check of a migrated save, so that pasting the wrong text
 * fails at import instead of crashing the game later. Not a full validation.
 */
function shapeProblem(data: Record<string, unknown>): string | undefined {
  const isObject = (v: unknown): boolean => typeof v === 'object' && v !== null && !Array.isArray(v);
  for (const key of ['seed', 'guildName'] as const) {
    if (typeof data[key] !== 'string') return `${key} is missing`;
  }
  for (const key of ['createdAt', 'lastUpdate', 'nextId'] as const) {
    if (typeof data[key] !== 'number' || !Number.isFinite(data[key])) return `${key} is missing`;
  }
  for (const key of ['survivors', 'memorial', 'stash', 'runs', 'reports', 'log'] as const) {
    if (!Array.isArray(data[key])) return `${key} is missing`;
  }
  for (const key of ['rng', 'relationships', 'resources', 'locations', 'eventsSeen', 'settings'] as const) {
    if (!isObject(data[key])) return `${key} is missing`;
  }
  for (const s of [...(data.survivors as unknown[]), ...(data.memorial as unknown[])]) {
    if (!isObject(s)) return 'a survivor is unreadable';
    const sv = s as Record<string, unknown>;
    if (typeof sv.id !== 'string' || typeof sv.firstName !== 'string') return 'a survivor has no id or name';
    if (!isObject(sv.stats) || !Array.isArray(sv.traits) || !isObject(sv.equipment) || !Array.isArray(sv.chronicle)) {
      return `${sv.firstName} is missing stats, traits, gear or a Chronicle`;
    }
  }
  return undefined;
}
