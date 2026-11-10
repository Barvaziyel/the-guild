import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  addFlag,
  adjustRelationship,
  crewCohesion,
  crewConflicts,
  hasFlag,
  labelFor,
  relationshipScore,
  relationshipsOf,
  traitAffinity,
} from './relationships.ts';
import { testGame, testSurvivor } from './test-utils.ts';
import { addTrait } from './traits.ts';
import type { GameState } from './types.ts';

function twoPeople(): GameState {
  const state = testGame();
  state.survivors = [testSurvivor('a'), testSurvivor('b'), testSurvivor('c')];
  state.relationships = {};
  return state;
}

describe('relationship labels', () => {
  test('thresholds match the design', () => {
    assert.equal(labelFor(-100), 'feud');
    assert.equal(labelFor(-60), 'feud');
    assert.equal(labelFor(-59), 'rival');
    assert.equal(labelFor(-20), 'rival');
    assert.equal(labelFor(-19), 'neutral');
    assert.equal(labelFor(19), 'neutral');
    assert.equal(labelFor(20), 'friend');
    assert.equal(labelFor(59), 'friend');
    assert.equal(labelFor(60), 'bonded');
    assert.equal(labelFor(100), 'bonded');
  });
});

describe('adjustRelationship', () => {
  test('changes are symmetric and clamped', () => {
    const state = twoPeople();
    adjustRelationship(state, 'a', 'b', 500, { day: 1 });
    assert.equal(relationshipScore(state, 'b', 'a'), 100);
    adjustRelationship(state, 'b', 'a', -1000, { day: 1 });
    assert.equal(relationshipScore(state, 'a', 'b'), -100);
  });

  test('label changes are written to both Chronicles', () => {
    const state = twoPeople();
    const r = adjustRelationship(state, 'a', 'b', 25, { day: 3 });
    assert.deepEqual(r.labelChange, { from: 'neutral', to: 'friend' });
    assert.match(state.survivors[0]!.chronicle.at(-1)!.text, /Became friends with Test Subject/);
    assert.equal(state.survivors[1]!.chronicle.length, 1);
    adjustRelationship(state, 'a', 'b', -50, { day: 4 });
    assert.match(state.survivors[0]!.chronicle.at(-1)!.text, /Became rivals/);
  });

  test('Loners warm up slowly (positive changes only)', () => {
    const state = twoPeople();
    addTrait(state.survivors[0]!, 'loner', { day: 1 }); // relGainMult 0.5
    adjustRelationship(state, 'a', 'b', 20, { day: 1 });
    assert.equal(relationshipScore(state, 'a', 'b'), 15); // (0.5 + 1) / 2 * 20
    adjustRelationship(state, 'a', 'b', -20, { day: 1 });
    assert.equal(relationshipScore(state, 'a', 'b'), -5);
  });

  test('flags', () => {
    const state = twoPeople();
    addFlag(state, 'a', 'b', { kind: 'owesLife', debtor: 'b' });
    addFlag(state, 'a', 'b', { kind: 'owesLife', debtor: 'b' });
    assert.ok(hasFlag(state, 'b', 'a', 'owesLife'));
    assert.equal(state.relationships['a|b']!.flags.length, 1);
  });
});

describe('affinity and crews', () => {
  test('affinity is symmetric; two hotheads clash, calm soothes', () => {
    const x = testSurvivor('x');
    const y = testSurvivor('y');
    addTrait(x, 'hothead', { day: 1 });
    addTrait(y, 'hothead', { day: 1 });
    assert.equal(traitAffinity(x, y), -2);
    assert.equal(traitAffinity(y, x), -2);
    const z = testSurvivor('z');
    addTrait(z, 'calm', { day: 1 });
    assert.ok(traitAffinity(x, z) > 0);
  });

  test('cohesion averages pairs and conflicts are reported', () => {
    const state = twoPeople();
    adjustRelationship(state, 'a', 'b', 80, { day: 1 });
    adjustRelationship(state, 'a', 'c', 70, { day: 1 });
    adjustRelationship(state, 'b', 'c', -30, { day: 1 });
    assert.equal(crewCohesion(state, ['a', 'b', 'c']), 2); // (80 + 70 - 30) / 3 = 40 -> 40 / 25 = 1.6 -> 2
  });

  test('relationshipsOf sorts warmest first', () => {
    const state = twoPeople();
    adjustRelationship(state, 'a', 'b', -30, { day: 1 });
    adjustRelationship(state, 'a', 'c', 40, { day: 1 });
    const list = relationshipsOf(state, 'a');
    assert.deepEqual(list.map((r) => r.other.id), ['c', 'b']);
    assert.deepEqual(crewConflicts(state, ['a', 'b', 'c']), [{ a: 'a', b: 'b', label: 'rival' }]);
  });
});
