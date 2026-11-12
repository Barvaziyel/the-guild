import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { RESCUE_DAYS, RESCUE_FIRST_GAP, RESCUE_GAP, RESCUE_WAIT_DAYS, SAVE_VERSION } from './constants.ts';
import { build, bunksCap } from './depot/buildings.ts';
import { takeIn } from './depot/recruits.ts';
import { advanceTime, dayStart } from './depot/time.ts';
import { validatePlan } from './expedition/plan.ts';
import { completeRun, startRun } from './expedition/runs.ts';
import { simulateRun } from './expedition/sim.ts';
import { dayAt } from './game.ts';
import { hasFlag, relationshipScore } from './relationships.ts';
import { RESCUE_TROUBLES, openCall, playRescueDay, startCall, troubleText } from './rescue.ts';
import { Rng } from './rng.ts';
import { deserialize } from './save.ts';
import { openGame, testGame, testPlan } from './test-utils.ts';
import type { GameState, RescueTrouble } from './types.ts';

function radio(state: GameState): void {
  state.resources.scrap += 500;
  state.resources.tech += 100;
  build(state, 'radio_tower', 1);
}

/** A guild with a call for help from the Rail Yard. */
function calling(seed: string, trouble: RescueTrouble = 'trapped'): GameState {
  const state = openGame(seed);
  radio(state);
  startCall(state, 1, new Rng(seed), 'rail_yard', trouble);
  return state;
}

function rescuePlan(state: GameState, size = 3) {
  return testPlan(state, 'rail_yard', { job: 'rescue' }, size);
}

