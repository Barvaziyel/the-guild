import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_CREW, RAID_THIN_PENALTY, SAVE_VERSION } from './constants.ts';
import { getLocation, getVehicleDef, VEHICLES } from './content/index.ts';
import { build } from './depot/buildings.ts';
import { acceptOffer, offerText, raid, raidDefense } from './depot/events.ts';
import { completeRun, startRun } from './expedition/runs.ts';
import { footDuration, planWarnings, runDuration, validatePlan } from './expedition/plan.ts';
import { simulateRun } from './expedition/sim.ts';
import { Rng } from './rng.ts';
import { deserialize } from './save.ts';
import { T0, openGame, testGame, testPlan } from './test-utils.ts';
import type { GameState, RunPlan, Vehicle } from './types.ts';
import {
  buildVehicle,
  buildVehicleProblem,
  createVehicle,
  crewLimit,
  gasLegs,
  gasNeeded,
  repairCost,
  repairProblem,
  repairVehicle,
  seating,
} from './vehicles.ts';
import { generateSurvivor } from './generator.ts';
import { initRelationships } from './relationships.ts';

/** A guild of `size` with every place known, plenty of gas, and the given vehicles at home. */
function garage(seed: string, defIds: string[], size = 6, condition = 100): { state: GameState; vehicles: Vehicle[] } {
  const state = openGame(seed);
  const rng = new Rng(seed);
  while (state.survivors.length < size) {
    const s = generateSurvivor(state, rng, { day: 1 });
    initRelationships(state, s, rng);
    state.survivors.push(s);
  }
  state.resources.gas = 200;
  const vehicles = defIds.map((id) => createVehicle(state, id, condition));
  state.vehicles.push(...vehicles);
  return { state, vehicles };
}

function crewOf(state: GameState, n: number): string[] {
  return state.survivors.slice(0, n).map((s) => s.id);
}

describe('vehicles: planning', () => {
  test('on foot a crew is 1 to 4; vehicles seat more, and every one needs a driver', () => {
    const { state, vehicles } = garage('seats', ['car', 'motorcycle'], 8);
    const [car, bike] = vehicles as [Vehicle, Vehicle];
    const foot: RunPlan = { ...testPlan(state), crew: crewOf(state, 5) };
    assert.equal(crewLimit(state, foot), MAX_CREW);
    assert.match(validatePlan(state, foot).join(' '), /On foot, a crew can have at most 4/);
    const inCar = { ...foot, vehicles: [car.id] };
    assert.equal(crewLimit(state, inCar), 5);
    assert.deepEqual(validatePlan(state, inCar), []);
    const both = { ...foot, crew: crewOf(state, 7), vehicles: [car.id, bike.id] };
    assert.equal(crewLimit(state, both), 7);
    assert.deepEqual(validatePlan(state, both), []);
    assert.match(validatePlan(state, { ...both, crew: crewOf(state, 1) }).join(' '), /needs someone to drive it/);
    const seats = seating(state, both);
    assert.deepEqual(seats.map((s) => s.riders.length), [5, 2]);
    assert.equal(seats[1]!.riders[0], both.crew[1], 'each vehicle gets a driver first');
  });

  test('no sneaking in a vehicle, no going out without the gas, and broken ones stay home', () => {
    const { state, vehicles } = garage('rules', ['car']);
    const car = vehicles[0]!;
    const plan: RunPlan = { ...testPlan(state, 'red_hand_camp'), vehicles: [car.id] };
    assert.equal(gasLegs(state, plan), Math.ceil(getLocation('red_hand_camp').durationMin / 30));
    assert.equal(gasNeeded(state, plan), getVehicleDef('car').gas * gasLegs(state, plan));
    assert.match(validatePlan(state, { ...plan, approach: 'sneaky' }).join(' '), /Nobody sneaks/);
    state.resources.gas = 1;
    assert.match(validatePlan(state, plan).join(' '), /need \d+ gas/);
    state.resources.gas = 200;
    car.condition = 0;
    assert.match(validatePlan(state, plan).join(' '), /needs repairs/);
    car.condition = 20;
    assert.ok(planWarnings(state, plan).some((w) => /poor shape/.test(w)));
  });

  test('a vehicle gets there in about half the time, but meets as much on the way', () => {
    const { state, vehicles } = garage('speed', ['car']);
    const plan: RunPlan = { ...testPlan(state, 'checkpoint_bravo'), vehicles: [vehicles[0]!.id] };
    const foot = footDuration(state, plan);
    assert.equal(runDuration(state, plan), Math.round(getLocation('checkpoint_bravo').durationMin * getVehicleDef('car').speed) * 60_000);
    assert.ok(runDuration(state, plan) < foot * 0.6);
    const walking = simulateRun(state, { ...plan, vehicles: [] }, 'same', T0);
    const driving = simulateRun(state, plan, 'same', T0);
    assert.ok(driving.beats.length >= walking.beats.length - 1, 'about as many beats');
  });

  test('leaving fewer than three at home gets a warning', () => {
    const { state } = garage('thin', [], 4);
    assert.ok(!planWarnings(state, testPlan(state, 'maple_street', {}, 1)).some((w) => /fence|easy pickings/.test(w)));
    assert.ok(planWarnings(state, testPlan(state, 'maple_street', {}, 2)).some((w) => /Only 2 would be left/.test(w)));
    assert.ok(planWarnings(state, testPlan(state, 'maple_street', {}, 4)).some((w) => /Nobody would be left/.test(w)));
  });
});

