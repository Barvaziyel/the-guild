/**
 * People's time (1.7.1, §6): every run costs stress for the road itself, so
 * stress is each person's labor budget and the Firepit and Bar set how much
 * a guild can do. Also: runs at danger 2 or more count toward Veteran.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HUNGER_STRESS_CAP, ROAD_STRESS, SAVE_VERSION } from '../constants.ts';
import { firepitRelief } from '../depot/day.ts';
import { assignPost, build, postBuilding } from '../depot/buildings.ts';
import { Rng } from '../rng.ts';
import { deserialize } from '../save.ts';
import { hungerStress } from '../stats.ts';
import { openGame, testGame, testPlan } from '../test-utils.ts';
import type { GameState } from '../types.ts';
import { simulateRun } from './sim.ts';

/** Mean stress a crew member comes home with, starting calm, over `runs` runs. */
function meanStress(location: string, runs: number): number {
  let total = 0;
  let people = 0;
  for (let i = 0; i < runs; i++) {
    const state = openGame(`road-${location}-${i}`);
    for (const s of state.survivors) s.stress = 0;
    const { result } = simulateRun(state, testPlan(state, location), `r${i}`, 0);
    for (const s of result.crew) {
      if (s.status === 'dead') continue;
      total += s.stress;
      people++;
    }
  }
  return total / people;
}

describe('the road costs stress', () => {
  test('even the safest run costs a little, and far, dangerous ones cost a lot', () => {
    const railYard = meanStress('rail_yard', 150);
    const glow = meanStress('the_glow', 150);
    // Nerve takes some off every gain, so the floor is a little under ROAD_STRESS.
    assert.ok(railYard >= ROAD_STRESS - 2, `the Rail Yard: ${railYard.toFixed(1)}`);
    assert.ok(railYard <= 15, `the Rail Yard: ${railYard.toFixed(1)}`);
    assert.ok(glow >= railYard + 20, `the Glow ${glow.toFixed(1)} against the Rail Yard ${railYard.toFixed(1)}`);
  });

  test('relief at the Depot is about 50 a real day at level 1 and about 80 with the Bar and Stage', () => {
    const state = testGame('relief');
    const realDay = (s: GameState): number => (2 + firepitRelief(s)) * 8;
    const one = realDay(state);
    assert.ok(one >= 40 && one <= 60, `level 1: ${one}`);
    state.resources = { scrap: 999, rations: 999, meds: 999, ammo: 999, tech: 999, gas: 0 };
    build(state, 'firepit', 1);
    build(state, 'firepit', 1);
    for (const s of state.survivors) {
      const keepers = state.survivors.filter((x) => postBuilding(x.post) === 'firepit').length;
      if (keepers < 3 && postBuilding(s.post) !== 'firepit') assignPost(state, s.id, { building: 'firepit' });
    }
    const three = realDay(state);
    assert.ok(three >= 65 && three <= 95, `Bar and Stage: ${three}`);
  });
});

describe('Veteran counts the runs past the easy places', () => {
  test('a danger 1 run counts as a run, not a hard one; danger 2 counts as both', () => {
    const state = openGame('hard-runs');
    const easy = simulateRun(state, testPlan(state, 'rail_yard'), 'easy', 0).result.crew[0]!;
    assert.equal(easy.counters.runs, 1);
    assert.equal(easy.counters.hardRuns, 0);
    const hard = simulateRun(state, testPlan(state, 'kessler_farm'), 'hard', 0).result.crew.find((s) => s.status !== 'dead')!;
    assert.equal(hard.counters.runs, 1);
    assert.equal(hard.counters.hardRuns, 1);
  });

  test('a save from before version 14 starts the count from the runs people have', () => {
    const state = testGame('v13');
    const s = state.survivors[0]!;
    s.counters.runs = 17;
    const old = structuredClone(state) as unknown as GameState & { version: number };
    for (const x of old.survivors) delete (x.counters as Partial<typeof x.counters>).hardRuns;
    old.version = 13;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.equal(loaded.survivors[0]!.counters.hardRuns, 17);
    assert.equal(loaded.survivors[1]!.counters.hardRuns, loaded.survivors[1]!.counters.runs);
  });
});

describe('hunger is bounded', () => {
  test('hunger alone never pushes anyone past 70', () => {
    const state = testGame('hunger');
    const s = state.survivors[0]!;
    s.stress = 50;
    const rng = new Rng('hunger');
    for (let day = 1; day <= 40; day++) hungerStress(s, rng, day);
    assert.equal(s.stress, HUNGER_STRESS_CAP);
    s.stress = 90;
    hungerStress(s, rng, 41);
    assert.equal(s.stress, 90, 'already past it: hunger adds nothing');
  });
});
