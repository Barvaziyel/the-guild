/**
 * Tunable numbers. Balance changes should usually happen here or in content/,
 * not inside logic. See docs/DESIGN.md for the reasoning behind each value.
 */

import type { Quality, RelationshipLabel, Resources } from './types.ts';

/** Save format version. Bump together with a migration in save.ts. */
export const SAVE_VERSION = 7;

// ---------------------------------------------------------------- time

/** Real milliseconds per game day (3 real hours). Runs take real time and don't scale with this. */
export const DAY_MS = 3 * 60 * 60 * 1000;

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

// ---------------------------------------------------------------- the Depot

/** Opening the game plays at most this many missed Depot days; older ones are skipped. */
export const MAX_CATCHUP_DAYS = 7;
/** Entries kept in the guild log. */
export const MAX_LOG = 300;

/** Bunks: beds by level (index = level). */
export const BUNKS_CAP = [0, 4, 8, 12] as const;
/** Workers a building takes by level. */
export const WORKER_SLOTS = [0, 2, 3, 3] as const;
export const MAX_BUILDING_LEVEL = 3;

/** Rations a survivor at the Depot eats per day (Gluttons eat more). */
export const UPKEEP_RATIONS = 1;
/** Stress per hungry day, instead of any relief. */
export const HUNGER_STRESS = 10;

/** Garden rations per day = level * (GARDEN_BASE + sum over gardeners of (GARDEN_PER_WORKER + Wits * GARDEN_PER_WITS)). */
export const GARDEN_BASE = 2;
export const GARDEN_PER_WORKER = 0.5;
export const GARDEN_PER_WITS = 0.25;

/** Stress shed per day at the Depot, before Firepit and traits. */
export const REST_RELIEF = 5;
/** Extra stress shed per day by Firepit level. */
export const FIREPIT_RELIEF = [0, 5, 8, 12] as const;
/** Each Firepit keeper adds this plus Nerve * FIREPIT_PER_NERVE. */
export const FIREPIT_PER_KEEPER = 1;
export const FIREPIT_PER_NERVE = 0.25;
/** Bar levels: daily chance that each pair at the Depot warms by 1. */
export const BAR_DRIFT_CHANCE = [0, 0, 0.25, 0.5] as const;
/** Extra stress shed per day with a Bonded friend at the Depot. */
export const BONDED_RELIEF = 2;

/** HP healed per day, as a share of max HP: base, per Infirmary level, per medic Wits point. */
export const HEAL_BASE = 0.15;
export const HEAL_PER_INFIRMARY = 0.1;
export const HEAL_PER_MEDIC_WITS = 0.02;
/** Daily chance, by Infirmary level, that a staffed Infirmary closes a wound a day early. */
export const INFIRMARY_SPEEDUP = [0, 0.25, 0.5, 0.75] as const;

/** Practice per day for working a post. */
export const WORK_PRACTICE = 1;
/** Practice per day at the Training Yard, by level. */
export const TRAINING_PRACTICE = [0, 2, 3, 4] as const;
/** Daily chance that co-workers' relationship drifts by their affinity. */
export const COWORKER_DRIFT_CHANCE = 0.5;

/** Workshop: each worker turns 1 scrap into AMMO_PER_WORKER + Wits * AMMO_PER_WITS ammo a day... */
export const AMMO_PER_WORKER = 1;
export const AMMO_PER_WITS = 0.25;
/** ...until the Depot holds this much ammo. */
export const AMMO_STOCK_CAP = 60;

/** Radio Tower: daily chance per level to hear of an undiscovered place, plus per operator Wits point. */
export const RADIO_REVEAL_PER_LEVEL = 0.03;
export const RADIO_REVEAL_PER_WITS = 0.005;
/** Recruits at the gate each day: base plus Radio Tower level. */
export const RECRUITS_BASE = 2;
/** Extra stat points for recruits, by Radio Tower level ("better recruits"). */
export const RECRUIT_BONUS_POINTS = [0, 0, 1, 2] as const;
/** Days a wanderer waits at the gate. */
export const WANDERER_DAYS = 3;
/** Days a trader caravan waits. */
export const TRADE_DAYS = 2;

/** Chance per day that something happens at the Depot (one event at most). */
export const DEPOT_EVENT_CHANCE = 0.2;
/** Daily chance that each feuding pair at the Depot comes to blows. */
export const FEUD_FIGHT_CHANCE = 0.2;
/** Raids: d10 + best Aim at the Depot + Watchtower bonus vs this. */
export const RAID_DC = 12;
export const WATCHTOWER_DEFENSE = 2;
/** Share of scrap, rations and ammo raiders take; halved with a Watchtower... */
export const RAID_LOSS = 0.25;
/** ...but no more of each than they can carry. */
export const RAID_MAX_TAKE = 30;

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

// ---------------------------------------------------------------- stories (see docs/DESIGN.md §15, step 11)

/** Chance that an enemy which put someone down and survived the fight becomes a nemesis. */
export const NEMESIS_CHANCE = 0.5;
/** Most nemeses at large at once. */
export const NEMESIS_MAX = 3;
/** Chance a nemesis at large joins a fight at its place. At most one turns up per run. */
export const NEMESIS_APPEAR = 0.35;
/** A nemesis is tougher than its kind: HP x1.5, plus a few, so even a Rad-hound takes some killing. */
export const NEMESIS_HP_MULT = 1.5;
export const NEMESIS_HP_BONUS = 3;
export const NEMESIS_ATTACK_BONUS = 1;
export const NEMESIS_DEFENSE_BONUS = 1;
/** Each person it kills makes it worse, +1 attack, up to this much. */
export const NEMESIS_MAX_GROWTH = 2;
/** Below this share of its HP, a nemesis tries once per fight to get away. */
export const NEMESIS_FLEE_HP = 0.34;
export const NEMESIS_FLEE_CHANCE = 0.5;
/** To hit, for someone it has put down before. */
export const NEMESIS_GRUDGE_BONUS = 1;
/** Stress shed by everyone it ever put down, when it dies. */
export const NEMESIS_DEATH_RELIEF = 10;

/** A weapon earns a name at this many kills... */
export const NAMED_GEAR_KILLS = 10;
/** ...and a line in its story at these. */
export const NAMED_GEAR_MILESTONES = [25, 50, 100] as const;
/** Story lines kept for a nemesis or a named weapon. */
export const STORY_MAX_LINES = 12;
