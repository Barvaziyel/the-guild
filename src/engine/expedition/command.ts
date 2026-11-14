/**
 * Fights the player commands (§7.13): which moves each person has this round,
 * and what the fight looks like when it stops for the next round's orders.
 * The rounds themselves are played in combat.ts.
 */
import { MAX_COMBAT_ROUNDS } from '../constants.ts';
import { MOVES } from '../content/moves.ts';
import { gearHooks, itemDef } from '../gear.ts';
import { maxHp } from '../stats.ts';
import { visibleTraits } from '../traits.ts';
import { getTrait } from '../content/index.ts';
import type { LogLine, MoveId, Rank } from '../types.ts';
import type { CombatEnd, Enemy } from './combat.ts';
import { active, type Member, type Sim } from './context.ts';
import { enemyRank, reaches, type EnemyRank } from './reach.ts';

/** A move someone can make this round, and what it can be aimed at. */
export interface MoveChoice {
  move: MoveId;
  /** "Shoot", "Strike" or "Punch" for an attack; the move's name otherwise. */
  name: string;
  detail: string;
  target: 'enemy' | 'ally' | 'none';
  /** Enemy places in the fight, or ally survivor ids. Empty when the move needs no target. */
  targets: (number | string)[];
}

export interface FightEnemyView {
  /** Its place in the fight: what an order's target names. */
  index: number;
  /** "Raider Scav 2", or a nemesis's or a Vulture's name. */
  name: string;
  /** Its kind of enemy: raider, feral, hollow, scrapbot. */
  type: string;
  /** Which enemy it is ('raider_gunner', 'rad_hound'...), for its drawing. */
  kind: string;
  hp: number;
  maxHp: number;
  /** `down`: on the ground, and back up at the end of the round unless someone finishes it (2.4.0). */
  state: 'up' | 'down' | 'dead' | 'fled';
  /** Loses its next attack. */
  stunned: boolean;
  /** A nemesis or one of the Vultures' named people. */
  named: boolean;
  /** A nemesis: an enemy with a name and a grudge (§7.7). */
  nemesis: boolean;
  /** One of the Vultures (§7.11). */
  vulture: boolean;
  /** Where it stands (2.3.0): in front, at the back (it shoots), or in the air (it flies). */
  rank: EnemyRank;
  /** What it means to do this round, chosen before the crew acts (2.3.0): a hit or a big hit at someone (a survivor id), or a run for it. */
  intent?: { kind: 'strike' | 'heavy' | 'run'; at?: string };
  /** What one of its hits does, before armor; a big hit does twice that. */
  damage: number;
  /** What comes off every hit on it (2.4.0: a brute's is 3). */
  armor: number;
  /** Gets back up once unless finished (hollows, 2.4.0). */
  rises: boolean;
  /** Hunts as a pack (hounds, 2.4.0). */
  pack: boolean;
  /** Winds up big hits now and then. */
  heavy: boolean;
  /** It leads them: its fall shakes the rest. */
  leader: boolean;
  /** It never breaks and runs. */
  fearless: boolean;
}

/**
 * One thing that happened in a commanded fight, for the battle stage to play:
 * who did it (an ally's survivor id, or an enemy's place in the fight), to whom, and how it went.
 */
export interface FightAct {
  round: number;
  /** The line in `FightView.lines` that tells it; acts with no line of their own (an enemy's miss) point at the next one. */
  line: number;
  by: number | string;
  at?: number | string;
  kind: FightActKind;
  /** Damage dealt, or HP healed. */
  amount?: number;
  /** A shot rather than a blow. */
  shot?: boolean;
  /** The target went down (a person) or reels (a stunned enemy). */
  down?: boolean;
  stun?: boolean;
  /** For talk and withdraw: whether it worked. */
  ok?: boolean;
}

export type FightActKind =
  /** An attack that lands; `kill` when it finishes an enemy. */
  | 'hit'
  | 'miss'
  | 'kill'
  /** Patching someone up; `revive` gets someone down back on their feet. */
  | 'heal'
  | 'revive'
  /** Intimidate, soothe, short out. */
  | 'talk'
  | 'cover'
  | 'aim'
  | 'draw_fire'
  | 'guard'
  | 'spot'
  /** A person losing their nerve and running. */
  | 'flee'
  /** Enemies breaking, a nemesis getting away. */
  | 'break'
  | 'escape'
  /** A stunned enemy losing its attack. */
  | 'reel'
  /** The crew trying to break away. */
  | 'withdraw'
  /** A blow at one on the ground, so it stays down (2.4.0). */
  | 'finish'
  /** One on the ground getting back up (2.4.0): `amount` is its HP. */
  | 'rise';

export interface FightMemberView {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  state: 'up' | 'down' | 'dead' | 'fled';
  /** Aimed last round: the next shot is better. */
  aimed: boolean;
  /** Empty for anyone who can't act. What they can do where they stand now. */
  moves: MoveChoice[];
  /** Where they stand (2.3.0). */
  rank: Rank;
  /** What they could do from either rank, for an order that moves them. */
  byRank: Record<Rank, MoveChoice[]>;
  /** A lookout shooting from the Watchtower in a raid (§9.8). */
  perch?: boolean;
}

