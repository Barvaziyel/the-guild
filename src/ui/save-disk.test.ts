import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { renameSurvivor, serialize } from '../engine/index.ts';
import { T0, testGame } from '../engine/test-utils.ts';
import { SAVE_KEY, memoryStore, type KeyValueStore } from './persist.ts';
import {
  COPIES_DIR,
  COPIES_KEPT,
  DISK_DELAY_MS,
  DISK_SAVE,
  SEQ_KEY,
  dailyCopies,
  dayStamp,
  mirrorSaves,
  readCopy,
  reconcileSave,
  unwrapSave,
  wrapSave,
  type Disk,
} from './save-disk.ts';
import { createGameStore } from './store.ts';

/** A disk in memory. `writes` counts what was written, by path. */
function memoryDisk(files: Record<string, string> = {}): Disk & { files: Map<string, string>; writes: string[] } {
  const map = new Map(Object.entries(files));
  const writes: string[] = [];
  return {
    files: map,
    writes,
    read: async (path) => map.get(path) ?? null,
    write: async (path, text) => {
      writes.push(path);
      map.set(path, text);
    },
    list: async (dir) => [...map.keys()].filter((p) => p.startsWith(`${dir}/`)).map((p) => p.slice(dir.length + 1)),
    remove: async (path) => void map.delete(path),
  };
}

const save = serialize(testGame());
const later = (() => {
  const g = testGame();
  renameSurvivor(g, g.survivors[0]!.id, 'Later', 'On');
  return serialize(g);
})();

