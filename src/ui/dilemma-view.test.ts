import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DILEMMA_DAYS, Rng, dayStart, decideDilemma, getDilemma, startDilemma } from '../engine/index.ts';
import { testGame } from '../engine/test-utils.ts';
import { dilemmaCard, dilemmaDeadline, dilemmaNotices } from './dilemma-view.ts';

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
    assert.match(due[0]!.body, /^A good coat: unless you choose/);
    decideDilemma(state, 0, dayStart(state, 3) + 1000);
    assert.equal(dilemmaNotices(state)[0]!.id, `dilemma-${state.dilemmas.nextDay}`);
  });
});
