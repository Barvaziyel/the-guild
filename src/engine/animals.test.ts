import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  adopt,
  animalOf,
  animalsDay,
  animalsFollowHome,
  dogDefense,
  expireStrays,
  goatMilk,
  keepProblem,
  keepStray,
  keeperOf,
  missingKinds,
  newAnimal,
  rehomeAnimals,
  sendOffStray,
  setKeeper,
  strayArrives,
} from './animals.ts';
import { CAT_RELIEF, DOG_DEFENSE, GOAT_MILK, KEEPER_RELIEF, STRAY_DAYS } from './constants.ts';
import { ANIMALS, EVENTS, getAnimal } from './content/index.ts';
import { raidDefense } from './depot/events.ts';
import { emptySummary, playDepotDay } from './depot/day.ts';
import { simulateRun } from './expedition/sim.ts';
import { adjustRelationship } from './relationships.ts';
import { Rng } from './rng.ts';
import { openGame, testGame, testPlan } from './test-utils.ts';
import { ANIMAL_KINDS } from './types.ts';

describe('animals', () => {
  test('every kind has text, names, and says what the numbers say', () => {
    assert.deepEqual(ANIMALS.map((a) => a.id), [...ANIMAL_KINDS]);
    for (const a of ANIMALS) assert.ok(a.names.length >= 6 && a.description && a.effect && a.arrives, a.id);
    assert.match(getAnimal('dog').effect, new RegExp(`\\+${DOG_DEFENSE} to holding off raids`));
    assert.match(getAnimal('cat').effect, new RegExp(`sheds ${CAT_RELIEF} more stress`));
    assert.equal(GOAT_MILK, 1);
    assert.match(getAnimal('goat').effect, /a ration a day/);
  });

  test('a stray waits at the gate to be kept or sent off, and wanders off after a few days', () => {
    const state = testGame('strays');
    const rng = new Rng('s');
    const stray = strayArrives(state, 5, rng)!;
    assert.equal(stray.expiresDay, 5 + STRAY_DAYS);
    assert.equal(keepProblem(state, stray.animal.id), undefined);
    const a = keepStray(state, stray.animal.id, 6);
    assert.equal(state.depot.strays.length, 0);
    assert.equal(animalOf(state, a.kind), a);
    const keeper = keeperOf(state, a)!;
    assert.ok(keeper.chronicle.some((c) => c.text === `Took in a ${getAnimal(a.kind).name} at the gate and named it ${a.name}.`));
    // One of each kind: strays come only of kinds the guild doesn't keep.
    for (let i = 0; i < 20; i++) {
      const next = strayArrives(state, 7, new Rng(`n${i}`));
      if (!next) break;
      assert.notEqual(next.animal.kind, a.kind);
      sendOffStray(state, next.animal.id, 7);
    }
    const last = strayArrives(state, 8, rng)!;
    expireStrays(state, 8 + STRAY_DAYS - 1);
    assert.equal(state.depot.strays.length, 1);
    expireStrays(state, 8 + STRAY_DAYS);
    assert.equal(state.depot.strays.length, 0);
    assert.match(keepProblem(state, last.animal.id)!, /wandered off/);
    for (const kind of ANIMAL_KINDS) if (!animalOf(state, kind)) adopt(state, newAnimal(state, kind, rng, 9), state.survivors[0], 9, 'at the gate');
    assert.deepEqual(missingKinds(state), []);
    assert.equal(strayArrives(state, 10, rng), undefined, 'one of each');
  });

  test('the dog helps hold off raids, the goat gives milk, the cat and keepers ease stress, the crow brings things', () => {
    const state = testGame('effects');
    const rng = new Rng('e');
    const [a, b, c] = state.survivors;
    const before = raidDefense(state);
    adopt(state, newAnimal(state, 'dog', rng, 1), a, 1, 'at the gate');
    assert.equal(dogDefense(state), DOG_DEFENSE);
    assert.equal(raidDefense(state), before + DOG_DEFENSE);
    assert.equal(goatMilk(state), 0);
    adopt(state, newAnimal(state, 'goat', rng, 1), b, 1, 'at the gate');
    assert.equal(goatMilk(state), GOAT_MILK);
    adopt(state, newAnimal(state, 'cat', rng, 1), c, 1, 'at the gate');
    for (const s of state.survivors) s.stress = 20;
    state.survivors[3]!.stress = 50;
    animalsDay(state, 2, new Rng('day'), false);
    assert.equal(a!.stress, 20 - KEEPER_RELIEF);
    assert.equal(state.survivors[3]!.stress, 50 - CAT_RELIEF, 'the cat finds whoever is most on edge');
    animalsDay(state, 3, new Rng('day'), true);
    assert.equal(a!.stress, 20 - KEEPER_RELIEF, 'no rest on an empty stomach');
    adopt(state, newAnimal(state, 'crow', rng, 1), a, 1, 'at the gate');
    const scrap = state.resources.scrap;
    const stash = state.stash.length;
    for (let day = 4; day < 400; day++) animalsDay(state, day, new Rng(`crow${day}`), false);
    assert.ok(state.resources.scrap > scrap + 20 && state.resources.scrap < scrap + 200, `${state.resources.scrap - scrap}`);
    assert.ok(state.stash.length > stash, 'and now and then a trinket');
  });

  test('the goat’s milk counts with what the Garden grows', () => {
    const with_ = testGame('milk');
    const without = testGame('milk');
    adopt(with_, newAnimal(with_, 'goat', new Rng('g'), 1), with_.survivors[0], 1, 'at the gate');
    const a = emptySummary();
    const b = emptySummary();
    playDepotDay(with_, 2, new Rng('day'), a);
    playDepotDay(without, 2, new Rng('day'), b);
    assert.equal(a.grown, b.grown + GOAT_MILK);
  });

  test('keepers can change, and when one dies or leaves the animal goes to whoever was closest', () => {
    const state = testGame('keepers');
    const [a, b, c] = state.survivors;
    const dog = adopt(state, newAnimal(state, 'dog', new Rng('r'), 1), a, 1, 'at the gate');
    setKeeper(state, dog.id, b!.id, 2);
    assert.equal(dog.keeper, b!.id);
    assert.ok(b!.chronicle.some((x) => x.text.startsWith(`Started looking after ${dog.name}`)));
    adjustRelationship(state, b!.id, c!.id, 60, { day: 2, useTraitMult: false });
    rehomeAnimals(state, b!, 3, 'died');
    assert.equal(dog.keeper, c!.id);
    assert.ok(c!.chronicle.some((x) => x.text === `Took in ${dog.name}, the dog, after ${b!.firstName} ${b!.lastName} died.`));
  });

  test('an animal can follow a crew home, unless the guild has one of that kind', () => {
    const ids = EVENTS.filter((e) => [e.success, e.failure].some((o) => o?.effects?.some((x) => x.type === 'animal'))).map((e) => e.id);
    assert.deepEqual(ids.sort(), ['cat_in_the_ruins', 'crow_with_a_key', 'goat_on_the_road', 'stray_dog']);
    let found;
    for (let i = 0; i < 400 && !found; i++) {
      const state = openGame(`follow-${i}`);
      const sim = simulateRun(state, testPlan(state, 'kessler_farm', { job: 'scout' }), `f${i}`, Date.UTC(2026, 10, 11));
      if (sim.result.animals?.length) found = { state, animals: sim.result.animals };
    }
    assert.ok(found, 'some run brings one home');
    const { state, animals } = found;
    animalsFollowHome(state, animals, 3, 'Kessler Farm');
    assert.equal(state.animals.length, 1);
    assert.ok(keeperOf(state, state.animals[0]!));
    animalsFollowHome(state, [{ ...animals[0]!, id: 'other' }], 4, 'Kessler Farm');
    assert.equal(state.animals.length, 1, 'ran off by the one already there');
  });
});
