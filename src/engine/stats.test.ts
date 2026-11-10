import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { STAT_MAX, STRESS_AFTER_BREAK, STRESS_HIGH } from './constants.ts';
import { getGear } from './content/index.ts';
import { Rng } from './rng.ts';
import {
  addPractice,
  carryCapacity,
  changeStress,
  checkBonus,
  effectiveStat,
  enemyContexts,
  maxHp,
  practiceNeeded,
  rollCheck,
  stressGainMultiplier,
} from './stats.ts';
import { testSurvivor } from './test-utils.ts';
import { addTrait } from './traits.ts';

describe('effective stats', () => {
  test('traits and gear modify stats', () => {
    const s = testSurvivor();
    addTrait(s, 'lost_eye', { day: 1, force: true }); // aim -1
    s.equipment.trinket = { uid: 'i1', defId: 'dog_tags', quality: 'common' }; // nerve +1
    assert.equal(effectiveStat(s, 'aim'), 4);
    assert.equal(effectiveStat(s, 'nerve'), 6);
    assert.ok(getGear('dog_tags'));
  });

  test('derived values follow the design formulas', () => {
    const s = testSurvivor(); // all 5
    assert.equal(maxHp(s), 8 + 2 * 5);
    assert.equal(carryCapacity(s), 2 + 5);
  });
});

describe('checks', () => {
  test('rollCheck compares d10 + bonus to the DC', () => {
    const rng = new Rng('check');
    for (let i = 0; i < 200; i++) {
      const r = rollCheck(rng, 4, 10, 'wits');
      assert.ok(r.roll >= 1 && r.roll <= 10);
      assert.equal(r.total, r.roll + 4);
      assert.equal(r.success, r.total >= 10);
      assert.equal(r.margin, r.total - 10);
    }
  });

  test('situational mods apply only in their context', () => {
    const s = testSurvivor();
    addTrait(s, 'tinkerer', { day: 1 }); // wits +2 in 'tech'; +1 vs scrapbots
    assert.equal(checkBonus(s, 'wits'), 5);
    assert.equal(checkBonus(s, 'wits', ['tech']), 7);
    assert.equal(checkBonus(s, 'aim', enemyContexts(s, 'scrapbot')), 6);
    assert.equal(checkBonus(s, 'aim', enemyContexts(s, 'raider')), 5);
  });

  test('Vengeful applies only against its target', () => {
    const s = testSurvivor();
    addTrait(s, 'vengeful', { day: 1, target: 'raider' });
    assert.equal(checkBonus(s, 'aim', enemyContexts(s, 'raider')), 7);
    assert.equal(checkBonus(s, 'aim', enemyContexts(s, 'feral')), 5);
  });

  test('high stress gives a penalty', () => {
    const s = testSurvivor('x1', { stress: STRESS_HIGH });
    assert.equal(checkBonus(s, 'grit'), 4);
  });
});

describe('practice', () => {
  test('stats rise when practice crosses 10 x current value', () => {
    const s = testSurvivor();
    assert.equal(practiceNeeded(5), 50);
    assert.deepEqual(addPractice(s, 'aim', 49, 2), []);
    const up = addPractice(s, 'aim', 1, 3);
    assert.deepEqual(up, [{ stat: 'aim', from: 5, to: 6 }]);
    assert.equal(s.practice.aim, 0);
    assert.match(s.chronicle.at(-1)!.text, /Aim rose to 6/);
  });

  test('big practice gains can raise a stat more than once, capped at max', () => {
    const s = testSurvivor();
    addPractice(s, 'wits', 50 + 60 + 70, 1);
    assert.equal(s.stats.wits, 8);
    addPractice(s, 'wits', 10_000, 2);
    assert.equal(s.stats.wits, STAT_MAX);
    assert.equal(s.practice.wits, 0);
  });
});

describe('stress', () => {
  test('Nerve and traits reduce stress gains', () => {
    const s = testSurvivor(); // nerve 5 => x0.75
    assert.equal(stressGainMultiplier(s), 0.75);
    addTrait(s, 'hardened', { day: 1 }); // x0.75
    assert.ok(Math.abs(stressGainMultiplier(s) - 0.5625) < 1e-9);
  });

  test('relief is never scaled and stress stays within 0..100', () => {
    const s = testSurvivor('x1', { stress: 10 });
    const rng = new Rng(1);
    changeStress(s, -50, { rng, day: 1 });
    assert.equal(s.stress, 0);
  });

  test('hitting 100 triggers a breaking point trait and resets stress', () => {
    const rng = new Rng('break');
    let positives = 0;
    for (let i = 0; i < 400; i++) {
      const s = testSurvivor('b' + i, { stress: 95 });
      const r = changeStress(s, 50, { rng, day: 7, source: 'a bad night' });
      assert.ok(r.breakingPoint);
      assert.equal(s.stress, STRESS_AFTER_BREAK);
      assert.equal(s.traits.length, 1);
      if (r.breakingPoint.positive) positives++;
    }
    assert.ok(positives > 80 && positives < 160, `positives ${positives}`);
  });
});
