/**
 * The save in a file on the phone (3.9.1), beside the WebView's storage.
 *
 * The game still saves to the WebView's storage after every change: it's
 * there at once, so the store stays simple. That storage belongs to the
 * WebView and its web address, though, and can be lost on its own. So in the
 * app each save is also written to a file in the app's own data (a moment
 * later, and whenever the game goes to the background), and once a real day a
 * copy goes beside it; the last few are kept and can be loaded from Settings.
 *
 * Every save is counted. The count goes into the file and beside the save in
 * storage, so on opening, whichever is further along wins: storage that lost
 * its save, can't read it, or stopped taking writes is put back from the file.
 *
 * Plain, so Node can test it: the file system comes in as a `Disk`.
 */
import { deserialize } from '../engine/index.ts';
import { SAVE_KEY, type KeyValueStore } from './persist.ts';

/** Files in the app's own data folder. Paths are relative to it. */
export interface Disk {
  /** The file's text, or null if there's none (or it can't be read). */
  read(path: string): Promise<string | null>;
  /** Write the file, making its folder if needed. */
  write(path: string, text: string): Promise<void>;
  /** The names of the files in a folder; none if there's no such folder. */
  list(dir: string): Promise<string[]>;
  remove(path: string): Promise<void>;
}

/** Beside the save in storage: how many saves it's been. */
export const SEQ_KEY = 'the-guild:save:seq';
export const DISK_SAVE = 'save.json';
/** A copy a real day, named for the day ("2026-11-26.json"). */
export const COPIES_DIR = 'copies';
export const COPIES_KEPT = 3;
/** How long after a change the file is written; changes in between go together. */
export const DISK_DELAY_MS = 1500;

interface Envelope {
  game: 'the-guild';
  seq: number;
  save: string;
}

export function wrapSave(seq: number, save: string): string {
  return JSON.stringify({ game: 'the-guild', seq, save } satisfies Envelope);
}

export function unwrapSave(text: string | null): { seq: number; save: string } | null {
  if (!text) return null;
  try {
    const e = JSON.parse(text) as Partial<Envelope>;
    if (e.game !== 'the-guild' || typeof e.seq !== 'number' || typeof e.save !== 'string') return null;
    return { seq: e.seq, save: e.save };
  } catch {
    return null;
  }
}

/** How many saves storage has had, by its count. */
export function storedSeq(kv: KeyValueStore): number {
  const n = Number(kv.getItem(SEQ_KEY));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readable(raw: string | null): boolean {
  if (!raw) return false;
  try {
    deserialize(raw);
    return true;
  } catch {
    return false;
  }
}

export interface Reconciled {
  /** The count to go on from. */
  seq: number;
  /** The save was put back from the file. */
  restored: boolean;
  /** The file is missing or behind storage: write storage's save to it now (`MirrorOptions.initial`). */
  fileBehind?: boolean;
}

/**
 * Before the game loads: put the file's save back into storage if it's
 * further along than storage's, or storage has none it can read. A file that
 * can't be read is left alone; storage stays as it is.
 */
export async function reconcileSave(kv: KeyValueStore, disk: Disk): Promise<Reconciled> {
  const file = unwrapSave(await disk.read(DISK_SAVE).catch(() => null));
  const seq = storedSeq(kv);
  const storageOk = readable(kv.getItem(SAVE_KEY));
  // A guild from before 3.9.1, or one that hasn't changed since: the file starts now.
  if (!file) return { seq, restored: false, fileBehind: storageOk };
  if ((storageOk && file.seq <= seq) || !readable(file.save)) return { seq: Math.max(seq, file.seq), restored: false, fileBehind: storageOk && file.seq < seq };
  try {
    kv.setItem(SAVE_KEY, file.save);
    kv.setItem(SEQ_KEY, String(file.seq));
  } catch {
    // Storage won't take it: the game opens on what storage has, and the file stays for next time.
    return { seq: Math.max(seq, file.seq), restored: false };
  }
  return { seq: file.seq, restored: true };
}

export interface SaveMirror {
  /** Storage that also writes each save to the file. */
  kv: KeyValueStore;
  /** Write what's waiting now (the game is going to the background). */
  flush(): Promise<void>;
}

export interface MirrorOptions {
  /** The count to go on from (`reconcileSave`). */
  seq: number;
  /** Today's date on the phone, "2026-11-26": names the day's copy. */
  today: () => string;
  /** Runs `fn` after `ms`; tests pass their own. */
  later?: (fn: () => void, ms: number) => void;
  /** A save to write to the file straight away, under the current count (the file was behind). */
  initial?: string | null;
}

/**
 * Wrap storage so each save is counted and also written to the file. A save
 * storage refuses (full) still goes to the file, and the error still reaches
 * the store, which tells the player.
 */
export function mirrorSaves(inner: KeyValueStore, disk: Disk, opts: MirrorOptions): SaveMirror {
  let seq = opts.seq;
  let pending: { seq: number; save: string } | null = null;
  let timer = false;
  let chain: Promise<void> = Promise.resolve();
  const later = opts.later ?? ((fn, ms) => void setTimeout(fn, ms));
  if (opts.initial) pending = { seq, save: opts.initial };

  const flush = (): Promise<void> => {
    const job = pending;
    pending = null;
    if (!job) return chain;
    chain = chain.then(() => writeToDisk(disk, job, opts.today())).catch(() => undefined);
    return chain;
  };

  const kv: KeyValueStore = {
    getItem: (key) => inner.getItem(key),
    removeItem: (key) => inner.removeItem(key),
    setItem(key, value) {
      if (key !== SAVE_KEY) return inner.setItem(key, value);
      seq += 1;
      pending = { seq, save: value };
      if (!timer) {
        timer = true;
        later(() => {
          timer = false;
          void flush();
        }, DISK_DELAY_MS);
      }
      inner.setItem(SAVE_KEY, value);
      try {
        inner.setItem(SEQ_KEY, String(seq));
      } catch {
        // The save itself went in; at worst the file wins next time, holding the same save.
      }
    },
  };
  if (pending) void flush();
  return { kv, flush };
}

async function writeToDisk(disk: Disk, job: { seq: number; save: string }, today: string): Promise<void> {
  await disk.write(DISK_SAVE, wrapSave(job.seq, job.save));
  const names = await disk.list(COPIES_DIR);
  const name = `${today}.json`;
  // The day's copy is its first save, so it's still there if something goes wrong later that day.
  if (!names.includes(name)) await disk.write(`${COPIES_DIR}/${name}`, job.save);
  const kept = [...new Set([...names, name])].filter(isCopyName).sort().reverse();
  for (const old of kept.slice(COPIES_KEPT)) await disk.remove(`${COPIES_DIR}/${old}`);
}

function isCopyName(name: string): boolean {
  return /^\d{4}-\d{2}-\d{2}\.json$/.test(name);
}

export interface DailyCopy {
  /** The file's name in the copies folder. */
  name: string;
  /** "Nov 26" */
  label: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The day's copies on the phone, newest first. */
export async function dailyCopies(disk: Disk): Promise<DailyCopy[]> {
  const names = (await disk.list(COPIES_DIR).catch(() => [] as string[])).filter(isCopyName).sort().reverse();
  return names.map((name) => ({ name, label: `${MONTHS[Number(name.slice(5, 7)) - 1]} ${Number(name.slice(8, 10))}` }));
}

/** A copy's save text, to load like an import. */
export function readCopy(disk: Disk, copy: DailyCopy): Promise<string | null> {
  return disk.read(`${COPIES_DIR}/${copy.name}`);
}

/** "2026-11-26" for a time, on the phone's own calendar. */
export function dayStamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
