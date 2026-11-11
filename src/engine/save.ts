import { DAY_MS, SAVE_VERSION } from './constants.ts';
import { addGuildLog } from './chronicle.ts';
import { buildingName, defaultPosts, initialBuildings, trimPosts } from './depot/buildings.ts';
import { fullName } from './text.ts';
import { initialLocations } from './locations.ts';
import { FIRST_NAMES } from './content/index.ts';
import { orientationFor } from './generator.ts';
import type { GameState, Pronouns, Survivor } from './types.ts';

/** A game day lasted one real hour until save version 6. */
const HOUR_DAY_MS = 60 * 60 * 1000;

/** Until save version 9 survivors could be 'they'. A man or a woman by first name, else by whether the portrait had a beard. */
function manOrWoman(s: Survivor): Pronouns {
  if ((FIRST_NAMES.he as readonly string[]).includes(s.firstName)) return 'he';
  if ((FIRST_NAMES.she as readonly string[]).includes(s.firstName)) return 'she';
  return s.appearance.facialHair % 5 === 0 ? 'he' : 'she';
}

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
  // v5: the Depot. Buildings as a new game has them, days counted from the last update, default posts.
  4: (save) => {
    save.buildings = initialBuildings();
    const created = Number(save.createdAt);
    const last = Number(save.lastUpdate ?? created);
    save.depot = { lastDay: Math.floor(Math.max(0, last - created) / HOUR_DAY_MS) + 1, recruits: [], offers: [] };
    defaultPosts(save as unknown as GameState);
  },
  // v6: a game day lasts 3 real hours instead of 1. The day number is worked
  // out from createdAt, so move createdAt back to keep the guild on the same
  // day, the same way through it, as when it was last played.
  5: (save) => {
    const created = Number(save.createdAt);
    const last = Number(save.lastUpdate ?? created);
    const elapsed = Math.max(0, last - created);
    const days = Math.floor(elapsed / HOUR_DAY_MS);
    const intoDay = (elapsed - days * HOUR_DAY_MS) / HOUR_DAY_MS;
    save.createdAt = last - Math.round((days + intoDay) * DAY_MS);
  },
  // v7: nemeses (roadmap step 11). Named weapons and nicknames only fill fields that were already optional.
  6: (save) => {
    save.nemeses ??= [];
  },
  // v8: a crew coming home used to bring back the post they left with, even if
  // someone else had taken it meanwhile, overfilling the building. Undo that.
  7: (save) => {
    const state = save as unknown as GameState;
    for (const { survivor, building } of trimPosts(state)) {
      addGuildLog(state, state.depot.lastDay, `The ${buildingName(state, building)} had more workers than room, so ${fullName(survivor)} is off it now. Choose a new post from the sheet.`, ['post', survivor.id]);
    }
  },
  // v9: survivors are men or women. Anyone who was 'they' becomes one or the
  // other, the same way everywhere they appear (at home, out on a run, at the gate).
  8: (save) => {
    const state = save as unknown as GameState;
    const chosen = new Map<string, Pronouns>();
    const fix = (s: Survivor): void => {
      if ((s.pronouns as string) !== 'they') return;
      const p = chosen.get(s.id) ?? manOrWoman(s);
      chosen.set(s.id, p);
      s.pronouns = p;
    };
    for (const s of state.survivors) fix(s);
    for (const s of state.memorial) fix(s);
    for (const r of state.runs) for (const s of r.result.crew) fix(s);
    for (const c of state.depot.recruits) fix(c.survivor);
  },
  // v10: survivors have an orientation (§5.1), from their appearance seed, as new ones do.
  9: (save) => {
    const state = save as unknown as GameState;
    const everyone = [...state.survivors, ...state.memorial, ...state.runs.flatMap((r) => r.result.crew), ...state.depot.recruits.map((c) => c.survivor)];
    for (const s of everyone) s.orientation ??= orientationFor(s.appearance.seed);
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
  for (const key of ['rng', 'relationships', 'resources', 'locations', 'eventsSeen', 'settings', 'buildings', 'depot'] as const) {
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
