/**
 * The market beat (§7.14, 3.4.0): a trade run reaches the Drive-In, the crew's
 * best talker haggles, and the goods in the packs become what they came for.
 * Priced at the market as it was when they set out (`TradeOrder.quote`).
 */
import { HAGGLE_BIG_BONUS, HAGGLE_BONUS, HAGGLE_DC } from '../constants.ts';
import { HAGGLE_BIG, HAGGLE_LOST, HAGGLE_WON, MARKET_ARRIVAL } from '../content/flavor.ts';
import { marketQuote } from '../market.ts';
import { amountOf } from '../text.ts';
import { bestBy, check, flavor, say, simBonus, standing, startBeat, type Sim } from './context.ts';

export function tradeBeat(sim: Sim): void {
  const t = sim.plan.trade;
  startBeat(sim, 'trade', sim.loc.name);
  say(sim, flavor(sim, MARKET_ARRIVAL));
  // Whatever got through the road: a fight or a dropped load may have cost some of it.
  const have = t ? Math.floor(sim.loot[t.give]) : 0;
  if (!t || have < 1) {
    say(sim, 'There is nothing left in the packs to trade.', { tone: 'bad' });
    return;
  }
  const talker = bestBy(standing(sim), (m) => simBonus(sim, m, 'nerve', []))!;
  const haggle = check(sim, talker, 'nerve', HAGGLE_DC, ['haggle']);
  const bonus = haggle.success ? (haggle.margin >= 5 ? HAGGLE_BIG_BONUS : HAGGLE_BONUS) : 0;
  say(sim, flavor(sim, haggle.success ? (bonus === HAGGLE_BIG_BONUS ? HAGGLE_BIG : HAGGLE_WON) : HAGGLE_LOST, { a: talker }), {
    check: haggle.info,
    ...(haggle.success ? { tone: 'good' as const } : {}),
  });
  // The price was set when they left; haggling and anything lost on the way change how much it comes to.
  const base = t.quote ?? marketQuote(sim.state.market, t);
  const got = have >= t.amount ? Math.floor(base * (1 + bonus)) : Math.floor(marketQuote(sim.state.market, { ...t, amount: have }) * (1 + bonus));
  sim.loot[t.give] -= have;
  sim.loot[t.get] += got;
  say(sim, `The trader takes ${amountOf(t.give, have)} and hands over ${amountOf(t.get, got)}.`, got > 0 ? { tone: 'good' } : {});
}