describe('vehicles: runs', () => {
  test('setting out burns the gas and takes the vehicle; coming home wears it down', () => {
    const { state, vehicles } = garage('trip', ['car']);
    const car = vehicles[0]!;
    const plan: RunPlan = { ...testPlan(state, 'maple_street'), vehicles: [car.id] };
    const gas = gasNeeded(state, plan);
    const run = startRun(state, plan, T0);
    assert.equal(state.resources.gas, 200 - gas);
    assert.equal(run.gas, gas);
    assert.equal(car.runId, run.id);
    assert.match(validatePlan(state, { ...testPlan(state, 'maple_street', {}, 1), crew: crewOf(state, 6).slice(4), vehicles: [car.id] }).join(' '), /already out/);
    assert.match(state.log.at(-1)!.text, /in the Hatchback\.$/);
    completeRun(state, run.id, run.returnAt);
    if (run.result.vehicles![0]!.wrecked) return;
    assert.equal(car.runId, undefined);
    assert.equal(car.runs, 1);
    assert.ok(car.condition < 100 && car.condition >= 100 - 30);
  });

  test('a wrecked vehicle is left behind, its riders get hurt, and the crew walks home', () => {
    for (let i = 0; i < 400; i++) {
      const { state, vehicles } = garage(`wreck-${i}`, ['car'], 6, 5);
      const plan: RunPlan = { ...testPlan(state, 'water_plant'), vehicles: [vehicles[0]!.id] };
      const sim = simulateRun(state, plan, 'w', T0);
      if (!sim.result.vehicles?.[0]?.wrecked || sim.result.outcome === 'lost') continue;
      const lines = sim.beats.flatMap((b) => b.lines.map((l) => l.text));
      assert.ok(lines.some((l) => /is wrecked/.test(l)));
      assert.ok(lines.some((l) => /long walk home/.test(l)));
      const run = startRun(state, plan, T0);
      if (!run.result.vehicles?.[0]?.wrecked) continue;
      completeRun(state, run.id, run.returnAt);
      assert.equal(state.vehicles.length, 0);
      assert.ok(state.log.some((l) => /The Hatchback was wrecked at The Water Plant/.test(l.text)));
      return;
    }
    assert.fail('no wreck found');
  });

  test('wrecks are rare in a vehicle kept in good shape, and much likelier in a worn one', () => {
    const rate = (condition: number): number => {
      let wrecks = 0;
      const n = 300;
      for (let i = 0; i < n; i++) {
        const { state, vehicles } = garage(`rate-${condition}-${i}`, ['car'], 3, condition);
        const plan: RunPlan = { ...testPlan(state, 'checkpoint_bravo'), vehicles: [vehicles[0]!.id] };
        if (simulateRun(state, plan, `r${i}`, T0).result.vehicles![0]!.wrecked) wrecks += 1;
      }
      return wrecks / n;
    };
    const good = rate(100);
    const worn = rate(20);
    assert.ok(good < 0.05, `${(good * 100).toFixed(1)}% at full condition`);
    assert.ok(worn > good * 2 && worn < 0.2, `${(worn * 100).toFixed(1)}% when worn`);
  });

  test('vehicles carry more home from far away, and draw more trouble', () => {
    let footLeft = 0;
    let carLeft = 0;
    let footFights = 0;
    let carFights = 0;
    for (let i = 0; i < 300; i++) {
      const { state, vehicles } = garage(`haul-${i}`, ['pickup'], 3);
      const plan: RunPlan = { ...testPlan(state, 'water_plant'), vehicles: [vehicles[0]!.id] };
      const walk = simulateRun(state, { ...plan, vehicles: [] }, `h${i}`, T0);
      const drive = simulateRun(state, plan, `h${i}`, T0);
      footLeft += walk.result.leftBehind;
      carLeft += drive.result.leftBehind;
      footFights += walk.beats.filter((b) => b.kind === 'combat').length;
      carFights += drive.beats.filter((b) => b.kind === 'combat').length;
    }
    assert.ok(carLeft < footLeft / 2, `left behind: ${footLeft} on foot, ${carLeft} by pickup`);
    assert.ok(carFights > footFights, `fights: ${footFights} on foot, ${carFights} by pickup`);
  });

  test('now and then a crew finds a wreck, gets it running and brings it home', () => {
    let found = 0;
    const n = 600;
    for (let i = 0; i < n; i++) {
      const state = openGame(`find-${i}`);
      const plan = testPlan(state, 'drowned_mall', { job: 'scout' });
      const sim = simulateRun(state, plan, `f${i}`, T0);
      const v = sim.result.foundVehicles?.[0];
      if (!v) continue;
      found += 1;
      assert.ok(getLocation('drowned_mall').wrecks!.includes(v.defId));
      assert.ok(v.condition >= 10 && v.condition <= 35);
      if (found === 1) {
        const run = startRun(state, plan, T0);
        if (run.result.foundVehicles?.length) {
          completeRun(state, run.id, run.returnAt);
          assert.equal(state.vehicles.length, 1);
          assert.ok(state.log.some((l) => /brought home a .* found at The Drowned Mall/.test(l.text)));
        }
      }
    }
    assert.ok(found > 0 && found / n < 0.08, `${found} of ${n} scouting runs`);
  });
});