describe('the save in a file (3.9.1)', () => {
  test('an envelope round-trips, and anything else is no envelope', () => {
    assert.deepEqual(unwrapSave(wrapSave(4, save)), { seq: 4, save });
    assert.equal(unwrapSave(null), null);
    assert.equal(unwrapSave(save), null);
    assert.equal(unwrapSave('{"game": "the-guild", "seq": 2'), null);
  });

  test('with no file, storage is left as it is, and the file is behind', async () => {
    const kv = memoryStore({ [SAVE_KEY]: save, [SEQ_KEY]: '3' });
    assert.deepEqual(await reconcileSave(kv, memoryDisk()), { seq: 3, restored: false, fileBehind: true });
    assert.equal(kv.getItem(SAVE_KEY), save);
  });

  test('storage that lost its save, or holds one it cannot read, gets the file back', async () => {
    for (const kv of [memoryStore(), memoryStore({ [SAVE_KEY]: '{"version": 3, "oops', [SEQ_KEY]: '9' })]) {
      const result = await reconcileSave(kv, memoryDisk({ [DISK_SAVE]: wrapSave(7, later) }));
      assert.deepEqual(result, { seq: 7, restored: true });
      assert.equal(kv.getItem(SAVE_KEY), later);
      assert.equal(kv.getItem(SEQ_KEY), '7');
    }
  });

  test('whichever is further along wins', async () => {
    const behind = memoryStore({ [SAVE_KEY]: save, [SEQ_KEY]: '5' });
    assert.deepEqual(await reconcileSave(behind, memoryDisk({ [DISK_SAVE]: wrapSave(8, later) })), { seq: 8, restored: true });
    assert.equal(behind.getItem(SAVE_KEY), later);

    const ahead = memoryStore({ [SAVE_KEY]: later, [SEQ_KEY]: '8' });
    assert.deepEqual(await reconcileSave(ahead, memoryDisk({ [DISK_SAVE]: wrapSave(5, save) })), { seq: 8, restored: false, fileBehind: true });
    assert.equal(ahead.getItem(SAVE_KEY), later);
  });

  test('a file that cannot be read is never put back', async () => {
    const kv = memoryStore();
    for (const text of ['not json', wrapSave(4, '{"oops')]) {
      assert.equal((await reconcileSave(kv, memoryDisk({ [DISK_SAVE]: text }))).restored, false);
      assert.equal(kv.getItem(SAVE_KEY), null);
    }
  });

  test('each save is counted, and written to the file a moment later with the day’s copy', async () => {
    const disk = memoryDisk();
    const timers: (() => void)[] = [];
    const inner = memoryStore();
    const { kv, flush } = mirrorSaves(inner, disk, { seq: 4, today: () => '2026-11-26', later: (fn, ms) => (assert.equal(ms, DISK_DELAY_MS), void timers.push(fn)) });

    kv.setItem('the-guild:prefs', '{}');
    assert.equal(timers.length, 0, 'other keys go straight through');
    kv.setItem(SAVE_KEY, save);
    kv.setItem(SAVE_KEY, later);
    assert.equal(inner.getItem(SEQ_KEY), '6');
    assert.equal(timers.length, 1, 'saves close together are written once');
    assert.equal(disk.writes.length, 0);

    timers.shift()!();
    await flush();
    assert.deepEqual(unwrapSave(disk.files.get(DISK_SAVE)!), { seq: 6, save: later });
    assert.equal(disk.files.get(`${COPIES_DIR}/2026-11-26.json`), later);

    // Later the same day: the file moves on, the day's copy stays as it was.
    const g = testGame();
    renameSurvivor(g, g.survivors[0]!.id, 'Evening', 'Too');
    kv.setItem(SAVE_KEY, serialize(g));
    await flush();
    assert.equal(unwrapSave(disk.files.get(DISK_SAVE)!)!.seq, 7);
    assert.equal(disk.files.get(`${COPIES_DIR}/2026-11-26.json`), later);
  });

  test('only the last few days’ copies are kept', async () => {
    const disk = memoryDisk({
      [`${COPIES_DIR}/2026-11-20.json`]: save,
      [`${COPIES_DIR}/2026-11-22.json`]: save,
      [`${COPIES_DIR}/2026-11-24.json`]: save,
      [`${COPIES_DIR}/notes.txt`]: 'not a copy',
    });
    const { kv, flush } = mirrorSaves(memoryStore(), disk, { seq: 0, today: () => '2026-11-26', later: () => undefined });
    kv.setItem(SAVE_KEY, save);
    await flush();
    const copies = await dailyCopies(disk);
    assert.equal(copies.length, COPIES_KEPT);
    assert.deepEqual(
      copies.map((c) => c.label),
      ['Nov 26', 'Nov 24', 'Nov 22'],
    );
    assert.equal(await readCopy(disk, copies[0]!), save);
    assert.ok(disk.files.has(`${COPIES_DIR}/notes.txt`), 'nothing else in the folder is touched');
  });

  test('a save storage refuses still reaches the file, and the store still says it failed', async () => {
    const disk = memoryDisk();
    const full: KeyValueStore = {
      ...memoryStore(),
      setItem: (key) => {
        if (key === SAVE_KEY) throw new Error('storage is full');
      },
    };
    const mirror = mirrorSaves(full, disk, { seq: 0, today: () => '2026-11-26', later: () => undefined });
    const store = createGameStore(mirror.kv, { now: () => T0, newSeed: () => 'refused' });
    const snap = store.getSnapshot();
    assert.equal(snap.status === 'ready' && snap.saveError?.includes('storage is full'), true);
    await mirror.flush();
    assert.equal(unwrapSave(disk.files.get(DISK_SAVE)!)!.seq, 1);
  });

  test('a day stamp is the phone’s own date', () => {
    assert.match(dayStamp(Date.now()), /^\d{4}-\d{2}-\d{2}$/);
    const d = new Date(2026, 0, 5, 23, 30);
    assert.equal(dayStamp(d.getTime()), '2026-01-05');
  });
});

describe('a guild from before the file (3.9.1)', () => {
  test('is written to the file on opening, under its count, before any change', async () => {
    const kv = memoryStore({ [SAVE_KEY]: save });
    const disk = memoryDisk();
    const result = await reconcileSave(kv, disk);
    assert.deepEqual(result, { seq: 0, restored: false, fileBehind: true });
    const { flush } = mirrorSaves(kv, disk, { seq: result.seq, today: () => '2026-11-26', later: () => undefined, initial: kv.getItem(SAVE_KEY) });
    await flush();
    assert.deepEqual(unwrapSave(disk.files.get(DISK_SAVE)!), { seq: 0, save });
    assert.equal(disk.files.get(`${COPIES_DIR}/2026-11-26.json`), save);

    // Storage lost, then: it comes back from the file.
    const lost = memoryStore();
    assert.deepEqual(await reconcileSave(lost, disk), { seq: 0, restored: true });
    assert.equal(lost.getItem(SAVE_KEY), save);
  });

  test('a file in step with storage is not written again on opening', async () => {
    const kv = memoryStore({ [SAVE_KEY]: save, [SEQ_KEY]: '4' });
    assert.equal((await reconcileSave(kv, memoryDisk({ [DISK_SAVE]: wrapSave(4, save) }))).fileBehind, false);
  });
});
