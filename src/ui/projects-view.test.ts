import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { build, joinProject, startStage, type GameState } from '../engine/index.ts';
import { testGame } from '../engine/test-utils.ts';
import { crewCandidates, etaText, postLink, postValue, projectChoices, projectNote, projectRow, projectRows } from './projects-view.ts';

function rich(state: GameState): GameState {
  state.resources = { scrap: 9000, rations: 9000, meds: 9000, ammo: 9000, tech: 9000, gas: 0 };
  return state;
}

describe('the Projects tab', () => {
  test('lists every project; locked ones say what they need, open ones what the first stage costs', () => {
    const state = rich(testGame('rows'));
    const rows = projectRows(state);
    assert.equal(rows.length, 5);
    const wall = projectRow(state, 'the_wall');
    assert.equal(wall.state, 'locked');
    assert.equal(wall.needs, 'Needs a level 3 Watchtower.');
    assert.equal(wall.status, 'Not yet');
    build(state, 'workshop', 1);
    build(state, 'workshop', 1);
    const line = projectRow(state, 'the_line');
    assert.equal(line.state, 'ready');
    assert.equal(line.status, 'Not started');
    assert.deepEqual(line.next, { label: 'Start', cost: '700 scrap, 100 tech, 50 rations' });
    assert.equal(line.crewRoom, 0, 'no crew before it starts');
  });

  test('a stage under way shows its progress, its crew, and how long at this pace', () => {
    const state = rich(testGame('working'));
    build(state, 'workshop', 1);
    build(state, 'workshop', 1);
    startStage(state, 'the_line', 2);
    let r = projectRow(state, 'the_line');
    assert.equal(r.state, 'working');
    assert.equal(r.status, 'Stage 1 of 3: 0% done');
    assert.equal(r.eta, 'Nobody is working on it. Put a crew on it.');
    assert.equal(r.next, undefined);
    joinProject(state, state.survivors[0]!.id, 'the_line');
    r = projectRow(state, 'the_line');
    assert.equal(r.crew.length, 1);
    assert.equal(r.crewRoom, 2);
    assert.match(r.crew[0]!.line, /^Brawn \d+$/);
    assert.match(r.eta ?? '', /^About \d+ real days? left at this pace\.$/);
    assert.equal(projectNote(state), 'The Line: stage 1 of 3: 0% done.');
    state.projects.the_line = { done: 1, startedDay: 2 };
    r = projectRow(state, 'the_line');
    assert.equal(r.state, 'waiting');
    assert.equal(r.status, "1 of 3 stages done. The next one isn't paid for.");
    assert.equal(r.next?.label, 'Start stage 2');
    state.projects.the_line = { done: 3, startedDay: 2, finishedDay: 40 };
    r = projectRow(state, 'the_line');
    assert.equal(r.state, 'done');
    assert.equal(r.status, 'Finished on day 40');
    assert.equal(r.progress, 1);
  });

  test('the crew picker offers everyone not on it, best at the work first, and the sheet can join and link', () => {
    const state = rich(testGame('pick'));
    build(state, 'workshop', 1);
    build(state, 'workshop', 1);
    assert.deepEqual(projectChoices(state, state.survivors[0]!), [], 'nothing to join before it starts');
    startStage(state, 'the_line', 2);
    const s = state.survivors[0]!;
    assert.deepEqual(projectChoices(state, s), [{ id: 'the_line', name: 'The Line' }]);
    joinProject(state, s.id, 'the_line');
    assert.equal(postValue(s), 'project:the_line');
    assert.deepEqual(postLink(state, s), { label: 'Go to the Line', to: { screen: 'depot', tab: 'projects' } });
    const options = crewCandidates(state, 'the_line');
    assert.ok(options.every((o) => o.survivor.id !== s.id));
    assert.ok(options.every((o) => /^Brawn \d+$/.test(o.stat)));
    const other = state.survivors.find((x) => x.post && 'building' in x.post)!;
    assert.equal(postValue(other), (other.post as { building: string }).building);
    assert.equal(postLink(state, other)?.to.screen, 'building');
  });

  test('how long is left, in real days', () => {
    assert.equal(etaText(150, 7.5), 'About 3 real days left at this pace.');
    assert.equal(etaText(20, 7.5), 'Done within half a day at this pace.');
    assert.equal(etaText(70, 7.5), 'About 1 real day left at this pace.');
  });
});
