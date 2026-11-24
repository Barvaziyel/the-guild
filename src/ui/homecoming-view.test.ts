import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { completeRun, startRun, type RunReport } from '../engine/index.ts';
import { openGame, testPlan } from '../engine/test-utils.ts';
import { HOME_BACK_AT, HOME_STEP, flights, homecoming, storesBefore } from './homecoming-view.ts';

const name = (i: { defId: string }): string => i.defId;

function report(over: Partial<RunReport> = {}, summary: Partial<RunReport['summary']> = {}): RunReport {
  return {
    id: 'r1',
    plan: { locationId: 'rail_yard', crew: ['a'], job: 'scavenge', meds: 2, ammo: 10, approach: 'balanced', retreat: 'downed' },
    departAt: 0,
    returnAt: 1,
    beats: [],
    crewNames: { a: 'A' },
    read: false,
    packed: { rations: 3, gas: 2 },
    summary: {
      outcome: 'completed',
      loot: { scrap: 12, rations: 0, meds: 0, ammo: 0, tech: 1, gas: 0 },
      items: [{ uid: 'i9', defId: 'pipe', quality: 'common' }],
      leftBehind: 0,
      medsLeft: 1,
      ammoLeft: 4,
      exploredGain: 5,
      discovered: [],
      deaths: [],
      highlights: [],
      events: [],
      ...summary,
    },
    ...over,
  };
}

const pairs = (chips: { glyph: string; text: string }[]): string[] => chips.map((c) => `${c.glyph} ${c.text}`);

describe('coming home (3.7.0)', () => {
  test('what they took, what they used, and what came back', () => {
    const h = homecoming(report(), name);
    assert.deepEqual(pairs(h.took), ['rations 3', 'meds 2', 'ammo 10', 'gas 2']);
    assert.deepEqual(pairs(h.used), ['rations 3', 'meds 1', 'ammo 6', 'gas 2']);
    assert.ok(h.used.every((c) => c.tone === 'bad'));
    // Back: what they found, and the meds and ammo they didn't use.
    assert.deepEqual(pairs(h.back), ['scrap +12', 'meds +1', 'ammo +4', 'tech +1']);
    assert.deepEqual(h.backBy, { scrap: 12, meds: 1, ammo: 4, tech: 1 });
    assert.deepEqual(h.items, [{ uid: 'i9', defId: 'pipe', quality: 'common', name: 'pipe' }]);
    assert.equal(h.empty, false);
  });

  test('an older report doesn’t know the rations and gas; goods taken to trade count as taken', () => {
    const { packed: _gone, ...old } = report();
    assert.deepEqual(pairs(homecoming(old, name).took), ['meds 2', 'ammo 10']);
    const trade = report({ plan: { ...report().plan, meds: 0, ammo: 0, job: 'trade', trade: { give: 'rations', get: 'scrap', amount: 30 } } }, { medsLeft: 0, ammoLeft: 0 });
    const h = homecoming(trade, name);
    assert.deepEqual(pairs(h.took), ['rations 33', 'gas 2']);
    assert.deepEqual(pairs(h.used), ['rations 33', 'gas 2'], 'eaten, burned or traded away');
  });

  test('nothing out, nothing back: nothing to show', () => {
    const h = homecoming(report({ plan: { ...report().plan, meds: 0, ammo: 0 }, packed: { rations: 0, gas: 0 } }, { loot: { scrap: 0, rations: 0, meds: 0, ammo: 0, tech: 0, gas: 0 }, items: [], medsLeft: 0, ammoLeft: 0 }), name);
    assert.equal(h.empty, true);
  });

  test('each thing back pops up in turn and lands after it; the stores count up from before', () => {
    const f = flights(homecoming(report(), name));
    assert.deepEqual(f.map((x) => x.key), ['scrap', 'meds', 'ammo', 'tech', 'i9']);
    assert.equal(f[0]!.showAt, HOME_BACK_AT);
    assert.equal(f[1]!.showAt - f[0]!.showAt, HOME_STEP);
    assert.ok(f.every((x) => x.landAt > x.showAt));
    assert.equal(f[4]!.kind, 'item');
    assert.deepEqual(storesBefore({ scrap: 40, rations: 9, meds: 1, ammo: 4, tech: 0, gas: 5 }, { scrap: 12, meds: 1, ammo: 4, tech: 1 }), {
      scrap: 28,
      rations: 9,
      meds: 0,
      ammo: 0,
      tech: 0,
      gas: 5,
    });
  });

  test('a real run home: the report keeps what was packed', () => {
    const state = openGame('homecoming');
    state.resources.rations = 20;
    const run = startRun(state, testPlan(state, 'rail_yard', { meds: 1, ammo: 0 }), 0);
    completeRun(state, run.id, run.returnAt);
    const r = state.reports.find((x) => x.id === run.id)!;
    assert.equal(r.packed?.rations, run.rations);
    assert.equal(r.packed?.gas, 0);
    const h = homecoming(r, name);
    assert.ok(h.took.some((c) => c.glyph === 'rations'));
  });
});
