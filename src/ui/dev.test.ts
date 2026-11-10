import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, completeDueRuns, dayAt, deserialize, dueRuns, serialize, startRun } from '../engine/index.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import { fastForward, skipToReturn } from './dev.ts';

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

  test('skipping ahead brings a crew home through the normal return', () => {
    const state = openGame('skip');
    const near = startRun(state, testPlan(state, 'rail_yard', {}, 1), T0);
    const far = startRun(state, { ...testPlan(state, 'kessler_farm'), crew: state.survivors.slice(1, 3).map((s) => s.id) }, T0);
    const now = T0 + 60_000;

    const wait = near.returnAt - now;
    assert.equal(skipToReturn(state, now, near.id), wait);
    assert.equal(near.returnAt, now, 'the timeline moved, not the clock');
    assert.deepEqual(dueRuns(state, now).map((r) => r.id), [near.id]);
    completeDueRuns(state, now);

    skipToReturn(state, now);
    assert.deepEqual(dueRuns(state, now).map((r) => r.id), [far.id]);
    assert.equal(skipToReturn(state, now), 0, 'nothing left to wait for');
  });

  test('fast-forward reports are already read', () => {
    const state = testGame('ff-read');
    fastForward(state, T0, { runs: 3 });
    assert.ok(state.reports.every((r) => r.read));
  });

  test('is deterministic for the same save', () => {
    const a = testGame('ff');
    const b = testGame('ff');
    fastForward(a, T0, { runs: 4 });
    fastForward(b, T0, { runs: 4 });
    assert.deepEqual(a, b);
  });
});
