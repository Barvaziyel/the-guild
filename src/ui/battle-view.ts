/**
 * The battle stage on the fight screen (§7.13): the fight as a `StageModel`
 * for `src/scene/battle.ts`, a round played back act by act, and what a tap
 * on someone in the fight does to the orders being given.
 */
import type { FightAct, FightView, GameState, MoveId } from '../engine/index.ts';
import type { StageEffect, StageFighter, StageModel } from '../scene/index.ts';
import { canStillReach, incoming, needsTarget, type Picks } from './fight-view.ts';
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
  /** The fight's job as the act leaves it (2.5.0). */
  job?: { progress: number; state: 'open' | 'done' | 'lost' };
  /** The act itself, for its sound (3.1.0). */
  act: FightAct;
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
  if (words.length > 1 && (words[0] === 'Raider' || words[0] === 'Vulture')) return words.slice(1).join(' ');
  // A pack crowds the stage: "Rad-hound 2" is "Hound 2" there (2.4.0).
  if (words[0] === 'Rad-hound' && words.length > 1) return ['Hound', ...words.slice(1)].join(' ');
  return name;
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

/** Where a fight is: the place's id for the backdrop ('depot' for a raid), and a seed that varies the enemies' looks. */
export interface StageAt {
  place: string;
  seed: string;
}

/** The fight drawn: everyone where they stand, with this moment's act if a round is being played. */
export function stageModel(state: GameState, at: StageAt, view: FightView, orders: StageOrders, frame?: StageFrame): StageModel {
  const crew: StageFighter[] = view.crew.map((m) => {
    const key = crewKey(m.id);
    const s = state.survivors.find((x) => x.id === m.id);
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
      // A Vulture beside the guild (§9.12): drawn as one, with the feather by the name.
      ...(m.ally ? { kind: 'vulture_lieutenant', type: 'raider', seed: m.id, vulture: true } : {}),
      aimed: frame ? false : m.aimed,
      ...(m.perch ? { perch: true } : { rank: m.rank }),
      // What's coming at them, for the round about to be given (3.8.0).
      ...(!frame && m.state === 'up' ? threatOf(view, m.id) : {}),
      ...(m.heldBy !== undefined && shown === 'up' ? { held: true } : {}),
    };
  });
  // The guild's dog at the gate: it fights, but nobody can hurt it.
  if (view.dog) crew.push({ key: crewKey('dog'), side: 'crew', label: view.dog, title: `${view.dog}, the dog`, hp: 0, maxHp: 0, state: 'up', kind: 'dog' });
  const enemies: StageFighter[] = view.enemies.map((e): StageFighter => {
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
      seed: `${at.seed}-${e.index}`,
      nemesis: e.nemesis,
      vulture: e.vulture,
      stunned: frame?.stunned[key] ?? e.stunned,
      rank: e.rank,
      ...(shown === 'down' ? { rising: true } : {}),
      ...(e.armor >= 2 ? { armored: true } : {}),
      // Their moves for the round about to be given (not while the last one plays), aimed at whoever they can still reach.
      ...(!frame && e.intent
        ? {
            intent: {
              kind: e.intent.kind,
              ...(e.intent.at && canStillReach(view, e, e.intent.at) ? { at: crewKey(e.intent.at) } : {}),
              ...(e.intent.also && canStillReach(view, e, e.intent.also) ? { also: crewKey(e.intent.also) } : {}),
              ...(e.intent.ally !== undefined ? { ally: enemyKey(e.intent.ally) } : {}),
            },
          }
        : {}),
      // About to be patched up by one of its own (3.8.0).
      ...(!frame && shown === 'up' ? mendingOf(view, e.index) : {}),
    };
  }).filter((f) => f.state !== 'waiting');
  const { targets, picked } = frame ? { targets: [], picked: undefined } : stageTargets(view, orders);
  return {
    place: at.place,
    crew,
    enemies,
    ...(!frame && orders.open ? { giving: crewKey(orders.open) } : {}),
    targets,
    ...(picked ? { picked } : {}),
    ...(frame ? { effect: frame.effect } : {}),
    ...(view.nerve !== undefined ? { nerve: view.nerve } : {}),
    ...(view.goal ? { job: { title: view.goal.title, needed: view.goal.needed, ...(frame?.job ?? { progress: view.goal.progress, state: view.goal.state }) } } : {}),
  };
}

