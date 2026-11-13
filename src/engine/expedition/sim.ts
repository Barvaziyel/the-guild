/**
 * Simulates a whole run at the moment of departure. The result is fixed from
 * then on; the UI only reveals it as time passes. See docs/DESIGN.md section 7.
 */
import { addChronicle } from '../chronicle.ts';
import {
  CARRY_COST_DOWNED,
  CHERISH_RUNS,
  DC,
  EXPLORE_GAIN,
  HUNGER_STRESS,
  MAX_BEATS,
  MENTOR_NEWCOMER_RUNS,
  MENTOR_RUNS,
  MEDS_HEAL,
  MEDS_HEAL_SKILLED,
  MINUTES_PER_BEAT,
  MIN_BEATS,
  RADS_PER_BEAT,
  RAD_SICKNESS_THRESHOLD,
  REL_COMBAT_TOGETHER,
  REL_ARGUMENT,
  REL_RUN_BASE,
  REL_RUN_PER_AFFINITY,
  STRESS_PER_DANGER_BEAT,
  STRESS_RIVAL_PER_BEAT,
  OUTPOST_REST_HP,
  OUTPOST_REST_STRESS,
  ROAD_STRESS,
  HARD_RUN_DANGER,
  ROAD_STRESS_MINUTES,
  VEHICLE_KNOCKS,
  VEHICLE_NOISE_CAP,
  WALK_HOME_SHARE,
  WALK_HOME_STRESS,
  WRECK_HURT,
  WRECK_PER_DANGER,
  WRECK_WORN,
} from '../constants.ts';
import { getLocation, getTrait, getVehicleDef } from '../content/index.ts';
import { DEPART_LINES, RETURN_LINES } from '../content/flavor.ts';
import { applyEvolutions } from '../evolution.ts';
import { itemDef, itemName, sumGearHook } from '../gear.ts';
import { addFlag, adjustRelationship, getRelationship, labelFor, pairKey, relationshipLabel, traitAffinity } from '../relationships.ts';
import { Rng } from '../rng.ts';
import { carryCapacity, maxHp } from '../stats.ts';
import { amountOf, fullName, pronounForms } from '../text.ts';
import { addTrait, maxTraitHook, revealTrait, sumTraitHook } from '../traits.ts';
import type {
  Beat,
  BeatKind,
  GameState,
  Relationship,
  ResourceId,
  Resources,
  RunHighlight,
  RunJob,
  RunOutcome,
  RunPlan,
  RunResult,
  VehicleNews,
} from '../types.ts';
import { RESOURCE_IDS } from '../types.ts';
import { combatBeat, discoveryBeat, hazardBeat, richness, scavengeBeat, socialBeat, travelBeat } from './beats.ts';
import {
  absorbRads,
  alive,
  bestBy,
  check,
  flavor,
  fmt,
  hurt,
  isHurt,
  newTally,
  running,
  say,
  simBonus,
  simDay,
  standing,
  startBeat,
  startingRerolls,
  stress,
  type Member,
  type Sim,
  revealHook,
} from './context.ts';
import { tryEvent } from './events.ts';
import { footDuration, hungryCrew, rationsPacked, runDuration } from './plan.ts';
import { atDepth, planDepth } from '../locations.ts';
import { outpostNear } from '../outposts.ts';
import { seating } from '../vehicles.ts';
import { earnNickname, nameWeapon, nemesisNewsList, takenNames } from './stories.ts';
import { resolveWounds } from './wounds.ts';
import { rescueBeat, rescueNews } from './rescue.ts';

type MidKind = Exclude<BeatKind, 'depart' | 'return'>;

/** How often each kind of beat comes up, by job. */
const JOB_WEIGHTS: Record<RunJob, Record<MidKind, number>> = {
  scavenge: { scavenge: 40, combat: 18, hazard: 14, travel: 10, social: 10, discovery: 6, rescue: 0 },
  scout: { discovery: 26, travel: 18, hazard: 18, combat: 14, social: 12, scavenge: 10, rescue: 0 },
  hunt: { combat: 42, travel: 14, hazard: 10, scavenge: 10, social: 10, discovery: 8, rescue: 0 },
  // Getting there is most of it, and the rescue comes once (§10.1).
  rescue: { rescue: 40, travel: 16, hazard: 14, combat: 14, social: 8, scavenge: 6, discovery: 2 },
};

