import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { marketQuote, moveMarket, newGame, priceOf, tradeCapacity, validatePlan, type RunPlan } from '../engine/index.ts';
import { JOBS, defaultPlan } from './runs-view.ts';
import { fitTrade, marketJobs, maxTrade, maxWant, payChoices, priceLine, priceRows, tradeChips, tradeLine, withGet, withGive, withWant } from './market-view.ts';

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
    assert.match(tradeLine(state, fitted), /^\d+ scrap cost \d+ rations at today’s prices; whoever talks best may get a little more\. Packed with goods, this crew can carry \d+\.$/);
    assert.equal(fitted.trade!.want! % 5, 0, 'a round number to start with');
  });

  test('buy an exact number, and the price is the fewest goods that buy it: rounded up (3.7.2)', () => {
    const { state, plan } = atMarket();
    const fitted = fitTrade(state, plan);
    const most = maxWant(state, fitted, 'rations', 'scrap');
    for (let want = 1; want <= most; want++) {
      const t = withWant(state, fitted, want).trade!;
      assert.equal(t.want, want, 'exactly what was asked, one by one');
      assert.ok(marketQuote(state.market, t) >= want, `${t.amount} rations buy ${want} scrap`);
      assert.ok(marketQuote(state.market, { ...t, amount: t.amount - 1 }) < want, 'and one fewer wouldn’t');
    }
    assert.equal(withWant(state, fitted, 999).trade!.want, most, 'no more than the crew can pay for');
    assert.equal(withWant(state, fitted, 0).trade!.want, 1);
    const seven = withWant(state, fitted, 7);
    assert.deepEqual(validatePlan(state, seven), []);
    assert.deepEqual(tradeChips(seven).map((c) => [c.glyph, c.text]), [
      ['rations', `−${seven.trade!.amount}`],
      ['arrow', ''],
      ['scrap', '+7'],
    ]);
    // A big unit for small change: paying for 3 scrap with tech rounds up to a whole piece of tech.
    state.resources.tech = 10;
    const tech = withGive(state, withWant(state, fitted, 3), 'tech').trade!;
    assert.equal(tech.amount, priceOf(state.market, 'tech', 'scrap', 3));
    assert.ok(marketQuote(state.market, tech) > 3, 'worth more than three, and still only three come back');
    assert.ok(!payChoices(state, seven, 'scrap').some((c) => c.id === 'scrap'), 'nothing paid for with itself');
  });

  test('the amount shrinks to fit a smaller crew, and changes with what goes', () => {
    const { state, plan } = atMarket();
    const big = withWant(state, fitTrade(state, plan), 999);
    assert.ok(big.trade!.amount <= maxTrade(state, big, 'rations'));
    const solo = fitTrade(state, { ...big, crew: big.crew.slice(0, 1) });
    assert.ok(solo.trade!.want! < big.trade!.want!, 'fewer bought when fewer carry the goods');
    assert.deepEqual(validatePlan(state, solo), []);
    const scrap = withGive(state, solo, 'scrap');
    assert.equal(scrap.trade!.give, 'scrap');
    assert.equal(scrap.trade!.get, 'gas', 'never scrap for scrap');
    assert.equal(withGet(state, scrap, 'meds').trade!.get, 'meds');
    assert.equal(withGet(state, solo, 'rations').trade!.give, 'scrap', 'buying rations, paid in scrap');
    assert.equal(fitTrade(state, { ...plan, locationId: 'rail_yard', job: 'trade' }).job, 'scavenge');
  });

  test('prices for ten of each, in scrap, and a mark once the guild has moved them', () => {
    const { state } = atMarket();
    const rows = priceRows(state);
    assert.deepEqual(rows.map((r) => r.id), ['rations', 'meds', 'ammo', 'tech', 'gas'], 'everything but scrap, which they\u2019re priced in');
    assert.deepEqual(rows.map((r) => [r.sell, r.buy]), [[3, 6], [11, 20], [4, 7], [22, 41], [9, 16]]);
    assert.ok(rows.every((r) => !r.trend));
    assert.equal(priceLine(state, 'rations'), '10 rations sell for 3 scrap here, and cost 6.');
    assert.equal(priceLine(state, 'scrap'), 'Everything here is priced in scrap.');
    moveMarket(state, { give: 'rations', amount: 200, get: 'scrap' }, 40);
    const moved = priceRows(state);
    assert.equal(moved[0]!.trend, 'cheap');
    assert.ok(moved[0]!.sell < 3);
    assert.match(priceLine(state, 'scrap'), /Pricey lately: the guild has bought a lot here\.$/);
    assert.ok(!/[Dd]ear/.test(priceLine(state, 'scrap')), 'not "dear" (Aviel)');
  });
});
