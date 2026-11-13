/**
 * The battle stage on the fight screen (§7.13): the fight as a `StageModel`
 * for `src/scene/battle.ts`, a round played back act by act, and what a tap
 * on someone in the fight does to the orders being given.
 */
import type { FightAct, FightView, GameState, MoveId, Run } from '../engine/index.ts';
import type { StageEffect, StageFighter, StageModel } from '../scene/index.ts';
import { needsTarget, type Picks } from './fight-view.ts';
import { figureLook } from './yard-view.ts';

type Shown = StageFighter['state'];

/** One moment of a round being played: the act, and how everyone stands once it's done. */
export interface StageFrame {
  /** The round the act is in, and the line in the view that tells it. */
  round: number;
  line: number;
  effect: StageEffect;
  hp: Record<string, number>;
  state: Record<string, Shown>;
  stunned: Record<string, boolean>;
}

/** What the stage needs to know about the orders being given. */
export interface StageOrders {
  picks: Picks;
  /** The person whose orders are open. */
  open?: string;
}

/** A tap on the stage's key for someone. */
export const crewKey = (id: string): string => `c:${id}`;
export const enemyKey = (index: number): string => `e:${index}`;
const keyFor = (who: number | string): string => (typeof who === 'number' ? enemyKey(who) : crewKey(who));

/** "Scav 2" for "Raider Scav 2", "Shot" for "Vulture Shot": the stage's room is tight, and the feather says Vulture. */
export function shortName(name: string): string {
  const words = name.split(' ');
  return words.length > 1 && (words[0] === 'Raider' || words[0] === 'Vulture') ? words.slice(1).join(' ') : name;
}

/** What a tap on an enemy can target for this person: the move they're picking if it takes an enemy, or else an attack. */
function enemyMove(view: FightView, member: string, picks: Picks): MoveId | undefined {
  const m = view.crew.find((c) => c.id === member);
  if (!m) return undefined;
  const pick = picks[member];
  const choice = pick ? m.moves.find((c) => c.move === pick.move) : undefined;
  if (choice?.target === 'enemy') return choice.move;
  return m.moves.find((c) => c.target === 'enemy' && (c.move === 'attack' || c.move === 'called_shot'))?.move ?? m.moves.find((c) => c.target === 'enemy')?.move;
}

/** Who the stage rings as tappable for the person whose orders are open, and who they've picked. */
export function stageTargets(view: FightView, orders: StageOrders): { targets: string[]; picked?: string } {
  const m = orders.open ? view.crew.find((c) => c.id === orders.open) : undefined;
  if (!m) return { targets: [] };
  const pick = orders.picks[m.id];
  const choice = pick ? m.moves.find((c) => c.move === pick.move) : undefined;
  const picked = pick?.target !== undefined ? keyFor(pick.target) : undefined;
  if (choice && choice.target === 'none') return { targets: [], ...(picked ? { picked } : {}) };
  if (choice?.target === 'ally') return { targets: choice.targets.map(keyFor), ...(picked ? { picked } : {}) };
  const move = enemyMove(view, m.id, orders.picks);
  const targets = m.moves.find((c) => c.move === move)?.targets.map(keyFor) ?? [];
  return { targets, ...(picked ? { picked } : {}) };
}

/**
 * A tap on someone in the fight. On an enemy: the open person's targeted move
 * goes at it, or they attack it. On one of the crew: the target of a move
 * that takes an ally, or else that person's orders open.
 */
export function tapOnStage(view: FightView, orders: StageOrders, key: string): StageOrders {
  const open = orders.open ? view.crew.find((c) => c.id === orders.open) : undefined;
  if (key.startsWith('e:')) {
    const index = Number(key.slice(2));
    if (!open) return orders;
    const move = enemyMove(view, open.id, orders.picks);
    const choice = open.moves.find((c) => c.move === move);
    if (!move || !choice?.targets.includes(index)) return orders;
    return { ...orders, picks: { ...orders.picks, [open.id]: { move, target: index } } };
  }
  const id = key.slice(2);
  const pick = open ? orders.picks[open.id] : undefined;
  if (open && pick && open.moves.find((c) => c.move === pick.move)?.targets.includes(id) && needsTarget(open, pick.move)) {
    return { ...orders, picks: { ...orders.picks, [open.id]: { move: pick.move, target: id } } };
  }
  const member = view.crew.find((c) => c.id === id);
  return member && member.moves.length > 0 ? { ...orders, open: id } : orders;
}

