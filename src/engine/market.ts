/**
 * The market at the Drive-In (§7.14, 3.4.0). Aviel, 2026-11-23: rations pile
 * up and scrap never does, so "some kind of merchant that you can go to and
 * exchange rations for scraps, or scraps for gas… maybe the price goes up as
 * you exchange more."
 *
 * Any supply for any other. Every unit the guild sells makes that supply a
 * little cheaper there, and every unit it buys makes that one a little
 * dearer: a supply's glut goes up by its worth over MARKET_DEPTH with each
 * unit sold and down with each bought, and its price goes with e to the minus
 * glut. The glut eases back each game day. A trade is priced when the crew
 * sets out (runs are decided at departure) and moves the market then.
 */
import { MARKET_BUY, MARKET_DEPTH, MARKET_EASE, MARKET_SELL, MARKET_VALUE, TRADE_LOAD } from './constants.ts';
import { findLocation, getVehicleDef } from './content/index.ts';
import { carryCapacity } from './stats.ts';
import type { GameState, MarketState, ResourceId, RunPlan, TradeOrder } from './types.ts';

/** Whether this place is a market, where only trade runs go. */
export function isMarket(locationId: string): boolean {
  return findLocation(locationId)?.market === true;
}

function glutOf(market: MarketState | undefined, r: ResourceId): number {
  return market?.glut[r] ?? 0;
}

/** What the market would give, in scrap's worth, for this many of a supply, at the prices it has now. */
function sellValue(market: MarketState | undefined, r: ResourceId, amount: number): number {
  const worth = MARKET_VALUE[r];
  let glut = glutOf(market, r);
  let value = 0;
  for (let i = 0; i < amount; i++) {
    value += worth * MARKET_SELL * Math.exp(-glut);
    glut += worth / MARKET_DEPTH;
  }
  return value;
}

/** How many of a supply that much scrap's worth buys, at the prices the market has now. */
function buyWith(market: MarketState | undefined, r: ResourceId, value: number): number {
  const worth = MARKET_VALUE[r];
  let glut = glutOf(market, r);
  let left = value;
  let got = 0;
  // A guard: nobody carries thousands of anything.
  while (got < 10_000) {
    const cost = worth * MARKET_BUY * Math.exp(-glut);
    if (left + 1e-9 < cost) break;
    left -= cost;
    glut -= worth / MARKET_DEPTH;
    got += 1;
  }
  return got;
}

/**
 * What a trade fetches at the market's prices now: `give` sold, `get` bought with what it fetched.
 * `bonus` is haggling (0.15 for 15% more). Pass the market as it was when the crew set out.
 */
export function marketQuote(market: MarketState | undefined, order: Pick<TradeOrder, 'give' | 'amount' | 'get'>, bonus = 0): number {
  if (order.give === order.get || order.amount <= 0) return 0;
  return buyWith(market, order.get, sellValue(market, order.give, order.amount) * (1 + bonus));
}

/** The price of one now, in scrap's worth: what the market pays for one, and what it asks. */
export function unitPrice(market: MarketState | undefined, r: ResourceId): { pays: number; asks: number } {
  const p = MARKET_VALUE[r] * Math.exp(-glutOf(market, r));
  return { pays: p * MARKET_SELL, asks: p * MARKET_BUY };
}

/** The market moves with a trade made: what was sold gets cheaper, what was bought dearer. */
export function moveMarket(state: GameState, order: Pick<TradeOrder, 'give' | 'amount' | 'get'>, got: number): void {
  const market = (state.market ??= { glut: {} });
  market.glut[order.give] = glutOf(market, order.give) + (order.amount * MARKET_VALUE[order.give]) / MARKET_DEPTH;
  market.glut[order.get] = glutOf(market, order.get) - (got * MARKET_VALUE[order.get]) / MARKET_DEPTH;
}

/** A game day at the market: every glut eases back toward nothing. */
export function easeMarket(state: GameState): void {
  const market = state.market;
  if (!market) return;
  for (const r of Object.keys(market.glut) as ResourceId[]) {
    const g = (market.glut[r] ?? 0) * (1 - MARKET_EASE);
    if (Math.abs(g) < 0.001) delete market.glut[r];
    else market.glut[r] = g;
  }
}

/**
 * How many loads a trade crew can carry: the usual (everyone's Carry, and the vehicles' cargo)
 * times TRADE_LOAD, since the packs hold nothing but goods.
 */
export function tradeCapacity(state: GameState, plan: Pick<RunPlan, 'crew' | 'vehicles'>): number {
  let loads = 0;
  for (const id of plan.crew) {
    const s = state.survivors.find((x) => x.id === id);
    if (s) loads += carryCapacity(s);
  }
  for (const id of plan.vehicles ?? []) {
    const v = state.vehicles.find((x) => x.id === id);
    if (v) loads += getVehicleDef(v.defId).cargo;
  }
  return loads * TRADE_LOAD;
}