/** The beat every run of this job gets at least once. */
const MAIN_BEAT: Record<RunJob, MidKind> = { scavenge: 'scavenge', scout: 'discovery', hunt: 'combat', rescue: 'rescue' };

const MID_KINDS = ['scavenge', 'combat', 'hazard', 'travel', 'social', 'discovery', 'rescue'] as const;

function pickBeatKind(sim: Sim, previous: MidKind | undefined, isLast: boolean): MidKind {
  const main = MAIN_BEAT[sim.plan.job];
  if (isLast && !sim.beatCounts[main] && (main !== 'rescue' || sim.rescue)) return main;

  const crew = standing(sim);
  const weights = { ...JOB_WEIGHTS[sim.plan.job] };
  weights.combat *= 0.8 + 0.15 * sim.loc.danger;
  // Engines carry: trouble finds a crew in vehicles more often.
  weights.combat *= 1 + Math.min(VEHICLE_NOISE_CAP, running(sim).reduce((n, r) => n + r.def.noise, 0));
  weights.hazard *= 0.8 + 0.1 * sim.loc.danger;
  let temper = 0;
  for (const m of crew) {
    weights.discovery += 100 * sumTraitHook(m.s, 'discoveryBonus');
    weights.hazard += 100 * sumTraitHook(m.s, 'hazardBonus');
    temper += maxTraitHook(m.s, 'argueChance');
  }
  // Crews with bad blood or short tempers find more to argue about.
  weights.social += 10 * temper + 3 * conflictPairs(sim);
  if (crew.length < 2 || previous === 'social') weights.social = 0;
  if (!sim.rescue || sim.beatCounts.rescue) weights.rescue = 0;
  return sim.rng.weightedBy(MID_KINDS, (k) => weights[k]);
}

function conflictPairs(sim: Sim): number {
  const crew = standing(sim);
  let n = 0;
  for (let i = 0; i < crew.length; i++) {
    for (let j = i + 1; j < crew.length; j++) {
      const label = relationshipLabel(sim.state, crew[i]!.s.id, crew[j]!.s.id);
      if (label === 'rival' || label === 'feud') n++;
    }
  }
  return n;
}

const BEAT_FNS: Record<MidKind, (sim: Sim) => void> = {
  scavenge: scavengeBeat,
  combat: combatBeat,
  hazard: hazardBeat,
  travel: travelBeat,
  social: socialBeat,
  discovery: discoveryBeat,
  rescue: rescueBeat,
};

// ---------------------------------------------------------------- between beats

/** Use meds on anyone below half health. The crew's best medic does the work. */
function useMeds(sim: Sim): void {
  for (const m of standing(sim)) {
    if (sim.meds <= 0) return;
    if (!isHurt(m)) continue;
    const medic = bestBy(standing(sim), (o) => simBonus(sim, o, 'wits', ['medicine']))!;
    const result = check(sim, medic, 'wits', DC.easy, ['medicine']);
    const heal = Math.min(result.success ? MEDS_HEAL_SKILLED : MEDS_HEAL, maxHp(m.s) - m.s.hp);
    m.s.hp += heal;
    sim.meds -= 1;
    const who =
      medic === m
        ? `${m.s.firstName} patches up ${pronounForms(m.s.pronouns).their} own wounds`
        : `${medic.s.firstName} patches up ${m.s.firstName}`;
    say(sim, `${who} (+${heal} HP).`, { check: result.info, tone: 'good' });
  }
}

/**
 * Fights and hazards knock vehicles about, and now and then one is wrecked.
 * Its riders are hurt, and if the rest can't seat everyone, the crew walks home.
 */