describe('calls for help', () => {
  test('none come without a Radio Tower; the first comes a few days after building one, and lasts about three quarters of a real day', () => {
    const state = testGame('quiet');
    for (let day = 2; day <= 40; day++) assert.equal(playRescueDay(state, day, new Rng(`q${day}`)), undefined);
    assert.equal(state.rescue.call, undefined);
    radio(state);
    assert.equal(playRescueDay(state, 41, new Rng('a')), undefined, 'not on the first day');
    let call;
    for (let day = 42; day <= 41 + RESCUE_FIRST_GAP && !call; day++) call = playRescueDay(state, day, new Rng(`c${day}`));
    assert.ok(call, 'a call comes within the first few days');
    assert.equal(call.expiresDay - call.day, RESCUE_DAYS);
    assert.ok(state.log.some((l) => l.text.startsWith('A voice on the radio:') && l.text.includes(troubleText(call))));
    // Unanswered, it goes quiet, and the next comes later.
    playRescueDay(state, call.expiresDay, new Rng('x'));
    assert.equal(state.rescue.call, undefined);
    assert.ok(state.log.some((l) => /has gone quiet/.test(l.text)));
    assert.ok(state.rescue.nextDay >= call.expiresDay + RESCUE_GAP[0] && state.rescue.nextDay <= call.expiresDay + RESCUE_GAP[1]);
  });

  test('a rescue run needs a call from that place, nobody already on the way, and the outskirts', () => {
    const state = calling('plans');
    assert.deepEqual(validatePlan(state, rescuePlan(state)), []);
    assert.match(validatePlan(state, { ...rescuePlan(state), locationId: 'maple_street' }).join(' '), /Nobody is calling/);
    state.locations.rail_yard!.explored = 100;
    assert.match(validatePlan(state, { ...rescuePlan(state), depth: 2 }).join(' '), /outskirts/);
    startRun(state, rescuePlan(state, 2), dayStart(state, 2));
    assert.equal(openCall(state), undefined, 'answered');
    assert.match(validatePlan(state, rescuePlan(state, 1).crew ? { ...rescuePlan(state), crew: [state.survivors[3]!.id] } : rescuePlan(state)).join(' '), /already on the way/);
  });

  test('every kind of trouble can end with them saved, and with them not', () => {
    for (const trouble of RESCUE_TROUBLES) {
      const seen = new Set<string>();
      for (let i = 0; i < 300 && seen.size < 2; i++) {
        const state = calling(`t-${trouble}-${i}`, trouble);
        if (i % 2) state.locations.rail_yard = { discovered: true, explored: 0, runs: 0 };
        const sim = simulateRun(state, { ...rescuePlan(state, 1 + (i % 3)), meds: i % 4 === 0 ? 0 : 2 }, `s${i}`, dayStart(state, 2));
        const news = sim.result.rescue;
        assert.ok(news, 'a rescue run always says how it went');
        seen.add(news.outcome === 'saved' ? 'saved' : 'not');
        assert.ok(sim.beats.some((b) => b.kind === 'rescue') || news.outcome === 'missed', 'the rescue beat comes unless the crew turned back first');
      }
      assert.equal(seen.size, 2, `${trouble}: ${[...seen]}`);
    }
  });

  test('brought home alive, they join owing their rescuer a life; with no bed free they wait at the gate', () => {
    let joined = false;
    let waited = false;
    for (let i = 0; i < 80 && !(joined && waited); i++) {
      const state = calling(`home-${i}`);
      const full = i % 2 === 1;
      state.buildings.bunks = full ? 1 : 2; // four beds for four founders, or room for more
      const run = startRun(state, rescuePlan(state), dayStart(state, 2));
      const news = run.result.rescue!;
      if (news.outcome !== 'saved' || run.result.outcome === 'routed' || run.result.outcome === 'lost') continue;
      const person = news.person;
      completeRun(state, run.id, run.returnAt);
      const day = dayAt(state, run.returnAt);
      assert.equal(state.rescue.call, undefined, 'the call is settled');
      const by = state.survivors.find((s) => s.id === news.by)!;
      if (full) {
        assert.equal(state.survivors.length, bunksCap(state));
        const c = state.depot.recruits.find((x) => x.survivor.id === person.id)!;
        assert.ok(c, 'waiting at the gate');
        assert.equal(c.expiresDay, day + RESCUE_WAIT_DAYS);
        state.buildings.bunks = 2;
        takeIn(state, person.id, new Rng('in'), day + 1);
        waited = true;
      } else {
        joined = true;
      }
      const s = state.survivors.find((x) => x.id === person.id)!;
      assert.ok(s, 'in the guild');
      assert.match(s.chronicle[0]!.text, /^Brought out of The Rail Yard alive by /);
      assert.ok(s.chronicle.some((c) => c.text.startsWith('Owes ') && c.text.includes('a life after')));
      assert.ok(hasFlag(state, s.id, by.id, 'owesLife'));
      assert.ok(relationshipScore(state, s.id, by.id) >= 20, 'grateful');
      assert.ok(by.chronicle.some((c) => c.text === `Brought ${s.firstName} ${s.lastName} out of The Rail Yard alive.`));
    }
    assert.ok(joined && waited);
  });

  test('a call that ends badly is settled too, with a line in the news', () => {
    let done = false;
    for (let i = 0; i < 200 && !done; i++) {
      const state = calling(`bad-${i}`, 'hurt');
      const run = startRun(state, { ...rescuePlan(state, 1), meds: 0 }, dayStart(state, 2));
      if (run.result.rescue!.outcome === 'saved') continue;
      completeRun(state, run.id, run.returnAt);
      assert.equal(state.rescue.call, undefined);
      assert.ok(state.log.some((l) => /didn't make it out|never found/.test(l.text)));
      assert.ok(!state.survivors.some((s) => s.id === run.result.rescue!.person.id));
      done = true;
    }
    assert.ok(done);
  });

  test('advanceTime plays calls, and saves from before version 16 get the new fields', () => {
    const state = openGame('time');
    radio(state);
    advanceTime(state, dayStart(state, 40));
    assert.ok(state.log.some((l) => l.text.startsWith('A voice on the radio:')));
    const old = JSON.parse(JSON.stringify(testGame('old'))) as Record<string, unknown>;
    old.version = 15;
    delete old.rescue;
    delete old.animals;
    delete old.departed;
    delete (old.depot as Record<string, unknown>).strays;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.deepEqual(loaded.animals, []);
    assert.deepEqual(loaded.departed, []);
    assert.deepEqual(loaded.depot.strays, []);
    assert.equal(loaded.rescue.nextDay, loaded.depot.lastDay + RESCUE_FIRST_GAP);
  });
});
