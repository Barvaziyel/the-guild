/**
 * The Vultures on a run (§7.11): a meeting in their turf, settled by the
 * crew's orders and how things stand with them, or the guild hitting one of
 * their camps. What happens goes into `sim.vultures.news`, applied when the
 * crew is back (`applyVultureNews`). In 18b a meeting becomes a radio call.
 */
import {
  ENCOUNTER_BASE,
  ENCOUNTER_CREW_MULT,
  ENCOUNTER_PER_DANGER,
  MAX_ENEMIES,
  VULTURES_ASSAULT_BUDGET,
  VULTURES_ASSAULT_STANDING,
  VULTURES_CAMP_GEAR_CHANCE,
  VULTURES_CAMP_STORES,
  VULTURES_CAPTURE_CHANCE,
  VULTURES_FIGHT_STANDING,
  VULTURES_KILLED_STRENGTH,
  VULTURES_KILL_STANDING,
  VULTURES_LIEUTENANT_CHANCE,
  VULTURES_NEWS_CHANCE,
  VULTURES_NOD_STANDING,
  VULTURES_PARTNER_NOD_STANDING,
  VULTURES_STANDOFF_DC,
  VULTURES_TOLL,
  VULTURES_TOLL_STANDING,
  VULTURES_WAR,
} from '../constants.ts';
import { getEnemy, getLocation } from '../content/index.ts';
import { locationState } from '../locations.ts';
import { effectiveStat } from '../stats.ts';
import { fullName, pronounForms } from '../text.ts';
import type { ResourceId, VultureMember } from '../types.ts';
import { RESOURCE_IDS } from '../types.ts';
import { addLoot, findGear, lootText, pickResource, resolveFight } from './beats.ts';
import { newEnemy, type CombatEnd, type Enemy } from './combat.ts';
import { bestBy, check, say, simDay, standing, startBeat, type Sim, type SimVultures } from './context.ts';

/**
 * Their side, bought with a fight's usual threat budget for the place and the
 * crew, scaled by their strength (×1 at 40, ×1.3 at 100) and bigger at a camp:
 * a named one at their head if there is one, then Vultures and Vulture Shots.
 */
function vultureCrew(sim: Sim, leader: VultureMember | undefined, scale = 1): Enemy[] {
  const v = sim.vultures!;
  const crewMult = ENCOUNTER_CREW_MULT[Math.min(standing(sim).length, ENCOUNTER_CREW_MULT.length) - 1] ?? 1;
  let budget = (ENCOUNTER_BASE + sim.loc.danger * ENCOUNTER_PER_DANGER) * crewMult * (0.8 + v.strength / 200) * scale;
  const out: Enemy[] = [];
  if (leader) {
    const e = namedEnemy(sim, leader);
    out.push(e);
    budget -= e.def.threat;
  }
  const kinds = [getEnemy('vulture_scav'), getEnemy('vulture_shot')];
  while (out.length < MAX_ENEMIES) {
    const affordable = kinds.filter((d) => d.threat <= budget);
    if (affordable.length === 0) break;
    const def = sim.rng.pick(affordable);
    out.push(newEnemy(def, sim.loc.danger));
    budget -= def.threat;
  }
  if (out.length === 0) out.push(newEnemy(kinds[0]!, sim.loc.danger));
  return out;
}

/** A lieutenant, or the boss (a little tougher), under their own name. */
function namedEnemy(sim: Sim, m: VultureMember): Enemy {
  const e = newEnemy(getEnemy('vulture_lieutenant'), sim.loc.danger);
  if (m.role === 'boss') {
    e.hp = e.maxHp = Math.round(e.hp * 1.3);
    e.attack += 1;
  }
  e.vulture = { id: m.person.id, name: fullName(m.person) };
  return e;
}

/** A line in a named Vulture's history, and the guild has met them. */
function meet(v: SimVultures, sim: Sim, m: VultureMember, text: string): void {
  if (!v.news.met.includes(m.person.id)) v.news.met.push(m.person.id);
  v.news.history.push({ id: m.person.id, line: { day: simDay(sim), text } });
}

/** The crew's side of a meeting or an attack: "The crew", or the one person out there. */
function crewWord(sim: Sim): string {
  return sim.members.length === 1 ? sim.members[0]!.s.firstName : 'The crew';
}

