import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, becomePartners, birth, build, createVehicle, expecting, getRelationship, addRadioRecruit, startRun, postBuilding } from '../engine/index.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import type { Survivor } from '../engine/index.ts';
import { awayLines, buildingCaption, childSize, figureLook, yardModel } from './yard-view.ts';

describe('the yard', () => {
  test('workers stand at their posts, the rest hang out by the fire', () => {
    const state = testGame('yard');
    const model = yardModel(state, 12);
    assert.equal(model.phase, 'day');
    assert.equal(model.people.length, state.survivors.length);
    for (const p of model.people) {
      const s = state.survivors.find((x) => x.id === p.id)!;
      if (s.post) {
        assert.deepEqual(p.place.kind === 'post' && p.place.building, postBuilding(s.post));
        assert.match(p.label, /works the|trains/i);
      } else {
        assert.equal(p.place.kind, 'idle');
        assert.match(p.label, /taking it easy by the fire/);
      }
      assert.equal(p.go, `#/s/${s.id}`);
    }
    assert.equal(model.buildings.bunks, 1);
    assert.equal(model.buildings.workshop, 0);
  });

  test('the wounded rest on cots, by the Infirmary once there is one', () => {
    const state = testGame('cots');
    const hurt = state.survivors[0]!;
    hurt.traits.push({ id: 'badly_wounded', gainedDay: 1, expiresDay: 7 });
    let p = yardModel(state, 12, 2).people.find((x) => x.id === hurt.id)!;
    assert.deepEqual(p.place, { kind: 'resting', slot: 0, infirmary: false });
    assert.equal(p.label, `${hurt.firstName} ${hurt.lastName}. Badly wounded, heals on day 7.`);
    assert.equal(p.look.hurt, true);
    state.resources.scrap = 50;
    state.resources.tech = 5;
    state.resources.meds = 10;
    build(state, 'infirmary', 1);
    p = yardModel(state, 12, 2).people.find((x) => x.id === hurt.id)!;
    assert.deepEqual(p.place, { kind: 'resting', slot: 0, infirmary: true });
  });

  test('partners sit together, and those out on a run are not there', () => {
    const state = openGame('together');
    for (const s of state.survivors) delete s.post;
    const [a, , c, d] = state.survivors;
    getRelationship(state, a!.id, d!.id)!.score = 80;
    becomePartners(state, a!, d!, 1);
    startRun(state, testPlan(state, 'maple_street', {}, 1), T0);
    const model = yardModel(state, 22);
    assert.equal(model.phase, 'night');
    const placed = model.people.filter((p) => p.place.kind === 'idle');
    assert.equal(placed.length, 3, 'one is out');
    assert.ok(!placed.some((p) => p.id === a!.id), 'a is out on the run');
    const dSlot = placed.find((p) => p.id === d!.id)!;
    assert.match(dSlot.label, /taking it easy by the fire/);
    assert.ok(placed.some((p) => p.id === c!.id));
    assert.match(awayLines(state)[0]!, new RegExp(`^${a!.firstName} is out at Maple Street, back at `));
  });

  test('partners at home get seats side by side', () => {
    const state = testGame('seats');
    for (const s of state.survivors) delete s.post;
    const [a, , , d] = state.survivors;
    getRelationship(state, a!.id, d!.id)!.score = 80;
    becomePartners(state, a!, d!, 1);
    const idle = yardModel(state, 12).people.filter((p) => p.place.kind === 'idle');
    const slot = (id: string): number => (idle.find((p) => p.id === id)!.place as { slot: number }).slot;
    assert.equal(Math.abs(slot(a!.id) - slot(d!.id)), 1);
    assert.match(idle.find((p) => p.id === a!.id)!.label, new RegExp(`with ${d!.firstName}`));
  });

  test('recruits wait at the gate, a trader parks a cart, and vehicles at home are in the yard', () => {
    const state = testGame('gate');
    for (const n of [1, 2, 3]) addRadioRecruit(state, 2, new Rng(`gate${n}`));
    state.depot.offers.push({ id: 'o1', give: { scrap: 5 }, get: { rations: 8 }, expiresDay: 9 });
    const car = createVehicle(state, 'car', 64);
    const bike = createVehicle(state, 'motorcycle', 0);
    const out = createVehicle(state, 'van', 90);
    out.runId = 'r1';
    state.vehicles.push(car, bike, out);
    const model = yardModel(state, 6);
    assert.equal(model.phase, 'dawn');
    const gate = model.people.filter((p) => p.place.kind === 'gate');
    assert.equal(gate.length, Math.min(4, state.depot.recruits.length));
    assert.ok(gate.every((p) => p.go === '#/recruits' && /asking to join/.test(p.label)));
    assert.equal(model.trader, true);
    assert.deepEqual(model.vehicles.map((v) => v.label), ['The Hatchback, 64%.', 'The Motorcycle, broken down.']);
  });

  test('a tap on a building says what it is, or what it would cost', () => {
    const state = testGame('captions');
    assert.match(buildingCaption(state, 'garden'), /^Garden, level 1\. \d of 2 working\.$/);
    assert.equal(buildingCaption(state, 'bunks'), 'Bunks, level 1.');
    assert.equal(buildingCaption(state, 'workshop'), 'Workshop: not built yet. 30 scrap.');
  });

  test('a figure takes its colors from the portrait', () => {
    const state = testGame('look');
    const look = figureLook(state.survivors[0]!);
    assert.match(look.skin, /^#[0-9a-f]{6}$/);
    assert.match(look.cloth, /^#[0-9a-f]{6}$/);
    assert.equal(look.hurt, false);
  });

  test('children play in front of the fire, smaller; babies sit', () => {
    const state = testGame('kids');
    state.buildings.bunks = 3;
    const [m, f] = state.survivors as [Survivor, Survivor];
    m.pronouns = 'she';
    f.pronouns = 'he';
    becomePartners(state, m, f, 1);
    expecting(state, m, f, 1);
    const baby = birth(state, m, 2, new Rng('b'));
    const people = yardModel(state, 12, 3).people.filter((p) => p.place.kind === 'child');
    assert.equal(people.length, 1);
    assert.deepEqual(people[0]!.place, { kind: 'child', slot: 0, baby: true });
    assert.equal(people[0]!.look.size, 0.5);
    assert.equal(people[0]!.label, `${baby.firstName} ${baby.lastName}, a newborn.`);
    baby.age = 8;
    const older = yardModel(state, 12, 3).people.find((p) => p.id === baby.id)!;
    assert.deepEqual(older.place, { kind: 'child', slot: 0, baby: false });
    assert.match(older.label, /, 8 years old, playing in the yard\.$/);
    assert.ok(childSize(8) > 0.5 && childSize(8) < childSize(15) && childSize(15) < 1);
  });
});
