/**
 * Tunable numbers. Balance changes should usually happen here or in content/,
 * not inside logic. See docs/DESIGN.md for the reasoning behind each value.
 */

import type { Quality, RelationshipLabel, Resources } from './types.ts';

/** Save format version. Bump together with a migration in save.ts. */
export const SAVE_VERSION = 1;

// ---------------------------------------------------------------- time

/** Real milliseconds per game day (1 real hour). */
export const DAY_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------- stats

export const STAT_MIN = 1;
export const STAT_MAX = 10;
/** Every stat starts at this before points are distributed. */
export const STAT_BASE = 2;
/** Extra points distributed at generation (total = 5 * STAT_BASE + this). */
export const STAT_GEN_POINTS = 10;
/** Highest a stat can be at generation. */
export const STAT_GEN_MAX = 7;

/** Practice needed to go from stat N to N + 1 is PRACTICE_PER_LEVEL * N. */
export const PRACTICE_PER_LEVEL = 10;
/** Practice from a normal check; hard checks give PRACTICE_HARD. */
export const PRACTICE_NORMAL = 1;
export const PRACTICE_HARD = 2;

export const HP_BASE = 8;
export const HP_PER_GRIT = 2;
export const CARRY_BASE = 2;

/** Check difficulties (d10 + stat + mods >= DC). */
export const DC = {
  easy: 7,
  normal: 10,
  hard: 13,
  brutal: 16,
} as const;
export type Difficulty = keyof typeof DC;

// ---------------------------------------------------------------- stress

export const STRESS_MAX = 100;
/** Above this stress, survivors take a penalty to all checks. */
export const STRESS_HIGH = 70;
export const STRESS_HIGH_PENALTY = -1;
/** Stress after a breaking point resolves. */
export const STRESS_AFTER_BREAK = 40;
/** Nerve reduces stress gains by Nerve / this (Nerve 10 => -50%). */
export const NERVE_STRESS_DIVISOR = 20;

// ---------------------------------------------------------------- traits

/** Max personality + earned + stress + scar traits. Conditions don't count. */
export const MAX_TRAITS = 6;

// ---------------------------------------------------------------- relationships

export const REL_MIN = -100;
export const REL_MAX = 100;
/** Lower bound (inclusive) of each label, checked from the top. */
export const REL_THRESHOLDS: readonly { label: RelationshipLabel; min: number }[] = [
  { label: 'bonded', min: 60 },
  { label: 'friend', min: 20 },
  { label: 'neutral', min: -19 },
  { label: 'rival', min: -59 },
  { label: 'feud', min: REL_MIN },
];
/** Starting relationship = affinity * this + random(-REL_START_NOISE..REL_START_NOISE). */
export const REL_AFFINITY_SCALE = 5;
export const REL_START_NOISE = 10;
/** Affinity between two survivors is clamped to this range. */
export const AFFINITY_MIN = -2;
export const AFFINITY_MAX = 2;

// ---------------------------------------------------------------- gear

export const QUALITY_MOD: Record<Quality, number> = {
  rusty: -1,
  common: 0,
  solid: 1,
  prime: 2,
  relic: 2,
};

export const QUALITY_NAME: Record<Quality, string> = {
  rusty: 'Rusty',
  common: '',
  solid: 'Solid',
  prime: 'Prime',
  relic: 'Relic',
};

/** Runs with the same trinket before it becomes Cherished. */
export const CHERISH_RUNS = 5;

// ---------------------------------------------------------------- new game

export const STARTING_SURVIVORS = 4;
export const STARTING_RESOURCES: Resources = {
  scrap: 20,
  rations: 24,
  meds: 3,
  ammo: 15,
  tech: 0,
};
