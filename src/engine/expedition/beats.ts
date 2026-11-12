/**
 * The individual beats of a run: travel, scavenging, hazards, fights,
 * moments between crew members, and discoveries.
 */
import {
  AGGRESSIVE_AMBUSH_PENALTY,
  DC,
  DROP_MARGIN,
  REL_ARGUMENT,
  REL_CAUGHT_STEALING,
  REL_COVERED,
  REL_SHARED,
  SNEAKY_AMBUSH_BONUS,
  SNEAK_DC_BASE,
  FOUND_VEHICLE_CONDITION,
  VEHICLE_AMBUSH_PENALTY,
  WRECK_FIND_WEIGHT,
  DEPTH_LOOT,
} from '../constants.ts';
import { planDepth } from '../locations.ts';
import { GEAR, getLocation, getVehicleDef, type HazardKind } from '../content/index.ts';
import { createVehicle } from '../vehicles.ts';
import {
  AMBUSHED_LINES,
  CALM_FAIL,
  CALM_SUCCESS,
  COMBAT_INTROS,
  DISCOVERY_LEAD,
  VEHICLE_FOUND,
  DISCOVERY_LORE,
  DISCOVERY_STASH,
  DROP_LINES,
  HAZARD_TEXT,
  INTIMIDATE_FAIL,
  INTIMIDATE_SUCCESS,
  POCKET_CAUGHT,
  SCAVENGE_INTROS,
  SCAVENGE_NOTHING,
  SNEAK_FAIL_LINES,
  SNEAK_PAST_LINES,
  SOCIAL_ARGUMENT,
  SOCIAL_COVER,
  SOCIAL_SHARE,
  SOCIAL_TALK,
  SPOTTED_LINES,
  TRAVEL_FIND,
  type SocialText,
} from '../content/flavor.ts';
import { anyGearHook, createItem, itemName, sumGearHook } from '../gear.ts';
import { locationState } from '../locations.ts';
import { adjustRelationship, relationshipScore, traitAffinity } from '../relationships.ts';
import { enemyContexts, situationalMods } from '../stats.ts';
import { amountOf } from '../text.ts';
import { maxTraitHook, sumTraitHook } from '../traits.ts';
import type { Quality, ResourceId } from '../types.ts';
import { QUALITIES, RESOURCE_IDS } from '../types.ts';
import { buildEncounter, describeGroup, fight, type Enemy, type FightStart } from './combat.ts';
import {
  absorbRads,
  bestBy,
  capitalize,
  check,
  flavor,
  fmt,
  hurt,
  revealHook,
  running,
  say,
  simBonus,
  simDay,
  standing,
  startBeat,
  stress,
  type Member,
  type Sim,
} from './context.ts';

// ---------------------------------------------------------------- loot helpers

export function lootMult(m: Member): number {
  return Math.max(0.25, 1 + sumTraitHook(m.s, 'lootBonus'));
}

export function pickResource(sim: Sim): ResourceId {
  return sim.rng.weightedBy(RESOURCE_IDS, (r) => sim.loc.loot[r]);
}

function rollQuality(sim: Sim): Quality {
  const d = sim.loc.danger;
  const weights: Record<Quality, number> = { rusty: 45 - 6 * d, common: 45, solid: 8 + 4 * d, prime: 2 * d, relic: 0 };
  return sim.rng.weightedBy(QUALITIES, (q) => weights[q]);
}

export function findGear(sim: Sim, finder: Member): void {
  const def = sim.rng.weightedBy(GEAR, (g) => g.lootWeight);
  const item = createItem(sim.state, def.id, rollQuality(sim));
  sim.items.push(item);
  say(sim, `${finder.s.firstName} finds something worth keeping: ${itemName(item)}.`, { tone: 'good' });
}

export function addLoot(sim: Sim, res: ResourceId, amount: number): void {
  // Deeper levels give up more (§7.10).
  sim.loot[res] += Math.round(amount * (1 + DEPTH_LOOT * (planDepth(sim.plan) - 1)));
}

export function lootText(loot: Partial<Record<ResourceId, number>>): string {
  const parts: string[] = [];
  for (const res of RESOURCE_IDS) {
    const n = loot[res] ?? 0;
    if (n > 0) parts.push(amountOf(res, n));
  }
  return parts.join(', ');
}

// ---------------------------------------------------------------- travel