/** A fight stopped for orders: what the player sees on the fight screen. */
export interface FightView {
  /** The round about to be played, and how many there can be. */
  round: number;
  maxRounds: number;
  place: string;
  enemies: FightEnemyView[];
  crew: FightMemberView[];
  /** What's left in the packs. */
  meds: number;
  ammo: number;
  /** The fight so far. */
  lines: LogLine[];
  /** What happened in it, act by act, for the battle stage. */
  acts: FightAct[];
  /** A raid at the Depot: the guild's dog, fighting alongside (§9.8). Its acts are by 'dog'. */
  dog?: string;
  /** How it ended, once it's over. */
  over?: CombatEnd;
  /** Their nerve, 0–100, when any of them can break (2.3.0): at 0 they run. */
  nerve?: number;
}

/** Thrown inside a replay when a fight under command needs the next round's orders. */
export class FightPause extends Error {
  view: FightView;
  constructor(view: FightView) {
    super('The fight waits for orders.');
    this.view = view;
  }
}

const living = (enemies: readonly Enemy[]): Enemy[] => enemies.filter((e) => !e.dead && !e.fled && !e.down);

/** Names to tell enemies apart: "Raider Scav 1", "Raider Scav 2", "Old Notch". */
export function enemyNames(enemies: readonly Enemy[]): string[] {
  const counts = new Map<string, number>();
  for (const e of enemies) if (!e.nemesis && !e.vulture) counts.set(e.def.name, (counts.get(e.def.name) ?? 0) + 1);
  const seen = new Map<string, number>();
  return enemies.map((e) => {
    if (e.nemesis) return e.nemesis.name;
    if (e.vulture) return e.vulture.name;
    if ((counts.get(e.def.name) ?? 0) < 2) return e.def.name;
    const n = (seen.get(e.def.name) ?? 0) + 1;
    seen.set(e.def.name, n);
    return `${e.def.name} ${n}`;
  });
}

/** Moves traits (that show) and equipped gear add. */
export function grantedMoves(m: Member): Set<MoveId> {
  const out = new Set<MoveId>();
  for (const t of visibleTraits(m.s)) for (const move of getTrait(t.id).hooks?.moves ?? []) out.add(move);
  for (const hooks of gearHooks(m.s)) for (const move of hooks.moves ?? []) out.add(move);
  return out;
}

/** What their weapon does this round: shoot (a gun with ammo, or the crossbow), strike, or punch. */
export function attackKind(sim: Sim, m: Member): 'shoot' | 'strike' | 'punch' {
  const weapon = m.s.equipment.weapon;
  if (!weapon) return 'punch';
  const def = itemDef(weapon);
  if (def.weaponType === 'ranged') return !def.usesAmmo || sim.ammo > 0 ? 'shoot' : 'strike';
  return 'strike';
}

const ATTACK_NAMES = { shoot: 'Shoot', strike: 'Strike', punch: 'Punch' } as const;

/**
 * Where someone stands when a fight starts (2.3.0): everyone in front, so the
 * blows spread as they always have. A lookout on the Watchtower counts as the back.
 * Sending someone back is the commander's call: safe from blows, but whoever is
 * left in front takes them all.
 */
export function defaultRank(_sim: Sim, m: Member): Rank {
  return m.perch ? 'back' : 'front';
}

