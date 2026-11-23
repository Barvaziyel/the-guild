import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { moveMarket, newGame, tradeCapacity, validatePlan, type RunPlan } from '../engine/index.ts';
import { JOBS, defaultPlan } from './runs-view.ts';
import { fitTrade, marketJobs, maxTrade, priceLines, tradeLine, withAmount, withGet, withGive } from './market-view.ts';

function atMarket(crew = 3): { state: ReturnType<typeof newGame>; plan: RunPlan } {
  const state = newGame({ seed: 'market-view', now: 0 });
  state.resources.rations = 150;
  const plan = { ...defaultPlan(state, 'drive_in'), crew: state.survivors.slice(0, crew).map((s) => s.id) };
  return { state, plan };
}

describe('the market on screen (§7.14)', () => {
  test('the market offers only Trade, and nowhere else does', () => {
    assert.deepEqual(marketJobs('drive_in', JOBS).map((j) => j.id), ['trade']);
    assert.deepEqual(marketJobs('rail_yard', JOBS).map((j) => j.id), ['scavenge', 'scout', 'hunt']);
  });

  test('a plan for the market trades the spare rations for scrap, as many as the crew can carry', () => {
    const { state, plan } = atMarket();
    const fitted = fitTrade(state, plan);
    assert.equal(fitted.job, 'trade');
    assert.equal(fitted.trade?.give, 'rations');
    assert.equal(fitted.trade?.get, 'scrap');
    assert.equal(fitted.lootPriority, 'scrap', 'what was bought is kept first');
    assert.ok(fitted.trade!.amount > 0 && fitted.trade!.amount <= tradeCapacity(state, fitted));
    assert.deepEqual(validatePlan(state, fitted), []);
    assert.match(tradeLine(state, fitted), /^\d+ rations fetch about \d+ scrap at today’s prices; whoever talks best may get more\. Packed with goods, this crew can carry \d+\.$/);
  });

  test('the amount shrinks to fit a smaller crew, and changes with what goes', () => {
    const { state, plan } = atMarket();
    const big = withAmount(state, fitTrade(state, plan), 999);
    assert.equal(big.trade!.amount, maxTrade(state, big, 'rations'));
    const solo = fitTrade(state, { ...big, crew: big.crew.slice(0, 1) });
    assert.ok(solo.trade!.amount < big.trade!.amount);
    assert.deepEqual(validatePlan(state, solo), []);
    const scrap = withGive(state, solo, 'scrap');
    assert.equal(scrap.trade!.give, 'scrap');
    assert.equal(scrap.trade!.get, 'gas', 'never scrap for scrap');
    assert.equal(withGet(state, scrap, 'meds').trade!.get, 'meds');
    assert.equal(fitTrade(state, { ...plan, locationId: 'rail_yard', job: 'trade' }).job, 'scavenge');
  });

  test('prices in plain words, and a note once the guild has moved them', () => {
    const { state } = atMarket();
    const lines = priceLines(state);
    assert.equal(lines.length, 5);
    assert.equal(lines[0], 'Rations: 3 fetch a scrap, and a scrap buys 1.6.');
    assert.match(lines.find((l) => l.startsWith('Tech'))!, /^Tech: sells for [\d.]+ scrap, and costs [\d.]+\.$/);
    moveMarket(state, { give: 'rations', amount: 200, get: 'scrap' }, 40);
    assert.match(priceLines(state)[0]!, /Cheap lately: the guild has sold a lot here\.$/);
  });
});
