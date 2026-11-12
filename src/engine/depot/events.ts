/**
 * Things that happen at the Depot: visitors, raids, fights, parties, fevers
 * and strays. At most one event a day, plus fights between feuding survivors.
 */
import { addChronicle, addGuildLog } from '../chronicle.ts';
import {
  DEPOT_EVENT_CHANCE,
  DC,
  FEUD_FIGHT_CHANCE,
  RAID_DC,
  RAID_EMPTY_WEIGHT,
  RAID_FULL_FENCE,
  RAID_LOSS,
  RAID_MAX_TAKE,
  RAID_TAKE_FREE,
  RAID_TAKE_OVER,
  TRADER_BUYS,
  TRADER_BUY_CHANCE,
  TRADER_BUY_KEEP,
  TRADER_BUY_KEEP_RATION_DAYS,
  RAID_THIN_PENALTY,
  REL_ARGUMENT,
  TRADER_VEHICLE_CHANCE,
  TRADE_MAX_GIVE,
  TRADE_SHARE_MAX,
  TRADE_SHARE_MIN,
  TRADE_DAYS,
  VEHICLE_THEFT_CHANCE,
  WATCHTOWER_DEFENSE,
} from '../constants.ts';
import { GEAR, VEHICLES } from '../content/index.ts';
import { createVehicle, vehicleName } from '../vehicles.ts';
import { createItem, itemName } from '../gear.ts';
import { newId } from '../ids.ts';
import { adjustRelationship, relationshipLabel } from '../relationships.ts';
import type { Rng } from '../rng.ts';
import { addPractice, changeStress, checkBonus, effectiveStat, rollCheck } from '../stats.ts';
import { fullName } from '../text.ts';
import { addTrait, anyTraitHook } from '../traits.ts';
import type { GameState, ResourceId, Resources, Survivor, TradeOffer } from '../types.ts';
import { guildUpkeep } from './day.ts';
import { RESOURCE_IDS } from '../types.ts';
import { atDepot, buildingLevel, canWork, workingLevel, canAfford, costText, payCost, workingAt } from './buildings.ts';
import { addWanderer } from './recruits.ts';
import { wallDefense } from '../projects.ts';
import { dogDefense, strayArrives } from '../animals.ts';

type EventKind = 'wanderer' | 'trader' | 'raid' | 'celebration' | 'sickness' | 'stray';

const EVENT_WEIGHTS: Record<EventKind, number> = {
  wanderer: 3,
  trader: 3,
  raid: 2,
  celebration: 2,
  sickness: 2,
  stray: 2,
};

/** Roll the day's events. Returns what happened, for tests. */
export function rollDepotEvents(state: GameState, day: number, rng: Rng): EventKind[] {
  const happened: EventKind[] = [];
  feudFights(state, day, rng);
  if (!rng.chance(DEPOT_EVENT_CHANCE)) return happened;
  const home = state.survivors.filter(atDepot);
  const options = (Object.keys(EVENT_WEIGHTS) as EventKind[]).filter((k) => {
    if (k === 'celebration') return home.length >= 2 && state.resources.rations >= home.length * 2;
    if (k === 'sickness' || k === 'stray') return home.length > 0;
    return true;
  });
  // Raiders watch the Depot: an empty one draws them.
  const weight = (k: EventKind): number => EVENT_WEIGHTS[k] * (k === 'raid' && home.filter(canWork).length <= 1 ? RAID_EMPTY_WEIGHT : 1);
  const kind = rng.weightedBy(options, weight);
  HANDLERS[kind](state, day, rng, home);
  happened.push(kind);
  return happened;
}