/** Everything this person can do this round from where they stand (or from `rank`), with what each move can be aimed at. */
export function movesFor(sim: Sim, m: Member, enemies: readonly Enemy[], rank: Rank = m.rank ?? 'front'): MoveChoice[] {
  if (m.down || m.dead || m.fled) return [];
  const foes = living(enemies);
  const kind = attackKind(sim, m);
  const gun = kind === 'shoot';
  // Blows reach only what's close (2.3.0); shots, anything.
  const from: Rank = m.perch ? 'back' : rank;
  const reachable = (shot: boolean): number[] => foes.filter((e) => reaches(shot, from, e, enemies)).map((e) => enemies.indexOf(e));
  const foeIds = reachable(gun);
  const anyFoe = foes.map((e) => enemies.indexOf(e));
  const granted = grantedMoves(m);
  const out: MoveChoice[] = [];
  const add = (move: MoveId, targets: (number | string)[] = [], name?: string): void => {
    const def = MOVES[move];
    if (def.target !== 'none' && targets.length === 0) return;
    out.push({ move, name: name ?? def.name, detail: def.detail, target: def.target, targets });
  };
  // One on the ground that would get back up (2.4.0): anyone who can reach it can finish it.
  add(
    'finish',
    enemies.filter((e) => e.down && !e.dead && reaches(gun, from, e, enemies)).map((e) => enemies.indexOf(e)),
  );
  const ofType = (type: string, unnamed = false): number[] =>
    foes.filter((e) => e.def.type === type && (!unnamed || (!e.nemesis && !e.vulture))).map((e) => enemies.indexOf(e));

  // A lookout on the Watchtower (§9.8) can only shoot, aim and point things out from up there.
  const PERCHED: readonly MoveId[] = ['attack', 'finish', 'aim', 'called_shot', 'spray', 'spot'];
  if (m.perch && kind === 'shoot') {
    return movesFor(sim, { ...m, perch: false }, enemies, 'back').filter((c) => PERCHED.includes(c.move));
  }
  add('attack', foeIds, ATTACK_NAMES[kind]);
  add('cover');
  if (sim.meds > 0) {
    const hurt = sim.members.filter((o) => !o.dead && !o.fled && (o.down || o.s.hp < maxHp(o.s))).map((o) => o.s.id);
    add('patch', hurt);
  }
  if (gun && !m.aimed) add('aim');
  if (granted.has('called_shot') && gun) add('called_shot', foeIds);
  const weapon = m.s.equipment.weapon ? itemDef(m.s.equipment.weapon) : undefined;
  if (granted.has('spray') && gun && foes.length >= 2 && (!weapon?.usesAmmo || sim.ammo >= 2)) add('spray', foeIds);
  if (granted.has('smash') && weapon?.weaponType === 'melee') add('smash', reachable(false));
  if (granted.has('stun') && weapon?.weaponType === 'melee') add('stun', reachable(false));
  if (granted.has('charge')) add('charge', foeIds);
  if (granted.has('draw_fire')) add('draw_fire');
  const others = active(sim).filter((o) => o !== m);
  if (granted.has('guard')) add('guard', others.map((o) => o.s.id));
  if (granted.has('spot') && others.length > 0) add('spot', anyFoe);
  if (granted.has('intimidate')) add('intimidate', ofType('raider', true));
  if (granted.has('soothe')) add('soothe', ofType('feral'));
  // Shorting a machine out takes a hand inside it: only what's in reach.
  if (granted.has('short_out')) add('short_out', ofType('scrapbot').filter((i) => reaches(false, from, enemies[i]!, enemies)));
  return out;
}

/** The move this person was ordered to make, if they can still make it at that target. */
export function validOrder(sim: Sim, m: Member, enemies: readonly Enemy[], move: MoveId, target: number | string | undefined): MoveChoice | undefined {
  const choice = movesFor(sim, m, enemies).find((c) => c.move === move);
  if (!choice) return undefined;
  if (choice.target !== 'none' && (target === undefined || !choice.targets.includes(target))) return undefined;
  return choice;
}

/** The fight as it stands before `round` (or after it, once it's over), for the fight screen. `nerve`: theirs, when any of them can break. */
export function fightView(sim: Sim, enemies: readonly Enemy[], round: number, fromLine: number, over?: CombatEnd, nerve?: number): FightView {
  const names = enemyNames(enemies);
  const beat = sim.beats.at(-1);
  return {
    round,
    maxRounds: MAX_COMBAT_ROUNDS,
    place: sim.loc.name,
    enemies: enemies.map((e, index) => ({
      index,
      name: names[index]!,
      type: e.def.type,
      kind: e.def.id,
      hp: Math.max(0, e.hp),
      maxHp: e.maxHp,
      state: e.dead ? 'dead' : e.fled ? 'fled' : e.down ? 'down' : 'up',
      stunned: e.stunned === true,
      named: e.nemesis !== undefined || e.vulture !== undefined,
      nemesis: e.nemesis !== undefined,
      vulture: e.def.id.startsWith('vulture_'),
      rank: enemyRank(e),
      damage: e.damage,
      armor: e.def.armor,
      rises: e.def.rises === true && !e.rose && !e.nemesis,
      pack: e.def.pack === true,
      heavy: e.def.heavy !== undefined,
      ...(e.intent && !over && !e.dead && !e.fled ? { intent: { kind: e.intent.kind, ...(e.intent.at ? { at: e.intent.at.s.id } : {}) } } : {}),
      leader: e.def.leader === true,
      fearless: e.def.morale === 'fearless' || e.nemesis !== undefined,
    })),
    crew: sim.members.map((m) => ({
      id: m.s.id,
      name: m.s.firstName,
      hp: m.s.hp,
      maxHp: maxHp(m.s),
      state: m.dead ? 'dead' : m.down ? 'down' : m.fled ? 'fled' : 'up',
      aimed: m.aimed === true,
      moves: movesFor(sim, m, enemies),
      rank: m.rank ?? 'front',
      byRank: { front: movesFor(sim, m, enemies, 'front'), back: movesFor(sim, m, enemies, 'back') },
      ...(m.perch ? { perch: true } : {}),
    })),
    ...(sim.gate?.dog ? { dog: sim.gate.dog } : {}),
    meds: sim.meds,
    ammo: sim.ammo,
    lines: beat ? beat.lines.slice(fromLine) : [],
    acts: (sim.fightActs?.acts ?? []).map((a) => ({ ...a, line: a.line - fromLine })),
    ...(over ? { over } : {}),
    ...(nerve !== undefined ? { nerve: Math.max(0, Math.round(nerve)) } : {}),
  };
}
