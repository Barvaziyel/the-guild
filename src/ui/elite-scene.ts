/**
 * An elite's first sight (§7.15, 4c, 3.16.0), played on the battle stage as a short moving scene: its place,
 * empty but for a sign of it (a sound, the rings where something went under, a glint and a shot, a light far
 * off) under the line of what was seen; then it comes on, the camera goes in on it, its call, and its name
 * stamped down over the stage. Once, when the crew that saw it is home (`components/EliteSight.tsx`), or at
 * its first fight if that comes before; at every fight with one it comes on again, under the line of how it
 * turned up. Nobody speaks: what's said is on the screen. One shape for all of them; what differs is in
 * `STAGING`. Plain TypeScript, tested in Node.
 */
import { eliteSightShown, getEnemy, getLocation, type EnemyDef, type GameState, type LedFight, type Run } from '../engine/index.ts';
import type { ExtraKey, ExtraPose, StageExtra, StageFighter, StageModel } from '../scene/index.ts';
import { readingTime, type SceneShot } from './scene-view.ts';
import type { AmbienceMix, Cue } from './sound-view.ts';

interface Spot {
  x: number;
  y: number;
  scale: number;
}

/** Where it stands once it has come on: where one alone stands in a fight. */
const SPOT: Spot = { x: 250, y: 222, scale: 1.45 };

/** How each one is shown: everything about the scene that isn't the same for all. */
interface Staging {
  /** Walking in from far off in its place, coming up out of the water, or up where it always is. */
  comes: 'walks' | 'rises' | 'there';
  /** Where a walker starts, small and far, and how many seconds it takes. */
  from?: Spot;
  seconds?: number;
  /** Where it ends up, if not where one alone stands; and which way it faces (left, toward a crew, unless 1). */
  to?: Spot;
  facing?: 1 | -1;
  /** About the middle of it, once it's there: where the camera goes in. */
  lookY: number;
  /** Low to the ground: its name goes up top, over the sky, not across it. */
  low?: boolean;
  /** Something of it seen before it comes on: rings on the water, a glint and a shot, a light far off. */
  glimpse?: 'rings' | 'shot' | 'far';
  ambience: AmbienceMix;
  /** Its sign; its steps, from when it starts to come on; its call, as its name comes down. */
  sight: Cue[];
  steps: Cue[];
  call: Cue[];
}

const OUT: AmbienceMix = { wind: 0.55, fire: 0, crickets: 0, birds: 0.15 };
const BARE: AmbienceMix = { wind: 0.75, fire: 0, crickets: 0, birds: 0 };
const INSIDE: AmbienceMix = { wind: 0.12, fire: 0, crickets: 0, birds: 0 };
const SWAMP: AmbienceMix = { wind: 0.35, fire: 0, crickets: 0.5, birds: 0.1 };

/** A sound again and again, louder as it comes closer: `n` of them from `at`, `every` seconds apart. */
function nearer(id: Cue['id'], n: number, at: number, every: number, from: number, to: number, rate = 1): Cue[] {
  return Array.from({ length: n }, (_, k) => ({ id, gain: Math.round((from + ((to - from) * k) / Math.max(1, n - 1)) * 100) / 100, rate, delay: Math.round((at + k * every) * 100) / 100 }));
}

