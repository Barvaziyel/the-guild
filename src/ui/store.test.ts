import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SAVE_VERSION, renameSurvivor, serialize } from '../engine/index.ts';
import { T0, testGame } from '../engine/test-utils.ts';
import { BACKUP_KEY, SAVE_KEY, exportFileName, loadSave, memoryStore, parseImport } from './persist.ts';
import { createGameStore } from './store.ts';

let seeds = 0;
const opts = { now: () => T0, newSeed: () => `seed-${++seeds}` };

describe('persist', () => {
  test('reports an empty device, a good save and a broken one', () => {
    assert.deepEqual(loadSave(memoryStore()), { kind: 'empty' });

    const state = testGame();
    const ok = loadSave(memoryStore({ [SAVE_KEY]: serialize(state) }));
    assert.equal(ok.kind, 'ok');
    assert.deepEqual(ok.kind === 'ok' && ok.state, state);

    const broken = loadSave(memoryStore({ [SAVE_KEY]: '{"version": 3, "oops' }));
    assert.equal(broken.kind, 'error');
    assert.equal(broken.kind === 'error' && broken.raw, '{"version": 3, "oops');
  });

  test('parseImport explains what is wrong with pasted text', () => {
    assert.deepEqual(parseImport('   '), { ok: false, message: 'Paste a save first.' });
    const future = parseImport(JSON.stringify({ version: SAVE_VERSION + 1 }));
    assert.equal(future.ok, false);
    assert.match(!future.ok ? future.message : '', /newer version/);
    const good = parseImport(`\n${serialize(testGame())}\n`);
    assert.equal(good.ok, true);
  });

  test('export file names carry the day', () => {
    assert.equal(exportFileName(12), 'the-guild-day-12.json');
  });
});

describe('game store', () => {
  test('starts and saves a new guild on an empty device', () => {
    const kv = memoryStore();
    const store = createGameStore(kv, opts);
    const snap = store.getSnapshot();
    assert.equal(snap.status, 'ready');
    assert.ok(kv.data.get(SAVE_KEY));
    assert.equal(snap.status === 'ready' && snap.state.survivors.length, 4);
  });

  test('loads the saved guild instead of making a new one', () => {
    const state = testGame('kept');
    const store = createGameStore(memoryStore({ [SAVE_KEY]: serialize(state) }), opts);
    const snap = store.getSnapshot();
    assert.equal(snap.status === 'ready' && snap.state.seed, 'kept');
  });

  test('update changes a copy, saves it and notifies', () => {
    const kv = memoryStore();
    const store = createGameStore(kv, opts);
    const before = store.getSnapshot();
    let calls = 0;
    store.subscribe(() => calls++);
    const id = before.status === 'ready' ? before.state.survivors[0]!.id : '';
    store.update((s) => renameSurvivor(s, id, 'Wren', 'Holloway'));

    const after = store.getSnapshot();
    assert.equal(calls, 1);
    assert.notEqual(after, before, 'a new snapshot so React re-renders');
    assert.notEqual(before.status === 'ready' && before.state.survivors[0]!.firstName, 'Wren', 'old state untouched');
    assert.equal(after.status === 'ready' && after.state.survivors[0]!.firstName, 'Wren');
    assert.match(kv.data.get(SAVE_KEY)!, /"Wren"/);
  });

  test('a failed update changes nothing', () => {
    const kv = memoryStore();
    const store = createGameStore(kv, opts);
    const before = store.getSnapshot();
    const saved = kv.data.get(SAVE_KEY);
    assert.throws(() =>
      store.update((s) => {
        s.resources.scrap = 999;
        throw new Error('nope');
      }),
    );
    assert.equal(store.getSnapshot(), before);
    assert.equal(kv.data.get(SAVE_KEY), saved);
  });

  test('keeps playing in memory when the device refuses to save', () => {
    const kv = memoryStore();
    const store = createGameStore(kv, opts);
    kv.setItem = () => {
      throw new Error('quota exceeded');
    };
    store.update((s) => {
      s.resources.scrap = 5;
    });
    const snap = store.getSnapshot();
    assert.equal(snap.status, 'ready');
    assert.match(snap.status === 'ready' ? (snap.saveError ?? '') : '', /quota exceeded/);
    assert.equal(snap.status === 'ready' && snap.state.resources.scrap, 5);
  });

  test('an unreadable save is never overwritten until the player starts over', () => {
    const kv = memoryStore({ [SAVE_KEY]: 'not json' });
    const store = createGameStore(kv, opts);
    const snap = store.getSnapshot();
    assert.equal(snap.status, 'broken');
    assert.equal(kv.data.get(SAVE_KEY), 'not json');
    assert.throws(() => store.update(() => {}));

    store.newGuild();
    assert.equal(store.getSnapshot().status, 'ready');
    assert.equal(kv.data.get(BACKUP_KEY), 'not json', 'the broken save is kept as the backup');
  });

  test('importing replaces the guild and backs up the old one', () => {
    const kv = memoryStore();
    const store = createGameStore(kv, opts);
    const old = kv.data.get(SAVE_KEY);
    const imported = testGame('imported');
    store.replace(imported);
    const snap = store.getSnapshot();
    assert.equal(snap.status === 'ready' && snap.state.seed, 'imported');
    assert.equal(kv.data.get(BACKUP_KEY), old);
    assert.equal(store.backup(), old);
  });

  test('loading the backup swaps it with the current guild', () => {
    const kv = memoryStore();
    const store = createGameStore(kv, opts);
    const first = store.getSnapshot();
    assert.ok(first.status === 'ready');
    store.newGuild();
    const restored = parseImport(store.backup()!);
    assert.ok(restored.ok);
    store.replace(restored.state);
    const snap = store.getSnapshot();
    assert.ok(snap.status === 'ready');
    assert.equal(snap.state.seed, first.state.seed);
    assert.notEqual(JSON.parse(store.backup()!).seed, first.state.seed, 'the guild it replaced is now the backup');
  });
});
