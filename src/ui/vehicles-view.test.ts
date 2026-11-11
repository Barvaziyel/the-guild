import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { build, createVehicle, getVehicleDef } from '../engine/index.ts';
import { openGame, testGame, testPlan } from '../engine/test-utils.ts';
import { lootList, vehicleOutcomes } from './runs-view.ts';
import { conditionText, toggleVehicle, vehicleBuildRows, vehicleChoices, vehicleFacts, vehicleNote, vehicleRows, vehiclesLine } from './vehicles-view.ts';

describe('vehicles on screen', () => {
  test('what a vehicle does, in a line', () => {
    assert.equal(vehicleFacts(getVehicleDef('car')), 'Seats 5. Carries 10 more loads. Gets there in 55% of the walking time. Burns 2 gas a leg.');
    assert.equal(conditionText(0), 'Broken down');
    assert.equal(conditionText(20), 'In poor shape');
    assert.equal(conditionText(50), 'Worn');
    assert.equal(conditionText(90), 'Good');
  });

  test('the Depot says what the guild has, or how to get one', () => {
    const state = testGame();
    assert.match(vehiclesLine(state), /^No vehicles yet\. They’re rare/);
    const car = createVehicle(state, 'car', 82);
    const bike = createVehicle(state, 'motorcycle', 0);
    state.vehicles.push(car, bike);
    assert.equal(vehiclesLine(state), 'The Hatchback (at home, 82%) and the Motorcycle (broken down).');
    car.runId = 'r1';
    assert.equal(vehiclesLine(state), 'The Hatchback (out) and the Motorcycle (broken down).');
  });

  test('each vehicle shows its condition, where it is, and what a repair costs', () => {
    const state = testGame();
    const bike = createVehicle(state, 'motorcycle', 0);
    state.vehicles.push(bike);
    const [row] = vehicleRows(state);
    assert.equal(row!.conditionLabel, 'Broken down, 0%');
    assert.match(row!.status, /won’t run until it’s repaired/);
    assert.deepEqual(row!.repair, { cost: '30 scrap, 4 tech', problem: 'Build the Workshop first.' });
    bike.condition = 100;
    assert.equal(vehicleRows(state)[0]!.repair, undefined);
  });

  test('the Workshop lists what it can build, and why not yet', () => {
    const state = testGame();
    state.resources.scrap = 200;
    state.resources.tech = 30;
    build(state, 'workshop', 1);
    build(state, 'workshop', 2);
    const rows = vehicleBuildRows(state);
    assert.deepEqual(rows.map((r) => r.id), ['motorcycle', 'car']);
    assert.equal(rows[0]!.problem, undefined);
    assert.equal(rows[1]!.problem, 'Needs a level 3 Workshop.');
  });

  test('the planner offers each vehicle, switches off sneaking, and counts the gas', () => {
    const state = openGame();
    state.resources.gas = 9;
    const car = createVehicle(state, 'car', 70);
    const broken = createVehicle(state, 'pickup', 0);
    state.vehicles.push(car, broken);
    const choices = vehicleChoices(state);
    assert.equal(choices[0]!.label, 'Seats 5, 70%');
    assert.equal(choices[1]!.reason, 'The Pickup Truck needs repairs before it will run.');
    const plan = testPlan(state, 'drowned_mall', { approach: 'sneaky' });
    assert.match(vehicleNote(state, plan), /^On foot, a crew is up to 4\./);
    const riding = toggleVehicle(plan, car.id);
    assert.deepEqual(riding.vehicles, [car.id]);
    assert.equal(riding.approach, 'balanced');
    assert.equal(vehicleNote(state, riding), 'Seats 5. 4 gas there and back (2 legs), of 9 at the Depot.');
    assert.equal(toggleVehicle(riding, car.id).vehicles, undefined);
  });

  test('the report names a vehicle found, and what became of those taken', () => {
    const state = testGame();
    const found = createVehicle(state, 'van', 22);
    const summary = {
      outcome: 'completed' as const,
      loot: { scrap: 3, rations: 0, meds: 0, ammo: 0, tech: 0, gas: 2 },
      items: [],
      leftBehind: 0,
      medsLeft: 0,
      ammoLeft: 0,
      exploredGain: 0,
      discovered: [],
      deaths: [],
      highlights: [],
      events: [],
      foundVehicles: [found],
      vehicles: [
        { id: 'v1', defId: 'car', condition: 64 },
        { id: 'v2', defId: 'motorcycle', condition: 0, wrecked: true },
      ],
    };
    assert.deepEqual(lootList(summary), ['3 scrap', '2 gas', 'a Cargo Van that only just runs (22%)']);
    assert.deepEqual(vehicleOutcomes(summary), ['The Hatchback came back at 64%.', 'The Motorcycle was wrecked and left behind.']);
  });
});