export const STAGING: Record<string, Staging> = {
  // Down the line from the far end of the yard, throwing switches as it goes.
  the_switchman: {
    comes: 'walks',
    from: { x: 372, y: 168, scale: 0.42 },
    seconds: 3.4,
    lookY: 168,
    ambience: OUT,
    sight: [
      { id: 'clang', gain: 0.75, rate: 1.15, delay: 0.7 },
      { id: 'clang', gain: 0.55, rate: 1.05, delay: 1.7 },
      { id: 'clang', gain: 0.4, rate: 0.95, delay: 2.6 },
    ],
    steps: [{ id: 'servo', gain: 0.5, delay: 0.2 }, ...nearer('stomp', 5, 0.4, 0.68, 0.3, 0.9)],
    call: [
      { id: 'clang', rate: 0.9 },
      { id: 'servo2', gain: 0.7, delay: 0.1 },
    ],
  },
  // A howl, the street answering, and her coming up it.
  old_mother: {
    comes: 'walks',
    from: { x: 335, y: 168, scale: 0.42 },
    seconds: 2.6,
    lookY: 198,
    low: true,
    ambience: OUT,
    sight: [
      { id: 'howl', gain: 0.55, rate: 0.95, delay: 0.6 },
      { id: 'bark', gain: 0.35, delay: 2.4 },
      { id: 'bark', gain: 0.3, rate: 1.12, delay: 2.75 },
      { id: 'snarl2', gain: 0.25, delay: 3.1 },
    ],
    steps: [{ id: 'snarl', gain: 0.45, delay: 1.1 }],
    call: [{ id: 'howl' }],
  },
  // A door creaking on the smokehouse, a blade at work inside, then him, out from behind the barn.
  the_butcher: {
    comes: 'walks',
    from: { x: 146, y: 158, scale: 0.4 },
    to: { x: 228, y: 222, scale: 1.45 },
    facing: 1,
    seconds: 3.0,
    lookY: 168,
    ambience: OUT,
    sight: [
      { id: 'creak', gain: 0.45, delay: 1.0 },
      { id: 'blade', gain: 0.35, delay: 2.4 },
      { id: 'blade', gain: 0.3, rate: 0.95, delay: 3.1 },
    ],
    steps: nearer('gravel_walk', 2, 0.2, 1.4, 0.55, 0.85),
    call: [
      { id: 'swing', gain: 0.8 },
      { id: 'blade', delay: 0.12 },
    ],
  },
  // A bell down the tunnel, and out of it, on the platform, the Conductor.
  the_conductor: {
    comes: 'walks',
    from: { x: 200, y: 160, scale: 0.34 },
    to: { x: 222, y: 222, scale: 1.45 },
    seconds: 3.0,
    lookY: 168,
    ambience: INSIDE,
    sight: [{ id: 'bell', gain: 0.6, delay: 0.8 }],
    steps: nearer('shuffle', 3, 0.3, 1.0, 0.4, 0.7),
    call: [{ id: 'bell' }],
  },
  // A table sinks without a sound; then the rings, and up out of them, the Snapper.
  the_snapper: {
    comes: 'rises',
    lookY: 198,
    low: true,
    glimpse: 'rings',
    ambience: INSIDE,
    sight: [],
    steps: [{ id: 'surface', delay: 0.2 }],
    call: [{ id: 'snarl3', rate: 0.7, gain: 0.9 }],
  },
  // A glint at the top of the mast and a shot off the rocks; she's up there, and she's seen them.
  the_lookout: {
    comes: 'there',
    lookY: 118,
    glimpse: 'shot',
    ambience: OUT,
    sight: [
      { id: 'shot_far', delay: 1.75 },
      { id: 'ricochet', gain: 0.5, delay: 1.9 },
    ],
    steps: [],
    call: [
      { id: 'shot_far', gain: 0.8 },
      { id: 'ricochet', gain: 0.45, delay: 0.15 },
    ],
  },
  // A trolley squeaking on its rounds, and the Matron coming out of the hospital's door.
  the_matron: {
    comes: 'walks',
    from: { x: 138, y: 157, scale: 0.4 },
    to: { x: 182, y: 222, scale: 1.45 },
    facing: 1,
    seconds: 3.2,
    lookY: 168,
    ambience: { ...OUT, wind: 0.35, birds: 0 },
    sight: nearer('creak', 3, 0.8, 1.1, 0.4, 0.3, 1.5),
    steps: nearer('shuffle', 3, 0.3, 1.05, 0.4, 0.7),
    call: [
      { id: 'clap' },
      { id: 'clap', gain: 0.9, delay: 0.25 },
    ],
  },
  // A siren, every sentry stopping, and the Warden rolling out from the plant.
  the_warden: {
    comes: 'walks',
    from: { x: 352, y: 160, scale: 0.4 },
    seconds: 3.2,
    lookY: 182,
    ambience: OUT,
    sight: [{ id: 'klaxon', gain: 0.7, delay: 0.8 }],
    steps: [
      { id: 'servo3', gain: 0.45, delay: 0.2 },
      { id: 'servo', gain: 0.6, delay: 1.4 },
      { id: 'servo2', gain: 0.8, delay: 2.5 },
    ],
    call: [{ id: 'klaxon' }],
  },
  // A deer gone under the black water, the rings spreading, and the Bog King coming up out of them.
  the_bog_king: {
    comes: 'rises',
    lookY: 200,
    low: true,
    glimpse: 'rings',
    ambience: SWAMP,
    sight: [{ id: 'splash', gain: 0.7, delay: 1.6 }],
    steps: [{ id: 'surface', delay: 0.2 }],
    call: [
      { id: 'snarl3', rate: 0.6 },
      { id: 'snarl', gain: 0.6, rate: 0.8, delay: 0.3 },
    ],
  },
  // The loudspeaker on the tower, and Bravo Six walking out to the barrier, its gun swinging round.
  bravo_six: {
    comes: 'walks',
    from: { x: 340, y: 166, scale: 0.42 },
    seconds: 3.4,
    lookY: 186,
    ambience: BARE,
    sight: [{ id: 'loudspeaker', gain: 0.9, delay: 0.5 }],
    steps: [{ id: 'servo2', gain: 0.5, delay: 0.1 }, ...nearer('stomp', 5, 0.3, 0.66, 0.3, 0.9, 0.85)],
    call: [
      { id: 'servo3', gain: 0.7 },
      { id: 'burst', delay: 0.3 },
    ],
  },
  // The camp in its stadium, a whistle and quiet, and the Red Hand walking out in front of his people.
  the_red_hand: {
    comes: 'walks',
    from: { x: 300, y: 162, scale: 0.4 },
    seconds: 2.8,
    lookY: 168,
    ambience: OUT,
    sight: [{ id: 'whistle', gain: 0.8, delay: 2.2 }],
    steps: nearer('gravel_walk', 2, 0.2, 1.3, 0.55, 0.85),
    call: [{ id: 'whistle' }],
  },
  // A light walking on the glass plain, far off, the ground chiming; then the Glass Man, close.
  the_glass_man: {
    comes: 'walks',
    from: { x: 330, y: 166, scale: 0.38 },
    seconds: 3.6,
    lookY: 160,
    glimpse: 'far',
    ambience: BARE,
    sight: [
      { id: 'chime', gain: 0.4, delay: 1.2 },
      { id: 'chime', gain: 0.3, rate: 1.1, delay: 2.6 },
    ],
    steps: [...nearer('stomp', 4, 0.5, 0.85, 0.3, 0.7, 0.9), { id: 'chime', gain: 0.35, delay: 1.8 }],
    call: [
      { id: 'chime', rate: 0.9 },
      { id: 'zap', gain: 0.5, delay: 0.1 },
    ],
  },
};

