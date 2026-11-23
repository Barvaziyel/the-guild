/**
 * The sound files in public/audio, written by tools/audio/build.py: do not edit by hand.
 * Music is FluidR3_GM instruments (Frank Wen, CC BY 3.0); the effects and ambience are synthesized.
 */

/** Each piece of music and the length of its loop, in seconds. */
export const MUSIC = {
  depot: 101.05263,
  night: 96.0,
  fight: 85.71429,
  haven: 91.42857,
  truth: 90.0,
} as const;

/** Each ambience loop and its length, in seconds. */
export const AMBIENCE = {
  wind: 42.0,
  fire: 23.0,
  crickets: 28.5,
  birds: 38.0,
} as const;

/** Every effect in sfx.ogg: where it starts and how long it is, in seconds. */
export const SPRITE = {
  tap: [0.0, 0.04],
  tab: [0.12, 0.09],
  open: [0.29, 0.22],
  nope: [0.59, 0.24],
  paper: [0.91, 0.5],
  send: [1.49, 2.2],
  engine: [3.77, 2.4],
  home: [6.25, 3.2],
  recruit: [9.53, 2.6],
  loot: [12.21, 0.9],
  build: [13.19, 1.6],
  craft: [14.87, 1.2],
  death: [16.15, 4.6],
  alarm: [20.83, 2.4],
  radio: [23.31, 1.1],
  decision: [24.49, 2.0],
  clue: [26.57, 2.6],
  trade: [29.25, 0.9],
  reward: [30.23, 2.4],
  victory: [32.71, 3.0],
  defeat: [35.79, 3.0],
  pistol: [38.87, 0.55],
  pistol2: [39.5, 0.55],
  rifle: [40.13, 0.9],
  shotgun: [41.11, 0.8],
  crossbow: [41.99, 0.45],
  zap: [42.52, 0.45],
  laser: [43.05, 0.4],
  swing: [43.53, 0.24],
  swing2: [43.85, 0.2],
  blunt: [44.13, 0.4],
  blade: [44.61, 0.4],
  punch: [45.09, 0.3],
  hurt: [45.47, 0.3],
  ricochet: [45.85, 0.5],
  fall: [46.43, 0.8],
  bite: [47.31, 0.55],
  snarl: [47.94, 0.6],
  groan: [48.62, 1.0],
  servo: [49.7, 0.5],
  heal: [50.28, 0.9],
  shuffle: [51.26, 0.35],
  run: [51.69, 0.9],
  door: [52.67, 0.9],
  work: [53.65, 0.8],
  stare: [54.53, 1.4],
  bark: [56.01, 0.6],
} as const;

export type MusicId = keyof typeof MUSIC;
export type AmbienceId = keyof typeof AMBIENCE;
export type SoundId = keyof typeof SPRITE;
