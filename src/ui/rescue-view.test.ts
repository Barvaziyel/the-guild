import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { build, dayStart, Rng, startCall, startRun, type GameState } from '../engine/index.ts';
import { openGame, testPlan } from '../engine/test-utils.ts';
import { callCard, jobChoices, rescueLine, rescueNotices, withRescue } from './rescue-view.ts';
import { defaultPlan, JOBS } from './runs-view.ts';

function calling(seed: string): GameState {
  const state = openGame(seed);
  state.resources.scrap += 500;
  state.resources.tech += 100;
  build(state, 'radio_tower', 1);
  startCall(state, 4, new Rng(seed), 'rail_yard', 'cornered');
  return state;
}

describe('calls for help on screen', () => {
  test('the card says who, where and until when; once a crew goes, who went', () => {
    const state = calling('card');
    const call = state.rescue.call!;
    const card = callCard(state, dayStart(state, 4))!;
    assert.equal(card.text, `${call.person.firstName} ${call.person.lastName} is cornered at The Rail Yard, with something prowling outside.`);
    assert.match(card.when, /^Go before .+, or the voice will go quiet\.$/);
    const run = startRun(state, testPlan(state, 'rail_yard', { job: 'rescue' }, 2), dayStart(state, 4) + 1000);
    const going = callCard(state, dayStart(state, 4))!;
    assert.equal(going.runId, run.id);
    assert.match(going.when, / are on the way\.$/);
    assert.equal(callCard(openGame('none'), 0), undefined);
  });

  test('the planner offers Rescue first, and starts there, only at the place calling', () => {
    const state = calling('jobs');
    const here = jobChoices(state, 'rail_yard', JOBS);
    assert.deepEqual(here.map((j) => j.id), ['rescue', 'scavenge', 'scout', 'hunt']);
    assert.match(here[0]!.description, /^Get \w+ out: cornered, with something prowling outside\. /);
    assert.deepEqual(jobChoices(state, 'maple_street', JOBS).map((j) => j.id), ['scavenge', 'scout', 'hunt']);
    assert.equal(withRescue(state, defaultPlan(state, 'rail_yard')).job, 'rescue');
    assert.equal(withRescue(state, defaultPlan(state, 'maple_street')).job, 'scavenge');
  });

  test('the report says how it went', () => {
    const person = calling('report').rescue.call!.person;
    const summary = (outcome: 'saved' | 'lost' | 'missed') => ({ rescue: { person, outcome } }) as unknown as Parameters<typeof rescueLine>[0];
    const name = `${person.firstName} ${person.lastName}`;
    assert.equal(rescueLine(summary('saved')), `Brought ${name} home alive.`);
    assert.equal(rescueLine(summary('lost')), `Couldn't save ${name}.`);
    assert.equal(rescueLine(summary('missed')), `Never found ${name}.`);
  });

  test('a notice when the next call is due, and a reminder before one goes quiet', () => {
    assert.deepEqual(rescueNotices(openGame('no-radio')), [], 'no radio, no calls');
    const state = calling('notices');
    const call = state.rescue.call!;
    const [reminder] = rescueNotices(state);
    assert.equal(reminder!.at, dayStart(state, call.expiresDay) - 2 * 3_600_000);
    assert.match(reminder!.body, /won't last much longer/);
    delete state.rescue.call;
    state.rescue.nextDay = 30;
    assert.deepEqual(rescueNotices(state).map((n) => n.at), [dayStart(state, 30)]);
  });
});
