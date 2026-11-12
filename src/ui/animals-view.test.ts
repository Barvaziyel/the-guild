import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { adopt, dayStart, newAnimal, Rng, strayArrives } from '../engine/index.ts';
import { testGame } from '../engine/test-utils.ts';
import { animalRows, followedHome, keeperLine, strayRows } from './animals-view.ts';

describe('animals on screen', () => {
  test('a stray at the gate says how it came, what it would do, and when it goes', () => {
    const state = testGame('stray');
    const stray = strayArrives(state, 3, new Rng('s'))!;
    const [row] = strayRows(state, dayStart(state, 3));
    assert.equal(row!.title, `A stray ${stray.animal.kind}`);
    assert.ok(row!.text && row!.effect);
    assert.match(row!.leaves, /^It will wander off by .+\.$/);
  });

  test('the guild’s animals, their keepers, and the sheet’s line', () => {
    const state = testGame('kept');
    const [a, b] = state.survivors;
    const dog = adopt(state, newAnimal(state, 'dog', new Rng('d'), 1), a, 1, 'at the gate');
    const cat = adopt(state, newAnimal(state, 'cat', new Rng('c'), 1), a, 1, 'at the gate');
    const rows = animalRows(state);
    assert.equal(rows[0]!.title, `${dog.name}, the dog`);
    assert.equal(rows[0]!.keeperLine, `Looked after by ${a!.firstName}.`);
    assert.equal(rows[0]!.keepers.length, state.survivors.length);
    assert.equal(keeperLine(state, a!.id), `Looks after ${dog.name}, the dog and ${cat.name}, the cat.`);
    assert.equal(keeperLine(state, b!.id), undefined);
  });

  test('what followed a crew home, by name', () => {
    const state = testGame('followed');
    const goat = { ...newAnimal(state, 'goat', new Rng('g'), 1), keeper: state.survivors[0]!.id };
    const summary = { animals: [goat] } as unknown as Parameters<typeof followedHome>[0];
    assert.deepEqual(followedHome(summary, { [state.survivors[0]!.id]: 'Mara' }), ['A goat followed Mara home.']);
    assert.deepEqual(followedHome(summary, {}), ['A goat followed the crew home.']);
  });
});
