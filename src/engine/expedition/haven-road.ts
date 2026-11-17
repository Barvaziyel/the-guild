/**
 * The road east (§9.12, 3.0.0): the guild's last run, played from a script
 * instead of random beats. The whole guild goes; at each fight the six in best
 * shape fight and the rest stay with the vehicles; every fight is under
 * command as on any led run (§7.13). At the gate, the one who went east is
 * shot running to them, the Vultures pull up, and the guild fights the
 * Shepherd. How it ends goes in `result.havenEnd`; completeRun applies it.
 */
import {
  HAVEN_FREED,
  HAVEN_GATE_ROUNDS,
  HAVEN_ROAD_MINUTES,
  HAVEN_STORES,
  HAVEN_TEAM,
  HAVEN_VULTURE_ALLIES,
} from '../constants.ts';
import { getEnemy, HAVEN_JOURNEY, HAVEN_VULTURES } from '../content/index.ts';
import { addChronicle } from '../chronicle.ts';
import { generateSurvivor } from '../generator.ts';
import { fillRoles } from '../text.ts';
import type { GameState, HavenEnd, Survivor } from '../types.ts';
import { addLoot, resolveFight } from './beats.ts';
import { newEnemy, patchUp, type Enemy, type FightResult, type FightStart } from './combat.ts';
import { bestBy, capitalize, isHurt, listNames, numberWord, say, simBonus, simDay, standing, startBeat, stress, type Member, type Sim } from './context.ts';
import { resolveWounds } from './wounds.ts';
import { maxHp } from '../stats.ts';

/** What the road brought: the end at the gate, and who was freed there. */
export interface RoadPlayed {
  end: HavenEnd;
}

/** Who fights at a stop: the six in best shape, the most HP first, then the best fighters. */
export function roadTeam(sim: Sim): Member[] {
  const power = (m: Member): number => m.s.stats.brawn + m.s.stats.aim + (m.s.equipment.weapon ? 2 : 0);
  return standing(sim)
    .slice()
    .sort((a, b) => b.s.hp - a.s.hp || power(b) - power(a))
    .slice(0, HAVEN_TEAM);
}

/** The enemies at a stop, at that stop's danger. */
function band(ids: readonly string[], danger: number): Enemy[] {
  return ids.map((id) => newEnemy(getEnemy(id), danger));
}

/** Red Hand's toll on the highway, danger 4. */
export const TOLL_ENEMIES = ['raider_enforcer', 'raider_brute', 'raider_gunner', 'raider_gunner', 'raider_scav', 'raider_scav'] as const;
/** Hollows out of the Glow, danger 5. */
export const GLOW_ENEMIES = ['hollow_hulk', 'glowing_hollow', 'glowing_hollow', 'hollow', 'hollow', 'hollow'] as const;
/** The north gate, danger 5: the Shepherd, its orderlies, and a marksman on the wall. */
export const GATE_ENEMIES = ['the_shepherd', 'haven_orderly', 'haven_orderly', 'haven_marksman'] as const;

/**
 * One fight on the road: the team goes forward (with any allies), the rest stay
 * with the vehicles. Afterwards everyone's together again, and those at the
 * vehicles help whoever went down; the guild drives on whatever happened.
 */
function roadFight(sim: Sim, site: string, enemies: Enemy[], start: FightStart, allies: Member[] = []): FightResult {
  const all = sim.members;
  const team = roadTeam(sim);
  // Nobody fit to fight: they can't, and it's lost without one.
  if (team.length === 0) {
    say(sim, 'Nobody is fit to fight. They can only watch.', { tone: 'bad' });
    return { end: 'routed', loot: {} };
  }
  const stay = all.length - team.length;
  if (stay > 0) {
    say(sim, `${listNames(team.map((m) => m.s.firstName))} go forward. The others stay with the vehicles${sim.state.children.length > 0 ? ' and the children' : ''}.`);
  }
  sim.members = [...team, ...allies];
  sim.site = site;
  let result: FightResult;
  try {
    result = resolveFight(sim, enemies, start);
  } finally {
    sim.members = all;
    delete sim.site;
  }
  resolveWounds(sim);
  sim.turnBack = false;
  sim.routed = false;
  // On the drive, those knocked down come round: there's time, and the road goes on. Then the meds.
  for (const m of sim.members) {
    if (!m.down || m.dead) continue;
    m.down = false;
    m.s.hp = Math.max(1, m.s.hp);
  }
  patchUpAll(sim);
  return result;
}

