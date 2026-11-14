/**
 * Tunable numbers. Balance changes should usually happen here or in content/,
 * not inside logic. See docs/DESIGN.md for the reasoning behind each value.
 */

import type { BuildingId, Quality, RelationshipLabel, ResourceId, Resources } from './types.ts';

/** Save format version. Bump together with a migration in save.ts. */
export const SAVE_VERSION = 23;

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
/** Everyday life moves a pair no further than this (the top of Friends) or below this (the bottom of Rivals); see AdjustOptions.everyday. */
export const EVERYDAY_MAX = 59;
export const EVERYDAY_MIN = -59;
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
/** Armor counts once: it makes a survivor harder to hit. Only heavy armor (this much or more) also takes this off each hit. */
export const HEAVY_ARMOR = 3;
export const HEAVY_ARMOR_SOAK = 1;
/** Enemies hit harder in dangerous places: +1 attack and +1 damage for every this many points of danger above 1 (deeper levels count). */
export const ENEMY_DANGER_STEP = 2;
/** From this danger up, enemies are also tougher: for each point, +1 defense and this share more HP. */
export const ENEMY_TOUGH_FROM = 4;
export const ENEMY_TOUGH_HP = 0.2;
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
/**
 * A run together: base plus affinity, and a fight side by side helps those who
 * get along. Before 1.6.2 every pair warmed (+1 base, +3 for any fight), so
 * nearly everyone ended up friends and feuds were rare.
 */
export const REL_RUN_BASE = 0;
export const REL_RUN_PER_AFFINITY = 2;
export const REL_COMBAT_TOGETHER = 2;
/** After a run with something to share: chance a Greedy or Hothead crew member argues over the shares. */
export const LOOT_ARGUMENT_CHANCE = 0.2;
/** After a death on a run: chance the person closest to the dead blames someone who came back, and how much it costs. */
export const BLAME_CHANCE = 0.5;
export const REL_BLAME = -20;
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

/** Every find is worth this much more per point of the place's danger above 1 (the Glow gives double). */
export const LOOT_PER_DANGER = 0.25;
/** Relics turn up only at the heart of a place: their weight among found gear there (the others weigh about 100 together). */
export const RELIC_HEART_WEIGHT = 6;
/** A Relic's perk: this much to one stat, fixed for each Relic. */
export const RELIC_STAT_BONUS = 1;