/** What's coming at one of the crew (3.8.0), when anything is: for the number over them. */
function threatOf(view: FightView, id: string): { threat?: NonNullable<StageFighter['threat']> } {
  const t = incoming(view, id);
  return t.amount > 0 || t.next ? { threat: t } : {};
}

/** How much an enemy is about to be patched up (3.8.0), when it is. */
function mendingOf(view: FightView, index: number): { mending?: number } {
  const by = view.enemies.find((e) => e.state === 'up' && !e.stunned && e.intent?.kind === 'mend' && e.intent.ally === index);
  const e = view.enemies[index]!;
  const amount = by ? Math.min(by.mends ?? 0, e.maxHp - e.hp) : 0;
  return amount > 0 ? { mending: amount } : {};
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
  throw: 'Firebomb!',
};

/** How one act looks on the stage. */
function effectOf(a: FightAct, after: FightView): StageEffect {
  const by = keyFor(a.by);
  const at = a.at !== undefined ? keyFor(a.at) : undefined;
  const onCrew = typeof a.at === 'string';
  const base = { by, ...(at ? { at } : {}) };
  // What flies off whoever is hit (3.2.0): a machine sparks, anyone else bleeds.
  const machine = typeof a.at === 'number' && after.enemies[a.at]?.type === 'scrapbot';
  const splash = machine ? ('sparks' as const) : ('blood' as const);
  switch (a.kind) {
    case 'hit':
    case 'kill':
      return { ...base, motion: a.shot ? 'shoot' : 'lunge', reaction: 'hit', pop: `-${a.amount ?? 0}`, tone: onCrew ? 'hurt' : 'hit', splash, ...((a.amount ?? 0) >= 6 || a.down || a.kind === 'kill' ? { big: true } : {}) };
    case 'miss':
      return { ...base, motion: a.shot ? 'shoot' : 'lunge', reaction: 'miss', pop: 'Miss', tone: 'miss', ...(a.shot ? { splash: 'dust' as const } : {}) };
    case 'heal':
      return { ...base, motion: 'act', reaction: 'heal', pop: `+${a.amount ?? 0}`, tone: 'heal' };
    case 'revive':
      return { ...base, motion: 'act', reaction: 'heal', pop: 'Back up', tone: 'heal' };
    case 'talk': {
      const gone = typeof a.at === 'number' ? after.enemies[a.at]?.state : undefined;
      return { ...base, motion: 'act', reaction: 'none', pop: a.ok ? (gone === 'dead' ? 'Shuts down' : 'Backs off') : 'No good', tone: a.ok ? 'hit' : 'miss' };
    }
    case 'finish':
      return { ...base, motion: a.shot ? 'shoot' : 'lunge', reaction: 'hit', pop: 'Finished', tone: 'hit', splash, big: true };
    case 'rise':
      return { by, motion: 'none', reaction: 'none', pop: 'Gets up', tone: 'hurt' };
    case 'arrive':
      return { by, motion: 'none', reaction: 'none', pop: 'Comes through', tone: 'hurt' };
    case 'job':
      return { by, motion: 'act', reaction: 'none', pop: after.goal?.move ?? 'On the job', tone: 'plain' };
    case 'withdraw':
      return { by, motion: 'act', reaction: 'none', pop: a.ok ? 'Pulling out' : 'Cut off', tone: a.ok ? 'plain' : 'hurt', ...(a.ok ? { leaving: after.crew.filter((m) => m.state === 'up').map((m) => crewKey(m.id)) } : {}) };
    case 'flee':
    case 'break':
    case 'escape':
      return { by, motion: 'none', reaction: 'none', pop: ACT_WORDS[a.kind]!, tone: a.kind === 'flee' ? 'hurt' : 'hit', leaving: [by] };
    // 3.8.0
    case 'shove':
      return { ...base, motion: a.shot ? 'shoot' : 'lunge', reaction: a.ok ? 'hit' : 'miss', pop: a.ok ? (a.shot ? 'Pinned' : 'Shoved') : 'Miss', tone: a.ok ? 'hit' : 'miss', ...(a.shot && !a.ok ? { splash: 'dust' as const } : {}) };
    case 'mend':
      return { ...base, motion: 'act', reaction: 'heal', pop: `+${a.amount ?? 0}`, tone: 'heal' };
    case 'throw':
      return { by, motion: 'act', reaction: 'none', pop: ACT_WORDS.throw!, tone: 'hurt' };
    case 'burn':
      return { ...base, motion: 'none', reaction: 'hit', pop: `-${a.amount ?? 0}`, tone: onCrew ? 'hurt' : 'hit', splash: 'sparks', ...(a.down ? { big: true } : {}) };
    case 'grab':
      return { ...base, motion: 'none', reaction: 'hit', pop: 'Grabbed', tone: 'hurt' };
    case 'free':
      return { by, motion: 'act', reaction: 'none', pop: a.ok ? 'Free' : 'Stuck', tone: a.ok ? 'heal' : 'miss' };
    case 'aim':
      return { ...base, motion: 'act', reaction: 'none', pop: typeof a.by === 'number' ? 'Takes aim' : ACT_WORDS.aim!, tone: typeof a.by === 'number' ? 'hurt' : 'plain' };
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
  // The job's work as the round goes (2.5.0); a job lost at the end of the round shows lost with the last act.
  let job = before.goal ? { progress: before.goal.progress, state: before.goal.state } : undefined;
  for (const a of after.acts.slice(before.acts.length)) {
    const by = keyFor(a.by);
    const at = a.at !== undefined ? keyFor(a.at) : undefined;
    const was = at !== undefined ? hp[at] : undefined;
    switch (a.kind) {
      case 'hit':
        if (at) {
          hp[at] = Math.max(0, (hp[at] ?? 0) - (a.amount ?? 0));
          if (a.down) state[at] = 'down';
          if (a.stun) stunned[at] = true;
        }
        break;
      case 'kill':
      case 'finish':
        if (at) {
          hp[at] = 0;
          state[at] = 'dead';
        }
        break;
      case 'rise':
        hp[by] = a.amount ?? 1;
        state[by] = 'up';
        break;
      case 'arrive':
        state[by] = 'up';
        break;
      case 'job':
        if (job && before.goal) {
          const progress = Math.min(before.goal.needed, job.progress + (a.amount ?? 1));
          job = { progress, state: progress >= before.goal.needed ? 'done' : job.state };
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
      // 3.8.0: a firebomb (or one's own, at its feet), and one of theirs patched up.
      case 'burn':
        if (at) {
          hp[at] = Math.max(0, (hp[at] ?? 0) - (a.amount ?? 0));
          if (a.down) state[at] = 'down';
          if (hp[at] === 0 && at.startsWith('e:')) state[at] = final(at) ?? 'dead';
        }
        break;
      case 'mend':
        if (at) hp[at] = Math.min(max[at] ?? 0, (hp[at] ?? 0) + (a.amount ?? 0));
        break;
      default:
        break;
    }
    const effect = effectOf(a, after);
    // The bar drains from what they had (3.7.0).
    if (at !== undefined && was !== undefined && hp[at] !== was) effect.was = was;
    frames.push({ round: a.round, line: a.line, act: a, effect, hp: { ...hp }, state: { ...state }, stunned: { ...stunned }, ...(job ? { job } : {}) });
  }
  // How the job stands once the round is over: done, or lost at the end of it.
  const last = frames.at(-1);
  if (last && after.goal) last.job = { progress: after.goal.progress, state: after.goal.state };
  return frames;
}

/** How long each act of a round is shown, in ms. */
export const FRAME_MS = 720;

