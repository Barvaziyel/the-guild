import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MARKET_VALUE, TRADE_LOAD } from './constants.ts';
import { LOCATIONS, getLocation } from './content/index.ts';
import { easeMarket, marketQuote, moveMarket, tradeCapacity, unitPrice } from './market.ts';
import { startRun } from './expedition/runs.ts';
import { simulateRun } from './expedition/sim.ts';
import { tradeProblems, validatePlan } from './expedition/plan.ts';
import { carryCapacity } from './stats.ts';
import { testGame, testPlan } from './test-utils.ts';
import type { GameState, RunPlan, TradeOrder } from './types.ts';

const T = (give: TradeOrder['give'], amount: number, get: TradeOrder['get']): TradeOrder => ({ give, amount, get });

function tradePlan(state: GameState, trade: TradeOrder, overrides: Partial<RunPlan> = {}): RunPlan {
  return testPlan(state, 'drive_in', { job: 'trade', trade, meds: 0, ammo: 0, ...overrides });
}

describe('the market at the Drive-In (§7.14)', () => {
  test('is known from the start, has nothing to find, and is the only market', () => {
    const markets = LOCATIONS.filter((l) => l.market);
    assert.deepEqual(markets.map((l) => l.id), ['drive_in']);
    const loc = getLocation('drive_in');
    assert.equal(loc.startKnown, true);
    assert.deepEqual(loc.leadsTo, []);
    assert.equal(loc.danger, 1);
  });

  test('rations start at about 3 to a scrap, and the more of one thing, the worse the price', () => {
    const first = unitPrice(undefined, 'scrap').asks / unitPrice(undefined, 'rations').pays;
    assert.ok(first > 2.9 && first < 3.1, `a scrap costs ${first} rations`);
    const per = (n: number): number => n / marketQuote(undefined, T('rations', n, 'scrap'));
    assert.ok(per(20) < per(60) && per(60) < per(120) && per(120) < per(200), 'a bigger load fetches less for each');
    assert.equal(marketQuote(undefined, T('rations', 60, 'rations')), 0, 'nothing for the same thing');
    assert.equal(marketQuote(undefined, T('rations', 0, 'scrap')), 0);
  });

  test('a trade moves the market, and it eases back day by day', () => {
    const state = testGame();
    const order = T('rations', 60, 'scrap');
    const before = marketQuote(state.market, order);
    moveMarket(state, order, before);
    const after = marketQuote(state.market, order);
    assert.ok(after < before, `${after} after selling, ${before} before`);
    assert.ok(unitPrice(state.market, 'scrap').asks > MARKET_VALUE.scrap * 1.15, 'scrap is dearer once bought');
    for (let day = 0; day < 8; day++) easeMarket(state);
    const aDayLater = marketQuote(state.market, order);
    assert.ok(aDayLater > after && aDayLater <= before, 'most of the way back in a real day');
    for (let day = 0; day < 80; day++) easeMarket(state);
    assert.equal(marketQuote(state.market, order), before, 'back to where it was');
    assert.deepEqual(state.market?.glut, {});
  });

  test('a trade crew carries three times its usual load', () => {
    const state = testGame();
    const plan = tradePlan(state, T('rations', 10, 'scrap'));
    const usual = plan.crew.reduce((n, id) => n + carryCapacity(state.survivors.find((s) => s.id === id)!), 0);
    assert.equal(tradeCapacity(state, plan), usual * TRADE_LOAD);
  });

  test('only trade runs go to the market, and only there; the goods must be spare and carried', () => {
    const state = testGame();
    state.resources.rations = 300;
    assert.match(validatePlan(state, testPlan(state, 'drive_in')).join(' '), /market/);
    assert.match(validatePlan(state, testPlan(state, 'rail_yard', { job: 'trade', trade: T('rations', 10, 'scrap') })).join(' '), /no market/);
    assert.deepEqual(validatePlan(state, tradePlan(state, T('rations', 30, 'scrap'))), []);
    assert.match(tradeProblems(state, tradePlan(state, T('rations', 30, 'rations'))).join(' '), /something other/);
    assert.match(tradeProblems(state, tradePlan(state, T('rations', 299, 'scrap'))).join(' '), /spare/);
    const loads = tradeCapacity(state, tradePlan(state, T('rations', 1, 'scrap')));
    assert.match(tradeProblems(state, tradePlan(state, T('rations', loads + 1, 'scrap'))).join(' '), /carry/);
    assert.match(tradeProblems(state, tradePlan(state, T('rations', 2, 'tech'))).join(' '), /even one/);
    assert.match(tradeProblems(state, testPlan(state, 'drive_in', { job: 'trade' })).join(' '), /Pick what/);
  });

  test('a trade run takes the goods, prices them at departure, and brings back what was bought', () => {
    let completed = 0;
    for (let i = 0; i < 40; i++) {
      const state = testGame(`trade-${i}`);
      state.resources.rations = 200;
      const order = T('rations', 36, 'scrap');
      const quote = marketQuote(state.market, order);
      const rations = state.resources.rations;
      const scrap = state.resources.scrap;
      const run = startRun(state, tradePlan(state, order), 0);
      assert.equal(run.plan.trade?.quote, quote, 'priced when they set out');
      assert.ok(state.resources.rations <= rations - 36, 'the goods left with them');
      assert.equal(state.resources.scrap, scrap);
      assert.ok((state.market?.glut.rations ?? 0) > 0, 'the market moved');
      const r = run.result;
      if (r.outcome === 'completed') {
        completed++;
        const beat = run.beats.find((b) => b.kind === 'trade');
        assert.ok(beat, 'the market is in the log');
        const got = Number(/hands over (\d+) scrap/.exec(beat.lines.map((l) => l.text).join(' '))?.[1]);
        assert.ok(got >= quote && got <= Math.floor(quote * 1.25), `${got} for a quote of ${quote}`);
        assert.ok(r.loot.scrap >= got, 'and it came home (with anything found on the road)');
      }
      if (r.outcome === 'routed' || r.outcome === 'lost') assert.equal(r.loot.scrap + r.loot.rations, 0);
    }
    assert.ok(completed >= 34, `${completed} of 40 got there and back`);
  });

  test('a crew that turns back before the market brings the goods home', () => {
    let found = false;
    for (let i = 0; i < 400 && !found; i++) {
      const state = testGame(`back-${i}`);
      state.resources.rations = 200;
      const solo = { crew: [state.survivors[0]!.id] };
      const plan = tradePlan(state, T('rations', tradeCapacity(state, solo), 'scrap'), { retreat: 'wounded', ...solo });
      const sim = simulateRun(state, { ...plan, trade: { ...plan.trade!, quote: marketQuote(state.market, plan.trade!) } }, `b${i}`, 0);
      if (sim.result.outcome !== 'turnedBack' || sim.beats.some((b) => b.kind === 'trade')) continue;
      found = true;
      assert.equal(sim.result.loot.rations, plan.trade!.amount, 'every ration came back');
    }
    assert.ok(found, 'some crew turned back before the market');
  });
});
