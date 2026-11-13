import { DAY_MS, RESCUE_FIRST_GAP, SAVE_VERSION, VULTURES_ARRIVE_DAY, VULTURES_LATE_ARRIVAL, YEAR_DAYS } from './constants.ts';

/** A small stable number from a string, for spreading birthdays over the year. */
function hashText(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
import { addGuildLog } from './chronicle.ts';
import { buildingName, defaultPosts, initialBuildings, trimPosts } from './depot/buildings.ts';
import { fullName } from './text.ts';
import { initialLocations } from './locations.ts';
import { FIRST_NAMES } from './content/index.ts';
import { orientationFor } from './generator.ts';
import type { GameState, Pronouns, Survivor } from './types.ts';
import { newVultures } from './vultures.ts';

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
  // v11: vehicles and gas (roadmap step 13). Loot from runs already out has no gas in it.
  10: (save) => {
    const state = save as unknown as GameState;
    state.resources.gas ??= 0;
    state.vehicles ??= [];
    for (const r of state.runs) r.result.loot.gas ??= 0;
    for (const r of state.reports) r.summary.loot.gas ??= 0;
  },
  // v12: outposts and deeper levels (roadmap step 15).
  11: (save) => {
    const state = save as unknown as GameState;
    state.outposts ??= [];
  },
  12: (save) => {
    // Decisions at the Depot (1.7.0): the first one comes a couple of days after loading.
    const state = save as unknown as GameState;
    state.dilemmas ??= { nextDay: state.depot.lastDay + 2, seen: {} };
  },
  13: (save) => {
    // Veteran counts runs at danger 2 or more (1.7.1). Nobody kept that count before, so everyone,
    // including copies inside runs and reports, starts from the runs they have.
    const walk = (x: unknown): void => {
      if (Array.isArray(x)) for (const y of x) walk(y);
      else if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        const c = o.counters as Record<string, number> | undefined;
        if (c && typeof c.runs === 'number') c.hardRuns ??= c.runs;
        for (const v of Object.values(o)) walk(v);
      }
    };
    walk(save);
  },
  14: (save) => {
    // Projects (1.8.0).
    const state = save as unknown as GameState;
    state.projects ??= {};
  },
  15: (save) => {
    // Calls for help, animals, and people who leave (1.9.0).
    const state = save as unknown as GameState;
    state.animals ??= [];
    state.departed ??= [];
    state.depot.strays ??= [];
    state.rescue ??= { nextDay: state.depot.lastDay + RESCUE_FIRST_GAP };
  },
  16: (save) => {
    // Ageing and children (1.10.0): everyone gets a birthday some time in the next year.
    const state = save as unknown as GameState;
    state.children ??= [];
    for (const s of state.survivors) s.nextBirthday ??= state.depot.lastDay + 1 + (hashText(s.id) % YEAR_DAYS);
  },
  17: (save) => {
    // The Vultures (1.11.0): they turn up a real day after the update, or on day 40, whichever is later.
    const state = save as unknown as GameState;
    state.vultures ??= newVultures(Math.max(VULTURES_ARRIVE_DAY, state.depot.lastDay + VULTURES_LATE_ARRIVAL));
  },
  18: () => {
    // Radio calls (1.12.0): runs and reports may carry a `radio` call. Older ones have none, which is fine.
  },
  19: () => {
    // Commanded fights (1.13.0): plans, runs and reports may say the player leads the fights. Older ones don't.
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
  for (const key of ['survivors', 'memorial', 'departed', 'children', 'animals', 'stash', 'runs', 'reports', 'log'] as const) {
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