function rattleVehicles(sim: Sim): void {
  for (const ride of running(sim)) {
    ride.v.condition = Math.max(0, ride.v.condition - sim.rng.int(VEHICLE_KNOCKS[0], VEHICLE_KNOCKS[1]));
    const worn = 1 - ride.v.condition / 100;
    if (!sim.rng.chance(WRECK_PER_DANGER * sim.loc.danger + WRECK_WORN * worn * worn)) continue;
    ride.wrecked = true;
    say(sim, `The ${ride.def.name} is wrecked: it won't go another yard.`, { tone: 'bad' });
    for (const m of sim.members) {
      if (m.dead || m.down || !ride.riders.includes(m.s.id)) continue;
      hurt(sim, m, sim.rng.int(WRECK_HURT[0], WRECK_HURT[1]), `a crash at ${sim.loc.name}`);
    }
  }
  const seats = running(sim).reduce((n, r) => n + r.def.seats, 0);
  if (sim.rides.length > 0 && sim.walkingFrom === undefined && seats < alive(sim).length) {
    sim.walkingFrom = sim.offset;
    sim.turnBack = true;
    say(
      sim,
      sim.members.length === 1
        ? `Nothing for it: ${sim.members[0]!.s.firstName} starts the long walk home.`
        : running(sim).length === 0
          ? 'Nothing for it: the crew starts the long walk home.'
          : 'Not everyone fits in what still runs. The crew turns for home, some of them on foot.',
      { tone: 'bad' },
    );
  }
}

/** Everything that happens at the end of every beat out in the Reach. */
function endBeat(sim: Sim, kind: MidKind): void {
  if (kind === 'combat' || kind === 'hazard') rattleVehicles(sim);
  resolveWounds(sim);
  const crew = standing(sim);

  for (const m of crew) {
    if (sim.loc.radiation > 0) absorbRads(m, sim.loc.radiation * RADS_PER_BEAT);

    // The company you keep.
    let delta = 0;
    const others = crew.filter((o) => o !== m);
    const hasRival = others.some((o) => {
      const label = relationshipLabel(sim.state, m.s.id, o.s.id);
      return label === 'rival' || label === 'feud';
    });
    delta += (sim.loc.danger - 1) * STRESS_PER_DANGER_BEAT;
    if (hasRival) delta += STRESS_RIVAL_PER_BEAT;
    if (crew.length >= 3) delta += sumTraitHook(m.s, 'crowdStress');
    for (const o of others) delta -= sumTraitHook(o.s, 'crewStressRelief');
    for (const o of crew) delta -= sumGearHook(o.s, 'crewStressRelief');
    delta -= sumGearHook(m.s, 'stressRelief');
    if (delta !== 0) stress(sim, m, delta, 'the strain of the road');
  }

  useMeds(sim);

  if (!sim.turnBack && sim.plan.retreat === 'wounded') {
    const hurtOne = standing(sim).find(isHurt);
    if (hurtOne) {
      sim.turnBack = true;
      say(sim, sim.members.length === 1 ? `${hurtOne.s.firstName} is in no state to go on, and turns for home as ordered.` : `${hurtOne.s.firstName} is in no state to go on. As ordered, the crew turns for home.`);
    }
  }
}

// ---------------------------------------------------------------- coming home

function relationshipLine(a: Member, b: Member, to: ReturnType<typeof labelFor>, warmer: boolean): string {
  const names = `${a.s.firstName} and ${b.s.firstName}`;
  switch (to) {
    case 'bonded':
      return `${names} would walk into fire for each other now.`;
    case 'friend':
      return warmer ? `${names} have become friends.` : `${names} are not as close as they were.`;
    case 'neutral':
      return warmer ? `${names} seem to have made their peace.` : `Something has cooled between ${names}.`;
    case 'rival':
      return warmer ? `${names} have stepped back from the brink.` : `${names} can barely stand each other.`;
    case 'feud':
      return `${names} are at each other's throats.`;
  }
}