const HANDLERS: Record<EventKind, (state: GameState, day: number, rng: Rng, home: Survivor[]) => void> = {
  wanderer(state, day, rng) {
    const c = addWanderer(state, day, rng);
    addGuildLog(state, day, `${fullName(c.survivor)} came to the gate looking for a place to stay.`, ['recruit', c.survivor.id]);
  },

  trader(state, day, rng) {
    const offer = makeOffer(state, day, rng);
    state.depot.offers.push(offer);
    addGuildLog(state, day, `A trader caravan stopped at the gate: ${offerText(offer)}.`, ['trade', offer.id]);
  },

  raid(state, day, rng) {
    raid(state, day, rng);
  },

  celebration(state, day, rng, home) {
    const cost = Math.ceil(home.length / 2);
    state.resources.rations -= cost;
    for (const s of home) changeStress(s, -15, { rng, day });
    for (let i = 0; i < home.length; i++) {
      for (let j = i + 1; j < home.length; j++) adjustRelationship(state, home[i]!.id, home[j]!.id, 3, { day, everyday: true });
    }
    addGuildLog(state, day, `The guild threw a party in the old ticket hall. It cost ${cost} rations and was worth every one.`, ['party']);
  },

  sickness(state, day, rng, home) {
    const s = rng.pick(home);
    addTrait(s, 'feverish', { day, rng, source: 'something going round the Depot' });
    addGuildLog(state, day, `${s.firstName} came down with a fever.`, ['sickness', s.id]);
  },

  stray(state, day, rng, home) {
    // A kind the guild doesn't keep waits at the gate to be kept (§9.7); with one of each, it moves on.
    if (strayArrives(state, day, rng)) return;
    const friend = home.find((s) => anyTraitHook(s, 'likesAnimals'));
    if (friend) {
      changeStress(friend, -10, { rng, day });
      addChronicle(friend, day, 'Fed a stray dog at the Depot gate.', ['animal']);
      addGuildLog(state, day, `A stray dog turned up at the gate. ${friend.firstName} fed it.`, ['animal']);
    } else {
      addGuildLog(state, day, 'A stray dog nosed around the fence and moved on.', ['animal']);
    }
  },
};

/**
 * What the fence is worth against raiders: the best shot at home, the
 * Watchtower and its lookouts, less a penalty for each hand short of three.
 */
export function raidDefense(state: GameState): number {
  const defenders = state.survivors.filter(canWork);
  const tower = workingLevel(state, 'watchtower');
  const lookouts = tower > 0 ? workingAt(state, 'watchtower') : [];
  const best = Math.max(0, ...defenders.map((s) => effectiveStat(s, 'aim')));
  const thin = Math.max(0, RAID_FULL_FENCE - defenders.length) * RAID_THIN_PENALTY;
  return best + tower * WATCHTOWER_DEFENSE + lookouts.length - thin + wallDefense(state) + dogDefense(state);
}

/** Raiders come for the Depot. Returns whether they broke in. */
export function raid(state: GameState, day: number, rng: Rng): boolean {
  const home = state.survivors.filter(atDepot);
  const defenders = home.filter(canWork);
  const tower = workingLevel(state, 'watchtower');
  const roll = rollCheck(rng, raidDefense(state), RAID_DC);
  const names = defenders.slice(0, 3).map((s) => s.firstName);

  if (defenders.length > 0 && roll.success) {
    for (const s of defenders) {
      addPractice(s, 'aim', 2, day);
      changeStress(s, 5, { rng, day, source: 'a raid' });
    }
    addGuildLog(state, day, `Raiders came for the Depot. ${listNames(names)} drove them off.`, ['raid']);
    return false;
  }

  const share = RAID_LOSS * (tower > 0 ? 0.5 : 1) * (defenders.length === 0 ? 1.5 : defenders.length === 1 ? 1.25 : 1);
  const taken: Partial<Resources> = {};
  for (const r of ['scrap', 'rations', 'ammo', 'gas'] as const) {
    const n = Math.min(raidCap(state.resources[r]), Math.floor(state.resources[r] * share));
    if (n > 0) {
      state.resources[r] -= n;
      taken[r] = n;
    }
  }
  for (const s of home) changeStress(s, 10, { rng, day, source: 'a raid' });
  const hurt = defenders.length > 0 ? rng.pick(defenders) : undefined;
  if (hurt) {
    addTrait(hurt, 'wounded', { day, rng, source: 'defending the Depot from raiders' });
    addChronicle(hurt, day, 'Hurt holding the fence against raiders.', ['raid']);
  }
  const lost = Object.keys(taken).length > 0 ? ` They got away with ${costText(taken)}.` : '';
  const warned = tower > 0 ? ' The Watchtower saw them coming, which saved the rest.' : '';
  // A vehicle at home is the best prize of all.
  const parked = state.vehicles.filter((v) => !v.runId);
  const theft = VEHICLE_THEFT_CHANCE * (tower > 0 ? 0.5 : 1) * (defenders.length === 0 ? 1.5 : 1);
  const stolen = parked.length > 0 && rng.chance(theft) ? rng.pick(parked) : undefined;
  if (stolen) state.vehicles = state.vehicles.filter((v) => v !== stolen);
  const drove = stolen ? ` They drove off in the ${vehicleName(stolen)}.` : '';
  addGuildLog(state, day, `Raiders broke into the Depot.${lost}${drove}${hurt ? ` ${hurt.firstName} was hurt.` : ''}${warned}`, ['raid']);
  return true;
}

