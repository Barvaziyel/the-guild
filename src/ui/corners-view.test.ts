import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CORNERS, Rng, finishSearch, getCorner, startSearch } from '../engine/index.ts';
import { T0, testGame } from '../engine/test-utils.ts';
import { bellItems } from './bell-view.ts';
import { noticeRoute } from './radio-view.ts';
import { cornerNotices, cornerRows, cornerWakeTimes, cornersSummary, resultCard, searchLine, searchedLine, searcherChoices } from './corners-view.ts';

const MIN = 60_000;

describe('the Depot’s corners on the Yard tab (2.7.0)', () => {
  test('the list: what’s open first, then what’s locked and why; how long each takes and what helps', () => {
    const state = testGame('rows');
    const rows = cornerRows(state);
    assert.equal(rows.length, CORNERS.length);
    const firstLocked = rows.findIndex((r) => r.status === 'locked');
    assert.ok(rows.slice(0, firstLocked).every((r) => r.status === 'open'));
    assert.equal(rows.find((r) => r.id === 'signal_box')!.meta, '10 min · Wits helps');
    assert.match(rows.find((r) => r.id === 'cellar')!.locked!, /ticket office/);
    assert.equal(cornersSummary(state), `0 of ${CORNERS.length} searched`);
    assert.equal(searchedLine(state), undefined);
  });

  test('who could go, best at it first', () => {
    const state = testGame('who');
    const choices = searcherChoices(state, 'freight_car');
    assert.equal(choices.length, state.survivors.length);
    const brawn = choices.map((c) => Number(/Brawn (\d+)\)$/.exec(c.label)![1]));
    assert.deepEqual(brawn, [...brawn].sort((a, b) => b - a));
  });

  test('the search under way: a line, a notice when it’s done, and the app wakes for it', () => {
    const state = testGame('under');
    const a = state.survivors[0]!;
    startSearch(state, 'water_tower', a.id, T0);
    assert.equal(searchLine(state, T0 + 3 * MIN), `${a.firstName} is searching the water tower. Done in 7 min.`);
    assert.equal(cornerRows(state)[0]!.status, 'searching');
    assert.deepEqual(cornerWakeTimes(state), [T0 + 10 * MIN]);
    const [n] = cornerNotices(state);
    assert.equal(n!.at, T0 + 10 * MIN);
    assert.equal(n!.title, `${a.firstName} is done searching`);
    // Tapping it opens the Yard, where the corners are (it opened "Run not found" in 2.7.0).
    assert.deepEqual(noticeRoute(n!.id), { screen: 'depot' });
  });

  test('what it found, until read: the story, the stores, the gear; and a line in the bell', () => {
    const state = testGame('found');
    const a = state.survivors[0]!;
    a.stats.wits = 10;
    state.corners.searched.push('signal_box');
    state.rng = new Rng('shed').getState();
    startSearch(state, 'engine_shed', a.id, T0);
    finishSearch(state, T0 + getCorner('engine_shed').minutes * MIN);
    const card = resultCard(state)!;
    assert.equal(card.title, 'The engine shed');
    assert.equal(card.who, `${a.firstName} searched it.`);
    assert.equal(card.supplies, 'Scrap +8.');
    assert.equal(card.gear, 'In the stash: Multitool.');
    assert.equal(searchedLine(state), 'Searched: the signal box, the engine shed.');
    const bell = bellItems(state, T0 + 30 * MIN).find((b) => b.id === 'corner')!;
    assert.equal(bell.text, `The engine shed: ${a.firstName} is done searching.`);
    assert.deepEqual(bell.to, { screen: 'depot' });
    state.corners.last!.seen = true;
    assert.equal(resultCard(state), undefined);
  });

  test('once every corner is searched, the list goes', () => {
    const state = testGame('all');
    state.corners.searched = CORNERS.map((c) => c.id);
    assert.equal(cornersSummary(state), undefined);
  });
});