export function travelBeat(sim: Sim): void {
  startBeat(sim, 'travel', 'On the Move');
  say(sim, sim.rng.pick(sim.loc.sights));
  const crew = standing(sim);
  if (crew.length > 0 && sim.rng.chance(0.25)) {
    const finder = sim.rng.pick(crew);
    addLoot(sim, 'scrap', sim.rng.int(1, 2));
    say(sim, flavor(sim, TRAVEL_FIND, { a: finder }));
  }
}

// ---------------------------------------------------------------- scavenge

export function scavengeBeat(sim: Sim): void {
  startBeat(sim, 'scavenge', 'Scavenging');
  say(sim, flavor(sim, SCAVENGE_INTROS));
  const dc = DC.normal + Math.floor(sim.loc.danger / 2);
  const crew = standing(sim);

  for (const m of crew) {
    const result = check(sim, m, 'wits', dc, ['scavenge'], { extra: sumGearHook(m.s, 'scavengeBonus') });
    if (!result.success && result.margin < -2) {
      say(sim, flavor(sim, SCAVENGE_NOTHING, { a: m }), { check: result.info });
      continue;
    }
    const res = pickResource(sim);
    // A near miss still turns up scraps.
    const units = result.success ? sim.rng.int(1, 2) + 2 * (sim.loc.danger - 1) + Math.floor(result.margin / 3) : 1;
    const found = units * lootMult(m);
    addLoot(sim, res, found);
    if (result.success) {
      m.s.counters.scavenges += 1;
      m.tally.scavenges += 1;
    }
    const amount = Math.max(1, Math.round(found));
    say(
      sim,
      result.success ? `${m.s.firstName} turns up ${amount} ${res}.` : `${m.s.firstName} finds little: ${amount} ${res}.`,
      result.success ? { check: result.info, tone: 'good' } : { check: result.info },
    );
    if (result.success && sim.rng.chance(sim.loc.gearChance)) findGear(sim, m);

    // Sticky fingers.
    const pocket = maxTraitHook(m.s, 'pocketChance');
    if (pocket > 0 && crew.length > 1 && sim.rng.chance(pocket)) {
      sim.loot[res] = Math.max(0, sim.loot[res] - 1);
      const watcher = bestBy(crew.filter((o) => o !== m), (o) => simBonus(sim, o, 'wits', []))!;
      const caught = check(sim, watcher, 'wits', DC.normal);
      if (caught.success) {
        say(sim, flavor(sim, POCKET_CAUGHT, { a: m, b: watcher }), { check: caught.info, tone: 'bad' });
        adjustRelationship(sim.state, m.s.id, watcher.s.id, REL_CAUGHT_STEALING, { day: simDay(sim) });
        revealHook(sim, m, 'pocketChance');
      }
    }
  }
}

// ---------------------------------------------------------------- hazards

function pickHazard(sim: Sim): HazardKind {
  return sim.rng.pick(sim.loc.hazards);
}

export function hazardBeat(sim: Sim): void {
  const kind = pickHazard(sim);
  const text = HAZARD_TEXT[kind];
  startBeat(sim, 'hazard', text.title);
  say(sim, sim.rng.pick(text.intro));
  const crew = standing(sim);
  const danger = sim.loc.danger;

  if (kind === 'radiation') {
    const warned = crew.find((m) => anyGearHook(m.s, 'radWarning'));
    if (warned) {
      say(sim, flavor(sim, text.avoided, { a: warned }), { tone: 'good' });
      return;
    }
    for (const m of crew) {
      absorbRads(m, sim.rng.int(8, 15));
      const result = check(sim, m, 'grit', DC.normal + sim.loc.radiation);
      if (!result.success) {
        say(sim, flavor(sim, text.hit, { a: m }), { check: result.info, tone: 'bad' });
        stress(sim, m, 5, 'radiation');
        hurt(sim, m, sim.rng.int(1, 3), text.cause);
      }
    }
    quietLine(sim);
    return;
  }

  if (kind === 'collapse' || kind === 'trap') {
    // One pair of sharp eyes can save the whole crew.
    const spotter = bestBy(crew, (m) => simBonus(sim, m, 'wits', []))!;
    const spot = check(sim, spotter, 'wits', 9 + danger, [], { crew: true });
    if (spot.success) {
      say(sim, flavor(sim, text.avoided, { a: spotter }), { check: spot.info, tone: 'good' });
      return;
    }
    const victim = sim.rng.pick(crew);
    const brace = check(sim, victim, 'grit', DC.normal);
    const raw = sim.rng.int(2, 4) + danger;
    const damage = brace.success ? Math.ceil(raw / 2) : raw;
    stress(sim, victim, sim.rng.int(5, 10), text.cause);
    const wentDown = hurt(sim, victim, damage, text.cause);
    say(sim, `${flavor(sim, text.hit, { a: victim })} (-${damage} HP)${wentDown ? ` ${victim.s.firstName} is down.` : ''}`, {
      check: brace.info,
      tone: 'bad',
    });
    return;
  }

  // storm, toxic: everyone toughs it out alone.
  for (const m of crew) {
    const result = check(sim, m, 'grit', 8 + danger);
    if (result.success) continue;
    const damage = sim.rng.int(1, 3);
    stress(sim, m, kind === 'toxic' ? 8 : 5, text.cause);
    const wentDown = hurt(sim, m, damage, text.cause);
    say(sim, `${flavor(sim, text.hit, { a: m })} (-${damage} HP)${wentDown ? ` ${m.s.firstName} is down.` : ''}`, {
      check: result.info,
      tone: 'bad',
    });
  }
  quietLine(sim);
}