/** A meeting in their turf, or the attack on a camp. */
export function vulturesBeat(sim: Sim): void {
  const v = sim.vultures;
  if (!v) return;
  v.met = true;
  if (sim.plan.job === 'assault' && v.camp) {
    assault(sim, v);
    return;
  }
  startBeat(sim, 'vultures', 'The Vultures');
  const candidate = v.camp?.leader ?? v.nearby;
  const leader = candidate && sim.rng.chance(VULTURES_LIEUTENANT_CHANCE) ? candidate : undefined;
  say(sim, `Black feathers on the next rise: a Vulture crew${leader ? `, ${fullName(leader.person)} at their head` : ''}.`);
  if (v.band === 'truce' || v.band === 'trade') friendly(sim, v, leader);
  else if (v.band === 'wary') standoff(sim, v, leader);
  else hostile(sim, v, leader);
}

function friendly(sim: Sim, v: SimVultures, leader: VultureMember | undefined): void {
  say(sim, 'They raise a hand and keep their distance. Nobody reaches for anything.', { tone: 'good' });
  v.news.standing += v.band === 'trade' ? VULTURES_PARTNER_NOD_STANDING : VULTURES_NOD_STANDING;
  if (leader) meet(v, sim, leader, `Passed a guild crew at ${sim.loc.name}, peaceably.`);
  if (!sim.rng.chance(VULTURES_NEWS_CHANCE)) return;
  const unknown = getLocation(sim.loc.id).leadsTo.filter((id) => !locationState(sim.state, id).discovered && !sim.discovered.includes(id));
  if (unknown.length === 0) return;
  const id = sim.rng.pick(unknown);
  sim.discovered.push(id);
  say(sim, `In passing, they mention a place the guild hasn't found: ${getLocation(id).name}.`, { tone: 'good' });
}

/** A sneaky crew tries to get by unseen: the quietest Wits against their lookouts. */
function slipPast(sim: Sim, v: SimVultures): boolean {
  if (sim.plan.approach !== 'sneaky') return false;
  const scout = bestBy(standing(sim), (m) => effectiveStat(m.s, 'wits'))!;
  const result = check(sim, scout, 'wits', 8 + Math.floor(v.strength / 25), ['sneak'], { crew: true });
  if (result.success) {
    say(sim, sim.members.length === 1 ? `${scout.s.firstName} goes to ground until they've passed.` : 'The crew goes to ground until they have passed.', { check: result.info, tone: 'good' });
    return true;
  }
  say(sim, 'A lookout whistles. They\'ve been seen.', { check: result.info, tone: 'bad' });
  return false;
}

function standoff(sim: Sim, v: SimVultures, leader: VultureMember | undefined): void {
  if (slipPast(sim, v)) return;
  if (sim.plan.approach === 'aggressive') {
    say(sim, `They want a toll for passing. ${crewWord(sim)} has other ideas.`, { tone: 'bad' });
    fightThem(sim, v, leader, { ambushed: false, drop: false });
    return;
  }
  const face = bestBy(standing(sim), (m) => effectiveStat(m.s, 'nerve'))!;
  const result = check(sim, face, 'nerve', VULTURES_STANDOFF_DC + Math.floor(v.strength / 25), ['intimidate'], { crew: true });
  if (result.success) {
    say(sim, `${face.s.firstName} stares them down. After a long moment the Vultures step aside.`, { check: result.info, tone: 'good' });
    if (leader) meet(v, sim, leader, `Backed down from a guild crew at ${sim.loc.name}.`);
    return;
  }
  const toll: Partial<Record<ResourceId, number>> = {};
  for (const r of RESOURCE_IDS) {
    const n = Math.floor(sim.loot[r] * VULTURES_TOLL);
    if (n > 0) {
      toll[r] = n;
      sim.loot[r] -= n;
    }
  }
  const paid = lootText(toll);
  say(
    sim,
    paid ? `They want a toll for passing, and ${face.s.firstName} can't talk them out of it. ${crewWord(sim)} hands over ${paid}.` : 'They want a toll for passing, but the packs are empty. They laugh, and wave them on.',
    { check: result.info, tone: 'bad' },
  );
  if (paid) v.news.standing += VULTURES_TOLL_STANDING;
  if (leader) meet(v, sim, leader, `Took a toll from a guild crew at ${sim.loc.name}.`);
}

