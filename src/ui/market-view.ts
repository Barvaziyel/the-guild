/**
 * The market at the Drive-In on screen (§7.14, 3.4.0): the Trade job in the
 * planner, what the goods fetch, and the prices on the place's panel.
 */
import {
  RESOURCE_IDS,
  amountOf,
  findLocation,
  isMarket,
  marketQuote,
  spareToTrade,
  tradeCapacity,
  unitPrice,
  type GameState,
  type ResourceId,
  type RunJob,
  type RunPlan,
  type TradeOrder,
} from '../engine/index.ts';
import type { Choice } from './runs-view.ts';
import { RESOURCE_NAMES } from './view.ts';

export const TRADE_JOB: Choice<RunJob> = {
  id: 'trade',
  name: 'Trade',
  description: 'Take goods to the market and bring back something else. The packs hold three times as much when they’re full of nothing but goods.',
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

/** What a new trade takes: the supply the Depot has most of to spare (by what it's worth), for scrap, or gas if it's scrap. */
export function defaultTrade(state: GameState, plan: RunPlan): TradeOrder {
  const worth = (r: ResourceId): number => spareToTrade(state, plan, r) * unitPrice(state.market, r).pays;
  // Rations first: they're what piles up (Aviel, 2026-11-23).
  const give = spareToTrade(state, plan, 'rations') >= 10 ? 'rations' : [...RESOURCE_IDS].sort((a, b) => worth(b) - worth(a))[0]!;
  const get: ResourceId = give === 'scrap' ? 'gas' : 'scrap';
  return { give, get, amount: roundDown(maxTrade(state, plan, give)) };
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
  // Nothing picked yet (or nothing could be, before there was a crew): as much as they can take.
  const amount = t.amount > 0 ? Math.max(0, Math.min(t.amount, maxTrade(state, plan, t.give))) : roundDown(maxTrade(state, plan, t.give));
  const { depth: _depth, ...rest } = plan;
  return { ...rest, job: 'trade', trade: { give: t.give, get: t.get, amount }, lootPriority: t.get };
}

/** Pick what to take; what comes back changes too if it would be the same thing. */
export function withGive(state: GameState, plan: RunPlan, give: ResourceId): RunPlan {
  const t = plan.trade ?? defaultTrade(state, plan);
  const get = t.get === give ? (give === 'scrap' ? 'gas' : 'scrap') : t.get;
  return fitTrade(state, { ...plan, trade: { give, get, amount: roundDown(maxTrade(state, plan, give)) } });
}

export function withGet(state: GameState, plan: RunPlan, get: ResourceId): RunPlan {
  const t = plan.trade ?? defaultTrade(state, plan);
  return fitTrade(state, { ...plan, trade: { ...t, get } });
}

export function withAmount(state: GameState, plan: RunPlan, amount: number): RunPlan {
  const t = plan.trade ?? defaultTrade(state, plan);
  return fitTrade(state, { ...plan, trade: { ...t, amount } });
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

/** "54 rations fetch about 15 scrap at today's prices. A good haggler gets more." */
export function tradeLine(state: GameState, plan: RunPlan): string {
  const t = plan.trade;
  if (!t || t.amount < 1) return 'Nothing to take.';
  const got = marketQuote(state.market, t);
  const loads = tradeCapacity(state, plan);
  const carry = `Packed with goods, ${plan.crew.length === 1 ? 'one person' : 'this crew'} can carry ${loads}.`;
  if (got < 1) return `${amountOf(t.give, t.amount)} wouldn’t fetch even one. ${carry}`;
  return `${amountOf(t.give, t.amount)} fetch about ${amountOf(t.get, got)} at today’s prices; whoever talks best may get more. ${carry}`;
}

function num(x: number): string {
  return x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10);
}

/**
 * A supply's prices today, in scrap: "Rations: 3 fetch a scrap, and a scrap buys 2." or
 * "Tech: sells for 2.2 scrap, costs 4.1." With a note when the guild has moved the price.
 */
export function priceLine(state: GameState, r: ResourceId): string {
  if (r === 'scrap') return `Everything here is priced in scrap.${moved(state, 'scrap')}`;
  const scrap = unitPrice(state.market, 'scrap');
  const p = unitPrice(state.market, r);
  // Selling one fetches this much scrap; buying one costs this much.
  const sell = p.pays / scrap.asks;
  const buy = p.asks / scrap.pays;
  const sold = sell >= 0.75 ? `sells for ${num(sell)} scrap` : `${num(1 / sell)} fetch a scrap`;
  const bought = buy >= 0.75 ? `costs ${num(buy)}` : `a scrap buys ${num(1 / buy)}`;
  return `${RESOURCE_NAMES[r]}: ${sold}, and ${bought}.${moved(state, r)}`;
}

function moved(state: GameState, r: ResourceId): string {
  const glut = state.market?.glut[r] ?? 0;
  if (glut > 0.05) return ' Cheap lately: the guild has sold a lot here.';
  if (glut < -0.05) return ' Dear lately: the guild has bought a lot here.';
  return '';
}

/** Every supply's prices today, for the market's panel on the Reach. */
export function priceLines(state: GameState): string[] {
  return RESOURCE_IDS.filter((r) => r !== 'scrap').map((r) => priceLine(state, r));
}
