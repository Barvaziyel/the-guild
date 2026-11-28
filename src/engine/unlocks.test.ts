import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIRST_TRIP_MIN } from './constants.ts';
import { FIRST_WEEK, FIRST_WEEK_BEFORE } from './content/index.ts';
import { rollDepotEvents } from './depot/events.ts';
import { playDilemmaDay } from './dilemmas.ts';
import { footDuration } from './expedition/plan.ts';
import { completeRun, startRun } from './expedition/runs.ts';
import { simulateRun } from './expedition/sim.ts';
import { newGame } from './game.ts';
import { playRescueDay } from './rescue.ts';
import { Rng } from './rng.ts';
import { deserialize, serialize } from './save.ts';
import { claimStory, storyStep } from './story.ts';
import { T0, testGame, testPlan } from './test-utils.ts';
import { SYSTEM_IDS, type GameState } from './types.ts';
import { isFirstTrip, isOpen, openSystem, planAsOpened, seenIntro } from './unlocks.ts';
import { createVehicle } from './vehicles.ts';

function guided(seed: string): GameState {
  return newGame({ seed, now: T0, guided: true });
}

describe('systems the story opens (3.14.0)', () => {
  test('a player’s new guild starts with them closed, the market off the map and the opening to watch; anything else has them all', () => {
    const state = guided('new');
    for (const id of SYSTEM_IDS) assert.equal(isOpen(state, id), false, id);
    assert.equal(state.intro, true);
    assert.equal(state.locations.drive_in!.discovered, false);
    assert.equal(state.locations.rail_yard!.discovered, true);
    seenIntro(state);
    assert.equal(state.intro, undefined);
    const old = testGame('old');
    for (const id of SYSTEM_IDS) assert.equal(isOpen(old, id), true, id);
    assert.equal(old.intro, undefined);
    assert.equal(openSystem(old, 'market', 1), false);
  });

  test('closed, no decisions come, no raiders, no calls for help', () => {
    const state = guided('quiet');
    const rng = new Rng('quiet');
    for (let day = 1; day <= 60; day++) {
      assert.equal(playDilemmaDay(state, day, rng), undefined);
      assert.ok(!rollDepotEvents(state, day, rng).includes('raid'));
      assert.equal(playRescueDay(state, day, rng), undefined);
    }
    assert.equal(state.dilemmas.active, undefined);
    assert.equal(state.rescue.call, undefined);
  });

  test('each step of the first week opens what it says, and the market puts the Drive-In on the map', () => {
    const state = guided('steps');
    const opened: string[] = [];
    for (const step of FIRST_WEEK) {
      assert.equal(storyStep(state)!.id, step.id);
      // Meet whatever the step asks for.
      if (step.goal.kind === 'kitted') state.stash = [];
      if (step.goal.kind === 'building') state.buildings[step.goal.building] = step.goal.level;
      if (step.goal.kind === 'runs') {
        const at = step.goal.at ?? 'rail_yard';
        state.locations[at]!.runs += step.goal.count;
      }
      if (step.goal.kind === 'corners') state.corners.searched.push('a', 'b', 'c');
      const ending = claimStory(state, T0 + 1000);
      assert.deepEqual(ending.opened ?? [], step.opens ?? [], step.id);
      opened.push(...(ending.opened ?? []));
      for (const id of step.opens ?? []) assert.equal(isOpen(state, id), true, `${step.id}: ${id}`);
    }
    assert.deepEqual([...opened].sort(), [...SYSTEM_IDS].sort());
    assert.equal(state.locations.drive_in!.discovered, true);
  });

  test('a vehicle the guild has opens vehicles, however it came', () => {
    const state = guided('ride');
    state.vehicles.push(createVehicle(state, 'motorcycle', 60));
    assert.equal(isOpen(state, 'vehicles'), true);
  });
});

describe('the first trip (3.14.0)', () => {
  test('the first run somewhere quiet is short, led, and starts with two hounds that call home', () => {
    const state = guided('first');
    const plan = testPlan(state, 'rail_yard', { approach: 'balanced' }, 3);
    assert.equal(isFirstTrip(state, plan), true);
    const asked = planAsOpened(state, plan);
    assert.equal(asked.first, true);
    assert.equal(asked.lead, 'matters');
    assert.equal(footDuration(state, asked), FIRST_TRIP_MIN * 60_000);
    const run = startRun(state, plan, T0);
    assert.equal(run.plan.first, true);
    assert.equal(isOpen(state, 'lead'), true);
    assert.equal(run.beats[0]?.title === 'Hounds' || run.beats[1]?.title === 'Hounds', true, run.beats.map((b) => b.title).join(' / '));
    assert.ok(run.lead && run.lead.fights.length === 1, 'the hounds wait for the player');
    // Once it's gone, the next run is an ordinary one.
    assert.equal(isFirstTrip(state, testPlan(state, 'rail_yard', {}, 2)), false);
  });

  test('nobody dies on it, however it goes', () => {
    for (let i = 0; i < 200; i++) {
      const state = guided(`safe-${i}`);
      const plan = planAsOpened(state, testPlan(state, i % 2 ? 'rail_yard' : 'maple_street', { approach: 'aggressive' }, 1 + (i % 3)));
      assert.equal(plan.first, true);
      const sim = simulateRun(state, plan, `safe-${i}`, T0);
      assert.deepEqual(sim.result.deaths, [], `seed ${i}`);
    }
  });

  test('not somewhere dangerous, not a scout, and not led before leading is open', () => {
    const state = guided('not-first');
    assert.equal(isFirstTrip(state, testPlan(state, 'kessler_farm')), false);
    assert.equal(isFirstTrip(state, testPlan(state, 'rail_yard', { job: 'scout' })), false);
    const plan = planAsOpened(state, testPlan(state, 'kessler_farm', { lead: 'matters' }));
    assert.equal(plan.first, undefined);
    assert.equal(plan.lead, undefined);
    const run = startRun(state, testPlan(state, 'kessler_farm', { lead: true }), T0);
    assert.equal(run.lead, undefined);
    completeRun(state, run.id, run.returnAt);
  });
});

describe('older saves part way through the first week (3.14.0)', () => {
  function oldAt(step: number): GameState {
    const state = testGame(`old-${step}`);
    const old = structuredClone(state) as unknown as { version: number; story: { step: number } };
    old.version = 31;
    old.story.step = step;
    return deserialize(JSON.stringify(old));
  }

  test('each keeps its place: the next step it hasn’t done, passing over any it has', () => {
    for (let k = 0; k < FIRST_WEEK_BEFORE.length; k++) {
      const state = oldAt(k);
      const done = new Set<string>(FIRST_WEEK_BEFORE.slice(0, k));
      const now = storyStep(state)!;
      assert.equal(done.has(now.id), false, `old step ${k}: ${now.id}`);
      assert.equal(now.id, FIRST_WEEK.find((s) => !done.has(s.id))!.id);
      for (const id of SYSTEM_IDS) assert.equal(isOpen(state, id), true);
    }
    // The Garden was done before the first run: after it, straight on to the corners.
    const state = oldAt(2);
    assert.deepEqual(state.story!.skip, ['garden']);
    state.locations.rail_yard!.runs += 1;
    claimStory(state, T0);
    assert.equal(storyStep(state)!.id, 'corners');
  });

  test('it saves and loads', () => {
    const state = guided('saves');
    openSystem(state, 'market', 3);
    const back = deserialize(serialize(state));
    assert.deepEqual(back.opened, { market: 3 });
    assert.equal(back.intro, true);
  });
});