/** The top of the Radio Station's mast on its backdrop, and where the shot from it lands. */
const MAST_TOP = { x: 300, y: 13 };
const SHOT_LANDS = { x: 214, y: 220 };

/** It, drawn on the stage. */
function fighter(def: EnemyDef, under = false): StageFighter {
  return { key: `x:${def.id}`, side: 'enemy', label: def.name, title: def.name, hp: 1, maxHp: 1, state: 'up', kind: def.id, type: def.type, seed: def.id, elite: true, ...(under ? { under } : {}) };
}

const key = (t: number, p: Spot, pose: ExtraPose, hidden = false): ExtraKey => ({ t, x: p.x, y: p.y, scale: p.scale, pose, ...(hidden ? { hidden } : {}) });

/** The first shot: its place, and the sign of it, under the line of what was seen. */
function signShot(def: EnemyDef, how: Staging): SceneShot {
  const place = def.elite!.place;
  const text = def.elite!.sight;
  const ms = Math.max(readingTime(text), 4200);
  const len = ms / 1000;
  const to = how.to ?? SPOT;
  const model: StageModel = { place, crew: [], enemies: [], targets: [], scene: true };
  // Where the camera drifts while nothing's there yet: toward where it'll come from, or the rings, or the mast.
  const toward = how.glimpse === 'shot' ? { x: MAST_TOP.x, y: 70 } : how.comes === 'rises' ? { x: to.x, y: to.y - 18 } : { x: how.from!.x, y: how.from!.y - 22 };
  model.camera = [
    { t: 0, scale: 1 },
    { t: len, scale: how.glimpse === 'shot' ? 1.3 : 1.18, ...toward },
  ];
  if (how.glimpse === 'rings') model.enemies = [fighter(def, true)];
  if (how.glimpse === 'shot') model.shot = { ...MAST_TOP, to: SHOT_LANDS, at: 1.75 };
  if (how.glimpse === 'far') {
    // Far off on the plain, small and bright, walking.
    const far = how.from!;
    model.extras = [{ fighter: fighter(def), x: far.x, y: far.y, scale: far.scale, facing: how.facing ?? -1, keys: [key(0, { x: far.x + 22, y: far.y - 1, scale: far.scale * 0.8 }, 'walk'), key(len, far, 'walk')] }];
  }
  return {
    model,
    lines: [{ at: 0, text }],
    ms,
    // No music under it: only its place, and the sign.
    sound: { ambience: how.ambience, cues: how.sight, music: [{ id: null, at: 0 }] },
  };
}

