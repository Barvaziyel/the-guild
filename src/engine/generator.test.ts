import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { STAT_BASE, STAT_GEN_MAX, STAT_GEN_POINTS } from './constants.ts';
import { getTrait } from './content/index.ts';
import { generateSurvivor } from './generator.ts';
import { Rng } from './rng.ts';
import { maxHp } from './stats.ts';
import { testGame } from './test-utils.ts';
import { STAT_IDS } from './types.ts';

describe('generateSurvivor', () => {
  test('stats add up and respect generation caps', () => {
    const state = testGame();
    const rng = new Rng('gen-stats');
    for (let i = 0; i < 300; i++) {
      const s = generateSurvivor(state, rng, { day: 1 });
      const total = STAT_IDS.reduce((sum, st) => sum + s.stats[st], 0);
      assert.equal(total, STAT_IDS.length * STAT_BASE + STAT_GEN_POINTS);
      for (const st of STAT_IDS) {
        assert.ok(s.stats[st] >= STAT_BASE && s.stats[st] <= STAT_GEN_MAX, `${st}=${s.stats[st]}`);
      }
    }
  });

  test('traits: at least one visible, no opposites, no duplicates', () => {
    const state = testGame();
    const rng = new Rng('gen-traits');
    for (let i = 0; i < 300; i++) {
      const s = generateSurvivor(state, rng, { day: 1 });
      const ids = s.traits.map((t) => t.id);
      assert.equal(new Set(ids).size, ids.length);
      assert.ok(s.traits.some((t) => !t.hidden), 'has a visible trait');
      assert.ok(s.traits.filter((t) => t.hidden).length <= 1);
      for (const id of ids) {
        const opp = getTrait(id).opposite;
        if (opp) assert.ok(!ids.includes(opp), `${id} with opposite ${opp}`);
        assert.equal(getTrait(id).kind, 'personality');
      }
    }
  });

  test('starts healthy, armed, with a filled-in backstory', () => {
    const state = testGame();
    const rng = new Rng('gen-misc');
    for (let i = 0; i < 100; i++) {
      const s = generateSurvivor(state, rng, { day: 3 });
      assert.equal(s.hp, maxHp(s));
      assert.ok(s.equipment.weapon, 'has a weapon');
      assert.ok(!s.backstory.includes('{'), s.backstory);
      assert.ok(s.age >= 18);
      assert.equal(s.joinedDay, 3);
    }
  });

  test('is deterministic for the same seed', () => {
    const a = generateSurvivor(testGame(), new Rng('same'), { day: 1 });
    const b = generateSurvivor(testGame(), new Rng('same'), { day: 1 });
    assert.deepEqual(a, b);
  });

  test('a forced origin is respected', () => {
    const state = testGame();
    const s = generateSurvivor(state, new Rng('origin'), { day: 1, origin: 'old_medic' });
    assert.equal(s.origin, 'old_medic');
    assert.ok(s.age >= 35);
  });
});