/** The fight drawn: everyone where they stand, with this moment's act if a round is being played. */
export function stageModel(state: GameState, run: Run, view: FightView, orders: StageOrders, frame?: StageFrame): StageModel {
  const crew: StageFighter[] = view.crew.map((m) => {
    const key = crewKey(m.id);
    const s = state.survivors.find((x) => x.id === m.id) ?? run.result.crew.find((x) => x.id === m.id);
    const hp = frame?.hp[key] ?? m.hp;
    const shown = frame?.state[key] ?? m.state;
    return {
      key,
      side: 'crew',
      label: m.name,
      title: `${m.name}, ${shown === 'up' ? `${hp} of ${m.maxHp} HP` : shown}`,
      hp,
      maxHp: m.maxHp,
      state: shown,
      ...(s ? { look: figureLook(s) } : {}),
      ...(s?.equipment.weapon ? { weapon: s.equipment.weapon.defId } : {}),
      aimed: frame ? false : m.aimed,
    };
  });
  const enemies: StageFighter[] = view.enemies.map((e) => {
    const key = enemyKey(e.index);
    const hp = frame?.hp[key] ?? e.hp;
    const shown = frame?.state[key] ?? e.state;
    return {
      key,
      side: 'enemy',
      label: shortName(e.name),
      title: `${e.name}, ${shown === 'up' ? `${hp} of ${e.maxHp}` : shown === 'fled' ? 'gone' : shown}`,
      hp,
      maxHp: e.maxHp,
      state: shown,
      kind: e.kind,
      type: e.type,
      seed: `${run.id}-${e.index}`,
      nemesis: e.nemesis,
      vulture: e.vulture,
      stunned: frame?.stunned[key] ?? e.stunned,
    };
  });
  const { targets, picked } = frame ? { targets: [], picked: undefined } : stageTargets(view, orders);
  return {
    place: run.plan.locationId,
    crew,
    enemies,
    ...(!frame && orders.open ? { giving: crewKey(orders.open) } : {}),
    targets,
    ...(picked ? { picked } : {}),
    ...(frame ? { effect: frame.effect } : {}),
  };
}

const ACT_WORDS: Partial<Record<FightAct['kind'], string>> = {
  cover: 'Takes cover',
  aim: 'Aims',
  draw_fire: 'Over here!',
  guard: 'Guards',
  spot: 'Spotted',
  flee: 'Runs!',
  break: 'Breaks!',
  escape: 'Gets away',
  reel: 'Reels',
};

/** How one act looks on the stage. */
function effectOf(a: FightAct, after: FightView): StageEffect {
  const by = keyFor(a.by);
  const at = a.at !== undefined ? keyFor(a.at) : undefined;
  const onCrew = typeof a.at === 'string';
  const base = { by, ...(at ? { at } : {}) };
  switch (a.kind) {
    case 'hit':
    case 'kill':
      return { ...base, motion: a.shot ? 'shoot' : 'lunge', reaction: 'hit', pop: `-${a.amount ?? 0}`, tone: onCrew ? 'hurt' : 'hit' };
    case 'miss':
      return { ...base, motion: a.shot ? 'shoot' : 'lunge', reaction: 'miss', pop: 'Miss', tone: 'miss' };
    case 'heal':
      return { ...base, motion: 'act', reaction: 'heal', pop: `+${a.amount ?? 0}`, tone: 'heal' };
    case 'revive':
      return { ...base, motion: 'act', reaction: 'heal', pop: 'Back up', tone: 'heal' };
    case 'talk': {
      const gone = typeof a.at === 'number' ? after.enemies[a.at]?.state : undefined;
      return { ...base, motion: 'act', reaction: 'none', pop: a.ok ? (gone === 'dead' ? 'Shuts down' : 'Backs off') : 'No good', tone: a.ok ? 'hit' : 'miss' };
    }
    case 'withdraw':
      return { by, motion: 'act', reaction: 'none', pop: a.ok ? 'Pulling out' : 'Cut off', tone: a.ok ? 'plain' : 'hurt', ...(a.ok ? { leaving: after.crew.filter((m) => m.state === 'up').map((m) => crewKey(m.id)) } : {}) };
    case 'flee':
    case 'break':
    case 'escape':
      return { by, motion: 'none', reaction: 'none', pop: ACT_WORDS[a.kind]!, tone: a.kind === 'flee' ? 'hurt' : 'hit', leaving: [by] };
    default:
      return { ...base, motion: a.kind === 'reel' ? 'none' : 'act', reaction: 'none', pop: ACT_WORDS[a.kind] ?? '', tone: 'plain' };
  }
}

