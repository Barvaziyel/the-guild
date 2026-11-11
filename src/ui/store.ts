/**
 * The one place the UI keeps the game. Screens read a snapshot and change the
 * game through update(), which runs engine functions on a copy, saves it and
 * tells subscribers. Plain TypeScript (no React) so it can be tested in Node.
 */
import { newGame, type GameState } from '../engine/index.ts';
import { backupSave, errorMessage, loadSave, readBackup, writeSave, type KeyValueStore } from './persist.ts';

export type Snapshot =
  | {
      status: 'ready';
      state: GameState;
      /** Set when the last save to the device failed; the game keeps running in memory. */
      saveError?: string;
    }
  | {
      /** The save on the device couldn't be read. Nothing is overwritten until the player decides. */
      status: 'broken';
      message: string;
      raw: string;
    };

export interface GameStore {
  getSnapshot(): Snapshot;
  subscribe(listener: () => void): () => void;
  /**
   * Change the game. `fn` gets a copy of the state to mutate with engine
   * functions. If it throws, nothing changes and the error is rethrown.
   */
  update(fn: (state: GameState) => void): void;
  /** Replace the whole game (import). The current save is kept as a backup. */
  replace(state: GameState): void;
  /** Start a new guild. The current save, even an unreadable one, is kept as a backup. */
  newGuild(): void;
  /** The save that the last import or new game replaced, if any. */
  backup(): string | null;
}

export interface StoreOptions {
  now: () => number;
  /** A fresh random seed for new games. */
  newSeed: () => string;
  /** Called with each new guild: on first launch, and when Settings starts one (the tour begins). */
  onNewGuild?: (state: GameState) => void;
}

export function createGameStore(kv: KeyValueStore, opts: StoreOptions): GameStore {
  const listeners = new Set<() => void>();
  let snapshot: Snapshot;

  const emit = (): void => {
    for (const l of listeners) l();
  };

  /** Save and publish a new state. */
  const commit = (state: GameState): void => {
    let saveError: string | undefined;
    try {
      writeSave(kv, state);
    } catch (err) {
      saveError = `Couldn't save to this device: ${errorMessage(err)}`;
    }
    snapshot = saveError ? { status: 'ready', state, saveError } : { status: 'ready', state };
    emit();
  };

  const freshGame = (): GameState => {
    const state = newGame({ seed: opts.newSeed(), now: opts.now() });
    opts.onNewGuild?.(state);
    return state;
  };

  const loaded = loadSave(kv);
  if (loaded.kind === 'ok') {
    snapshot = { status: 'ready', state: loaded.state };
  } else if (loaded.kind === 'error') {
    snapshot = { status: 'broken', message: loaded.message, raw: loaded.raw };
  } else {
    snapshot = { status: 'ready', state: freshGame() };
    try {
      writeSave(kv, snapshot.state);
    } catch (err) {
      snapshot = { ...snapshot, saveError: `Couldn't save to this device: ${errorMessage(err)}` };
    }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(fn) {
      if (snapshot.status !== 'ready') throw new Error('The save could not be read.');
      const draft = structuredClone(snapshot.state);
      fn(draft);
      commit(draft);
    },
    replace(state) {
      backupSave(kv);
      commit(structuredClone(state));
    },
    newGuild() {
      backupSave(kv);
      commit(freshGame());
    },
    backup: () => readBackup(kv),
  };
}

/** A random seed for a new game. The engine itself never uses Math.random. */
export function randomSeed(): string {
  return `guild-${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 6).toString(36)}`;
}