/** Explored % gained per finished run, by job. */
export const EXPLORE_GAIN: Record<'scavenge' | 'scout' | 'hunt' | 'rescue' | 'assault', readonly [number, number]> = {
  scavenge: [4, 6],
  scout: [10, 15],
  hunt: [2, 4],
  rescue: [2, 4],
  assault: [2, 4],
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
/** Stress per hungry day, instead of any relief (10 before 1.7.1, when it outweighed the Depot's relief and broke people). */
export const HUNGER_STRESS = 4;
/** Hunger alone never pushes anyone past this; only runs can break someone. */
export const HUNGER_STRESS_CAP = 70;
/** Share of the usual healing a hungry day still gives. */
export const HUNGRY_HEAL_SHARE = 0.5;

/** Garden rations per day = level * (GARDEN_BASE + sum over gardeners of (GARDEN_PER_WORKER + Wits * GARDEN_PER_WITS)). */
export const GARDEN_BASE = 2;
export const GARDEN_PER_WORKER = 0.5;
export const GARDEN_PER_WITS = 0.25;

/** Stress shed per day at the Depot, before Firepit and traits. 5 before 1.6.2: with 8 Depot days a real day, people were calm again by every check-in. */
export const REST_RELIEF = 2;
/**
 * Extra stress shed per day by Firepit level (3, 5 and 8 before 1.7.1; 5, 8 and 12 before 1.6.2).
 * Relief is the guild's labor budget (§6): with rest and keepers, about 50 a real day at level 1,
 * 65 with the Bar and 80 with the Bar and Stage, against 8–55 stress a run.
 */
export const FIREPIT_RELIEF = [0, 3, 4, 5] as const;
/** Each Firepit keeper adds this plus Nerve * FIREPIT_PER_NERVE (1 and 0.25 before 1.7.1). */
export const FIREPIT_PER_KEEPER = 0.5;
export const FIREPIT_PER_NERVE = 0.1;
/** Bar levels: daily chance that each pair at the Depot warms by 1. */
export const BAR_DRIFT_CHANCE = [0, 0, 0.25, 0.5] as const;
/** Extra stress shed per day with a Bonded friend at the Depot. */
export const BONDED_RELIEF = 2;

/** HP healed per day, as a share of max HP: base, per Infirmary level, per medic Wits point (0.15 and 0.1 before 1.6.2). */
export const HEAL_BASE = 0.08;
export const HEAL_PER_INFIRMARY = 0.08;
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
/**
 * The day's chance that someone answers the radio and comes to the gate, by
 * Radio Tower level (1.9.0). Before, 2 + the level answered every day; now
 * most people come from rescues and from crews finding them out there.
 */
export const RADIO_ANSWER_CHANCE = [0.03, 0.05, 0.07, 0.09] as const;
/** Days someone who answered the radio waits at the gate. */
export const RECRUIT_WAIT_DAYS = 4;
/** Extra stat points for recruits, by Radio Tower level ("better recruits"). */
export const RECRUIT_BONUS_POINTS = [0, 0, 1, 2] as const;
/** Days a wanderer waits at the gate. */
export const WANDERER_DAYS = 3;
/** Days a trader caravan waits. */
export const TRADE_DAYS = 2;
/**
 * A swap asks for this share of what the guild holds of the supply it gives, if that's more than 8-20,
 * up to TRADE_MAX_GIVE (1.7.2). Before, every swap was 8-20, so traders meant nothing to a guild holding
 * hundreds, and a guild rich in scrap but short of tech had no way to turn one into the other.
 */
export const TRADE_SHARE_MIN = 0.08;
export const TRADE_SHARE_MAX = 0.15;
export const TRADE_MAX_GIVE = 200;

/** Chance per day that something happens at the Depot (one event at most). */
export const DEPOT_EVENT_CHANCE = 0.2;
/** Daily chance that each feuding pair at the Depot comes to blows. */
export const FEUD_FIGHT_CHANCE = 0.2;
/** Raids: d10 + best Aim at the Depot + Watchtower bonus vs this. */
export const RAID_DC = 12;
export const WATCHTOWER_DEFENSE = 2;
/** Share of scrap, rations and ammo raiders take; halved with a Watchtower... */
export const RAID_LOSS = 0.25;
/** ...but no more of each than they can carry: this much, plus a share of whatever is stored beyond RAID_TAKE_FREE (a big stockpile draws a bigger crew). */
export const RAID_MAX_TAKE = 30;
export const RAID_TAKE_FREE = 100;
export const RAID_TAKE_OVER = 0.2;

/**
 * Upkeep (1.6.2): what the upper levels of some buildings use up each day, by
 * level. Fractions are a chance of one more. A building whose upkeep can't be
 * paid works one level lower that day.
 */
export const BUILDING_UPKEEP: Partial<Record<BuildingId, { res: ResourceId; perLevel: readonly number[] }>> = {
  firepit: { res: 'rations', perLevel: [0, 0, 1, 2] },
  infirmary: { res: 'meds', perLevel: [0, 0, 0.25, 0.5] },
  workshop: { res: 'tech', perLevel: [0, 0, 0.25, 0.5] },
  radio_tower: { res: 'tech', perLevel: [0, 0, 0.25, 0.5] },
  watchtower: { res: 'ammo', perLevel: [0, 0, 0.5, 1] },
};

/**
 * Traders buy what the guild has too much of (1.6.2): scrap paid for each one
 * sold, and how much is kept back before any counts as spare (rations: this
 * many days of eating).
 */
export const TRADER_BUYS: Partial<Record<ResourceId, number>> = { rations: 0.5, meds: 1.2, tech: 2, gas: 1, ammo: 0.4 };
export const TRADER_BUY_KEEP = 25;
export const TRADER_BUY_KEEP_RATION_DAYS = 10;
/** Chance a caravan offers to buy, when the guild has something spare. */
export const TRADER_BUY_CHANCE = 0.5;

// ---------------------------------------------------------------- names

/** Longest first or last name the player can give a survivor. */
export const NAME_MAX_LENGTH = 20;

// ---------------------------------------------------------------- new game

export const STARTING_SURVIVORS = 4;
/** What a new guild starts with. 50 scrap (20 before 1.7.2) buys Bunks 2 or Garden 2 on day one: the first week brings in only about 10 scrap a day. */
export const STARTING_RESOURCES: Resources = {
  scrap: 50,
  rations: 24,
  meds: 3,
  ammo: 15,
  tech: 0,
  gas: 0,
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

/** A weapon earns a name at this many kills (10 before 1.6.2, when most of the guild's weapons had names within a month)... */
export const NAMED_GEAR_KILLS = 25;
/** ...and a line in its story at these. */
export const NAMED_GEAR_MILESTONES = [50, 100, 200] as const;
/** Story lines kept for a nemesis or a named weapon. */
export const STORY_MAX_LINES = 12;

// ---------------------------------------------------------------- partners (roadmap step 12)

/** Each day, the chance a Bonded pair at the Depot together becomes partners. */
export const PARTNER_DAILY_CHANCE = 0.015;
/**
 * Who people can fall for, per thousand. Set so that about 96% of couples are a
 * man and a woman (Aviel's call), measured on guilds of 4 and 8 over two to four
 * months in partners.test.ts.
 */
export const ORIENTATION_PER_MILLE = { straight: 850, gay: 60, bi: 90 } as const;
/** ...and by this when either already has a partner: about 99% stay with one. */
export const PARTNER_SECOND_FACTOR = 0.01;
/** ...and by this for every couple already in the guild, so couples stay uncommon over months (1.6.2). */
export const PARTNER_GUILD_FACTOR = 0.4;
/** Extra stress shed a day with their partner at the Depot, on top of a Bonded friend's. */
export const PARTNER_RELIEF = 2;
/** Extra stress on seeing their partner go down. */
export const PARTNER_DOWN_STRESS = 10;
/** Extra on a wound roll with their partner standing, on top of a Bonded friend's. */
export const PARTNER_WOUND_BONUS = 5;
/** Losing a partner: stress, and Grieving lasts this many days longer. */
export const PARTNER_LOSS_STRESS = 25;
export const PARTNER_GRIEF_EXTRA_DAYS = 7;
/** Partners whose bond falls below this (no longer friends) split up. */
export const PARTNER_SPLIT_SCORE = 20;

// ---------------------------------------------------------------- vehicles and gas (roadmap step 13, §7.8)

/** A run's distance in legs for gas: one leg per this many minutes of walking, at least one. */
export const GAS_LEG_MINUTES = 30;
/** Engines carry: the crew's spotting check when enemies are near. */
export const VEHICLE_AMBUSH_PENALTY = -2;
/** Most extra trouble that noise brings, added to the combat weight multiplier. */
export const VEHICLE_NOISE_CAP = 0.6;
/** Chance per fight or hazard that a vehicle is wrecked: this per point of danger... */
export const WRECK_PER_DANGER = 0.004;
/** ...plus this times (1 - condition/100) squared. */
export const WRECK_WORN = 0.08;
/** Condition lost to a fight or hazard, on top of the run's ordinary wear. */
export const VEHICLE_KNOCKS: readonly [number, number] = [2, 6];
/** Condition of a wreck a crew gets running and drives home. */
export const FOUND_VEHICLE_CONDITION: readonly [number, number] = [10, 35];
/** Walking home after a wreck: stress for each walker... */
export const WALK_HOME_STRESS = 8;
// ---------------------------------------------------------------- salvage (§9.4)

/** Taking gear apart gives back this share of what making it costs (1.8.0). */
export const SALVAGE_SHARE: Record<Quality, number> = { rusty: 0.25, common: 0.4, solid: 0.6, prime: 0.8, relic: 0 };
/** What a trinket's parts are worth (they have no recipe). */
export const SALVAGE_TRINKET_SCRAP = 2;

// ---------------------------------------------------------------- projects (§9.6)

/** Most people on one project's crew. */
export const PROJECT_CREW = 3;
/** Work a crew member at the Depot adds a day: this, plus their work stat times PROJECT_WORK_PER_STAT. */
export const PROJECT_WORK_BASE = 1;
export const PROJECT_WORK_PER_STAT = 0.25;
/** Hard work: each crew member at the Depot eats this many more rations a day while a stage is under way. */
export const PROJECT_CREW_RATIONS = 1;
/** The Line: runs to its stops take this share of the time. */
export const LINE_TIME = 0.5;
/** The Wall: added to holding off raids. */
export const WALL_DEFENSE = 4;
/** The Clinic: healing at the Depot is multiplied by this, and wounds lose an extra day each day. */
export const CLINIC_HEAL_MULT = 2;
/** The Relay: more outposts. */
export const RELAY_OUTPOSTS = 2;
/** The Memorial Garden: more stress shed a day, and grief loses an extra day each day. */
export const MEMORIAL_RELIEF = 1;

/** Stress every run costs for the road itself (§6), on top of what happens on it, plus 1 for every ROAD_STRESS_MINUTES away. */
export const ROAD_STRESS = 5;
/** Runs at this danger or more count toward Veteran (§4.5). */
export const HARD_RUN_DANGER = 2;
export const ROAD_STRESS_MINUTES = 15;
/** ...and the walk takes this share of the round trip on foot. */
export const WALK_HOME_SHARE = 0.6;
/** Damage to each rider when a vehicle is wrecked. */
export const WRECK_HURT: readonly [number, number] = [1, 4];
/** Repairs: scrap for every 10 points of condition, and tech for every 25. */
export const REPAIR_SCRAP_PER_10 = 3;
export const REPAIR_TECH_PER_25 = 1;
/** A broken raid drives off a vehicle at home this often (half with a Watchtower). */
export const VEHICLE_THEFT_CHANCE = 0.4;
/** Fewer people home than this, and each one missing costs the fence this much. */
export const RAID_FULL_FENCE = 3;
export const RAID_THIN_PENALTY = 2;
/** Raids come this many times as often when no more than one person is home. */
export const RAID_EMPTY_WEIGHT = 2;
/** Chance a trader brings a vehicle instead of the usual offer. */
export const TRADER_VEHICLE_CHANCE = 0.1;
/** Weight of finding a wreck to get running, among a discovery beat's outcomes, where a place has wrecks. */
export const WRECK_FIND_WEIGHT = 0.5;

// ---------------------------------------------------------------- outposts and depths (roadmap step 15, §7.9, §7.10)

/** What an outpost costs to set up. */
export const OUTPOST_COST = { scrap: 40, tech: 6 } as const;
/** And to mend after a raid. */
export const OUTPOST_REPAIR = { scrap: 15 } as const;
/** How many people can live at one. */
export const OUTPOST_STAFF = 3;
/** Runs to the place or a place next to it start from the outpost: this share of the time. */
export const OUTPOST_SHORTCUT = 0.5;
/** A crew stopping at an outpost on the way home sheds this stress and heals this much. */
export const OUTPOST_REST_STRESS = 8;
export const OUTPOST_REST_HP = 2;
/** Each person living there heals this share of their health a day: about a third of the Depot's, with no Infirmary. */
export const OUTPOST_HEAL = 0.03;
/** Stress shed a day out there (the Depot gives 2, plus its Firepit), before a Bonded friend or partner there. */
export const OUTPOST_RELIEF = 1;
/** Keeping watch: stress a day for every point of the place's danger above 1. */
export const OUTPOST_WATCH_STRESS = 1;
/** Trouble at an outpost (prowlers, a long night, an accident, radiation): chance a day, base plus per point of danger. */
export const OUTPOST_TROUBLE_BASE = 0.04;
export const OUTPOST_TROUBLE_PER_DANGER = 0.02;
/** Prowlers: d10 + the best Aim there + 1 for each other fit person against this + danger. */
export const OUTPOST_PROWLER_DC = 8;
/** Raiders hit an outpost with this chance a day: base, plus per point of danger. */
export const OUTPOST_RAID_BASE = 0.005;
export const OUTPOST_RAID_PER_DANGER = 0.005;
/** Raids on an outpost are fought like the gate (§9.8): bought at the place's danger for a fence of at least this many, this big. */
export const OUTPOST_RAID_FENCE = 1;
export const OUTPOST_RAID_BUDGET = 0.75;
/** The danger an outpost raid is fought at, by the place's danger: raiders who come for a camp aren't the worst the place has. */
export const OUTPOST_RAID_DANGER: readonly number[] = [0, 1, 2, 2, 2, 3];
/** Deeper levels: +1 danger, this much longer, and this much likelier to turn up gear, per level down. */
export const DEPTH_DURATION = 0.25;
export const DEPTH_GEAR = 0.5;
export const DEPTHS = 3;

// ---------------------------------------------------------------- decisions at the Depot (1.7.0)

/** Game days between one decision and the next (8 game days are a real day). */
export const DILEMMA_GAP: readonly [number, number] = [5, 11];
/** Game days the player has to decide before the people involved settle it themselves (about a real day). */
export const DILEMMA_DAYS = 8;
/** The first one in a new guild, on this day. */
export const DILEMMA_FIRST_DAY = 4;

// ---------------------------------------------------------------- calls for help (§10.1, 1.9.0)

/** Game days between one call for help and the next, with a Radio Tower. */
export const RESCUE_GAP: readonly [number, number] = [5, 10];
/** The first call comes this many days after the Radio Tower can hear it. */
export const RESCUE_FIRST_GAP = 3;
/** Game days a call lasts unanswered (about three quarters of a real day). */
export const RESCUE_DAYS = 6;
/** Stat points a rescued person has on top of a recruit's. */
export const RESCUE_BONUS_POINTS = 2;
/** Days a rescued person waits at the gate when no bed is free. */
export const RESCUE_WAIT_DAYS = 6;
/** Stress for a crew that gets there too late. */
export const RESCUE_LOST_STRESS = 8;
/** What a rescued person had put by, brought home with them (plus the place's danger). */
export const RESCUE_STASH: readonly [number, number] = [6, 12];

// ---------------------------------------------------------------- leaving the guild (1.9.0)

/** Relationship between someone a crew found out there and whoever brought them home. */
export const REL_FOUND = 15;

/** Stress for a partner left behind when someone walks out. */
export const PARTNER_LEFT_STRESS = 15;

// ---------------------------------------------------------------- animals (§9.7, 1.9.0)

/** Days a stray waits at the gate. */
export const STRAY_DAYS = 3;
/** Stress an animal's keeper sheds each day at home with it. */
export const KEEPER_RELIEF = 1;
/** The dog: added to holding off raids. */
export const DOG_DEFENSE = 2;
/** The cat: stress the most strained person at home sheds each day. */
export const CAT_RELIEF = 3;
/** The goat: rations of milk a day. */
export const GOAT_MILK = 1;
/** The crow: a day's chance of bringing home scrap, how much, and the chance of a trinket. */
export const CROW_SCRAP_CHANCE = 0.15;
export const CROW_SCRAP: readonly [number, number] = [1, 3];
export const CROW_TRINKET_CHANCE = 0.01;

// ---------------------------------------------------------------- ageing (§5.2, 1.10.0)

/** Game days in a year: everyone has a birthday this often (about 45 real days). */
export const YEAR_DAYS = 365;
/** From this age, each birthday may take a point off Grit, Brawn or Aim. */
export const DECLINE_AGE = 60;
export const DECLINE_CHANCE = 0.5;
/** Stats don't decline below this. */
export const DECLINE_FLOOR = 2;
/** From this age, a small chance each day at the Depot of dying peacefully: the base times (age - 64)². About 10% a year at 70. */
export const OLD_AGE_AGE = 65;
export const OLD_AGE_DEATH_BASE = 0.0000076;

// ---------------------------------------------------------------- babies and children (§5.3, 1.10.0)

/**
 * The day's chance that partners, both at the Depot, find a baby is on the
 * way: about one in every 100 days they're home together (12 real days). A
 * busy guild keeps them apart most days, so in play it's rarer.
 */
export const CONCEIVE_CHANCE = 0.01;
/** Mothers between these ages. */
export const MOTHER_AGES: readonly [number, number] = [18, 42];
/** Game days from finding out to the birth (about 34 real days). */
export const PREGNANCY_DAYS = 270;
/** For the last of them she stays at the Depot (about 10 real days). */
export const NEARLY_DUE_DAYS = 80;
/** Game days after a birth before the same couple has another (about 3 real months). */
export const BABY_GAP_DAYS = 730;
/** Children join the guild at this age, and help in the Garden from that one. */
export const ADULT_AGE = 16;
export const CHILD_HELP_AGE = 12;
/** What a child eats a day, and what one of 12 or more adds to the Garden. */
export const CHILD_RATIONS = 0.5;
export const CHILD_GARDEN = 0.5;
/** Stress everyone at the Depot sheds with children around: per child, at most the cap. */
export const CHILD_RELIEF = 1;
export const CHILD_RELIEF_MAX = 2;
/** New parents shed this much stress. */
export const BIRTH_RELIEF = 15;
/** Relationship between someone who grows up at the Depot and each parent. */
export const REL_FAMILY = 50;

// ---------------------------------------------------------------- beds (§9.1, 1.10.0)

/** Children sleep in their parents' bed until this age, then need one of their own (about 9 real months). */
export const SHARE_BED_AGE = 6;
/**
 * With more people than beds, someone at home sleeps on the floor each night
 * (each Depot day): no rest that night, and this much stress instead, up to the cap.
 */
export const FLOOR_STRESS = 3;
export const FLOOR_STRESS_CAP = 70;

// ---------------------------------------------------------------- the Vultures (§7.11, 1.11.0)

/** The game day they turn up (about five real days in). Older saves get them this many days after updating. */
export const VULTURES_ARRIVE_DAY = 40;
export const VULTURES_LATE_ARRIVAL = 8;
/** Where they set up first: a place of this danger. */
export const VULTURES_HOME_DANGER: readonly [number, number] = [3, 4];
export const VULTURES_START_STANDING = -10;
export const VULTURES_START_STRENGTH = 40;
/** Strength each game day (about 0.8 a real day), up to the cap. */
export const VULTURES_GROWTH = 0.1;
export const VULTURES_MAX_STRENGTH = 100;
/** Standing bands: at war at or below the first, trading partners at or above the last. */
export const VULTURES_WAR = -40;
export const VULTURES_TRUCE = 10;
export const VULTURES_TRADE = 40;
/** A camp for every this much strength, on top of their home. */
export const VULTURES_STRENGTH_PER_CAMP = 35;
/** A new camp at most this often (game days); one is lost at or below this strength per extra camp. */
export const VULTURES_CAMP_GAP: readonly [number, number] = [20, 28];
export const VULTURES_CAMP_HOLD = 25;
/** Lieutenants under the boss. A lost one is replaced after this many game days. */
export const VULTURES_LIEUTENANTS = 3;
export const VULTURES_PROMOTION_DAYS: readonly [number, number] = [15, 25];
/** Driven out of their last camp, they're gone this many game days and come back this strong. */
export const VULTURES_GONE_DAYS: readonly [number, number] = [20, 30];
export const VULTURES_RETURN_STRENGTH = 25;

/** Finds at a place in their turf. */
export const VULTURES_TURF_FINDS = 0.8;
/** How often a run in their turf meets them: beat weight, more at a camp, scaled by strength / 50. */
export const VULTURES_MEET_WEIGHT = 10;
export const VULTURES_MEET_CAMP_WEIGHT = 18;
/** A meeting near a camp brings its lieutenant this often. */
export const VULTURES_LIEUTENANT_CHANCE = 0.4;
/** A wary standoff: Nerve against this + strength / 25; a toll is this share of what the crew carries. */
export const VULTURES_STANDOFF_DC = 9;
export const VULTURES_TOLL = 0.25;
/** The toll when someone tried to talk them out of it and failed (§7.12). */
export const VULTURES_TOLL_RAISED = 0.5;
/** Friendly meetings share news of a place this often. */
export const VULTURES_NEWS_CHANCE = 0.2;
/** A downed lieutenant is captured (rather than killed) this often when the crew holds the field. */
export const VULTURES_CAPTURE_CHANCE = 0.5;
/** Their side of a fight is bought like any encounter's, ×(0.8 + strength / 200); at a camp, this much bigger. The camp's stores. */
export const VULTURES_ASSAULT_BUDGET = 1.4;
export const VULTURES_CAMP_STORES: readonly [number, number] = [20, 40];
export const VULTURES_CAMP_GEAR_CHANCE = 0.5;

/** Standing changes. */
export const VULTURES_FIGHT_STANDING = -5;
export const VULTURES_KILL_STANDING = -10;
export const VULTURES_ASSAULT_STANDING = -20;
export const VULTURES_NOD_STANDING = 1;
export const VULTURES_PARTNER_NOD_STANDING = 2;
export const VULTURES_TOLL_STANDING = 3;
export const VULTURES_TRADE_STANDING = 3;
export const VULTURES_RELEASE_STANDING = 10;
export const VULTURES_RANSOM_STANDING = 15;
export const VULTURES_RANSOM: Readonly<Partial<Record<'scrap' | 'tech', number>>> = { scrap: 20, tech: 10 };
export const VULTURES_RECRUIT_STANDING = -10;
/** Asking a prisoner to join: this chance, plus this for each friend or better at home... */
export const VULTURES_JOIN_CHANCE = 0.25;
/** Strength changes. */
export const VULTURES_KILLED_STRENGTH = -2;
export const VULTURES_LIEUTENANT_STRENGTH = -5;
export const VULTURES_CAMP_STRENGTH = -15;
export const VULTURES_BOSS_STRENGTH = -30;
export const VULTURES_TAKEN_STRENGTH = 2;

/** People: an unanswered call, or someone left waiting at the gate, goes to them this often. */
export const VULTURES_TAKE_CHANCE = 0.5;
/** Prisoners eat a ration a day and slip out this often. */
export const VULTURES_ESCAPE_CHANCE = 0.02;
/** Outpost raids a day in their turf, at war and wary (fought like the gate, §9.8; they come stronger as they grow). */
export const VULTURES_OUTPOST_RAID: readonly [number, number] = [0.01, 0.003];
/** Depot raids: as often as raiders at war (this share wary), and this much harder to hold off. */
export const VULTURES_WARY_RAIDS = 0.25;
export const VULTURES_RAID_DC = 2;
/** Caravan swaps shrink by strength / this, until trading partners; their own traders' swaps. */
export const VULTURES_TRADE_CUT = 400;
export const VULTURES_TRADER_RATE = 1.25;
/** Envoys come to the gate this often (game days). */
export const VULTURES_ENVOY_GAP: readonly [number, number] = [12, 20];

// ---------------------------------------------------------------- radio calls (§7.12)

/** How long a crew waits on the radio for an answer before deciding themselves (real ms). */
export const RADIO_WAIT = 30 * 60_000;
/** How often a travel, hazard or discovery beat becomes a fork, when one fits. */
export const FORK_CHANCE = 0.2;

// ---------------------------------------------------------------- commanded fights (§7.13)

/** At a fight on a led run the crew waits this long for the player, then fights on its own; once in command, the fight has to be over by then. */
export const LEAD_WAIT = RADIO_WAIT;
/** Ids set aside at departure for whatever a led run's replays find (they all count from the start copy's counter). */
export const LEAD_ID_BLOCK = 500;

// ---------------------------------------------------------------- raids at the gate (§9.8)

/** Raiders reach the gate this long after the Depot day that brings them begins (minutes, at random between). */
export const RAID_ARRIVE_MINUTES = [50, 160] as const;
/** At the gate they wait this long for the player's orders; then whoever is home fights them on their own. */
export const RAID_WAIT = 3 * 60 * 60_000;
/** The chance the Watchtower sees them coming, by its level, and how much more for each lookout posted. */
export const WATCH_SPOT_CHANCE = [0, 0.5, 0.7, 0.9] as const;
export const WATCH_SPOT_LOOKOUT = 0.1;
/** How long before they arrive they're seen, by the Watchtower's level (minutes). */
export const WATCH_LEAD_MINUTES = [0, 45, 75, 120] as const;
/** The raiders are as many and as tough as at a place of this danger, for a fence of at least three. */
export const RAID_DANGER = 2;
/** More of them than a run's fight at that danger would bring: they came for the Depot. */
export const RAID_BUDGET_MULT = 1.05;
/** A lookout on the Watchtower shoots from up there, out of reach, with this much more to hit for each level of the tower. */
export const TOWER_TO_HIT = 1;
/** Behind the Wall, raiders need this much more to hit the defenders. */
export const WALL_COVER = 3;
/** The guild's dog joins in: its bite, to hit and damage. */
export const DOG_TO_HIT = 3;
export const DOG_DAMAGE = [2, 3] as const;
/** The Infirmary is right there: a defender who goes down gets this on the wound roll, and nobody dies at the gate. */
export const RAID_WOUND_BONUS = 10;
/** Rations spoil (§9.1, Aviel): kept more than this many game days, this share of them goes off each day. */
export const RATION_KEEP_DAYS = 10;
export const RATION_SPOIL_SHARE = 0.5;
/** Getting ready (§9.8): shoring up the fence takes this, and raiders need this much more to hit the defenders behind it (on top of the Wall). */
export const RAID_SHORE_COST = { scrap: 20 } as const;
export const RAID_SHORE_COVER = 2;
/** Hidden stores: raiders who break in find only this share of them, and the defenders reach only this share of the meds and ammo. */
export const RAID_HIDDEN_SHARE = 0.5;
/** Paying raiders off at the gate: this share of what they'd take breaking in, but at least this much scrap and rations for each of them. */
export const RAID_TOLL_SHARE = 0.6;
export const RAID_TOLL_PER_RAIDER = 3;
/** Staring them down: the best Nerve at the gate against this, and this much more against the Vultures. Failing, the raiders strike first. */
export const RAID_STARE_DC = 13;
export const RAID_STARE_VULTURES = 2;
/** Some raids come in two bands: the second comes on if the gate holds, this much the size of the first. */
export const RAID_WAVE_CHANCE = 0.25;
export const RAID_WAVE_BUDGET = 0.6;
/** The Workshop's people know the machines: +this to hit scrapbots at the gate for each Workshop level. */
export const RAID_WORKSHOP_TO_HIT = 1;
/** Raiders and the Vultures come wanting something in particular this often (§9.8). */
export const RAID_WANT_CHANCE = 0.4;
/** A score to settle: someone with at least this many raider kills; in the fight raiders go for them this many times as often. */
export const RAID_SCORE_KILLS = 5;
export const RAID_MARKED_WEIGHT = 4;
/** A kind of store: this share of it, but at least this much. */
export const RAID_WANT_SHARE = 0.3;
export const RAID_WANT_MIN = { rations: 15, meds: 4, ammo: 10 } as const;
/** Spoils of a held raid: each raider killed leaves gear this often, and one is left behind as a captive this often. */
export const RAID_SPOILS_GEAR = 0.35;
export const RAID_CAPTIVE_CHANCE = 0.3;
/** Captives: questioned (Nerve, against this), they tell of a cache; asked, they join this often; they slip out this often a day. */
export const CAPTIVE_QUESTION_DC = 12;
export const CAPTIVE_CACHE = { scrap: [8, 16], rations: [4, 10], ammo: [3, 8] } as const;
export const CAPTIVE_JOIN_CHANCE = 0.25;
export const CAPTIVE_ESCAPE_CHANCE = 0.02;
/** Take cover: enemies need this much more to hit them this round. */
export const COVER_DEFENSE = 3;
/** Aim: the next shot is this much more likely to hit, and does this much more damage. */
export const AIM_TO_HIT = 3;
export const AIM_DAMAGE = 1;
/** Called shot: harder to hit, double damage. */
export const CALLED_SHOT_TO_HIT = -3;
/** Spray: two enemies at once, each a little harder to hit. */
export const SPRAY_TO_HIT = -2;
/** Smash: harder to land, more damage, through any armor. */
export const SMASH_TO_HIT = -2;
export const SMASH_DAMAGE = 2;
/** Charge: this much more to hit and damage, and enemies get as much against them this round. */
export const CHARGE_BONUS = 2;
/** Draw fire: the enemies go for them, and need this much more to hit. */
export const DRAW_FIRE_DEFENSE = 2;
/** Spot: everyone else is this much more likely to hit the spotted enemy. */
export const SPOT_TO_HIT = 2;

// ---------------------------------------------------------------- their moves, ranks and nerve (§7.4, 2.3.0)
/** A big hit an enemy winds up (shown before the crew acts) does this many times its damage... */
export const HEAVY_HIT_MULT = 2;
/** ...and is this much harder to land. */
export const HEAVY_TO_HIT = -2;
/** A group that can break starts with this much nerve; at 0 those that can run do. */
export const NERVE_FULL = 100;
/** Nerve lost when their leader falls, on top of what any death costs. */
export const NERVE_LEADER = 30;
/** A hit at least this big shakes them... */
export const BIG_HIT = 6;
/** ...by this much. */
export const NERVE_BIG_HIT = 8;
/** One of the crew going down gives them heart. */
export const NERVE_DOWN = 15;
/** Someone stared down and running (intimidate) takes this off the rest. */
export const NERVE_TALKED = 20;
/** Below this nerve, a badly hurt one may look for a way out instead of attacking... */
export const RUN_NERVE = 40;
/** ...this often a round. It runs at the end of the round unless stopped. */
export const RUN_CHANCE = 0.5;
/** A pack (2.4.0): +1 to hit for each other one going for the same person, up to this. */
export const PACK_TO_HIT_MAX = 2;
/** How often a fight on a run comes with a job (2.5.0): hold the door, grab their stash, get someone out, open a cage. */
export const GOAL_CHANCE = 0.25;
/** How many more come through a door nobody holds. */
export const DOOR_REINFORCEMENTS = 2;
/** A stranger got out comes home to join this often; the rest give what they carry and go their own way. */
export const GOAL_RESCUE_JOINS = 0.5;
/** What they give instead: meds. */
export const GOAL_RESCUE_MEDS: [number, number] = [1, 2];
/** A crew that can't reach what's left (drones, and nobody who can shoot) pulls out and leaves this share of what it found. */
export const UNREACHABLE_DROP = 1 / 3;
/** Intimidate, Soothe, Short out: checks against this + danger. */
export const INTIMIDATE_DC = 10;
export const SOOTHE_DC = 9;
export const SHORT_OUT_DC = 9;
/** Patched up after going down: the wound roll gets this much. */
export const PATCH_WOUND_BONUS = 5;
