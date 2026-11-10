/**
 * Tunable numbers. Balance changes should usually happen here or in content/,
 * not inside logic. See docs/DESIGN.md for the reasoning behind each value.
 */

import type { Quality, RelationshipLabel, Resources } from './types.ts';

/** Save format version. Bump together with a migration in save.ts. */
export const SAVE_VERSION = 3;

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
export const PRACTICE_PER_LEVEL = 8;
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

// ---------------------------------------------------------------- expeditions

export const MAX_CREW = 4;
export const MAX_REPORTS = 20;

/** A run has between MIN and MAX beats (including the return), one per MINUTES_PER_BEAT of travel. */
export const MIN_BEATS = 3;
export const MAX_BEATS = 8;
export const MINUTES_PER_BEAT = 20;
/** Sneaking takes longer. */
export const SNEAKY_DURATION_MULT = 1.15;

/** Enemy group size: threat budget = (BASE + danger * PER_DANGER) * CREW_MULT[crew size - 1]. */
export const ENCOUNTER_BASE = 5;
export const ENCOUNTER_PER_DANGER = 1.5;
export const ENCOUNTER_CREW_MULT = [0.6, 0.85, 1.1, 1.35] as const;
export const MAX_ENEMIES = 6;

export const MAX_COMBAT_ROUNDS = 6;
/** Attacks against a survivor must reach this + their armor. */
export const SURVIVOR_DEFENSE = 7;
export const UNARMED_DAMAGE = 1;
export const AGGRESSIVE_ATTACK_BONUS = 1;
export const SNEAKY_AMBUSH_BONUS = 2;
export const AGGRESSIVE_AMBUSH_PENALTY = -2;
/** Sneaking past enemies: the crew's weakest Wits against this + danger. */
export const SNEAK_DC_BASE = 6;
/** Beating the ambush check by this much gives the crew a free round. */
export const DROP_MARGIN = 3;
/** Bonus to every check while a Bonded friend is in the crew, and their stress multiplier. */
export const BONDED_CHECK_BONUS = 1;
export const BONDED_STRESS_MULT = 0.8;

/** Stress amounts (before Nerve and trait multipliers). */
export const STRESS_COMBAT: readonly [number, number] = [8, 20];
/** Every beat in a dangerous place wears on the nerves: (danger - 1) * this. */
export const STRESS_PER_DANGER_BEAT = 1;
/** Stress per point of damage taken. */
export const STRESS_PER_DAMAGE = 1;
export const STRESS_ALLY_DOWNED = 15;
export const STRESS_ALLY_KILLED = 30;
export const STRESS_ROUTED = 30;
export const STRESS_RIVAL_PER_BEAT = 2;

/** Wound roll: d100 + Grit * WOUND_GRIT_MULT + bonuses. Below MORTAL is a death save; below SERIOUS is a serious wound. */
export const WOUND_GRIT_MULT = 2;
export const WOUND_MORTAL_BELOW = 20;
export const WOUND_SERIOUS_BELOW = 45;
export const WOUND_BONDED_BONUS = 5;
export const DEATH_SAVE_DC = 12;
export const SCAR_CHANCE = 0.5;
/** Carry capacity used up by carrying a downed crewmate. */
export const CARRY_COST_DOWNED = 3;

/** HP restored by one unit of meds (more with a successful medicine check). */
export const MEDS_HEAL = 5;
export const MEDS_HEAL_SKILLED = 8;

/** Radiation absorbed per beat per location radiation level. */
export const RADS_PER_BEAT = 3;
/** Rads absorbed in one run before a rad-sickness check is made. */
export const RAD_SICKNESS_THRESHOLD = 15;

/** Relationship changes. */
export const REL_RUN_BASE = 1;
export const REL_RUN_PER_AFFINITY = 2;
export const REL_COMBAT_TOGETHER = 3;
export const REL_SAVED = 30;
export const REL_ARGUMENT = -10;
export const REL_CAUGHT_STEALING = -25;
export const REL_SHARED = 8;
export const REL_COVERED = 10;
export const REL_FLED_DOWNED = -40;
export const REL_FLED = -5;

/** A survivor with this many runs can mentor a friend with at most MENTOR_NEWCOMER_RUNS. */
export const MENTOR_RUNS = 10;
export const MENTOR_NEWCOMER_RUNS = 3;

/** Chance that a beat of this kind is a scripted event (content/events.ts) when one fits. */
export const EVENT_CHANCE: Record<'travel' | 'hazard' | 'discovery' | 'social', number> = {
  travel: 0.75,
  hazard: 0.4,
  discovery: 0.5,
  social: 0.5,
};
/** An event's weight is divided by 1 + times seen * this, so new ones come up first. */
export const EVENT_SEEN_PENALTY = 1;

/** Explored % gained per finished run, by job. */
export const EXPLORE_GAIN: Record<'scavenge' | 'scout' | 'hunt', readonly [number, number]> = {
  scavenge: [4, 6],
  scout: [10, 15],
  hunt: [2, 4],
};

// ---------------------------------------------------------------- names

/** Longest first or last name the player can give a survivor. */
export const NAME_MAX_LENGTH = 20;

// ---------------------------------------------------------------- new game

export const STARTING_SURVIVORS = 4;
export const STARTING_RESOURCES: Resources = {
  scrap: 20,
  rations: 24,
  meds: 3,
  ammo: 15,
  tech: 0,
};
