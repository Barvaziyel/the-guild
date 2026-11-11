/**
 * Display preferences that belong to this device, not to the guild (they are
 * not part of the save).
 */
import type { KeyValueStore } from './persist.ts';

export interface Prefs {
  /** Hand-drawn wobble on portrait lines. Off can make long lists scroll faster. */
  wobble: boolean;
  /** Tell the player when crews come back. */
  notify: boolean;
  /** Show developer shortcuts on game screens (skip ahead to a crew's return). */
  devTools: boolean;
  /** The tour step on screen (see tour.ts), or null when the tour isn't running. */
  tour: string | null;
}

export const PREFS_KEY = 'the-guild:prefs';
const DEFAULT_PREFS: Prefs = { wobble: true, notify: false, devTools: false, tour: null };

export interface PrefsStore {
  get(): Prefs;
  set(change: Partial<Prefs>): void;
  subscribe(listener: () => void): () => void;
}

export function createPrefsStore(kv: KeyValueStore): PrefsStore {
  let prefs: Prefs = { ...DEFAULT_PREFS };
  try {
    const raw = kv.getItem(PREFS_KEY);
    if (raw) prefs = { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    // Unreadable preferences fall back to the defaults.
  }
  const listeners = new Set<() => void>();
  return {
    get: () => prefs,
    set(change) {
      prefs = { ...prefs, ...change };
      try {
        kv.setItem(PREFS_KEY, JSON.stringify(prefs));
      } catch {
        // Not worth bothering the player about.
      }
      for (const l of listeners) l();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
