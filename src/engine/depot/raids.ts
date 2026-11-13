/**
 * Raids at the gate (§9.8). A Depot day may bring raiders: they arrive at a
 * set time, seen coming first if the Watchtower spots them. At the gate they
 * wait up to RAID_WAIT for the player, who can take command or let them
 * fight; after that, whoever was home fights them on their own. Only those who
 * were home and fit when the raiders arrived can defend: a crew that gets back
 * in the meantime stays out of it.
 */
import { addChronicle, addGuildLog } from '../chronicle.ts';
import {
  DAY_MS,
  PRACTICE_HARD,
  RAID_ARRIVE_MINUTES,
  RAID_HIDDEN_SHARE,
  RAID_LOSS,
  RAID_SHORE_COST,
  RAID_STARE_DC,
  RAID_STARE_VULTURES,
  RAID_TOLL_PER_RAIDER,
  RAID_TOLL_SHARE,
  RAID_WAIT,
  RAID_WAVE_CHANCE,
  VEHICLE_THEFT_CHANCE,
  VULTURES_TAKEN_STRENGTH,
  VULTURES_TOLL_STANDING,
  WATCH_LEAD_MINUTES,
  WATCH_SPOT_CHANCE,
  WATCH_SPOT_LOOKOUT,
} from '../constants.ts';
import { itemDef } from '../gear.ts';
import { dayAt } from '../game.ts';
import { newId } from '../ids.ts';
import { RAIDERS } from '../outposts.ts';
import { Rng } from '../rng.ts';
import { addPractice, changeStress, checkBonus, enemyContexts, maxHp, rollCheck } from '../stats.ts';
import { fullName } from '../text.ts';
import type { DepotRaid, GameState, LogLine, Resources, RoundOrders, Survivor } from '../types.ts';
import { pairKey } from '../relationships.ts';
import { applyVultureNews, freeLieutenants, noteMember, vultureBoss, vultureMember } from '../vultures.ts';
import { vehicleName } from '../vehicles.ts';
import { FightPause, type FightView } from '../expedition/command.ts';
import { playRaid, raidEnemies, raidPause, withinReach } from '../expedition/raid.ts';
import { runStart } from '../expedition/sim.ts';
import { homecoming, recallReplay, storeRecall } from '../expedition/runs.ts';
import { atDepot, canAfford, canWork, costText, payCost, workingAt, workingLevel } from './buildings.ts';
import { getEnemy } from '../content/index.ts';
import { describeGroup, newEnemy } from '../expedition/combat.ts';
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

/** Who's at the gate: "two Raider Scavs and a Raider Gunner", "Rook Harlan, two Vultures and a Vulture Shot". */
export function raidAgainst(state: GameState, raid: DepotRaid): string {
  const leader = raid.leadId ? vultureMember(state, raid.leadId) : undefined;
  const enemies = (raid.enemies ?? []).map((id, i) => {
    const e = newEnemy(getEnemy(id), 1);
    if (i === 0 && id === 'vulture_lieutenant' && leader) e.vulture = { id: leader.person.id, name: fullName(leader.person) };
    return e;
  });
  return describeGroup(enemies);
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
  // Some come in two bands (their own dice, so the day's don't change).
  if (new Rng(`raid-waves:${raid.seed}`).chance(RAID_WAVE_CHANCE)) raid.waves = 2;
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
  if (raid.waves === 2) raid.enemies2 = raidEnemies(state, raid, raid.defenders.length, 2);
  if (raid.defenders.length === 0) finish(state, raid, raid.arrive);
}

