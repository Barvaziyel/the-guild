/**
 * Raids at the gate (§9.8). A Depot day may bring raiders: they arrive at a
 * set time, seen coming first if the Watchtower spots them. At the gate they
 * wait up to RAID_WAIT for the player, who can take command or let them
 * fight; after that, whoever was home fights them on their own. Only those who
 * were home and fit when the raiders arrived can defend: a crew that gets back
 * in the meantime stays out of it.
 */
import { addChronicle, addGuildLog } from '../chronicle.ts';
import { DAY_MS, RAID_ARRIVE_MINUTES, RAID_LOSS, RAID_WAIT, VEHICLE_THEFT_CHANCE, WATCH_LEAD_MINUTES, WATCH_SPOT_CHANCE, WATCH_SPOT_LOOKOUT } from '../constants.ts';
import { itemDef } from '../gear.ts';
import { dayAt } from '../game.ts';
import { newId } from '../ids.ts';
import { RAIDERS } from '../outposts.ts';
import { Rng } from '../rng.ts';
import { addPractice, changeStress } from '../stats.ts';
import { fullName } from '../text.ts';
import type { DepotRaid, GameState, Resources, RoundOrders, Survivor } from '../types.ts';
import { pairKey } from '../relationships.ts';
import { applyVultureNews, freeLieutenants, noteMember, vultureBoss, vultureMember } from '../vultures.ts';
import { vehicleName } from '../vehicles.ts';
import type { FightView } from '../expedition/command.ts';
import type { FightPlan } from '../expedition/context.ts';
import { playRaid, raidEnemies, raidPause } from '../expedition/raid.ts';
import { runStart } from '../expedition/sim.ts';
import { homecoming } from '../expedition/runs.ts';
import { atDepot, costText, workingAt, workingLevel } from './buildings.ts';
import { getTrait } from '../content/index.ts';
import { raidCap } from './events.ts';
import type { Rng as RngType } from '../rng.ts';

/** When game day `day` begins (as in time.ts, kept here to avoid a cycle). */
function dayStartOf(state: GameState, day: number): number {
  return state.createdAt + (day - 1) * DAY_MS;
}

/** The raid that hasn't ended: coming, or at the gate. */
export function openRaid(state: GameState): DepotRaid | undefined {
  const raid = state.depot.raid;
  return raid && raid.ended === undefined ? raid : undefined;
}

/** Raiders at the gate now: they've arrived, and it isn't over. */
export function raidAtGate(state: GameState): DepotRaid | undefined {
  const raid = openRaid(state);
  return raid?.defenders !== undefined ? raid : undefined;
}

/** Raiders seen on the road: spotted from the Watchtower, not here yet. */
export function raidSeen(state: GameState, now: number): DepotRaid | undefined {
  const raid = openRaid(state);
  return raid && raid.defenders === undefined && raid.seen !== undefined && raid.seen <= now ? raid : undefined;
}

/** "Raiders", or "The Vultures, led by Rook Harlan,". */
export function raidersName(state: GameState, raid: DepotRaid): { name: string; lower: string } {
  if (raid.by === 'raiders') return { name: RAIDERS.name, lower: RAIDERS.lower };
  const lead = raid.leadId ? vultureMember(state, raid.leadId) : undefined;
  return { name: lead ? `The Vultures, led by ${fullName(lead.person)},` : 'The Vultures', lower: 'the Vultures' };
}

/**
 * Raiders set out for the Depot on `day`: when they'll arrive, and whether the
 * Watchtower sees them coming (more likely the higher it is, and with lookouts
 * on it; the higher, the sooner). Nothing if a raid is already under way.
 */
export function scheduleRaid(state: GameState, day: number, rng: RngType, by: 'raiders' | 'vultures'): DepotRaid | undefined {
  if (openRaid(state)) return undefined;
  const start = dayStartOf(state, day);
  const arrive = start + rng.int(RAID_ARRIVE_MINUTES[0], RAID_ARRIVE_MINUTES[1]) * 60_000;
  const tower = workingLevel(state, 'watchtower');
  const lookouts = tower > 0 ? workingAt(state, 'watchtower').length : 0;
  const chance = tower > 0 ? Math.min(0.95, (WATCH_SPOT_CHANCE[tower] ?? WATCH_SPOT_CHANCE[3]) + lookouts * WATCH_SPOT_LOOKOUT) : 0;
  const spotted = tower > 0 && rng.chance(chance);
  const id = newId(state, 'raid');
  const raid: DepotRaid = {
    id,
    by,
    seed: `${state.seed}:${id}`,
    day,
    arrive,
    until: arrive + RAID_WAIT,
    ...(spotted ? { seen: Math.max(start, arrive - (WATCH_LEAD_MINUTES[tower] ?? WATCH_LEAD_MINUTES[3]) * 60_000) } : {}),
  };
  if (by === 'vultures') {
    // Led by one of their lieutenants, or the boss with none left.
    const lead = rng.shuffle([...freeLieutenants(state)])[0] ?? vultureBoss(state);
    if (lead) {
      raid.leadId = lead.person.id;
      lead.met = true;
      noteMember(lead, day, 'Led a raid on the guild’s Depot.');
    }
  }
  state.depot.raid = raid;
  return raid;
}

