/**
 * Monte Carlo balance tests. These pin down how dangerous the game is, so a
 * content or rules change that makes it much deadlier (or toothless) fails
 * here. Seeds are fixed: the numbers are exact, not flaky. If you change
 * balance on purpose, run `npm run balance` and adjust the ranges with it.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createItem } from '../gear.ts';
import { maxHp } from '../stats.ts';
import { openGame, testPlan } from '../test-utils.ts';
import type { RunPlan } from '../types.ts';
import { RESOURCE_IDS, STAT_IDS } from '../types.ts';
import { simulateRun } from './sim.ts';

interface Tally {
  runs: number;
  deaths: number;
  downs: number;
  loot: number;
  completed: number;
}

function simulate(location: string, runs: number, overrides: Partial<RunPlan> = {}, setup?: (state: ReturnType<typeof openGame>) => void): Tally {
  const tally: Tally = { runs, deaths: 0, downs: 0, loot: 0, completed: 0 };
  for (let i = 0; i < runs; i++) {
    const state = openGame(`balance-${i}`);
    setup?.(state);
    const { result } = simulateRun(state, testPlan(state, location, overrides), `b${i}`, 0);
    tally.deaths += result.deaths.length;
    tally.downs += result.crew.reduce((n, s) => n + s.counters.timesDowned, 0);
    tally.loot += RESOURCE_IDS.reduce((n, r) => n + result.loot[r], 0) + result.items.length;
    if (result.outcome === 'completed') tally.completed++;
  }
  return tally;
}

const N = 3000;

describe('balance: permadeath is rare', () => {
  const moderate = ['st_judes', 'water_plant', 'blackwater'].map((id) => simulate(id, N));
  const moderateDeaths = moderate.reduce((n, t) => n + t.deaths, 0) / (N * 3);

  test('moderate danger, sensible orders: about one death per 30 to 50 runs', () => {
    const per = 1 / moderateDeaths;
    assert.ok(per >= 25 && per <= 55, `one death per ${per.toFixed(1)} runs`);
  });

  test('injuries are far more common than deaths', () => {
    const downs = moderate.reduce((n, t) => n + t.downs, 0) / (N * 3);
    assert.ok(downs > 0.4 && downs < 0.8, `downs per run ${downs.toFixed(2)}`);
    assert.ok(downs > moderateDeaths * 8);
  });

  test('the starting locations are safe enough to learn in', () => {
    for (const id of ['rail_yard', 'maple_street']) {
      const t = simulate(id, N);
      assert.ok(t.deaths / N < 0.004, `${id}: ${t.deaths} deaths in ${N}`);
      assert.ok(t.completed / N > 0.95);
    }
  });

  test('danger rises with the danger rating', () => {
    const d2 = simulate('drowned_mall', N).deaths / N;
    const d4 = simulate('red_hand_camp', N).deaths / N;
    assert.ok(d2 < moderateDeaths, `danger 2 (${d2}) below moderate (${moderateDeaths})`);
    assert.ok(d4 > moderateDeaths * 1.5, `danger 4 (${d4}) well above moderate`);
    assert.ok(d4 < 0.12, 'even Red Hand Camp is not a coin flip');
  });

  test('reckless orders somewhere deadly cost lives', () => {
    const careful = simulate('the_glow', N).deaths / N;
    const reckless = simulate('the_glow', N, { retreat: 'never', approach: 'aggressive' }).deaths / N;
    assert.ok(reckless > careful * 1.4, `reckless ${reckless} vs careful ${careful}`);
    assert.ok(reckless > moderateDeaths * 3);
  });

  test('cautious orders save lives and cost loot', () => {
    const normal = simulate('water_plant', N);
    const cautious = simulate('water_plant', N, { retreat: 'wounded' });
    assert.ok(cautious.deaths < normal.deaths * 0.6);
    assert.ok(cautious.completed < normal.completed);
  });

  test('a Medkit in the crew prevents most deaths', () => {
    const without = simulate('water_plant', N);
    const withKit = simulate('water_plant', N, {}, (state) => {
      state.survivors[0]!.equipment.tool = state.stash.find((i) => i.defId === 'medkit')!;
    });
    assert.ok(withKit.deaths < without.deaths * 0.4, `${withKit.deaths} vs ${without.deaths}`);
  });
});

describe('balance: gear matters, but danger 4 and 5 stay dangerous', () => {
  /** A crew with two weeks of growth: +1 to every stat, a Solid Hunting Rifle and a Solid Scrap Vest each, ammo, no Medkit. */
  const seasoned = (state: ReturnType<typeof openGame>): void => {
    for (const s of state.survivors) {
      for (const st of STAT_IDS) s.stats[st] = Math.min(10, s.stats[st] + 1);
      s.hp = maxHp(s);
      s.equipment.weapon = createItem(state, 'hunting_rifle', 'solid');
      s.equipment.armor = createItem(state, 'scrap_vest', 'solid');
    }
  };
  const run = (id: string): Tally => simulate(id, 1000, { ammo: 20 }, seasoned);

  test('a seasoned crew makes danger 3 safe, but not the Glow', () => {
    const d3 = run('water_plant');
    assert.ok(d3.completed / d3.runs > 0.9, `danger 3: ${d3.completed} of ${d3.runs} finished`);
    assert.ok(d3.deaths / d3.runs < 0.01);
    const glow = run('the_glow');
    assert.ok(glow.completed / glow.runs < 0.65, `the Glow: ${glow.completed} of ${glow.runs} finished`);
    assert.ok(glow.deaths / glow.runs > 0.015, `the Glow: ${glow.deaths} deaths in ${glow.runs}`);
  });
});

describe('balance: rewards', () => {
  test('a seasoned crew brings home more from more dangerous places', () => {
    const seasoned = (state: ReturnType<typeof openGame>): void => {
      for (const s of state.survivors) {
        s.equipment.weapon = createItem(state, 'hunting_rifle', 'solid');
        s.equipment.armor = createItem(state, 'scrap_vest', 'solid');
      }
    };
    const per = (id: string): number => {
      const t = simulate(id, 600, { ammo: 20 }, seasoned);
      return t.loot / t.runs;
    };
    const d1 = per('rail_yard');
    const d3 = per('water_plant');
    const d4 = per('checkpoint_bravo');
    assert.ok(d3 > d1 * 2.5, `danger 3 ${d3.toFixed(1)} vs danger 1 ${d1.toFixed(1)}`);
    assert.ok(d4 > d1 * 2.5, `danger 4 ${d4.toFixed(1)} vs danger 1 ${d1.toFixed(1)}`);
  });

  test('more dangerous places pay better per finished run', () => {
    const perFinished = (id: string): number => {
      const t = simulate(id, 1500);
      return t.loot / t.runs;
    };
    assert.ok(perFinished('drowned_mall') > perFinished('maple_street') * 1.2);
    assert.ok(perFinished('rail_yard') > 3, 'even the Rail Yard is worth the walk');
  });
});