/**
 * A round played back: one frame for each act since `before`, each with how
 * everyone stands once it's done. Empty when `after` doesn't follow on from
 * `before` (another fight, or nothing new).
 */
export function roundFrames(before: FightView, after: FightView): StageFrame[] {
  if (after.acts.length <= before.acts.length || after.enemies.length !== before.enemies.length) return [];
  const hp: Record<string, number> = {};
  const state: Record<string, Shown> = {};
  const stunned: Record<string, boolean> = {};
  const max: Record<string, number> = {};
  for (const m of before.crew) {
    hp[crewKey(m.id)] = m.hp;
    state[crewKey(m.id)] = m.state;
    max[crewKey(m.id)] = m.maxHp;
  }
  for (const e of before.enemies) {
    hp[enemyKey(e.index)] = e.hp;
    state[enemyKey(e.index)] = e.state;
    stunned[enemyKey(e.index)] = e.stunned;
    max[enemyKey(e.index)] = e.maxHp;
  }
  const final = (key: string): Shown | undefined => {
    if (key.startsWith('e:')) return after.enemies[Number(key.slice(2))]?.state;
    return after.crew.find((m) => crewKey(m.id) === key)?.state;
  };
  const frames: StageFrame[] = [];
  for (const a of after.acts.slice(before.acts.length)) {
    const by = keyFor(a.by);
    const at = a.at !== undefined ? keyFor(a.at) : undefined;
    switch (a.kind) {
      case 'hit':
        if (at) {
          hp[at] = Math.max(0, (hp[at] ?? 0) - (a.amount ?? 0));
          if (a.down) state[at] = 'down';
          if (a.stun) stunned[at] = true;
        }
        break;
      case 'kill':
        if (at) {
          hp[at] = 0;
          state[at] = 'dead';
        }
        break;
      case 'heal':
        if (at) hp[at] = Math.min(max[at] ?? 0, (hp[at] ?? 0) + (a.amount ?? 0));
        break;
      case 'revive':
        if (at) {
          hp[at] = a.amount ?? 1;
          state[at] = 'up';
        }
        break;
      case 'talk':
        if (at && a.ok) state[at] = final(at) ?? 'fled';
        break;
      case 'flee':
      case 'break':
      case 'escape':
        state[by] = 'fled';
        break;
      case 'reel':
        stunned[by] = false;
        break;
      default:
        break;
    }
    frames.push({ round: a.round, line: a.line, effect: effectOf(a, after), hp: { ...hp }, state: { ...state }, stunned: { ...stunned } });
  }
  return frames;
}

/** How long each act of a round is shown, in ms. */
export const FRAME_MS = 720;

/** The line under the stage between rounds: what a tap does now. */
export function stageHint(view: FightView, open: string | undefined, picks: Picks = {}): string {
  const m = open ? view.crew.find((c) => c.id === open) : undefined;
  if (!m) return 'Tap one of the crew to give their orders.';
  const pick = picks[m.id];
  const choice = pick ? m.moves.find((c) => c.move === pick.move) : undefined;
  if (choice?.target === 'ally') return `Tap who ${m.name} should help.`;
  if (choice?.target === 'none') return `${m.name}: ${choice.name.toLowerCase()}. Tap someone else to give their orders.`;
  return `Tap an enemy for ${m.name} to go after.`;
}