/** If nobody came to harm, say so. */
function quietLine(sim: Sim): void {
  if (!sim.beats[sim.beats.length - 1]!.lines.some((l) => l.tone === 'bad')) {
    // No line is picked at random here, so the run's dice stay the same.
    say(sim, sim.members.length === 1 ? fmt('{a.first} grits {a.their} teeth and pushes through.', { a: sim.members[0]! }) : 'The crew grits their teeth and pushes through.');
  }
}

// ---------------------------------------------------------------- combat

function ambushScore(sim: Sim, m: Member): number {
  return simBonus(sim, m, 'wits', ['ambush']) + sumTraitHook(m.s, 'ambushBonus') + sumGearHook(m.s, 'ambushBonus');
}

export function combatBeat(sim: Sim): void {
  const enemies = buildEncounter(sim);
  const lead = enemies.reduce((a, b) => (b.def.threat > a.def.threat ? b : a)).def;
  const group = describeGroup(enemies);
  startBeat(sim, 'combat', enemies.length === 1 ? lead.name : lead.plural);
  say(sim, flavor(sim, COMBAT_INTROS[lead.type], {}, { group, Group: capitalize(group) }));

  const crew = standing(sim);
  const plan = sim.plan;

  // Who sees whom first?
  const scout = bestBy(crew, (m) => ambushScore(sim, m))!;
  let extra = sumTraitHook(scout.s, 'ambushBonus') + sumGearHook(scout.s, 'ambushBonus');
  if (plan.approach === 'sneaky') extra += SNEAKY_AMBUSH_BONUS;
  if (plan.approach === 'aggressive') extra += AGGRESSIVE_AMBUSH_PENALTY;
  if (running(sim).length > 0) extra += VEHICLE_AMBUSH_PENALTY;
  const stealth = Math.max(...enemies.map((e) => e.def.stealth));
  const spot = check(sim, scout, 'wits', stealth, ['ambush'], { crew: true, extra });

  let ambushed = false;
  let drop = false;
  if (!spot.success) {
    ambushed = true;
    say(sim, flavor(sim, AMBUSHED_LINES), { check: spot.info, tone: 'bad' });
  } else if (plan.approach === 'sneaky' && plan.job !== 'hunt') {
    // Slipping past: a crew is only as quiet as its loudest member.
    say(sim, flavor(sim, SPOTTED_LINES, { a: scout }), { check: spot.info });
    const loudest = bestBy(crew, (m) => -simBonus(sim, m, 'wits', ['sneak']))!;
    let noise = 0;
    for (const m of crew) noise += sumGearHook(m.s, 'sneakPenalty');
    const sneak = check(sim, loudest, 'wits', SNEAK_DC_BASE + sim.loc.danger, ['sneak'], { crew: true, extra: -noise });
    if (sneak.success) {
      say(sim, flavor(sim, SNEAK_PAST_LINES, { a: loudest }), { check: sneak.info, tone: 'good' });
      return;
    }
    say(sim, flavor(sim, SNEAK_FAIL_LINES, { a: loudest }), { check: sneak.info, tone: 'bad' });
  } else if (spot.margin >= DROP_MARGIN) {
    drop = true;
    say(sim, flavor(sim, DROP_LINES, { a: scout }), { check: spot.info, tone: 'good' });
  } else {
    say(sim, flavor(sim, SPOTTED_LINES, { a: scout }), { check: spot.info });
  }

  // Can it be ended without a fight?
  if (!ambushed && plan.job !== 'hunt' && enemies.every((e) => e.def.backsOff === lead.backsOff)) {
    if (lead.backsOff === 'intimidate') {
      const face = bestBy(crew, (m) => simBonus(sim, m, 'nerve', ['intimidate', ...enemyContexts(m.s, lead.type)]))!;
      const result = check(sim, face, 'nerve', 12 + sim.loc.danger, ['intimidate', ...enemyContexts(face.s, lead.type)], { crew: true });
      if (result.success) {
        say(sim, flavor(sim, INTIMIDATE_SUCCESS, { a: face }), { check: result.info, tone: 'good' });
        return;
      }
      say(sim, flavor(sim, INTIMIDATE_FAIL, { a: face }), { check: result.info, tone: 'bad' });
    } else if (lead.backsOff === 'calm') {
      // Only someone with a way with these creatures even tries.
      const handler = bestBy(
        crew.filter((m) => situationalMods(m.s, 'nerve', enemyContexts(m.s, lead.type)) > 0),
        (m) => simBonus(sim, m, 'nerve', enemyContexts(m.s, lead.type)),
      );
      if (handler) {
        const result = check(sim, handler, 'nerve', 10 + sim.loc.danger, enemyContexts(handler.s, lead.type));
        if (result.success) {
          say(sim, flavor(sim, CALM_SUCCESS, { a: handler }), { check: result.info, tone: 'good' });
          return;
        }
        say(sim, flavor(sim, CALM_FAIL, { a: handler }), { check: result.info, tone: 'bad' });
      }
    }
  }

  resolveFight(sim, enemies, { ambushed, drop });
}