/** Home and fit to hold the gate: anyone who can work (tired from a run is fine). */
export function canDefend(s: Survivor): boolean {
  return canWork(s);
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

/**
 * The fight goes on: the next round's orders are wanted (the fight as it
 * stands), or the first band is beaten and the player picks who holds the
 * gate against the second (undefined, and the raid waits), or it's over.
 */
function goOn(state: GameState, raid: DepotRaid, now: number): FightView | undefined {
  try {
    if (playRaid(state, raid, true).regroup) return undefined;
  } catch (e) {
    if (e instanceof FightPause) return e.view;
    throw e;
  }
  finish(state, raid, now);
  return undefined;
}

/** Raiders at the gate and nothing said or done yet: still time to talk, or to pick who holds the gate. */
function untouched(state: GameState, now: number): DepotRaid {
  const raid = raidAtGate(state);
  if (!raid) throw new Error('There are no raiders at the gate.');
  if (now >= raid.until) throw new Error('It’s too late: they’re fighting it out.');
  if (raid.took !== undefined) throw new Error('You are in command already.');
  return raid;
}

/** The player takes command at the gate. Returns the fight as it stands, or undefined if it's already over. */
export function takeRaidCommand(state: GameState, now: number): FightView | undefined {
  const raid = untouched(state, now);
  if (!begin(state, raid)) {
    finish(state, raid, now);
    return undefined;
  }
  raid.took = now;
  raid.rounds = [];
  return goOn(state, raid, now);
}

/** The fight at the gate as it stands for the next orders, if the player is in command. */
export function raidFightNow(state: GameState, now: number): FightView | undefined {
  const raid = raidAtGate(state);
  if (!raid || raid.took === undefined || now >= raid.until) return undefined;
  return raidPause(state, raid);
}

/** The fight at the gate before anyone takes command: who's up against whom. Changes nothing. */
export function raidPreview(state: GameState, now: number): FightView | undefined {
  const raid = raidAtGate(state);
  if (!raid || now >= raid.until) return undefined;
  if (raid.took !== undefined) return raidFightNow(state, now);
  const copy = structuredClone(raid);
  if (!begin(structuredClone(state), copy)) return undefined;
  copy.took = now;
  copy.rounds = [];
  return raidPause(state, copy);
}

/** One round of orders at the gate. Returns the fight for the next round, or undefined once it's over (or the player picks who meets the second band). */
export function commandRaidRound(state: GameState, orders: RoundOrders, now: number): FightView | undefined {
  const raid = raidAtGate(state);
  if (!raid || raid.took === undefined) throw new Error('You are not in command at the gate.');
  if (now >= raid.until) throw new Error('It’s too late: they’re fighting it out.');
  if (raid.rounds2 !== undefined) raid.rounds2 = [...raid.rounds2, orders];
  else raid.rounds = [...(raid.rounds ?? []), orders];
  return goOn(state, raid, now);
}

/** Let them fight it out on their own: with no orders, or the rest of a fight under command (and any second band). */
export function letRaidFight(state: GameState, now: number): void {
  const raid = raidAtGate(state);
  if (!raid) return;
  begin(state, raid);
  finish(state, raid, now);
}

/** The last raid as it ended, for the screen after it: its last fight under command, or undefined. */
export function lastRaidFight(state: GameState): FightView | undefined {
  const raid = state.depot.raid;
  if (!raid || raid.ended === undefined || raid.took === undefined || !raid.start) return undefined;
  return playRaid(state, raid, false).view;
}

// ---------------------------------------------------------------- who holds the gate

/** Who could hold the gate: home and fit when they came, and still fit. */
export function raidFighters(state: GameState): Survivor[] {
  const raid = raidAtGate(state);
  return raid ? fighters(state, raid) : [];
}

/** Who holds the gate against the first band: everyone who can, unless the player picked. */
export function raidTeam(state: GameState): string[] {
  const raid = raidAtGate(state);
  if (!raid) return [];
  const can = fighters(state, raid).map((s) => s.id);
  return raid.team ? can.filter((id) => raid.team!.includes(id)) : can;
}

/** The player picks who holds the gate against the first band (the rest stay back, fresh for a second). */
export function setRaidTeam(state: GameState, ids: readonly string[], now: number): void {
  const raid = untouched(state, now);
  const can = fighters(state, raid).map((s) => s.id);
  const team = can.filter((id) => ids.includes(id));
  if (team.length === 0) throw new Error('Someone has to hold the gate.');
  if (team.length === can.length) delete raid.team;
  else raid.team = team;
}

/** Between the bands, waiting for the player: who's standing and how they are, what's coming, and the patching up. */
export interface RaidRegroup {
  people: { id: string; name: string; hp: number; maxHp: number; down: boolean; fought: boolean }[];
  against: string;
  lines: LogLine[];
}

/** The first band is beaten under command and the second is coming: the player picks who holds the gate. Undefined otherwise. */
export function raidRegroup(state: GameState, now: number): RaidRegroup | undefined {
  const raid = raidAtGate(state);
  if (!raid || raid.took === undefined || raid.team2 !== undefined || raid.waves !== 2 || now >= raid.until) return undefined;
  let result;
  try {
    result = playRaid(state, raid, true);
  } catch (e) {
    if (e instanceof FightPause) return undefined;
    throw e;
  }
  if (!result.regroup) return undefined;
  const team = new Set(raid.team ?? result.sim.members.map((m) => m.s.id));
  const second = (raid.enemies2 ?? []).map((id) => newEnemy(getEnemy(id), 1));
  return {
    people: result.sim.members.filter((m) => !m.dead).map((m) => ({ id: m.s.id, name: m.s.firstName, hp: Math.max(0, m.s.hp), maxHp: maxHp(m.s), down: m.down, fought: team.has(m.s.id) })),
    against: describeGroup(second),
    lines: result.sim.beats.at(-1)?.title === 'Between the bands' ? result.sim.beats.at(-1)!.lines : [],
  };
}

/** The player picks who holds the gate against the second band, and takes command of that fight or lets them fight it. */
export function regroupRaid(state: GameState, ids: readonly string[], command: boolean, now: number): FightView | undefined {
  const raid = raidAtGate(state);
  const at = raidRegroup(state, now);
  if (!raid || !at) throw new Error('Nobody is waiting on you between the bands.');
  const standing = at.people.filter((p) => !p.down).map((p) => p.id);
  const team = standing.filter((id) => ids.includes(id));
  if (team.length === 0) throw new Error('Someone has to hold the gate.');
  raid.team2 = team;
  if (!command) {
    finish(state, raid, now);
    return undefined;
  }
  raid.rounds2 = [];
  return goOn(state, raid, now);
}

// ---------------------------------------------------------------- getting ready (§9.8)

/** Getting ready needs someone at the Depot to do it, and the raiders still on the road. */
function onTheRoad(state: GameState, now: number): DepotRaid {
  const raid = raidSeen(state, now);
  if (!raid) throw new Error('No raiders are on the road.');
  if (!state.survivors.some(canWork)) throw new Error('Nobody is home to do it.');
  return raid;
}

/** Shore up the fence before they come: costs scrap; the defenders get cover behind it. */
export function shoreUpFence(state: GameState, now: number): void {
  const raid = onTheRoad(state, now);
  if (raid.shored) throw new Error('The fence is shored up already.');
  if (!canAfford(state, RAID_SHORE_COST)) throw new Error(`Not enough to shore it up: it takes ${costText(RAID_SHORE_COST)}.`);
  payCost(state, RAID_SHORE_COST);
  raid.shored = true;
  addGuildLog(state, dayAt(state, now), `Raiders on the way: the fence is shored up for them (${costText(RAID_SHORE_COST)}).`, ['raid']);
}

/** Hide stores before they come: raiders who break in find only half, and the defenders reach only half the meds and ammo. */
export function hideStores(state: GameState, now: number): void {
  const raid = onTheRoad(state, now);
  if (raid.hidden) throw new Error('The stores are hidden already.');
  raid.hidden = true;
  addGuildLog(state, dayAt(state, now), 'Raiders on the way: half the stores are hidden.', ['raid']);
}

/** When a crew called home now would be back, and whether that's before the raiders get here; undefined if they can't be called (or it wouldn't bring them back sooner). */
export function recallPreview(state: GameState, runId: string, now: number): { returnAt: number; inTime: boolean } | undefined {
  const raid = raidSeen(state, now);
  const run = state.runs.find((r) => r.id === runId);
  if (!raid || !run) return undefined;
  const sim = recallReplay(run, now);
  if (!sim || sim.returnAt >= run.returnAt) return undefined;
  // Crews home at the moment the raiders arrive are home to defend.
  return { returnAt: sim.returnAt, inTime: sim.returnAt <= raid.arrive };
}

/** Call a crew home over the radio: they turn back now, and the rest of their run never happens. */
export function recallCrew(state: GameState, runId: string, now: number): void {
  if (!raidSeen(state, now)) throw new Error('No raiders are on the road.');
  const run = state.runs.find((r) => r.id === runId);
  if (!run) throw new Error('No such run.');
  const sim = recallReplay(run, now);
  if (!sim || sim.returnAt >= run.returnAt) throw new Error('They can’t be called home now.');
  storeRecall(state, run, sim, now);
  const names = run.plan.crew.map((id) => state.survivors.find((s) => s.id === id)?.firstName ?? 'Someone');
  addGuildLog(state, dayAt(state, now), `Raiders on the way: ${listNames(names)} called home over the radio.`, ['raid', 'run', run.id]);
}

// ---------------------------------------------------------------- talk first (§9.8)

/** What they'd take to go away: a share of what they'd carry off breaking in, and some scrap and rations for each of them whatever the stores. */
export function raidToll(state: GameState, raid: DepotRaid): Partial<Resources> {
  const toll: Partial<Resources> = {};
  const raiders = (raid.enemies?.length ?? 0) + (raid.enemies2?.length ?? 0);
  for (const r of ['scrap', 'rations', 'ammo', 'gas'] as const) {
    const take = Math.min(raidCap(state.resources[r]), Math.floor(state.resources[r] * RAID_LOSS));
    const floor = r === 'scrap' || r === 'rations' ? raiders * RAID_TOLL_PER_RAIDER : 0;
    const n = Math.max(floor, Math.ceil(take * RAID_TOLL_SHARE));
    if (n > 0) toll[r] = n;
  }
  return toll;
}

/** Whether the raiders at the gate can be talked to now: nothing said yet, and nobody's fighting. */
export function canTalk(state: GameState, now: number): boolean {
  const raid = raidAtGate(state);
  return raid !== undefined && raid.took === undefined && raid.talk === undefined && now < raid.until;
}

/** Pay them to go away: nobody gets hurt. The Vultures take it as a toll, and grow on it. */
export function payRaiders(state: GameState, now: number): void {
  const raid = untouched(state, now);
  if (raid.talk) throw new Error('They’re past talking.');
  const toll = raidToll(state, raid);
  if (!canAfford(state, toll)) throw new Error(`The guild doesn’t have it: they want ${costText(toll)}.`);
  payCost(state, toll);
  raid.talk = { how: 'pay', paid: toll };
  const day = dayAt(state, now);
  const { name } = raidersName(state, raid);
  if (raid.by === 'vultures') {
    applyVultureNews(state, { standing: VULTURES_TOLL_STANDING, strength: VULTURES_TAKEN_STRENGTH, met: [], killed: [], captured: [], history: [] }, day, new Rng(`raid-after:${raid.seed}`));
  }
  addGuildLog(state, day, `${name} came for the Depot. The guild paid them ${costText(toll)} to go away.`, ['raid']);
  raid.ended = now;
  raid.end = 'paid';
}

/** Who'd do the talking: the best Nerve at the gate. */
export function raidTalker(state: GameState): Survivor | undefined {
  const raid = raidAtGate(state);
  if (!raid) return undefined;
  const type = getEnemy(raid.enemies?.[0] ?? 'raider_scav').type;
  let best: Survivor | undefined;
  for (const s of fighters(state, raid)) if (!best || stareBonus(s, type) > stareBonus(best, type)) best = s;
  return best;
}

function stareBonus(s: Survivor, enemyType: string): number {
  return checkBonus(s, 'nerve', ['intimidate', ...enemyContexts(s, enemyType)]);
}

/** The Nerve it takes to stare them down. */
export function stareDc(raid: DepotRaid): number {
  return RAID_STARE_DC + (raid.by === 'vultures' ? RAID_STARE_VULTURES : 0);
}

/** Staring them down from here: who'd do it, their Nerve against what it takes, and the chance it works. */
export function stareOdds(state: GameState): { talker: Survivor; bonus: number; dc: number; chance: number } | undefined {
  const raid = raidAtGate(state);
  const talker = raidTalker(state);
  if (!raid || !talker) return undefined;
  const bonus = stareBonus(talker, getEnemy(raid.enemies?.[0] ?? 'raider_scav').type);
  const dc = stareDc(raid);
  // A d10 and the bonus against the DC.
  return { talker, bonus, dc, chance: Math.max(0, Math.min(1, (11 - (dc - bonus)) / 10)) };
}

/** Stare them down: the best Nerve at the gate tells them to go. If it works they go; if not, they strike first. */
export function stareDown(state: GameState, now: number): boolean {
  const raid = untouched(state, now);
  if (raid.talk) throw new Error('They’re past talking.');
  const talker = raidTalker(state);
  if (!talker) throw new Error('Nobody is at the gate.');
  const type = getEnemy(raid.enemies?.[0] ?? 'raider_scav').type;
  const bonus = stareBonus(talker, type);
  const dc = stareDc(raid);
  const result = rollCheck(new Rng(`raid-stare:${raid.seed}`), bonus, dc, 'nerve');
  const day = dayAt(state, now);
  addPractice(talker, 'nerve', PRACTICE_HARD, day);
  raid.talk = { how: 'stare', by: talker.id, ok: result.success, check: { who: talker.id, stat: 'nerve', roll: result.roll, bonus, dc, success: result.success } };
  const { name, lower } = raidersName(state, raid);
  if (!result.success) return false;
  addChronicle(talker, day, `Stared down ${lower} at the gate.`, ['raid']);
  addGuildLog(state, day, `${name} came for the Depot. ${talker.firstName} stared them down at the gate, and they went away.`, ['raid']);
  raid.ended = now;
  raid.end = 'stared';
  return true;
}

/**
 * The raid is over. With a fight, its outcome comes home to the real
 * defenders (hurt, tired, practiced; what changed at the Depot meanwhile is
 * kept) and the Depot pays for the ammo and meds used. Held: driven off.
 * Broken: they take a share of the stores, maybe a vehicle, and everyone home
 * is shaken.
 */
function finish(state: GameState, raid: DepotRaid, at: number): void {
  const day = dayAt(state, at);
  const rng = new Rng(`raid-after:${raid.seed}`);
  const { name, lower } = raidersName(state, raid);
  let held = false;
  const fought: Survivor[] = [];
  if (raid.start) {
    const result = playRaid(state, raid, false);
    held = result.end === 'won' || result.end === 'stalemate';
    for (const m of result.sim.members) {
      const i = state.survivors.findIndex((s) => s.id === m.s.id);
      if (i < 0) continue;
      const merged = homecoming(state.survivors[i]!, m.s, raid.marks?.[m.s.id]);
      state.survivors[i] = merged;
      fought.push(merged);
    }
    for (const rel of Object.values(result.sim.state.relationships)) state.relationships[pairKey(rel.a, rel.b)] = rel;
    const used = (have: number | undefined, left: number): number => Math.max(0, withinReach(raid, have) - left);
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
    const bands = raid.waves === 2 ? ' both bands' : ' them';
    addGuildLog(state, day, `${name} came for the Depot. ${listNames(names)} drove${bands} off${led}.`, ['raid']);
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
  // Hidden stores stay where they are.
  const found = raid.hidden ? 1 - RAID_HIDDEN_SHARE : 1;
  for (const r of ['scrap', 'rations', 'ammo', 'gas'] as const) {
    const there = Math.floor(state.resources[r] * found);
    const n = Math.min(raidCap(there), Math.floor(there * share));
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