/** Between fights they patch each other up, the down first, as long as the meds last (as between a raid's bands, §9.8). */
function patchUpAll(sim: Sim): void {
  const needing = sim.members.filter((m) => !m.dead && (m.down || isHurt(m))).sort((a, b) => Number(b.down) - Number(a.down));
  for (const m of needing) {
    if (sim.meds <= 0) break;
    const medic = bestBy(standing(sim), (o) => simBonus(sim, o, 'wits', ['medicine']));
    if (!medic) break;
    patchUp(sim, medic, m);
  }
}

/** The time of a part of the road: its minutes from setting out, plus every wait so far. */
function at(sim: Sim, minutes: number): void {
  sim.offset = Math.max(sim.offset, minutes * 60_000 + sim.delay);
}

/** The Vultures who fight beside the guild at the gate: they gave their word (§9.11), and their boss and a lieutenant are free. */
export function vultureAllies(state: GameState): Survivor[] {
  const v = state.vultures;
  if (!v.arrived || !state.haven?.found.some((f) => f.id === HAVEN_VULTURES.id)) return [];
  const free = v.people.filter((p) => p.status === 'free');
  const boss = free.filter((p) => p.role === 'boss');
  const rest = free.filter((p) => p.role !== 'boss');
  return [...boss, ...rest].slice(0, HAVEN_VULTURE_ALLIES).map((p) => structuredClone(p.person));
}

/** The one who went east (§9.11), if they did: they're at Haven now. */
function dreamerAtHaven(state: GameState): Survivor | undefined {
  const d = state.haven?.dreamer;
  if (!d || d.gone === undefined) return undefined;
  return state.departed.find((s) => s.id === d.id);
}

/**
 * The road east, start to finish. `state` is the guild as it set out (for the
 * one who went east, the Vultures and the children); the crew is `sim.members`.
 */