/** Fight it out and deal with the result: loot from the bodies, or a retreat home. */
export function resolveFight(sim: Sim, enemies: Enemy[], start: FightStart): void {
  const result = fight(sim, enemies, start);
  if (result.end === 'won') {
    const text = lootText(result.loot);
    for (const res of RESOURCE_IDS) addLoot(sim, res, result.loot[res] ?? 0);
    const taker = sim.members.length === 1 ? sim.members[0]!.s.firstName : 'The crew';
    say(sim, text ? `The fight is over. ${taker} takes what is worth taking: ${text}.` : 'The fight is over.', { tone: 'good' });
  } else if (result.end === 'withdrew') {
    sim.turnBack = true;
  }
}

// ---------------------------------------------------------------- social

/** Change how two crew members feel about each other, and say so if it crosses a line. */
export function relate(sim: Sim, a: Member, b: Member, delta: number): void {
  const change = adjustRelationship(sim.state, a.s.id, b.s.id, delta, { day: simDay(sim) });
  if (!change.labelChange) return;
  const to = change.labelChange.to;
  const warmer = change.after > change.before;
  const now =
    to === 'bonded'
      ? 'are inseparable now'
      : to === 'friend'
        ? warmer ? 'are friends now' : 'are not as close as they were'
        : to === 'neutral'
          ? warmer ? 'are on speaking terms again' : 'have cooled toward each other'
          : to === 'rival'
            ? warmer ? 'have stepped back from the brink' : 'are rivals now'
            : "are at each other's throats";
  say(sim, `${a.s.firstName} and ${b.s.firstName} ${now}.`, { tone: warmer ? 'good' : 'bad' });
}

function socialEvent(sim: Sim, a: Member, b: Member, text: SocialText, delta: number, stressDelta: number): void {
  startBeat(sim, 'social', text.title);
  say(sim, flavor(sim, text.lines, { a, b }), { tone: delta < 0 ? 'bad' : 'good' });
  relate(sim, a, b, delta);
  stress(sim, a, stressDelta);
  stress(sim, b, stressDelta);
}