/** What the run made of the people who came back. */
function aftermath(sim: Sim): void {
  const day = simDay(sim);
  const crew = alive(sim);

  for (const m of crew) {
    m.s.counters.runs += 1;
    if (sim.loc.danger >= HARD_RUN_DANGER) m.s.counters.hardRuns += 1;
    if (m.s.counters.runs === 1) addChronicle(m.s, day, `First run for the guild: ${sim.loc.name}.`, ['run']);

    if (m.tally.rads >= RAD_SICKNESS_THRESHOLD && !m.down) {
      const result = check(sim, m, 'grit', Math.min(16, 7 + Math.floor(m.tally.rads / 10)));
      if (!result.success) {
        addTrait(m.s, 'rad_sickness', { day, rng: sim.rng });
        say(sim, `${m.s.firstName} comes home with radiation sickness.`, { check: result.info, tone: 'bad' });
      }
    }
  }

  // Time on the road together.
  for (let i = 0; i < crew.length; i++) {
    for (let j = i + 1; j < crew.length; j++) {
      const a = crew[i]!;
      const b = crew[j]!;
      // A fight side by side brings together those who get along; it doesn't mend the rest (1.6.2).
      const affinity = traitAffinity(a.s, b.s);
      const delta = REL_RUN_BASE + REL_RUN_PER_AFFINITY * affinity + (sim.hadCombat && affinity >= 0 ? REL_COMBAT_TOGETHER : 0);
      const change = adjustRelationship(sim.state, a.s.id, b.s.id, delta, { day });
      if (change.labelChange) {
        say(sim, relationshipLine(a, b, change.labelChange.to, change.after > change.before), {
          tone: change.after > change.before ? 'good' : 'bad',
        });
      }
      // An old hand takes a newcomer under their wing.
      const label = labelFor(change.after);
      if (label === 'friend' || label === 'bonded') {
        for (const [mentor, pupil] of [
          [a, b],
          [b, a],
        ] as const) {
          const flags = getRelationship(sim.state, a.s.id, b.s.id)?.flags ?? [];
          if (mentor.s.counters.runs >= MENTOR_RUNS && pupil.s.counters.runs <= MENTOR_NEWCOMER_RUNS && !flags.some((f) => f.kind === 'mentor')) {
            addFlag(sim.state, a.s.id, b.s.id, { kind: 'mentor', mentor: mentor.s.id });
            addChronicle(mentor.s, day, `Took ${fullName(pupil.s)} under ${pronounForms(mentor.s.pronouns).their} wing.`, ['mentor', pupil.s.id]);
            addChronicle(pupil.s, day, `Started learning from ${fullName(mentor.s)}.`, ['mentor', mentor.s.id]);
            say(sim, `${mentor.s.firstName} has started showing ${pupil.s.firstName} the ropes.`, { tone: 'good' });
          }
        }
      }
    }
  }

  // Shares: someone Greedy, or quick to anger, may fall out with another over who carried what (1.6.2).
  if (crew.length >= 2 && RESOURCE_IDS.some((r) => sim.loot[r] > 0)) {
    for (const m of crew) {
      if (!sim.rng.chance(sumTraitHook(m.s, 'lootArgueChance'))) continue;
      const other = sim.rng.pick(crew.filter((o) => o !== m));
      adjustRelationship(sim.state, m.s.id, other.s.id, REL_ARGUMENT, { day });
      say(sim, `${m.s.firstName} and ${other.s.firstName} argue over the shares the whole way home.`, { tone: 'bad' });
      revealHook(sim, m, 'lootArgueChance');
    }
  }

  for (const m of crew) {
    // Experience leaves its mark.
    for (const id of applyEvolutions(m.s, { when: 'run', rng: sim.rng, day, tally: m.tally })) {
      say(sim, `${m.s.firstName} is not the same person who left: now ${getTrait(id).name}.`, { tone: 'good' });
    }

    // People show who they are after a few runs.
    for (const t of m.s.traits) {
      if (!t.hidden) continue;
      const runs = m.s.counters.runs;
      if (sim.rng.chance(runs >= 3 ? 1 : runs === 2 ? 0.5 : 0.34)) {
        revealTrait(m.s, t.id, day);
        const name = getTrait(t.id).name;
        say(sim, sim.members.length === 1 ? `Some things show, even out alone. ${m.s.firstName} is ${name}.` : `The others have ${m.s.firstName} figured out by now: ${name}.`);
      }
    }

    // Feats leave names behind: on weapons, and on people.
    nameWeapon(sim, m);
    earnNickname(sim, m);

    // Trinkets become precious.
    const trinket = m.s.equipment.trinket;
    if (trinket && itemDef(trinket).slot === 'trinket') {
      trinket.runsWithHolder = (trinket.runsWithHolder ?? 0) + 1;
      if (trinket.runsWithHolder >= CHERISH_RUNS && trinket.cherishedBy !== m.s.id) {
        trinket.cherishedBy = m.s.id;
        addChronicle(m.s, day, `Would not part with the ${itemName(trinket)} now.`, ['cherished']);
        say(sim, `${m.s.firstName} has grown attached to the ${itemName(trinket)}. It means more now.`, { tone: 'good' });
      }
    }
  }
}

