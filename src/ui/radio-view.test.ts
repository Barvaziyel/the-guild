import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, answerRadio, completeRun, startRun, type GameState, type Run } from '../engine/index.ts';
import { T0, openGame, testPlan } from '../engine/test-utils.ts';
import { anyoneCalling, noticeRoute, radioCard, radioCards, radioNoticeKey, radioNoticeRun, radioNotices, radioReportLine, radioWakeTimes, titleInLine } from './radio-view.ts';

/** A guild with a Radio Tower and a crew out that will call home. */
function calling(seed: string): { state: GameState; run: Run } {
  for (let i = 0; i < 2000; i++) {
    const state = openGame(`${seed}-${i % 5}`);
    state.buildings.radio_tower = 1;
    state.rng = new Rng(`${seed}-${i}`).getState();
    const run = startRun(state, testPlan(state, ['kessler_farm', 'old_metro', 'st_judes', 'drowned_mall'][i % 4]!, { job: 'scout' }), T0);
    if (run.radio) return { state, run };
  }
  throw new Error('no crew called home');
}

describe('a crew on the radio', () => {
  test('a card while they wait: who, what they found, what they ask, the orders, and how long they wait', () => {
    const { state, run } = calling('card');
    const call = run.radio!;
    assert.equal(radioCard(state, run, call.at - 1), undefined, 'not before they call');
    assert.equal(anyoneCalling(state, call.at - 1), false);
    const card = radioCard(state, run, call.at + 6 * 60_000)!;
    assert.equal(card.title, call.title);
    assert.equal(card.ask, call.ask);
    assert.deepEqual(card.orders, call.orders);
    assert.equal(card.caller?.id, call.by);
    assert.match(card.wait, /will wait 24 more minutes for an answer\. After that, \w+ decides by the crew's orders\./);
    assert.equal(radioCards(state, call.at + 60_000).length, 1);
    assert.equal(anyoneCalling(state, call.at + 60_000), true);
    assert.equal(radioCard(state, run, call.until), undefined, 'gone once they decide');
  });

  test('the app wakes when they call and when the wait runs out; a notice is planned for the call', () => {
    const { state, run } = calling('wake');
    const call = run.radio!;
    assert.deepEqual(radioWakeTimes(state, T0), [call.at, call.until]);
    assert.deepEqual(radioWakeTimes(state, call.at + 1), [call.until]);
    const [notice] = radioNotices(state);
    assert.equal(notice!.id, `radio-${run.id}`);
    assert.equal(notice!.at, call.at);
    assert.match(notice!.title, /^\w+ is on the radio$/);
    assert.match(notice!.body, /will wait 30 min for your answer\.$/);
    assert.equal(radioNoticeRun(notice!.id), run.id);
    assert.equal(radioNoticeRun(run.id), undefined);
    const key = radioNoticeKey(state);
    answerRadio(state, run.id, call.orders[0]!.id, call.at + 1000);
    assert.notEqual(radioNoticeKey(state), key);
    assert.deepEqual(radioNotices(state), []);
    assert.deepEqual(radioWakeTimes(state, T0), []);
  });

  test('the report says what was asked, and the answer or that nobody gave one', () => {
    const answered = calling('report-a');
    const call = answered.run.radio!;
    const order = call.orders[1]!;
    answerRadio(answered.state, answered.run.id, order.id, call.at + 1000);
    const report = completeRun(answered.state, answered.run.id, answered.run.returnAt);
    assert.equal(radioReportLine(report), `${answered.run.result.crew.find((s) => s.id === call.by)!.firstName} called home about ${titleInLine(call.title)}. The guild said: ${titleInLine(order.label)}.`);

    const ignored = calling('report-n');
    const report2 = completeRun(ignored.state, ignored.run.id, ignored.run.returnAt);
    assert.match(radioReportLine(report2)!, /Nobody answered in time, so \w+ made the call\.$/);
  });

  test('a tapped notice opens what it is about', () => {
    assert.deepEqual(noticeRoute('r12'), { screen: 'run', id: 'r12' });
    assert.deepEqual(noticeRoute('radio-r12'), { screen: 'run', id: 'r12' });
    for (const id of ['dilemma-40', 'dilemma-due-40', 'rescue-41', 'rescue-due-41', 'baby-s3-120', 'grown-c2']) assert.deepEqual(noticeRoute(id), { screen: 'depot' }, id);
  });

  test('titles read right inside a sentence', () => {
    assert.equal(titleInLine('A sealed door'), 'a sealed door');
    assert.equal(titleInLine('The Vultures'), 'the Vultures');
  });
});
