import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { RATION_KEEP_DAYS } from '../constants.ts';
import { Rng } from '../rng.ts';
import { deserialize } from '../save.ts';
import { testGame } from '../test-utils.ts';
import { emptySummary, playDepotDay } from './day.ts';
import { oldestRations, pantryIn, pantryOut, rationsGoingOff, settlePantry, spoilRations } from './pantry.ts';

describe('rations spoil', () => {
  test('the stores keep rations by the day they came in, and the oldest go first', () => {
    const state = testGame('batches');
    state.resources.rations = 0;
    state.depot.pantry = [];
    state.resources.rations = 30;
    settlePantry(state, 3);
    state.resources.rations += 20;
    settlePantry(state, 5);
    assert.deepEqual(state.depot.pantry, [
      { day: 3, n: 30 },
      { day: 5, n: 20 },
    ]);
    state.resources.rations -= 35;
    settlePantry(state, 6);
    assert.deepEqual(state.depot.pantry, [{ day: 5, n: 15 }]);
    pantryIn(state, 6, 4);
    pantryOut(state, 2);
    assert.deepEqual(state.depot.pantry, [
      { day: 5, n: 13 },
      { day: 6, n: 4 },
    ]);
    assert.equal(oldestRations(state, 9), 4);
  });

  test('past ten days, half of them go off each day; nothing younger does', () => {
    const state = testGame('off');
    state.resources.rations = 100;
    state.depot.pantry = [
      { day: 1, n: 60 },
      { day: 8, n: 40 },
    ];
    assert.equal(spoilRations(state, 1 + RATION_KEEP_DAYS), 0, 'ten days is still fine');
    assert.deepEqual(rationsGoingOff(state, 1 + RATION_KEEP_DAYS), { now: 0, soon: 60 });
    const lost = spoilRations(state, 2 + RATION_KEEP_DAYS);
    assert.equal(lost, 30);
    assert.equal(state.resources.rations, 70);
    assert.deepEqual(state.depot.pantry, [
      { day: 1, n: 30 },
      { day: 8, n: 40 },
    ]);
    spoilRations(state, 3 + RATION_KEEP_DAYS);
    spoilRations(state, 4 + RATION_KEEP_DAYS);
    assert.ok(state.depot.pantry![0]!.n <= 8, 'a week on, little of it is left');
  });

  test('a guild that eats its food in time loses none; a hoard shrinks', () => {
    const lean = testGame('lean');
    const hoard = testGame('hoard');
    hoard.resources.rations = 1000;
    let leanLost = 0;
    let hoardLost = 0;
    for (let d = 2; d <= 30; d++) {
      const a = emptySummary();
      playDepotDay(lean, d, new Rng(`l${d}`), a);
      leanLost += a.spoiled ?? 0;
      const b = emptySummary();
      playDepotDay(hoard, d, new Rng(`h${d}`), b);
      hoardLost += b.spoiled ?? 0;
    }
    assert.ok(hoardLost > 800, `the hoard lost ${hoardLost}`);
    assert.ok(leanLost < hoardLost / 10, `the lean guild lost ${leanLost}`);
  });

  test('older saves count what is stored as come in on the last day played', () => {
    const state = testGame('old');
    state.resources.rations = 44;
    const old = structuredClone(state) as unknown as { version: number; depot: Record<string, unknown> };
    old.version = 22;
    delete old.depot.pantry;
    assert.deepEqual(deserialize(JSON.stringify(old)).depot.pantry, [{ day: state.depot.lastDay, n: 44 }]);
  });
});
