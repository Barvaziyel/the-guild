import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_TRAITS } from './constants.ts';
import { Rng } from './rng.ts';
import { testSurvivor } from './test-utils.ts';
import { addTrait, expireConditions, hasTrait, mulTraitHook, removeTrait, revealTrait, sumTraitHook, visibleTraits } from './traits.ts';

describe('traits', () => {
  test('adding a trait writes a Chronicle entry with the cause', () => {
    const s = testSurvivor();
    const r = addTrait(s, 'rad_hardened', { day: 4, source: 'soaked up radiation at the Drowned Mall' });
    assert.equal(r.added, true);
    assert.ok(hasTrait(s, 'rad_hardened'));
    assert.equal(s.chronicle.length, 1);
    assert.match(s.chronicle[0]!.text, /Rad-Hardened: soaked up radiation/);
  });

  test('duplicates are rejected', () => {
    const s = testSurvivor();
    addTrait(s, 'brave', { day: 1 });
    assert.equal(addTrait(s, 'brave', { day: 2 }).reason, 'duplicate');
    assert.equal(s.traits.length, 1);
  });

  test('gaining an opposite replaces it (Cowardly -> Brave)', () => {
    const s = testSurvivor();
    addTrait(s, 'cowardly', { day: 1, silent: true });
    const r = addTrait(s, 'brave', { day: 9, source: 'stood their ground' });
    assert.equal(r.replaced, 'cowardly');
    assert.ok(!hasTrait(s, 'cowardly'));
    assert.ok(hasTrait(s, 'brave'));
    assert.match(s.chronicle.at(-1)!.text, /No longer Cowardly\. Became Brave/);
  });

  test('at the cap, something new pushes out the oldest habit; scars and conditions always fit', () => {
    const s = testSurvivor();
    const fill = ['brave', 'loyal', 'calm', 'curious', 'lucky', 'generous'];
    fill.forEach((id, i) => addTrait(s, id, { day: 1 + i, silent: true }));
    assert.equal(s.traits.length, MAX_TRAITS);
    assert.deepEqual(addTrait(s, 'veteran', { day: 9, source: 'twenty-five runs' }), { added: true, replaced: 'brave' });
    assert.equal(s.chronicle.at(-1)!.text, 'Became Veteran: twenty-five runs, and left being Brave behind.');
    assert.equal(s.traits.length, MAX_TRAITS);
    assert.deepEqual(addTrait(s, 'scav', { day: 10 }).replaced, 'loyal', 'Veteran is kept; the next oldest goes');
    assert.equal(addTrait(s, 'lost_eye', { day: 11, force: true }).added, true);
    assert.equal(addTrait(s, 'wounded', { day: 11, rng: new Rng(1) }).added, true);
  });

  test('at the cap with nothing that can be let go, a new trait is refused', () => {
    const s = testSurvivor();
    for (const id of ['veteran', 'survivor', 'lost_eye', 'bad_leg', 'burn_scars', 'missing_fingers']) addTrait(s, id, { day: 1, silent: true, force: true });
    assert.equal(addTrait(s, 'scav', { day: 2 }).reason, 'full');
  });

  test('conditions expire, and re-applying extends rather than stacks', () => {
    const s = testSurvivor();
    const rng = new Rng('cond');
    addTrait(s, 'grieving', { day: 10, rng });
    const first = s.traits[0]!.expiresDay!;
    assert.ok(first >= 13 && first <= 17);
    addTrait(s, 'grieving', { day: 20, rng });
    assert.equal(s.traits.length, 1);
    assert.ok(s.traits[0]!.expiresDay! >= 23);
    assert.deepEqual(expireConditions(s, 22), []);
    assert.deepEqual(expireConditions(s, 40), ['grieving']);
    assert.equal(s.traits.length, 0);
  });

  test('hidden traits are not visible until revealed', () => {
    const s = testSurvivor();
    addTrait(s, 'unlucky', { day: 1, hidden: true });
    assert.equal(visibleTraits(s).length, 0);
    assert.equal(s.chronicle.length, 0, 'no spoilers in the Chronicle');
    assert.equal(revealTrait(s, 'unlucky', 5), true);
    assert.equal(visibleTraits(s).length, 1);
    assert.match(s.chronicle.at(-1)!.text, /Unlucky/);
    assert.equal(revealTrait(s, 'unlucky', 6), false);
  });

  test('hook helpers aggregate across traits', () => {
    const s = testSurvivor();
    addTrait(s, 'calm', { day: 1 }); // stressGainMult 0.85
    addTrait(s, 'haunted', { day: 1, force: true }); // 1.25
    addTrait(s, 'lucky', { day: 1 }); // rerollFails 1
    assert.ok(Math.abs(mulTraitHook(s, 'stressGainMult') - 0.85 * 1.25) < 1e-9);
    assert.equal(sumTraitHook(s, 'rerollFails'), 1);
    assert.equal(mulTraitHook(s, 'radMult'), 1);
  });

  test('removeTrait logs a reason when given', () => {
    const s = testSurvivor();
    addTrait(s, 'haunted', { day: 1, force: true });
    assert.equal(removeTrait(s, 'haunted', 8, 'found peace with a friend'), true);
    assert.match(s.chronicle.at(-1)!.text, /No longer Haunted: found peace/);
  });
});
