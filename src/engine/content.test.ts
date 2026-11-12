import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIRST_NAMES, GEAR, LAST_NAMES, ORIGINS, TRAITS, findGear, findTrait } from './content/index.ts';
import { STAT_IDS } from './types.ts';

/** Guards against typos in content ids. Keep this passing when adding content. */
describe('content integrity', () => {
  test('ids are unique', () => {
    for (const list of [TRAITS, GEAR, ORIGINS] as const) {
      const ids = list.map((x) => x.id);
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  test('trait opposites exist and are symmetric', () => {
    for (const t of TRAITS) {
      if (!t.opposite) continue;
      const other = findTrait(t.opposite);
      assert.ok(other, `${t.id}.opposite -> ${t.opposite} missing`);
      assert.equal(other.opposite, t.id, `${t.opposite} should point back to ${t.id}`);
    }
  });

  test('trait affinities reference real traits and stay in -2..2', () => {
    for (const t of TRAITS) {
      for (const [id, value] of Object.entries(t.affinity ?? {})) {
        assert.ok(findTrait(id), `${t.id}.affinity -> ${id} missing`);
        assert.ok(value >= -2 && value <= 2);
      }
      if (t.sociability !== undefined) assert.ok(t.sociability >= -2 && t.sociability <= 2);
    }
  });

  test('only personality traits can appear at recruitment', () => {
    for (const t of TRAITS) {
      if ((t.startWeight ?? 0) > 0) assert.equal(t.kind, 'personality', t.id);
    }
  });

  test('conditions have durations', () => {
    for (const t of TRAITS) {
      // Expecting and Nearly Due end with the birth, not after a set time (§5.3).
      if (t.kind === 'condition' && !['expecting', 'nearly_due'].includes(t.id)) {
        assert.ok(t.durationDays, `${t.id} needs durationDays`);
        assert.ok(t.durationDays[0] <= t.durationDays[1]);
      }
    }
  });

  test('every trait and gear item has a description', () => {
    for (const x of [...TRAITS, ...GEAR]) assert.ok(x.description.length > 5, x.id);
  });

  test('weapons have a type and damage; armor has a value', () => {
    for (const g of GEAR) {
      if (g.slot === 'weapon') {
        assert.ok(g.weaponType, `${g.id} weaponType`);
        assert.ok((g.damage ?? 0) > 0, `${g.id} damage`);
      }
      if (g.slot === 'armor') assert.ok(g.armor !== undefined, `${g.id} armor`);
    }
  });

  test('origins reference real traits and gear, and have weights for every stat', () => {
    for (const o of ORIGINS) {
      for (const { trait } of o.traitChances) assert.ok(findTrait(trait), `${o.id} -> trait ${trait}`);
      for (const id of o.startingWeapons) assert.equal(findGear(id)?.slot, 'weapon', `${o.id} -> ${id}`);
      for (const id of o.startingExtras?.gear ?? []) assert.ok(findGear(id), `${o.id} -> ${id}`);
      for (const stat of STAT_IDS) assert.ok(o.statWeights[stat] > 0, `${o.id}.${stat}`);
      assert.ok(o.backstories.length > 0);
      // Recruits are adults; the Depot-born join at 16 and are never rolled.
      assert.ok(o.ageRange[0] >= (o.weight > 0 ? 18 : 16), 'all survivors are adults');
    }
  });

  test('name pools are non-empty', () => {
    assert.ok(FIRST_NAMES.he.length > 10);
    assert.ok(FIRST_NAMES.she.length > 10);
    assert.ok(FIRST_NAMES.either.length > 10);
    assert.ok(LAST_NAMES.length > 20);
  });
});
