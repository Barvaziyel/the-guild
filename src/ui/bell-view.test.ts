import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, startRun } from '../engine/index.ts';
import { scheduleRaid, stepRaid } from '../engine/depot/raids.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import { NEAR_BREAKING, bellGroups, bellItems } from './bell-view.ts';

describe('the bell', () => {
  test('a quiet guild: nothing needs you', () => {
    const state = testGame('quiet');
    assert.deepEqual(bellItems(state, T0), []);
    assert.deepEqual(bellGroups([]), []);
  });

  test('raiders at the gate wait on you, and open the raid', () => {
    const state = testGame('bell-raid');
    const raid = scheduleRaid(state, 1, new Rng('r'), 'raiders')!;
    raid.by = 'raiders';
    stepRaid(state, raid.arrive);
    const item = bellItems(state, raid.arrive + 1000).find((i) => i.id === 'raid')!;
    assert.equal(item.group, 'waiting');
    assert.equal(item.text, 'Raiders at the gate: waiting for your orders.');
    assert.deepEqual(item.to, { screen: 'raid' });
  });

  test('people at the gate, crews back, and warnings, each in their group', () => {
    const state = openGame('bell-mix');
    state.depot.recruits.push(structuredClone(state.depot.recruits[0] ?? { survivor: state.survivors[0]!, expiresDay: 9 }) as never);
    const run = startRun(state, testPlan(state, 'rail_yard', {}, 1), T0);
    state.reports.push({ id: 'rep1', plan: run.plan, departAt: T0, returnAt: T0 + 1, beats: [], summary: {} as never, crewNames: { [run.plan.crew[0]!]: 'Ash Moreno' }, read: false } as never);
    const tense = state.survivors[1]!;
    tense.stress = NEAR_BREAKING + 3;
    const items = bellItems(state, T0 + 1000);
    const by = (g: string) => items.filter((i) => i.group === g).map((i) => i.text);
    assert.ok(by('gate').some((t) => /at the gate want(s)? to join\.$/.test(t)));
    assert.deepEqual(by('back'), ['Ash, back from The Rail Yard.']);
    assert.ok(by('warning').includes(`${tense.firstName} is near breaking (stress ${NEAR_BREAKING + 3}).`));
    assert.deepEqual(
      bellGroups(items).map((g) => g.title),
      ['At the gate', 'Crews back', 'Warnings'],
    );
  });

  test('nobody home is a warning', () => {
    const state = testGame('bell-empty');
    for (const s of state.survivors) s.status = 'away';
    assert.ok(bellItems(state, T0).some((i) => i.id === 'empty'));
  });
});