describe('vehicles: the Depot', () => {
  test('the Workshop repairs a vehicle to full, for scrap and tech', () => {
    const { state, vehicles } = garage('repair', ['car'], 4, 20);
    const car = vehicles[0]!;
    assert.deepEqual(repairCost(car), { scrap: 24, tech: 3 });
    assert.equal(repairProblem(state, car.id), 'Build the Workshop first.');
    state.resources.scrap = 100;
    state.resources.tech = 10;
    build(state, 'workshop', 1);
    repairVehicle(state, car.id, 2);
    assert.equal(car.condition, 100);
    assert.match(repairProblem(state, car.id)!, /good shape/);
  });

  test('a motorcycle needs a level 2 Workshop, a car level 3, and trucks and vans are only found or bought', () => {
    const state = testGame('build');
    state.resources = { scrap: 500, rations: 10, meds: 0, ammo: 0, tech: 100, gas: 0 };
    build(state, 'workshop', 1);
    assert.equal(buildVehicleProblem(state, 'motorcycle'), 'Needs a level 2 Workshop.');
    build(state, 'workshop', 2);
    buildVehicle(state, 'motorcycle', 3);
    assert.equal(buildVehicleProblem(state, 'car'), 'Needs a level 3 Workshop.');
    assert.match(buildVehicleProblem(state, 'pickup')!, /can't build/);
    assert.equal(state.vehicles.length, 1);
    assert.equal(state.vehicles[0]!.condition, 100);
  });

  test('a thin fence is easier to break, and raiders drive off a vehicle left at home', () => {
    const state = testGame('fence');
    for (const s of state.survivors) s.stats.aim = 5;
    const full = raidDefense(state);
    state.survivors[0]!.status = 'away';
    assert.equal(raidDefense(state), full, 'three at home is still a full fence');
    state.survivors[1]!.status = 'away';
    assert.equal(raidDefense(state), full - RAID_THIN_PENALTY);
    state.survivors[2]!.status = 'away';
    assert.equal(raidDefense(state), full - 2 * RAID_THIN_PENALTY);

    let stolen = 0;
    for (let i = 0; i < 200; i++) {
      const empty = testGame(`theft-${i}`);
      for (const s of empty.survivors) s.status = 'away';
      empty.vehicles.push(createVehicle(empty, 'car', 80));
      assert.equal(raid(empty, 2, new Rng(`raid-${i}`)), true, 'nobody home: they always get in');
      if (empty.vehicles.length === 0) stolen += 1;
    }
    assert.ok(stolen > 80 && stolen < 160, `${stolen} of 200 stolen`);
  });

  test('a trader can sell a vehicle', () => {
    const state = testGame('trade');
    state.resources.scrap = 100;
    state.resources.tech = 20;
    const vehicle = createVehicle(state, 'motorcycle', 60);
    state.depot.offers.push({ id: 'o1', give: { scrap: 45, tech: 6 }, get: {}, vehicle, expiresDay: 5 });
    assert.equal(offerText(state.depot.offers[0]!), '45 scrap, 6 tech for a Motorcycle in fair shape (60%)');
    acceptOffer(state, 'o1', 2);
    assert.equal(state.vehicles.length, 1);
    assert.equal(state.resources.scrap, 55);
  });

  test('every vehicle seats at least one and most seat five', () => {
    assert.ok(VEHICLES.every((v) => v.seats >= 1 && v.speed < 1 && v.gas > 0));
    assert.ok(VEHICLES.filter((v) => v.seats === 5).length >= 2);
  });

  test('a save from before version 11 gets gas and an empty garage', () => {
    const state = openGame('v10');
    const run = startRun(state, testPlan(state), T0);
    const old = structuredClone(state) as unknown as Record<string, unknown> & GameState;
    delete (old.resources as Partial<GameState['resources']>).gas;
    delete (old as Partial<GameState>).vehicles;
    delete (old.runs[0]!.result.loot as Partial<GameState['resources']>).gas;
    old.version = 10;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.equal(loaded.resources.gas, 0);
    assert.deepEqual(loaded.vehicles, []);
    completeRun(loaded, run.id, run.returnAt);
    assert.ok(Number.isFinite(loaded.resources.gas));
  });
});