/** Round the loot and cut it down to what the crew can carry. */
function packLoot(sim: Sim, outcome: RunOutcome): { loot: Resources; leftBehind: number } {
  const loot: Resources = { scrap: 0, rations: 0, meds: 0, ammo: 0, tech: 0, gas: 0 };
  if (outcome === 'routed' || outcome === 'lost') {
    sim.items = [];
    return { loot, leftBehind: 0 };
  }
  for (const res of RESOURCE_IDS) loot[res] = Math.round(sim.loot[res]);

  let capacity = 0;
  for (const m of sim.members) {
    if (m.dead) continue;
    capacity += m.down ? -CARRY_COST_DOWNED : carryCapacity(m.s);
  }
  // What still runs carries a load home, and so does anything found and got running.
  for (const r of running(sim)) capacity += r.def.cargo;
  for (const v of sim.foundVehicles) capacity += getVehicleDef(v.defId).cargo;
  capacity = Math.max(0, capacity);

  let leftBehind = 0;
  if (sim.items.length > capacity) {
    leftBehind += sim.items.length - capacity;
    sim.items = sim.items.slice(0, capacity);
  }
  // A load out of a richer place holds more (§7.6): the finds were made bigger, so the packs hold as many loads.
  const rich = richness(sim.plan);
  const room = Math.round((capacity - sim.items.length) * rich);
  const total = (): number => RESOURCE_IDS.reduce((sum, r) => sum + loot[r], 0);
  let dropped = 0;
  while (total() > room) {
    // Drop from the biggest pile that isn't the priority.
    const droppable = RESOURCE_IDS.filter((r) => loot[r] > 0 && r !== sim.plan.lootPriority);
    const pool: readonly ResourceId[] = droppable.length > 0 ? droppable : RESOURCE_IDS.filter((r) => loot[r] > 0);
    const drop = pool.reduce((a, b) => (loot[b] > loot[a] ? b : a));
    loot[drop] -= 1;
    dropped += 1;
  }
  leftBehind += Math.ceil(dropped / rich);
  return { loot, leftBehind };
}

function lootSummary(loot: Resources, items: readonly string[]): string {
  const parts: string[] = [];
  for (const res of RESOURCE_IDS) if (loot[res] > 0) parts.push(amountOf(res, loot[res]));
  parts.push(...items);
  return parts.join(', ');
}

// ---------------------------------------------------------------- the run

export interface SimulatedRun {
  returnAt: number;
  rations: number;
  beats: Beat[];
  result: RunResult;
  /** The id counter after the run (found items take ids). */
  nextId: number;
}

/**
 * Simulate a run from start to finish. Does not change `state`: the crew is
 * cloned, and the outcome is returned for startRun/completeRun to apply.
 */