/** The next moment the raid moves on: its arrival, or the end of its wait. */
export function nextRaidMoment(state: GameState): number | undefined {
  const raid = openRaid(state);
  if (!raid) return undefined;
  return raid.defenders === undefined ? raid.arrive : raid.until;
}

/** Bring the raid up to `at`: the raiders arrive, or their wait runs out and the defenders fight on their own. */
export function stepRaid(state: GameState, at: number): void {
  const raid = openRaid(state);
  if (!raid) return;
  if (raid.defenders === undefined) {
    if (raid.arrive <= at) arrive(state, raid);
    return;
  }
  if (raid.until <= at) letRaidFight(state, raid.until);
}

/** At the gate: who is home and fit to fight is fixed now; with nobody, they walk in. */
function arrive(state: GameState, raid: DepotRaid): void {
  raid.defenders = state.survivors.filter(canDefend).map((s) => s.id);
  raid.enemies = raidEnemies(state, raid, raid.defenders.length);
  if (raid.defenders.length === 0) finish(state, raid, raid.arrive, undefined);
}

/** Home and fit to hold the gate: anyone not laid up (tired from a run is fine). */
export function canDefend(s: Survivor): boolean {
  return atDepot(s) && s.traits.every((t) => !getTrait(t.id).blocksRuns || getTrait(t.id).stillDefends === true);
}

/** Those who fight: the defenders still home and fit. */
function fighters(state: GameState, raid: DepotRaid): Survivor[] {
  const ids = new Set(raid.defenders ?? []);
  return state.survivors.filter((s) => ids.has(s.id) && canDefend(s));
}

/** The fight begins: those who fight are copied as they are, with the Depot's meds and ammo for them. */
function begin(state: GameState, raid: DepotRaid): boolean {
  if (raid.start) return true;
  const crew = fighters(state, raid);
  if (crew.length === 0) return false;
  // A copy without the raid itself in it.
  const shell = structuredClone(runStart(state, { locationId: 'depot', crew: crew.map((s) => s.id), job: 'scout', meds: 0, ammo: 0, approach: 'balanced', retreat: 'never' }));
  delete shell.depot.raid;
  raid.start = shell;
  raid.marks = Object.fromEntries(crew.map((s) => [s.id, { traits: s.traits.map((t) => t.id), stress: s.stress, chronicle: s.chronicle.length }]));
  // Lookouts with a gun go up the Watchtower and shoot from there.
  const tower = workingLevel(state, 'watchtower');
  const lookouts = tower > 0 ? workingAt(state, 'watchtower') : [];
  raid.perch = lookouts.filter((s) => crew.includes(s) && s.equipment.weapon && itemDef(s.equipment.weapon).weaponType === 'ranged').map((s) => s.id);
  raid.meds = state.resources.meds;
  raid.ammo = state.resources.ammo;
  return true;
}

function livePlan(raid: DepotRaid): FightPlan {
  return { rounds: raid.rounds ?? [], live: true, delay: 0 };
}

/** The player takes command at the gate. Returns the fight as it stands, or undefined if it's already over. */
export function takeRaidCommand(state: GameState, now: number): FightView | undefined {
  const raid = raidAtGate(state);
  if (!raid) throw new Error('There are no raiders at the gate.');
  if (raid.took !== undefined) throw new Error('You are in command already.');
  if (now >= raid.until) throw new Error('It’s too late: they’re fighting it out.');
  if (!begin(state, raid)) {
    finish(state, raid, now, undefined);
    return undefined;
  }
  raid.took = now;
  raid.rounds = [];
  const view = raidPause(state, raid, livePlan(raid));
  if (!view) finish(state, raid, now, { rounds: [], live: false, delay: 0 });
  return view;
}

/** The fight at the gate as it stands for the next orders, if the player is in command. */
export function raidFightNow(state: GameState, now: number): FightView | undefined {
  const raid = raidAtGate(state);
  if (!raid || raid.took === undefined || now >= raid.until) return undefined;
  return raidPause(state, raid, livePlan(raid));
}

/** The fight at the gate before anyone takes command: who's up against whom. Changes nothing. */
export function raidPreview(state: GameState, now: number): FightView | undefined {
  const raid = raidAtGate(state);
  if (!raid || now >= raid.until) return undefined;
  if (raid.took !== undefined) return raidFightNow(state, now);
  const copy = structuredClone(raid);
  if (!begin(structuredClone(state), copy)) return undefined;
  return raidPause(state, copy, { rounds: [], live: true, delay: 0 });
}

/** One round of orders at the gate. Returns the fight for the next round, or undefined once it's over. */
export function commandRaidRound(state: GameState, orders: RoundOrders, now: number): FightView | undefined {
  const raid = raidAtGate(state);
  if (!raid || raid.took === undefined) throw new Error('You are not in command at the gate.');
  if (now >= raid.until) throw new Error('It’s too late: they’re fighting it out.');
  raid.rounds = [...(raid.rounds ?? []), orders];
  const view = raidPause(state, raid, livePlan(raid));
  if (!view) finish(state, raid, now, { rounds: raid.rounds, live: false, delay: 0 });
  return view;
}

