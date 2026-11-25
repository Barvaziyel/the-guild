import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DILEMMA_DAYS, Rng, advanceTime, dayAt, dayStart, decideDilemma, getDilemma, playVulturesDay, startDilemma, startRun } from '../engine/index.ts';
import { openGame, testGame, testPlan } from '../engine/test-utils.ts';
import { decisionDay, dilemmaCard, dilemmaDeadline, dilemmaNotices, suppliesLine } from './dilemma-view.ts';
import { clockTime } from './time.ts';

describe('decisions on screen', () => {
  test('the card fills in the people, the four answers and when it has to be decided', () => {
    const state = testGame('card');
    assert.equal(dilemmaCard(state, Date.now()), undefined);
    const d = startDilemma(state, 3, new Rng('c'), 'good_coat')!;
    const now = dayStart(state, 3) + 60_000;
    const card = dilemmaCard(state, now)!;
    const [a, b] = [state.survivors.find((s) => s.id === d.cast.a)!, state.survivors.find((s) => s.id === d.cast.b)!];
    assert.equal(card.title, 'A good coat');
    assert.ok(card.text.startsWith(`${a.firstName} and ${b.firstName} both swear`));
    assert.deepEqual(card.choices, [`Give it to ${a.firstName}.`, `Give it to ${b.firstName}.`, 'Cut it in two.', 'Sell it and be done with it.']);
    assert.deepEqual(card.people.map((s) => s.id), [a.id, b.id]);
    assert.equal(dilemmaDeadline(state), dayStart(state, 3 + DILEMMA_DAYS));
    assert.match(card.deadline, /^Decide by (tomorrow, )?.+\.$/);
    assert.equal(card.otherwise, `After that, ${a.firstName} and ${b.firstName} will settle it themselves.`);
  });

  test('a stranger shows with the one who found them', () => {
    const state = testGame('stranger');
    const d = startDilemma(state, 3, new Rng('s'), 'stranger_at_gate')!;
    const card = dilemmaCard(state, dayStart(state, 3))!;
    assert.equal(card.people.length, 2);
    assert.equal(card.people[1]!.id, d.stranger!.id);
    assert.equal(card.otherwise, `After that, ${card.people[0]!.firstName} will settle it alone.`);
    assert.ok(card.choices[0]!.startsWith('Let '));
    assert.equal(getDilemma(d.defId).choices.length, 4);
  });

  test('notices: when the next one is due, and a reminder before one is settled without you', () => {
    const state = testGame('notices');
    const next = dilemmaNotices(state);
    assert.equal(next.length, 1);
    assert.equal(next[0]!.at, dayStart(state, state.dilemmas.nextDay));
    assert.equal(next[0]!.title, 'Something needs deciding');
    const d = startDilemma(state, 3, new Rng('n'), 'good_coat')!;
    const due = dilemmaNotices(state);
    assert.equal(due[0]!.id, `dilemma-due-${d.day}`);
    assert.ok(due[0]!.at < dayStart(state, d.deadlineDay));
    assert.equal(due[0]!.until, dayStart(state, d.deadlineDay));
    assert.equal(due[0]!.body, `A good coat: choose by ${clockTime(dayStart(state, d.deadlineDay))}, or they'll settle it themselves.`);
    decideDilemma(state, 0, dayStart(state, 3) + 1000);
    assert.equal(dilemmaNotices(state)[0]!.id, `dilemma-${state.dilemmas.nextDay}`);
  });
});

describe('what an answer put in the stores (2.5.1)', () => {
  test('a line of what changed, gains and losses, or nothing', () => {
    assert.equal(suppliesLine(undefined), undefined);
    assert.equal(suppliesLine({}), undefined);
    assert.equal(suppliesLine({ ammo: 6 }), 'Ammo +6.');
    assert.equal(suppliesLine({ tech: 2, rations: -6 }), 'Rations −6, Tech +2.');
  });

  test('with everyone out, the notice waits for the day someone is home, which is when the decision comes', () => {
    const state = testGame('all-out');
    const from = state.dilemmas.nextDay;
    const t = dayStart(state, from) - 60_000;
    advanceTime(state, t);
    const run = startRun(state, testPlan(state, 'kessler_farm', {}, state.survivors.length), t);
    assert.ok(run.returnAt > dayStart(state, from), 'still out when the decision is due');
    const day = decisionDay(state, from)!;
    assert.equal(day, dayAt(state, run.returnAt - 1) + 1, 'the first day that begins with them back');
    assert.deepEqual(dilemmaNotices(state).map((n) => [n.id, n.at]), [[`dilemma-${day}`, dayStart(state, day)]]);
    // The game agrees: nothing on the day it was due, then a decision the day they're home.
    const active = (): number | undefined => state.dilemmas.active?.day;
    advanceTime(state, dayStart(state, day) - 1);
    assert.equal(active(), undefined);
    advanceTime(state, dayStart(state, day) + 1);
    assert.equal(active(), day);
  });

  test('nobody at the Depot for days to come: no notice', () => {
    const state = testGame('outposts');
    for (const s of state.survivors) s.outpost = 'maple_street';
    assert.deepEqual(dilemmaNotices(state), []);
  });

  test('an envoy from the Vultures gets a notice too, on its own day', () => {
    const state = openGame('envoy');
    state.vultures.arriveDay = 1;
    playVulturesDay(state, 1, new Rng('a-envoy'));
    state.dilemmas.nextDay = 20;
    state.vultures.nextEnvoyDay = 12;
    assert.equal(dilemmaNotices(state)[0]!.id, 'dilemma-12');
    state.vultures.nextEnvoyDay = 30;
    assert.equal(dilemmaNotices(state)[0]!.id, 'dilemma-20');
  });
});
