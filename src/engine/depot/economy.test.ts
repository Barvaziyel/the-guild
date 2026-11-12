/**
 * The 1.6.2 economy: upkeep for upper building levels, traders who buy what
 * the guild has too much of, and raids that take more from big stockpiles.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIREPIT_RELIEF, HEAL_BASE, RAID_MAX_TAKE, REST_RELIEF } from '../constants.ts';
import { Rng } from '../rng.ts';
import { openGame, testGame } from '../test-utils.ts';
import type { GameState } from '../types.ts';
import { build, buildingLevel, upkeepOf, workingLevel } from './buildings.ts';
import { emptySummary, firepitRelief, playDepotDay } from './day.ts';
import { makeOffer, raidCap, spare } from './events.ts';

function rich(state: GameState): void {
  state.resources = { scrap: 5000, rations: 5000, meds: 5000, ammo: 5000, tech: 5000, gas: 5000 };
}

describe('upkeep', () => {
  test('only upper levels cost upkeep, and it is paid from the stores each day', () => {
    const state = testGame('upkeep');
    rich(state);
    assert.equal(upkeepOf(state, 'firepit'), undefined, 'a level 1 Firepit costs nothing to run');
    build(state, 'firepit', 1);
    build(state, 'firepit', 1);
    assert.deepEqual(upkeepOf(state, 'firepit'), { res: 'rations', amount: 2 });
    for (const [id, times] of [['infirmary', 3], ['workshop', 3], ['radio_tower', 3], ['watchtower', 3]] as const) {
      for (let i = 0; i < times; i++) build(state, id, 1);
    }
    const before = { ...state.resources };
    const summary = emptySummary();
    for (let d = 2; d < 22; d++) playDepotDay(state, d, new Rng(`u${d}`), summary);
    assert.ok((summary.upkeep.rations ?? 0) === 40, `the Bar and Stage drank ${summary.upkeep.rations}`);
    assert.ok((summary.upkeep.meds ?? 0) >= 4 && (summary.upkeep.meds ?? 0) <= 18, `meds ${summary.upkeep.meds}`);
    assert.ok((summary.upkeep.tech ?? 0) >= 10 && (summary.upkeep.tech ?? 0) <= 32, `tech ${summary.upkeep.tech}`);
    assert.ok((summary.upkeep.ammo ?? 0) >= 12, `ammo ${summary.upkeep.ammo}`);
    assert.deepEqual(summary.unpaid, []);
    assert.ok(state.resources.tech < before.tech);
  });

  test('a building whose upkeep cannot be paid works a level lower that day', () => {
    const state = testGame('short');
    rich(state);
    build(state, 'firepit', 1);
    build(state, 'firepit', 1);
    const full = firepitRelief(state);
    state.resources.rations = 0;
    const summary = emptySummary();
    playDepotDay(state, 2, new Rng('s'), summary);
    assert.deepEqual(summary.unpaid, ['firepit']);
    assert.deepEqual(state.depot.unpaid, ['firepit']);
    assert.equal(buildingLevel(state, 'firepit'), 3, 'the building keeps its level');
    assert.equal(workingLevel(state, 'firepit'), 2);
    assert.ok(firepitRelief(state) < full);
    state.resources.rations = 100;
    playDepotDay(state, 3, new Rng('s2'), emptySummary());
    assert.equal(state.depot.unpaid, undefined);
    assert.equal(workingLevel(state, 'firepit'), 3);
  });

  test('the Depot heals and calms slowly: a long run takes days to shake off', () => {
    assert.ok(HEAL_BASE <= 0.08);
    assert.ok(REST_RELIEF + FIREPIT_RELIEF[1] <= 5, 'a level 1 Firepit with nobody keeping it');
  });
});

describe('traders', () => {
  test('with more than it needs of something, the guild gets offers to sell it for scrap', () => {
    const state = openGame('sell');
    state.resources = { scrap: 10, rations: 400, meds: 5, ammo: 10, tech: 120, gas: 3 };
    assert.equal(spare(state, 'meds'), 0);
    assert.ok(spare(state, 'rations') > 300);
    let buying = 0;
    const sold = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const offer = makeOffer(state, 5, new Rng(`t${i}`));
      // The old swap of rations for scrap (about 0.8 each) is still around; buying offers pay about half.
      const [[res, amount]] = Object.entries(offer.give) as [[string, number]];
      if (offer.get.scrap && (res === 'tech' || offer.get.scrap / amount < 0.6)) {
        buying += 1;
        sold.add(res);
        assert.ok(amount <= spare(state, res as 'rations'), `${amount} ${res}`);
      }
    }
    assert.ok(buying > 70 && buying < 130, `${buying} of 200 offers buy`);
    assert.deepEqual([...sold].sort(), ['rations', 'tech']);
  });

  test('swaps grow with what the guild can spare, up to 200', () => {
    const sizes = (scrap: number): number[] => {
      const state = openGame('swap');
      state.resources = { scrap, rations: 10, meds: 2, ammo: 5, tech: 1, gas: 0 };
      const out: number[] = [];
      for (let i = 0; i < 300; i++) {
        const offer = makeOffer(state, 5, new Rng(`s${i}`));
        if (offer.give.scrap && !offer.item && !offer.vehicle) out.push(offer.give.scrap);
      }
      return out;
    };
    const poor = sizes(30);
    assert.ok(Math.max(...poor) <= 20 && Math.min(...poor) >= 8, 'a new guild sees the old 8-20');
    const rich = sizes(1200);
    assert.ok(Math.min(...rich) >= 96 && Math.max(...rich) <= 180, `a rich one sees an eighth or so: ${Math.min(...rich)}-${Math.max(...rich)}`);
    assert.ok(Math.max(...sizes(5000)) === 200, 'never more than 200');
  });

  test('with nothing spare, they only sell and swap', () => {
    const state = openGame('poor');
    state.resources = { scrap: 20, rations: 10, meds: 2, ammo: 5, tech: 1, gas: 0 };
    for (let i = 0; i < 100; i++) {
      const offer = makeOffer(state, 5, new Rng(`p${i}`));
      if (offer.get.scrap) assert.ok(offer.give.rations, 'the old rations-for-scrap swap is all');
    }
  });
});

describe('raids', () => {
  test('raiders carry off more from a big pile', () => {
    assert.equal(raidCap(50), RAID_MAX_TAKE);
    assert.equal(raidCap(100), RAID_MAX_TAKE);
    assert.equal(raidCap(600), RAID_MAX_TAKE + 100);
  });
});
