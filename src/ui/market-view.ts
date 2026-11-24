/**
 * The market at the Drive-In on screen (§7.14, 3.4.0): the Trade job in the
 * planner, what the goods fetch, and the prices on the place's panel.
 */
import {
  RESOURCE_IDS,
  TRADE_LOAD,
  amountOf,
  findLocation,
  isMarket,
  marketQuote,
  priceOf,
  spareToTrade,
  tradeCapacity,
  unitPrice,
  type GameState,
  type ResourceId,
  type RunJob,
  type RunPlan,
  type TradeOrder,
} from '../engine/index.ts';
import type { Chip } from './glyphs.ts';
import type { Choice } from './runs-view.ts';
import { RESOURCE_NAMES } from './view.ts';

export const TRADE_JOB: Choice<RunJob> = {
  id: 'trade',
  name: 'Trade',
  description: 'Take goods to the market and bring back something else. The packs hold three times as much when they’re full of nothing but goods.',
  chips: [
    { glyph: 'scales', text: 'swap', label: 'Goods for other goods' },
    { glyph: 'cargo', text: `×${TRADE_LOAD}`, tone: 'good', label: `Packs hold ${TRADE_LOAD} times as much` },
  ],
};

/** The jobs a place offers: only Trade at a market, and never Trade anywhere else. */
export function marketJobs<T extends Choice<RunJob>>(locationId: string, jobs: readonly T[]): (T | Choice<RunJob>)[] {
  return isMarket(locationId) ? [TRADE_JOB] : jobs.filter((j) => j.id !== 'trade');
}

/** Whether a place is a market, for the Reach. */
export function marketAt(locationId: string): boolean {
  return findLocation(locationId)?.market === true;
}

/** The most the Depot can send of the goods this plan takes: what it can spare, and what the crew can carry. */
export function maxTrade(state: GameState, plan: RunPlan, give: ResourceId): number {
  return Math.max(0, Math.min(spareToTrade(state, plan, give), tradeCapacity(state, plan)));
}

/** The most of `get` the goods the crew can take would buy today. */
export function maxWant(state: GameState, plan: RunPlan, give: ResourceId, get: ResourceId): number {
  return marketQuote(state.market, { give, get, amount: maxTrade(state, plan, give) });
}

/**
 * Buy exactly so many (3.7.2; Aviel: "it's annoying that everything jumps by seemingly random numbers when
 * trading. I should be able to buy an exact amount of x and tell me the price in y. It should round up"):
 * the order names how many to buy, kept within what the crew can pay for, and its price, rounded up.
 */
function buying(state: GameState, plan: RunPlan, give: ResourceId, get: ResourceId, want: number): TradeOrder {
  const most = maxWant(state, plan, give, get);
  if (most < 1) return { give, get, amount: maxTrade(state, plan, give), want: 1 };
  const n = Math.max(1, Math.min(Math.round(want), most));
  return { give, get, want: n, amount: priceOf(state.market, give, get, n, maxTrade(state, plan, give)) };
}

/** What a new trade takes: the supply the Depot has most of to spare (by what it's worth), for scrap, or gas if it's scrap. */
export function defaultTrade(state: GameState, plan: RunPlan): TradeOrder {
  const worth = (r: ResourceId): number => spareToTrade(state, plan, r) * unitPrice(state.market, r).pays;
  // Rations first: they're what piles up (Aviel, 2026-11-23).
  const give = spareToTrade(state, plan, 'rations') >= 10 ? 'rations' : [...RESOURCE_IDS].sort((a, b) => worth(b) - worth(a))[0]!;
  const get: ResourceId = give === 'scrap' ? 'gas' : 'scrap';
  return buying(state, plan, give, get, roundDown(maxWant(state, plan, give, get)));
}

/** Down to a round 5 once there's more than 10, so the stepper's steps land on round numbers. */
function roundDown(n: number): number {
  return n > 10 ? n - (n % 5) : n;
}

/**
 * The plan as the market sees it: a Trade job with goods that fit the crew and what the Depot can spare
 * (the crew may have changed since the amount was picked), and what's bought kept first if anything has to be left.
 */
export function fitTrade(state: GameState, plan: RunPlan): RunPlan {
  if (!isMarket(plan.locationId)) return plan.job === 'trade' ? { ...plan, job: 'scavenge' } : plan;
  const t = plan.trade ?? defaultTrade(state, plan);
  // Nothing picked yet (or nothing could be, before there was a crew): as much as they can pay for.
  const want = t.want !== undefined && t.want > 0 ? t.want : roundDown(maxWant(state, plan, t.give, t.get));
  const { depth: _depth, ...rest } = plan;
  return { ...rest, job: 'trade', trade: buying(state, plan, t.give, t.get, want), lootPriority: t.get };
}

/** What to pay with; what's bought changes too if it would be the same thing. */
export function withGive(state: GameState, plan: RunPlan, give: ResourceId): RunPlan {
  const t = plan.trade ?? defaultTrade(state, plan);
  const get = t.get === give ? (give === 'scrap' ? 'gas' : 'scrap') : t.get;
  return fitTrade(state, { ...plan, trade: { give, get, amount: 0, want: t.want ?? 0 } });
}

/** What to buy; what pays for it changes too if it would be the same thing. */
export function withGet(state: GameState, plan: RunPlan, get: ResourceId): RunPlan {
  const t = plan.trade ?? defaultTrade(state, plan);
  const give = t.give === get ? (get === 'rations' ? 'scrap' : 'rations') : t.give;
  return fitTrade(state, { ...plan, trade: { give, get, amount: 0, want: t.want ?? 0 } });
}

