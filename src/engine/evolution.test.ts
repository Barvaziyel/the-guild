import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { RunTally } from './content/index.ts';
import { applyEvolutions } from './evolution.ts';
import { Rng } from './rng.ts';
import { testSurvivor } from './test-utils.ts';
import { addTrait, hasTrait } from './traits.ts';

const tally = (over: Partial<RunTally> = {}): RunTally => ({
  combats: 0, fled: 0, downed: 0, rads: 0, rangedKills: 0, meleeKills: 0, scavenges: 0, ...over,
});

describe('trait evolution', () => {
  test('ten runs make a Veteran, with the reason in the Chronicle', () => {
    const s = testSurvivor();
    s.counters.runs = 9;
    assert.deepEqual(applyEvolutions(s, { when: 'run', rng: new Rng(1), day: 5, tally: tally() }), []);
    s.counters.runs = 10;
    assert.deepEqual(applyEvolutions(s, { when: 'run', rng: new Rng(1), day: 6, tally: tally() }), ['veteran']);
    assert.match(s.chronicle.at(-1)!.text, /Became Veteran: ten runs/);
    assert.deepEqual(applyEvolutions(s, { when: 'run', rng: new Rng(1), day: 7, tally: tally() }), [], 'only once');
  });

  test('a coward who keeps standing their ground becomes Steady, but never on a run they fled', () => {
    const rng = new Rng('steady');
    let changed = 0;
    for (let i = 0; i < 400; i++) {
      const s = testSurvivor('c' + i);
      addTrait(s, 'cowardly', { day: 1, silent: true });
      s.counters.combats = 6;
      assert.deepEqual(applyEvolutions(s, { when: 'run', rng, day: 2, tally: tally({ combats: 1, fled: 1 }) }), []);
      assert.deepEqual(applyEvolutions(s, { when: 'run', rng, day: 2, tally: tally() }), [], 'needs a fight this run');
      if (applyEvolutions(s, { when: 'run', rng, day: 3, tally: tally({ combats: 1 }) }).includes('steady')) {
        changed++;
        assert.ok(!hasTrait(s, 'cowardly'));
      }
    }
    assert.ok(changed > 60 && changed < 140, `about a quarter: ${changed}`);
  });

  test('the brave cannot become Steady (the rule needs Cowardly)', () => {
    const s = testSurvivor();
    addTrait(s, 'brave', { day: 1 });
    s.counters.combats = 50;
    for (let i = 0; i < 50; i++) applyEvolutions(s, { when: 'run', rng: new Rng(i), day: 2, tally: tally({ combats: 1 }) });
    assert.ok(!hasTrait(s, 'steady'));
  });

  test('depot rules only fire on depot days', () => {
    const s = testSurvivor();
    addTrait(s, 'haunted', { day: 1, force: true });
    for (let i = 0; i < 200; i++) applyEvolutions(s, { when: 'run', rng: new Rng(i), day: 2, tally: tally() });
    assert.ok(hasTrait(s, 'haunted'));
    let healed = false;
    for (let i = 0; i < 500 && !healed; i++) {
      healed = applyEvolutions(s, { when: 'depotDay', rng: new Rng(i), day: 3, bondedAtDepot: true }).includes('hardened');
    }
    assert.ok(healed && !hasTrait(s, 'haunted') && hasTrait(s, 'hardened'));
  });
});
