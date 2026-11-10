import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, SAVE_VERSION, STARTING_SURVIVORS } from './constants.ts';
import { dayAt, newGame, withRng } from './game.ts';
import { pairKey } from './relationships.ts';
import { deserialize, serialize } from './save.ts';
import { T0, testGame } from './test-utils.ts';

describe('newGame', () => {
  test('creates founders with distinct origins and full relationships', () => {
    const state = testGame();
    assert.equal(state.survivors.length, STARTING_SURVIVORS);
    assert.equal(new Set(state.survivors.map((s) => s.origin)).size, STARTING_SURVIVORS);
    const ids = state.survivors.map((s) => s.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        assert.ok(state.relationships[pairKey(ids[i]!, ids[j]!)], `missing ${ids[i]}-${ids[j]}`);
      }
    }
    for (const s of state.survivors) {
      assert.equal(s.chronicle[0]!.text, 'Founded the guild at the Depot.');
    }
    assert.equal(state.stash.length, 3);
  });

  test('same seed, same game; different seed, different game', () => {
    assert.deepEqual(testGame('alpha'), testGame('alpha'));
    assert.notDeepEqual(
      testGame('alpha').survivors.map((s) => s.firstName),
      testGame('beta').survivors.map((s) => s.firstName),
    );
  });

  test('ids are unique across survivors and items', () => {
    const state = testGame();
    const ids = [
      ...state.survivors.map((s) => s.id),
      ...state.stash.map((i) => i.uid),
      ...state.survivors.flatMap((s) => Object.values(s.equipment).map((i) => i!.uid)),
    ];
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('time', () => {
  test('day 1 starts at creation and advances every DAY_MS', () => {
    const state = testGame();
    assert.equal(dayAt(state, T0), 1);
    assert.equal(dayAt(state, T0 + DAY_MS - 1), 1);
    assert.equal(dayAt(state, T0 + DAY_MS), 2);
    assert.equal(dayAt(state, T0 - 5000), 1, 'clock skew never goes below day 1');
  });
});

describe('rng threading', () => {
  test('withRng advances the stored state', () => {
    const state = testGame();
    const before = { ...state.rng };
    withRng(state, (rng) => rng.next());
    assert.notDeepEqual(state.rng, before);
  });
});

describe('save', () => {
  test('round-trips exactly', () => {
    const state = newGame({ seed: 'save', now: T0 });
    assert.deepEqual(deserialize(serialize(state)), state);
  });

  test('rejects saves from the future', () => {
    const json = JSON.stringify({ version: SAVE_VERSION + 1 });
    assert.throws(() => deserialize(json), /newer version/);
  });
});