/** Let them fight it out on their own: with no orders, or the rest of a fight under command. */
export function letRaidFight(state: GameState, now: number): void {
  const raid = raidAtGate(state);
  if (!raid) return;
  if (!begin(state, raid)) {
    finish(state, raid, now, undefined);
    return;
  }
  finish(state, raid, now, raid.took !== undefined ? { rounds: raid.rounds ?? [], live: false, delay: 0 } : undefined);
}

/** The last raid as it ended, for the screen after it: the fight under command, or undefined. */
export function lastRaidFight(state: GameState): FightView | undefined {
  const raid = state.depot.raid;
  if (!raid || raid.ended === undefined || raid.took === undefined || !raid.start) return undefined;
  return playRaid(state, raid, { rounds: raid.rounds ?? [], live: false, delay: 0 }).view;
}

/**
 * The raid is over. With a fight, its outcome comes home to the real
 * defenders (hurt, tired, practiced; what changed at the Depot meanwhile is
 * kept) and the Depot pays for the ammo and meds used. Held: driven off.
 * Broken: they take a share of the stores, maybe a vehicle, and everyone home
 * is shaken.
 */
function finish(state: GameState, raid: DepotRaid, at: number, plan: FightPlan | undefined): void {
  const day = dayAt(state, at);
  const rng = new Rng(`raid-after:${raid.seed}`);
  const { name, lower } = raidersName(state, raid);
  let held = false;
  const fought: Survivor[] = [];
  if (raid.start) {
    const result = playRaid(state, raid, plan);
    held = result.end === 'won' || result.end === 'stalemate';
    for (const m of result.sim.members) {
      const i = state.survivors.findIndex((s) => s.id === m.s.id);
      if (i < 0) continue;
      const merged = homecoming(state.survivors[i]!, m.s, raid.marks?.[m.s.id]);
      state.survivors[i] = merged;
      fought.push(merged);
    }
    for (const rel of Object.values(result.sim.state.relationships)) state.relationships[pairKey(rel.a, rel.b)] = rel;
    const used = (have: number | undefined, left: number): number => Math.max(0, (have ?? 0) - left);
    state.resources.ammo = Math.max(0, state.resources.ammo - used(raid.ammo, result.sim.ammo));
    state.resources.meds = Math.max(0, state.resources.meds - used(raid.meds, result.sim.meds));
    if (result.sim.vultures) applyVultureNews(state, result.sim.vultures.news, day, rng);
  }
  const names = fought.map((s) => s.firstName);
  const led = raid.took !== undefined ? ' under your command' : '';
  if (held) {
    for (const s of fought) {
      addPractice(s, 'aim', 2, day);
      addChronicle(s, day, `Held the gate against ${lower}.`, ['raid']);
    }
    addGuildLog(state, day, `${name} came for the Depot. ${listNames(names)} drove them off${led}.`, ['raid']);
  } else {
    for (const s of fought) addChronicle(s, day, `Fought ${lower} at the gate, and couldn’t keep them out.`, ['raid']);
    breakIn(state, raid, day, rng, name, fought.length);
  }
  raid.ended = at;
  raid.end = held ? 'held' : 'broken';
}

/** Raiders inside: a share of the stores (less with a Watchtower, more with few or nobody home), maybe a vehicle, and a fright for all. */
function breakIn(state: GameState, raid: DepotRaid, day: number, rng: Rng, name: string, defenders: number): void {
  const tower = workingLevel(state, 'watchtower');
  const share = RAID_LOSS * (tower > 0 ? 0.5 : 1) * (defenders === 0 ? 1.5 : defenders === 1 ? 1.25 : 1);
  const taken: Partial<Resources> = {};
  for (const r of ['scrap', 'rations', 'ammo', 'gas'] as const) {
    const n = Math.min(raidCap(state.resources[r]), Math.floor(state.resources[r] * share));
    if (n > 0) {
      state.resources[r] -= n;
      taken[r] = n;
    }
  }
  for (const s of state.survivors.filter(atDepot)) changeStress(s, 10, { rng, day, source: 'a raid' });
  const parked = state.vehicles.filter((v) => !v.runId);
  const theft = VEHICLE_THEFT_CHANCE * (tower > 0 ? 0.5 : 1) * (defenders === 0 ? 1.5 : 1);
  const stolen = parked.length > 0 && rng.chance(theft) ? rng.pick(parked) : undefined;
  if (stolen) state.vehicles = state.vehicles.filter((v) => v !== stolen);
  const lost = Object.keys(taken).length > 0 ? ` They got away with ${costText(taken)}.` : '';
  const drove = stolen ? ` They drove off in the ${vehicleName(stolen)}.` : '';
  const nobody = defenders === 0 ? ' Nobody was home to stop them.' : '';
  addGuildLog(state, day, `${name} broke into the Depot.${nobody}${lost}${drove}`, ['raid', raid.id]);
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'Someone';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
