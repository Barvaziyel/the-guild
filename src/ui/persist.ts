/**
 * Saving the game on the device. Works with anything shaped like localStorage,
 * so tests can pass an in-memory store (and Capacitor storage can slot in later).
 */
import { deserialize, serialize, type GameState } from '../engine/index.ts';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'the-guild:save';
/** The save that was replaced by the last import or new game. */
export const BACKUP_KEY = 'the-guild:save:backup';

export type LoadResult =
  | { kind: 'empty' }
  | { kind: 'ok'; state: GameState }
  /** The save exists but can't be read. `raw` is kept so the player can copy it out. */
  | { kind: 'error'; message: string; raw: string };

export function loadSave(kv: KeyValueStore): LoadResult {
  const raw = kv.getItem(SAVE_KEY);
  if (raw === null || raw === '') return { kind: 'empty' };
  try {
    return { kind: 'ok', state: deserialize(raw) };
  } catch (err) {
    return { kind: 'error', message: errorMessage(err), raw };
  }
}

/** Write the save. Throws if the device refuses (storage full). */
export function writeSave(kv: KeyValueStore, state: GameState): void {
  kv.setItem(SAVE_KEY, serialize(state));
}

/** Keep a copy of the current save before something replaces it. */
export function backupSave(kv: KeyValueStore): void {
  const raw = kv.getItem(SAVE_KEY);
  if (raw) kv.setItem(BACKUP_KEY, raw);
}

export function readBackup(kv: KeyValueStore): string | null {
  return kv.getItem(BACKUP_KEY);
}

/** Read a save the player pasted or picked, without touching storage. */
export function parseImport(text: string): { ok: true; state: GameState } | { ok: false; message: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, message: 'Paste a save first.' };
  try {
    return { ok: true, state: deserialize(trimmed) };
  } catch (err) {
    return { ok: false, message: errorMessage(err) };
  }
}

/** File name for an exported save, e.g. "the-guild-day-12.json". */
export function exportFileName(day: number): string {
  return `the-guild-day-${day}.json`;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** A KeyValueStore in memory, for tests and for when the device has no storage. */
export function memoryStore(initial: Record<string, string> = {}): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}