export function simulateRun(state: GameState, plan: RunPlan, seed: string, departAt: number): SimulatedRun {
  // Deeper levels are the same place, only more dangerous (§7.10).
  const loc = atDepth(getLocation(plan.locationId), planDepth(plan));
  const restStop = outpostNear(state, plan.locationId);
  const rng = new Rng(`run:${seed}`);
  const duration = runDuration(state, plan);

  const crew = plan.crew.map((id) => {
    const s = state.survivors.find((x) => x.id === id);
    if (!s) throw new Error(`Unknown survivor: ${id}`);
    return structuredClone(s);
  });
  const relationships: Record<string, Relationship> = {};
  for (let i = 0; i < crew.length; i++) {
    for (let j = i + 1; j < crew.length; j++) {
      const rel = getRelationship(state, crew[i]!.id, crew[j]!.id);
      if (rel) relationships[pairKey(rel.a, rel.b)] = structuredClone(rel);
    }
  }
  const nemeses = structuredClone(state.nemeses ?? []);
  const shell: GameState = { ...state, survivors: crew, memorial: [], relationships, stash: [], runs: [], reports: [], log: [], nemeses };

  const sim: Sim = {
    state: shell,
    rng,
    plan,
    loc,
    members: crew.map((s): Member => {
      const rerolls = startingRerolls(s);
      return {
        s,
        down: false,
        dead: false,
        fled: false,
        fleeRolled: false,
        tally: newTally(),
        rerollFails: rerolls.fails,
        rerollSuccesses: rerolls.successes,
        chronicleStart: s.chronicle.length,
        weaponKillsAtStart: s.equipment.weapon?.kills ?? 0,
        countersAtStart: { ...s.counters },
        traitsAtStart: s.traits.map((t) => t.id),
      };
    }),
    departAt,
    offset: 0,
    beats: [],
    loot: { scrap: 0, rations: 0, meds: 0, ammo: 0, tech: 0, gas: 0 },
    items: [],
    meds: plan.meds,
    ammo: plan.ammo,
    mercy: state.settings.mercyMode,
    hadCombat: false,
    turnBack: false,
    routed: false,
    discovered: [],
    deaths: [],
    beatCounts: {},
    events: [],
    exploreBonus: 0,
    nemeses,
    nemesisNews: {},
    nemesisMet: false,
    takenNames: takenNames(state),
    rides: seating(state, plan).map(({ vehicleId, riders }) => {
      const v = structuredClone(state.vehicles.find((x) => x.id === vehicleId)!);
      return { v, def: getVehicleDef(v.defId), riders, wrecked: false };
    }),
    foundVehicles: [],
    animals: [],
    found: [],
  };
  // A rescue run carries the person who called for help, and what trouble they're in (§10.1).
  const call = state.rescue?.call;
  if (plan.job === 'rescue' && call && call.locationId === plan.locationId) sim.rescue = { person: structuredClone(call.person), trouble: call.trouble };

  startBeat(sim, 'depart', 'Setting Out');
  say(sim, flavor(sim, DEPART_LINES));
  if (sim.rides.length > 0) {
    const names = sim.rides.map((r) => `the ${r.def.name}`);
    const list = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
    say(sim, `Engines cough and catch. Into ${list} and away.`);
  }
  // Short of rations, the crew goes anyway; whoever has none goes hungry.
  for (const s of hungryCrew(state, plan)) {
    const m = sim.members.find((x) => x.s.id === s.id)!;
    say(sim, fmt('{a.first} goes out on an empty stomach.', { a: m }), { tone: 'bad' });
    stress(sim, m, HUNGER_STRESS, 'going out hungry');
  }

  // Beats come from the distance, so a vehicle gets there sooner but meets as much on the way.
  const foot = footDuration(state, plan);
  const totalBeats = Math.max(MIN_BEATS, Math.min(MAX_BEATS, Math.round(foot / 60_000 / MINUTES_PER_BEAT) + 2));
  const middle = totalBeats - 1;
  const slot = duration / totalBeats;
  let previous: MidKind | undefined;
  let done = 0;
  for (let i = 0; i < middle; i++) {
    if (sim.turnBack || sim.routed || standing(sim).length === 0) break;
    sim.offset = Math.round(slot * (i + 1) + slot * (rng.next() - 0.5) * 0.4);
    const kind = pickBeatKind(sim, previous, i === middle - 1);
    if (!tryEvent(sim, kind)) BEAT_FNS[kind](sim);
    endBeat(sim, kind);
    previous = kind;
    done += 1;
  }

  const cutShort = done < middle || sim.turnBack || sim.routed;
  const outcome: RunOutcome =
    alive(sim).length === 0 ? 'lost' : sim.routed ? 'routed' : cutShort ? 'turnedBack' : 'completed';
  sim.offset =
    sim.walkingFrom !== undefined
      ? Math.round(sim.walkingFrom + foot * WALK_HOME_SHARE)
      : cutShort
        ? Math.min(duration, Math.max(sim.offset + 60_000, Math.round(sim.offset * 1.5)))
        : duration;

  startBeat(sim, 'return', outcome === 'lost' ? 'Silence' : 'Home');
  say(sim, flavor(sim, RETURN_LINES[outcome]), outcome === 'completed' ? {} : { tone: 'bad' });
  const rescue = rescueNews(sim, outcome);
  // The road itself wears on people (§6): a little for going out at all, more the longer they're away.
  const road = ROAD_STRESS + Math.floor(sim.offset / 60_000 / ROAD_STRESS_MINUTES);
  for (const m of alive(sim)) stress(sim, m, road, 'the road');
  if (sim.walkingFrom !== undefined && outcome !== 'lost') {
    say(sim, sim.members.length === 1 ? 'It is a long way on foot.' : 'It is a long way on foot, and nobody talks much.', { tone: 'bad' });
    for (const m of alive(sim)) stress(sim, m, WALK_HOME_STRESS, 'the long walk home');
  } else if (restStop && outcome !== 'lost') {
    // A rest stop at the guild's outpost on the way home (§7.9).
    const where = getLocation(restStop.locationId).name;
    say(sim, sim.members.length === 1 ? `${sim.members[0]!.s.firstName} stops at the outpost at ${where} to rest and get patched up.` : `The crew stops at the outpost at ${where} to rest and get patched up.`, { tone: 'good' });
    for (const m of alive(sim)) {
      m.s.hp = Math.min(maxHp(m.s), m.s.hp + OUTPOST_REST_HP);
      stress(sim, m, -OUTPOST_REST_STRESS);
    }
  }
  // Every run wears a vehicle down.
  const vehicleNews: VehicleNews[] = sim.rides.map((r) => {
    // Nobody drives home from a lost run.
    if (r.wrecked || outcome === 'lost') return { id: r.v.id, defId: r.v.defId, condition: 0, wrecked: true };
    const condition = Math.max(0, r.v.condition - rng.int(r.def.wear[0], r.def.wear[1]));
    return { id: r.v.id, defId: r.v.defId, condition };
  });
  if (outcome !== 'lost') aftermath(sim);

  const { loot, leftBehind } = packLoot(sim, outcome);
  if (outcome === 'completed' || outcome === 'turnedBack') {
    const summary = lootSummary(loot, sim.items.map(itemName));
    const solo = sim.members.length === 1 ? sim.members[0]!.s.firstName : undefined;
    const loads = `${leftBehind} ${leftBehind === 1 ? 'load' : 'loads'}`;
    if (solo) {
      say(sim, summary ? `${solo} brings back: ${summary}.` : `${solo} brings back nothing but a sore back.`, summary ? { tone: 'good' } : {});
      if (leftBehind > 0) say(sim, `${solo} had to leave ${loads} behind: too much for one person to carry.`);
    } else {
      say(sim, summary ? `They bring back: ${summary}.` : 'They bring back nothing but themselves.', summary ? { tone: 'good' } : {});
      if (leftBehind > 0) say(sim, `They had to leave ${loads} behind: too much to carry.`);
    }
  }

  const range = EXPLORE_GAIN[plan.job];
  const fullGain = rng.int(range[0], range[1]) + sim.exploreBonus;
  const exploredGain = outcome === 'completed' ? fullGain : outcome === 'turnedBack' ? Math.floor(fullGain / 2) : 0;

  const highlights: RunHighlight[] = [];
  for (const m of sim.members) {
    for (const entry of m.s.chronicle.slice(m.chronicleStart)) highlights.push({ survivorId: m.s.id, text: entry.text });
  }

  return {
    returnAt: departAt + sim.offset,
    rations: rationsPacked(state, plan),
    beats: sim.beats,
    nextId: shell.nextId,
    result: {
      outcome,
      crew: sim.members.map((m) => m.s),
      relationships: Object.values(shell.relationships),
      loot,
      items: sim.items,
      leftBehind,
      medsLeft: outcome === 'lost' || outcome === 'routed' ? 0 : sim.meds,
      ammoLeft: outcome === 'lost' || outcome === 'routed' ? 0 : sim.ammo,
      exploredGain,
      discovered: outcome === 'lost' ? [] : sim.discovered,
      deaths: sim.deaths,
      highlights,
      events: sim.events,
      nemeses: nemesisNewsList(sim),
      ...(vehicleNews.length > 0 ? { vehicles: vehicleNews } : {}),
      ...(sim.foundVehicles.length > 0 && outcome !== 'lost' ? { foundVehicles: sim.foundVehicles } : {}),
      ...(rescue ? { rescue } : {}),
      ...(sim.animals.length > 0 && (outcome === 'completed' || outcome === 'turnedBack') ? { animals: sim.animals } : {}),
      ...(sim.found.length > 0 && (outcome === 'completed' || outcome === 'turnedBack') ? { found: sim.found } : {}),
    },
  };
}