/** The second shot: it comes on, the camera goes in, its call, and its name comes down. */
function comesOnShot(def: EnemyDef, how: Staging, text: string): SceneShot {
  const to = how.to ?? SPOT;
  const facing = how.facing ?? -1;
  let keys: ExtraKey[];
  let arrived: number;
  if (how.comes === 'walks') {
    arrived = how.seconds!;
    keys = [key(0, how.from!, 'walk'), key(arrived, to, 'stand')];
  } else if (how.comes === 'rises') {
    // Up out of the rings, from under the water.
    arrived = 1.1;
    const below = { x: to.x, y: to.y + 14, scale: to.scale * 0.75 };
    keys = [key(0, below, 'stand', true), key(0.35, below, 'stand', true), key(arrived, to, 'stand')];
  } else {
    arrived = 0.8;
    keys = [key(0, to, 'stand'), key(arrived, to, 'stand')];
  }
  const it: StageExtra = { fighter: fighter(def), x: to.x, y: to.y, scale: to.scale, facing, keys };
  const callAt = arrived + 0.4;
  const stampAt = callAt + 0.35;
  const ms = Math.max(readingTime(text), Math.round((stampAt + 3.2) * 1000));
  const model: StageModel = {
    place: def.elite!.place,
    crew: [],
    // The rings it came up out of, under it.
    enemies: how.comes === 'rises' ? [fighter(def, true)] : [],
    targets: [],
    scene: true,
    extras: [it],
    camera: [
      { t: 0, scale: 1 },
      { t: Math.max(0, arrived - 0.3), scale: 1 },
      { t: arrived + 0.5, scale: 1.5, x: to.x, y: how.lookY },
    ],
  };
  const later = (cues: Cue[], at: number): Cue[] => cues.map((c) => ({ ...c, delay: Math.round(((c.delay ?? 0) + at) * 100) / 100 }));
  return {
    model,
    lines: [{ at: 0, text }],
    ms,
    stamp: { at: stampAt, title: def.name, sub: getLocation(def.elite!.place).name, ...(how.low ? { top: true } : {}) },
    sound: {
      ambience: how.ambience,
      cues: [...how.steps, ...later(how.call, callAt), { id: 'stamp', delay: stampAt }],
      music: [
        { id: null, at: 0 },
        { id: 'fight', at: stampAt },
      ],
    },
  };
}

/** An elite's first sight, the scene shown once the crew that saw it is home. */
export function eliteSightScene(id: string): SceneShot[] {
  const def = getEnemy(id);
  const how = STAGING[id];
  if (!def.elite || !how) return [];
  return [signShot(def, how), comesOnShot(def, how, def.description)];
}

/**
 * Before a fight with an elite: it comes on again, under the line of how it turned up; first its first
 * sight, if the player hasn't seen that yet (met on the run it was first seen on). Undefined for any other.
 */
export function eliteFightScene(state: GameState, run: Run, fight: LedFight): SceneShot[] | undefined {
  if (!fight.elite) return undefined;
  const def = getEnemy(fight.elite);
  const how = STAGING[fight.elite];
  if (!def.elite || !how) return undefined;
  // How it turned up, as the run's log has it (filled in with whoever saw it), or what it is.
  const met = def.elite.met;
  const start = met.split('{')[0]!.slice(0, 40);
  const said = [fight.fromBeat - 1, fight.fromBeat]
    .flatMap((b) => run.beats[b]?.lines ?? [])
    .map((l) => l.text)
    .find((t) => t.startsWith(start));
  const shots = eliteSightShown(state, def.id) ? [] : [signShot(def, how)];
  shots.push(comesOnShot(def, how, said ?? def.description));
  return shots;
}