/** How many to buy: exactly that many, within what the crew can pay for. */
export function withWant(state: GameState, plan: RunPlan, want: number): RunPlan {
  const t = plan.trade ?? defaultTrade(state, plan);
  return fitTrade(state, { ...plan, trade: { ...t, want: Math.max(1, want) } });
}

/** The supplies to buy, each with its price today. */
export function buyChoices(state: GameState): Choice<ResourceId>[] {
  return RESOURCE_IDS.map((id) => ({ id, name: RESOURCE_NAMES[id], description: priceLine(state, id) }));
}

/** What to pay with: anything but what's bought, each saying how many the Depot can spare. */
export function payChoices(state: GameState, plan: RunPlan, get: ResourceId): Choice<ResourceId>[] {
  return giveChoices(state, plan).filter((c) => c.id !== get);
}

/** The price, as pictures: what goes, and what comes back for it. */
export function tradeChips(plan: RunPlan): Chip[] {
  const t = plan.trade;
  if (!t || t.want === undefined || t.amount < 1) return [];
  return [
    { glyph: t.give, text: `−${t.amount}`, tone: 'bad', label: `Costs ${amountOf(t.give, t.amount)} at today’s prices, rounded up` },
    { glyph: 'arrow', text: '' },
    { glyph: t.get, text: `+${t.want}`, tone: 'good', label: `Buys ${amountOf(t.get, t.want)}` },
  ];
}

/** The supplies to take, each saying how many the Depot can spare. */
export function giveChoices(state: GameState, plan: RunPlan): Choice<ResourceId>[] {
  return RESOURCE_IDS.map((id) => {
    const spare = spareToTrade(state, plan, id);
    return { id, name: RESOURCE_NAMES[id], description: spare === 0 ? `The Depot has no ${id} to spare.` : `The Depot can spare ${amountOf(id, spare)}.` };
  });
}

/** The supplies to bring back: anything but what goes, each with its price today. */
export function getChoices(state: GameState, give: ResourceId): Choice<ResourceId>[] {
  return RESOURCE_IDS.filter((id) => id !== give).map((id) => ({ id, name: RESOURCE_NAMES[id], description: priceLine(state, id) }));
}

/** "15 scrap cost 54 rations at today's prices. A good haggler gets a little more." */
export function tradeLine(state: GameState, plan: RunPlan): string {
  const t = plan.trade;
  if (!t || t.amount < 1) return 'Nothing to take.';
  const loads = tradeCapacity(state, plan);
  const carry = `Packed with goods, ${plan.crew.length === 1 ? 'one person' : 'this crew'} can carry ${loads}.`;
  if (marketQuote(state.market, t) < 1) return `${amountOf(t.give, t.amount)} wouldn’t buy even one. ${carry}`;
  if (t.want !== undefined) return `${amountOf(t.get, t.want)} cost ${amountOf(t.give, t.amount)} at today’s prices; whoever talks best may get a little more. ${carry}`;
  return `${amountOf(t.give, t.amount)} fetch about ${amountOf(t.get, marketQuote(state.market, t))} at today’s prices; whoever talks best may get more. ${carry}`;
}

/** A supply's prices at the Drive-In today, for ten of it, in scrap: what ten fetch, and what ten cost. */
export interface PriceRow {
  id: ResourceId;
  name: string;
  /** Scrap the market gives for ten, at today's price. */
  sell: number;
  /** Scrap it takes for ten, at today's price. */
  buy: number;
  /** The guild has moved this price lately: sold a lot (cheap) or bought a lot (pricey). */
  trend?: 'cheap' | 'pricey';
}

function trendOf(state: GameState, r: ResourceId): PriceRow['trend'] {
  const glut = state.market?.glut[r] ?? 0;
  return glut > 0.05 ? 'cheap' : glut < -0.05 ? 'pricey' : undefined;
}

/** The Drive-In's prices for every supply but scrap, which everything is priced in. */
export function priceRows(state: GameState): PriceRow[] {
  return RESOURCE_IDS.filter((r) => r !== 'scrap').map((r) => {
    const trend = trendOf(state, r);
    return {
      id: r,
      name: RESOURCE_NAMES[r],
      // At today's price, before a trade that size moves it: the planner says what a whole load fetches.
      sell: Math.round((10 * unitPrice(state.market, r).pays) / unitPrice(state.market, 'scrap').asks),
      buy: Math.round((10 * unitPrice(state.market, r).asks) / unitPrice(state.market, 'scrap').pays),
      ...(trend ? { trend } : {}),
    };
  });
}

/** "Cheap lately: the guild has sold a lot here." */
export function trendText(trend: PriceRow['trend']): string {
  if (trend === 'cheap') return 'Cheap lately: the guild has sold a lot here.';
  if (trend === 'pricey') return 'Pricey lately: the guild has bought a lot here.';
  return '';
}

/** One supply's prices in a sentence, for the planner: "10 rations sell for 3 scrap here, and cost 7." */
export function priceLine(state: GameState, r: ResourceId): string {
  const trend = trendText(trendOf(state, r));
  if (r === 'scrap') return `Everything here is priced in scrap.${trend ? ` ${trend}` : ''}`;
  const row = priceRows(state).find((x) => x.id === r)!;
  return `10 ${r} sell for ${row.sell} scrap here, and cost ${row.buy}.${trend ? ` ${trend}` : ''}`;
}