/** Feuding survivors at the Depot sometimes come to blows. */
function feudFights(state: GameState, day: number, rng: Rng): void {
  const home = state.survivors.filter(atDepot);
  for (let i = 0; i < home.length; i++) {
    for (let j = i + 1; j < home.length; j++) {
      const a = home[i]!;
      const b = home[j]!;
      if (relationshipLabel(state, a.id, b.id) !== 'feud' || !rng.chance(FEUD_FIGHT_CHANCE)) continue;
      const aRoll = rollCheck(rng, checkBonus(a, 'brawn'), DC.normal).total;
      const bRoll = rollCheck(rng, checkBonus(b, 'brawn'), DC.normal).total;
      const loser = aRoll >= bRoll ? b : a;
      const winner = loser === a ? b : a;
      addTrait(loser, 'wounded', { day, rng, source: `a fight with ${winner.firstName}` });
      for (const s of [a, b]) changeStress(s, 10, { rng, day, source: 'a fight' });
      adjustRelationship(state, a.id, b.id, REL_ARGUMENT, { day });
      addChronicle(winner, day, `Came to blows with ${fullName(loser)} at the Depot, and came off better.`, ['fight', loser.id]);
      addChronicle(loser, day, `Came to blows with ${fullName(winner)} at the Depot, and came off worse.`, ['fight', winner.id]);
      addGuildLog(state, day, `${a.firstName} and ${b.firstName} came to blows. ${loser.firstName} came off worse.`, ['fight']);
    }
  }
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'Someone';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The most raiders can carry off of one supply: more from a bigger pile (1.6.2). */
export function raidCap(stored: number): number {
  return RAID_MAX_TAKE + Math.floor(RAID_TAKE_OVER * Math.max(0, stored - RAID_TAKE_FREE));
}

// ---------------------------------------------------------------- traders

/** How much of a supply is spare for a trader to buy: what's left after keeping some back. */
export function spare(state: GameState, r: ResourceId): number {
  const keep = r === 'rations' ? Math.max(TRADER_BUY_KEEP, TRADER_BUY_KEEP_RATION_DAYS * guildUpkeep(state)) : TRADER_BUY_KEEP;
  return Math.max(0, state.resources[r] - keep);
}

/**
 * A caravan offering to buy what the guild has too much of, for scrap
 * (1.6.2): the supply with the most spare, up to about a third of the spare.
 */
function buyOffer(state: GameState, id: string, expiresDay: number, rng: Rng): TradeOffer | undefined {
  const options = (Object.keys(TRADER_BUYS) as ResourceId[]).map((r) => ({ r, spare: spare(state, r) })).filter((o) => o.spare >= 10);
  if (options.length === 0) return undefined;
  const { r, spare: extra } = rng.weightedBy(options, (o) => o.spare * TRADER_BUYS[o.r]!);
  const give = Math.max(10, Math.round(extra * (0.2 + rng.next() * 0.2)));
  const get = Math.max(1, Math.round(give * TRADER_BUYS[r]! * (0.85 + rng.next() * 0.3)));
  return { id, give: { [r]: give }, get: { scrap: get }, expiresDay };
}

/** A caravan's offer: a swap of supplies, or a piece of gear for scrap and tech. */
export function makeOffer(state: GameState, day: number, rng: Rng): TradeOffer {
  const id = newId(state, 'o');
  const expiresDay = day + TRADE_DAYS;
  if (rng.chance(TRADER_VEHICLE_CHANCE)) {
    // Now and then, wheels: the trader's own spare, with some miles on it.
    const def = rng.weightedBy(VEHICLES, (d) => d.findWeight);
    const vehicle = createVehicle(state, def.id, rng.int(45, 80));
    const scale = 0.85 + rng.next() * 0.3;
    const give: Partial<Resources> = {};
    for (const r of RESOURCE_IDS) if (def.price[r]) give[r] = Math.round(def.price[r]! * scale);
    return { id, give, get: {}, vehicle, expiresDay };
  }
  if (rng.chance(TRADER_BUY_CHANCE)) {
    const buying = buyOffer(state, id, expiresDay, rng);
    if (buying) return buying;
  }
  if (rng.chance(0.35)) {
    const gear = rng.weightedBy(
      GEAR.filter((g) => !g.consumable),
      (g) => g.lootWeight,
    );
    const quality = rng.chance(0.3) ? 'prime' : 'solid';
    const item = createItem(state, gear.id, quality);
    const price = rng.int(15, 25) + (quality === 'prime' ? 15 : 0);
    const tech = gear.slot === 'weapon' && gear.weaponType === 'ranged' ? rng.int(2, 5) : 0;
    return { id, give: tech > 0 ? { scrap: price, tech } : { scrap: price }, get: {}, item, expiresDay };
  }
  const swaps: { give: ResourceId; get: ResourceId; rate: number }[] = [
    { give: 'scrap', get: 'rations', rate: 1.5 },
    { give: 'scrap', get: 'meds', rate: 0.4 },
    { give: 'scrap', get: 'ammo', rate: 1.5 },
    { give: 'scrap', get: 'tech', rate: 0.25 },
    { give: 'rations', get: 'scrap', rate: 0.8 },
    { give: 'ammo', get: 'meds', rate: 0.3 },
    { give: 'scrap', get: 'gas', rate: 0.5 },
    { give: 'ammo', get: 'gas', rate: 0.6 },
  ];
  const swap = rng.pick(swaps);
  // A caravan deals in what the guild can spare: 8-20 to a new guild, up to an eighth of a big stockpile (1.7.2).
  const share = Math.round(state.resources[swap.give] * (TRADE_SHARE_MIN + rng.next() * (TRADE_SHARE_MAX - TRADE_SHARE_MIN)));
  const give = Math.max(rng.int(8, 20), Math.min(TRADE_MAX_GIVE, share));
  const get = Math.max(1, Math.round(give * swap.rate * (0.8 + rng.next() * 0.4)));
  return { id, give: { [swap.give]: give }, get: { [swap.get]: get }, expiresDay };
}

/** "20 scrap for 30 rations", "18 scrap for a Solid Machete". */
export function offerText(offer: TradeOffer): string {
  const wheels = offer.vehicle ? `a ${vehicleName(offer.vehicle)} in fair shape (${offer.vehicle.condition}%)` : '';
  const get = [costText(offer.get), offer.item ? `a ${itemName(offer.item)}` : '', wheels].filter((x) => x && x !== 'nothing').join(' and ');
  return `${costText(offer.give)} for ${get}`;
}

export function offerProblem(state: GameState, offerId: string): string | undefined {
  const offer = state.depot.offers.find((o) => o.id === offerId);
  if (!offer) return 'The caravan has moved on.';
  if (!canAfford(state, offer.give)) return `Needs ${costText(offer.give)}.`;
  return undefined;
}

/** Make the trade. Throws if it can't be done. */
export function acceptOffer(state: GameState, offerId: string, day: number): void {
  const problem = offerProblem(state, offerId);
  if (problem) throw new Error(problem);
  const index = state.depot.offers.findIndex((o) => o.id === offerId);
  const [offer] = state.depot.offers.splice(index, 1);
  payCost(state, offer!.give);
  for (const r of RESOURCE_IDS) state.resources[r] += offer!.get[r] ?? 0;
  if (offer!.item) state.stash.push(offer!.item);
  if (offer!.vehicle) state.vehicles.push(offer!.vehicle);
  addGuildLog(state, day, `Traded with the caravan: ${offerText(offer!)}.`, ['trade']);
}

/** Send a caravan on its way. */
export function declineOffer(state: GameState, offerId: string): void {
  state.depot.offers = state.depot.offers.filter((o) => o.id !== offerId);
}

/** Caravans leave when their time is up. */
export function expireOffers(state: GameState, day: number): void {
  state.depot.offers = state.depot.offers.filter((o) => o.expiresDay > day);
}