export function playHavenRoad(sim: Sim, state: GameState, newMember: (s: Survivor) => Member): RoadPlayed {
  const day = simDay(sim);
  if (state.children.length > 0) say(sim, HAVEN_JOURNEY.children);

  at(sim, HAVEN_ROAD_MINUTES.highway);
  startBeat(sim, 'travel', HAVEN_JOURNEY.highway.title);
  for (const line of HAVEN_JOURNEY.highway.lines) say(sim, line);

  // Red Hand across the highway.
  at(sim, HAVEN_ROAD_MINUTES.toll);
  startBeat(sim, 'combat', HAVEN_JOURNEY.toll.title);
  say(sim, HAVEN_JOURNEY.toll.intro, { tone: 'bad' });
  roadFight(sim, 'haven_toll', band(TOLL_ENEMIES, 4), { ambushed: false, drop: false });

  // One of Haven's trucks, going the other way. Nobody knows yet.
  at(sim, HAVEN_ROAD_MINUTES.truck);
  startBeat(sim, 'travel', HAVEN_JOURNEY.truck.title);
  for (const line of HAVEN_JOURNEY.truck.lines) say(sim, line);

  // Hollows out of the Glow: Haven's failures, though nobody knows that yet either.
  at(sim, HAVEN_ROAD_MINUTES.glow);
  startBeat(sim, 'combat', HAVEN_JOURNEY.glow.title);
  say(sim, HAVEN_JOURNEY.glow.intro, { tone: 'bad' });
  roadFight(sim, 'haven_glow', band(GLOW_ENEMIES, 5), { ambushed: false, drop: false });

  at(sim, HAVEN_ROAD_MINUTES.dam);
  startBeat(sim, 'discovery', HAVEN_JOURNEY.dam.title);
  for (const line of HAVEN_JOURNEY.dam.lines) say(sim, line);

  // The north gate: the truth, then the last fight.
  at(sim, HAVEN_ROAD_MINUTES.gate);
  startBeat(sim, 'combat', HAVEN_JOURNEY.gate.title);
  const dreamer = dreamerAtHaven(state);
  const scene = dreamer ? HAVEN_JOURNEY.gate.dreamer.map((t) => fillRoles(t, { a: dreamer })) : HAVEN_JOURNEY.gate.stranger;
  scene.forEach((line, i) => say(sim, line, i === scene.length - 1 ? { tone: 'bad' } : {}));
  for (const m of sim.members) {
    stress(sim, m, 10, 'what they saw at Haven’s gate');
    if (dreamer) addChronicle(m.s, day, fillRoles(HAVEN_JOURNEY.saw, { a: dreamer }), ['haven', dreamer.id]);
  }
  const vultures = vultureAllies(state);
  if (vultures.length > 0) say(sim, fillRoles(HAVEN_JOURNEY.gate.vultures, { v: vultures[0]! }));
  say(sim, HAVEN_JOURNEY.gate.open, { tone: 'bad' });
  const allies = vultures.map((p) => ({ ...newMember(p), ally: true }));
  // Nobody dies at the gate: whoever goes down is dragged back to the trucks (§9.12).
  // And nobody pulls back from it on their own: it's fought to the end, or until the player pulls them out.
  const mercy = sim.mercy;
  const plan = sim.plan;
  sim.mercy = true;
  sim.plan = { ...plan, retreat: 'never' };
  const last = roadFight(sim, 'haven_gate', band(GATE_ENEMIES, 5), { ambushed: false, drop: false, rounds: HAVEN_GATE_ROUNDS }, allies);
  sim.mercy = mercy;
  sim.plan = plan;
  const won = last.end === 'won';

  // How it ends.
  const words = won ? HAVEN_JOURNEY.won : HAVEN_JOURNEY.lost;
  startBeat(sim, 'discovery', words.title);
  const freed: Survivor[] = [];
  if (won) {
    say(sim, words.lines[0]!, { tone: 'good' });
    say(sim, words.lines[1]!);
    const n = sim.rng.int(HAVEN_FREED[0], HAVEN_FREED[1]);
    for (let i = 0; i < n; i++) {
      const person = generateSurvivor(sim.state, sim.rng, { day });
      person.hp = Math.max(1, Math.round(maxHp(person) * 0.5));
      freed.push(person);
    }
    say(sim, `${capitalize(numberWord(n))} of them can walk.`, { tone: 'good' });
    say(sim, words.lines[2]!);
    if (vultures.length > 0) say(sim, HAVEN_JOURNEY.won.vultures);
    for (const res of ['meds', 'tech', 'scrap'] as const) addLoot(sim, res, sim.rng.int(HAVEN_STORES[res][0], HAVEN_STORES[res][1]));
    say(sim, words.lines[3]!, { tone: 'good' });
  } else {
    const first = HAVEN_JOURNEY.lost.first[last.end] ?? HAVEN_JOURNEY.lost.first.routed!;
    say(sim, `${first} ${vultures.length > 0 ? HAVEN_JOURNEY.lost.vultures : HAVEN_JOURNEY.lost.alone}`, { tone: 'bad' });
    for (const line of HAVEN_JOURNEY.lost.lines) say(sim, line);
  }
  for (const m of sim.members) addChronicle(m.s, day, won ? HAVEN_JOURNEY.wentWon : HAVEN_JOURNEY.wentLost, ['haven']);

  at(sim, HAVEN_ROAD_MINUTES.home);
  return {
    end: { won, ...(dreamer ? { shot: dreamer.id } : {}), vultures: vultures.length > 0, ...(freed.length > 0 ? { freed } : {}) },
  };
}
