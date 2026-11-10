import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, dayAt, deserialize, serialize } from '../engine/index.ts';
import { T0, testGame } from '../engine/test-utils.ts';
import { fastForward } from './dev.ts';

describe('developer fast-forward', () => {
  test('plays runs and slides the timeline back so nothing is in the future', () => {
    const state = testGame('ff');
    const now = T0 + 2 * DAY_MS;
    const result = fastForward(state, now, { runs: 6 });

    assert.ok(result.runs >= 1);
    assert.ok(result.days > 0);
    assert.ok(state.createdAt < T0, 'the guild now looks older');
    assert.equal(dayAt(state, now), 3 + result.days);
    assert.equal(state.runs.length, 0);
    for (const r of state.reports) assert.ok(r.returnAt <= now);
    const everyone = [...state.survivors, ...state.memorial];
    assert.ok(everyone.some((s) => s.counters.runs > 0));
    for (const s of everyone) {
      for (const e of s.chronicle) assert.ok(e.day <= dayAt(state, now), `${e.text} is dated in the future`);
    }
    assert.deepEqual(deserialize(serialize(state)), state);
  });

  test('is deterministic for the same save', () => {
    const a = testGame('ff');
    const b = testGame('ff');
    fastForward(a, T0, { runs: 4 });
    fastForward(b, T0, { runs: 4 });
    assert.deepEqual(a, b);
  });
});