/** A moment between two crew members. Needs at least two people standing. */
export function socialBeat(sim: Sim): void {
  const crew = standing(sim);
  if (crew.length < 2) {
    travelBeat(sim);
    return;
  }
  // Pairs with history (good or bad) are more likely to have a moment.
  const pairs: { a: Member; b: Member; weight: number }[] = [];
  for (let i = 0; i < crew.length; i++) {
    for (let j = i + 1; j < crew.length; j++) {
      const a = crew[i]!;
      const b = crew[j]!;
      const heat = Math.abs(relationshipScore(sim.state, a.s.id, b.s.id)) / 20;
      const temper = maxTraitHook(a.s, 'argueChance') + maxTraitHook(b.s, 'argueChance');
      pairs.push({ a, b, weight: 1 + heat + temper * 5 });
    }
  }
  const pair = sim.rng.weightedBy(pairs, (p) => p.weight);
  const [a, b] = sim.rng.chance(0.5) ? [pair.a, pair.b] : [pair.b, pair.a];
  const score = relationshipScore(sim.state, a.s.id, b.s.id);
  const affinity = traitAffinity(a.s, b.s);
  const temper = maxTraitHook(a.s, 'argueChance') + maxTraitHook(b.s, 'argueChance');

  const kind = sim.rng.weighted([
    { item: 'argument', weight: 2 + (score <= -20 ? 6 : 0) + Math.max(0, -affinity) * 3 + temper * 10 },
    { item: 'talk', weight: 3 + Math.max(0, affinity) * 2 + (score >= 20 ? 2 : 0) },
    { item: 'share', weight: 2 + Math.max(0, affinity) },
    { item: 'cover', weight: 1.5 },
  ] as const);

  if (kind === 'argument') {
    // The one with the temper starts it.
    const [starter, other] = maxTraitHook(b.s, 'argueChance') > maxTraitHook(a.s, 'argueChance') ? [b, a] : [a, b];
    socialEvent(sim, starter, other, SOCIAL_ARGUMENT, REL_ARGUMENT, 4);
    revealHook(sim, starter, 'argueChance');
  } else if (kind === 'share') {
    socialEvent(sim, a, b, SOCIAL_SHARE, REL_SHARED, -3);
  } else if (kind === 'cover') {
    socialEvent(sim, a, b, SOCIAL_COVER, REL_COVERED, 0);
  } else {
    socialEvent(sim, a, b, SOCIAL_TALK, 5, -4);
  }
}

// ---------------------------------------------------------------- discovery

export function discoveryBeat(sim: Sim): void {
  const crew = standing(sim);
  const finder = sim.rng.pick(crew);
  const leads = sim.loc.leadsTo.filter(
    (id) => !locationState(sim.state, id).discovered && !sim.discovered.includes(id),
  );
  const stashBonus = crew.reduce((sum, m) => sum + sumGearHook(m.s, 'stashBonus'), 0);
  const kind = sim.rng.weighted([
    { item: 'stash', weight: 4 + stashBonus * 20 },
    { item: 'lead', weight: leads.length > 0 ? (sim.plan.job === 'scout' ? 9 : 3) : 0 },
    { item: 'lore', weight: 2 },
    { item: 'wreck', weight: sim.loc.wrecks && sim.foundVehicles.length === 0 ? WRECK_FIND_WEIGHT : 0 },
  ] as const);

  if (kind === 'lead') {
    const id = sim.rng.pick(leads);
    sim.discovered.push(id);
    startBeat(sim, 'discovery', 'A Lead');
    say(sim, flavor(sim, DISCOVERY_LEAD, { a: finder }, { loc: getLocation(id).name }), { tone: 'good' });
  } else if (kind === 'stash') {
    startBeat(sim, 'discovery', 'Hidden Stash');
    const res = pickResource(sim);
    const amount = Math.round((2 + sim.loc.danger + sim.rng.int(0, 2)) * lootMult(finder));
    addLoot(sim, res, amount);
    say(sim, `${flavor(sim, DISCOVERY_STASH, { a: finder })} ${capitalize(String(amount))} ${res}.`, { tone: 'good' });
    if (sim.rng.chance(0.35)) findGear(sim, finder);
  } else if (kind === 'wreck') {
    const wrecks = sim.loc.wrecks!.map(getVehicleDef);
    const def = sim.rng.weightedBy(wrecks, (d) => d.findWeight);
    const v = createVehicle(sim.state, def.id, sim.rng.int(FOUND_VEHICLE_CONDITION[0], FOUND_VEHICLE_CONDITION[1]));
    sim.foundVehicles.push(v);
    startBeat(sim, 'discovery', 'Wheels');
    say(sim, flavor(sim, VEHICLE_FOUND, { a: finder }, { vehicle: def.name }), { tone: 'good' });
  } else {
    startBeat(sim, 'discovery', 'Echoes');
    say(sim, flavor(sim, DISCOVERY_LORE, { a: finder }));
    for (const m of crew) stress(sim, m, -3);
  }
}