function hostile(sim: Sim, v: SimVultures, leader: VultureMember | undefined): void {
  if (slipPast(sim, v)) return;
  say(sim, 'They don\'t stop to talk.', { tone: 'bad' });
  fightThem(sim, v, leader, { ambushed: sim.plan.approach !== 'aggressive', drop: false });
}

function fightThem(sim: Sim, v: SimVultures, leader: VultureMember | undefined, start: { ambushed: boolean; drop: boolean }, scale = 1): CombatEnd {
  const enemies = vultureCrew(sim, leader, scale);
  const result = resolveFight(sim, enemies, start);
  v.news.standing += VULTURES_FIGHT_STANDING;
  settle(sim, v, enemies, result.end, leader);
  return result.end;
}

/** After a fight: their dead weaken them, and a named one down is captured or dead. */
function settle(sim: Sim, v: SimVultures, enemies: readonly Enemy[], end: CombatEnd, leader: VultureMember | undefined): void {
  const place = sim.loc.name;
  for (const e of enemies) {
    if (!e.dead) continue;
    if (!e.vulture || !leader) {
      v.news.strength += VULTURES_KILLED_STRENGTH;
      continue;
    }
    const p = pronounForms(leader.person.pronouns);
    if (end === 'won' && sim.rng.chance(VULTURES_CAPTURE_CHANCE)) {
      v.news.captured.push(leader.person.id);
      say(sim, `${e.vulture.name} is down, and alive. ${crewWord(sim)} ties ${p.them} up and brings ${p.them} along.`, { tone: 'good' });
      meet(v, sim, leader, `Captured by the guild at ${place}.`);
    } else {
      v.news.killed.push(leader.person.id);
      v.news.standing += VULTURES_KILL_STANDING;
      say(sim, `${e.vulture.name} is dead.`, { tone: 'bad' });
      meet(v, sim, leader, `Killed by the guild at ${place}.`);
    }
  }
  if (leader && !enemies.some((e) => e.vulture && e.dead)) meet(v, sim, leader, `Fought a guild crew at ${place}.`);
}

/** Hit their camp: a bigger fight, with whoever holds it; win, and the camp and its stores are the guild's. */
function assault(sim: Sim, v: SimVultures): void {
  const camp = v.camp!;
  const leader = camp.leader;
  startBeat(sim, 'vultures', 'Their camp');
  say(sim, `The Vultures' camp: a ring of wrecks around a fire, and lookouts on the roofs.${leader ? ` ${fullName(leader.person)} is there.` : ''}`);
  const end = fightThem(sim, v, leader, { ambushed: false, drop: sim.plan.approach === 'sneaky' }, VULTURES_ASSAULT_BUDGET);
  // Hitting a camp means war, from wherever things stood.
  v.news.standing += VULTURES_ASSAULT_STANDING;
  if (v.standing + v.news.standing > VULTURES_WAR) v.news.standing = VULTURES_WAR - v.standing;
  if (end !== 'won') {
    say(sim, `${crewWord(sim)} couldn't take the camp.`, { tone: 'bad' });
    return;
  }
  v.news.campTaken = camp.locationId;
  const stores: Partial<Record<ResourceId, number>> = {};
  let left = sim.rng.int(VULTURES_CAMP_STORES[0], VULTURES_CAMP_STORES[1]);
  for (let i = 0; i < 3 && left > 0; i++) {
    const r = pickResource(sim);
    const n = i === 2 ? left : Math.round(left / (3 - i));
    stores[r] = (stores[r] ?? 0) + n;
    left -= n;
  }
  for (const r of RESOURCE_IDS) if (stores[r]) addLoot(sim, r, stores[r]!);
  say(sim, `The camp is the guild's. Their stores: ${lootText(stores)}.`, { tone: 'good' });
  const finder = bestBy(standing(sim), (m) => effectiveStat(m.s, 'wits'));
  if (finder && sim.rng.chance(VULTURES_CAMP_GEAR_CHANCE)) findGear(sim, finder);
}
