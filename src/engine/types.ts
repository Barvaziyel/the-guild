/**
 * Core data types for the game state. Everything here is plain JSON-safe data
 * so the whole GameState can be saved with JSON.stringify.
 */

import type { RngState } from './rng.ts';

// ---------------------------------------------------------------- stats

export const STAT_IDS = ['grit', 'brawn', 'aim', 'wits', 'nerve'] as const;
export type StatId = (typeof STAT_IDS)[number];
export type Stats = Record<StatId, number>;

// ---------------------------------------------------------------- traits

export type TraitKind = 'personality' | 'earned' | 'stress' | 'scar' | 'condition';

/** A situational modifier to checks, e.g. +2 Wits when dealing with tech. */
export interface CheckMod {
  stat?: StatId;
  /** Free-form context tag the simulation matches on, e.g. 'tech', 'scavenge', 'enemy:scrapbot'. */
  context?: string;
  mod: number;
}

/**
 * Behavior knobs that the simulation reads. All optional; absent means "no effect".
 * Add new keys here (documented) rather than special-casing trait ids in code.
 */
export interface TraitHooks {
  /** Chance per combat to flee when hurt or when an ally goes down. */
  fleeChance?: number;
  /** Chance, after a run that found something, to fall out with another crew member over the shares (1.6.2). */
  lootArgueChance?: number;
  /** Never flees, even under retreat pressure. */
  neverFlees?: boolean;
  /** Relative weight for being targeted by enemies (1 = normal). */
  attentionWeight?: number;
  /** Bonus loot rolls multiplier added to 1 (0.25 = +25%). */
  lootBonus?: number;
  /** Chance per scavenge beat to secretly pocket an item. */
  pocketChance?: number;
  /** Failed checks this survivor may reroll per run. */
  rerollFails?: number;
  /** Successful checks that get rerolled (bad luck) per run. */
  rerollSuccesses?: number;
  /** Multiplier on stress gained (1.25 = +25%). */
  stressGainMult?: number;
  /** Multiplier on stress recovered at the Depot. */
  stressReliefMult?: number;
  /** Stress removed from every other crew member per beat. */
  crewStressRelief?: number;
  /** Will try to rescue downed allies (bigger effect for Bonded friends). */
  rescuesAllies?: boolean;
  /** Bonus to wound rolls of downed allies in the same crew. */
  allyWoundBonus?: number;
  /** Bonus to own wound rolls. */
  woundRollBonus?: number;
  /** Multiplier on radiation absorbed. */
  radMult?: number;
  /** Multiplier on relationship gains (0.5 for Loner). */
  relGainMult?: number;
  /** Chance per run to start an argument with a crewmate. */
  argueChance?: number;
  /** Rations eaten per day (default 1). */
  rationUse?: number;
  /** Chance per beat to trigger a discovery (Curious). */
  discoveryBonus?: number;
  /** Chance per beat to trigger a hazard. */
  hazardBonus?: number;
  /** Ambush detection bonus. */
  ambushBonus?: number;
  /** Run duration multiplier when in the crew. */
  durationMult?: number;
  /** Bonus when the survivor is alone on a run. */
  soloBonus?: number;
  /** Stress per beat when the crew has 3+ members. */
  crowdStress?: number;
  /** Ignores retreat orders while the target enemy type is present. */
  ignoresRetreat?: boolean;
  /** Has a way with animals: strays at the Depot come to them (Animal Lover, Beast-Friend). */
  likesAnimals?: boolean;
  /** Situational check modifiers. */
  checkMods?: CheckMod[];
}

export interface TraitDef {
  id: string;
  name: string;
  kind: TraitKind;
  /** Player-facing explanation of what the trait does. */
  description: string;
  /** Flat stat changes while the trait is held. */
  statMods?: Partial<Stats>;
  /** Mutually exclusive trait; gaining one replaces the other. */
  opposite?: string;
  /** General sociability, -2..+2. Added to every relationship affinity. */
  sociability?: number;
  /** Affinity with specific other traits, -2..+2. */
  affinity?: Record<string, number>;
  hooks?: TraitHooks;
  /** Weight when rolling starting personality traits. 0 or absent = never at start. */
  startWeight?: number;
  /** For conditions: duration range in days. */
  durationDays?: [number, number];
  /** Trait needs a target, e.g. Vengeful needs an enemy type. */
  needsTarget?: boolean;
  /** Survivors with this trait can't be sent on runs (serious wounds). */
  blocksRuns?: boolean;
}

export interface TraitInstance {
  id: string;
  /** Hidden traits work normally but are not shown until revealed. */
  hidden?: boolean;
  gainedDay: number;
  /** Conditions expire at the start of this day. */
  expiresDay?: number;
  /** Why the trait was gained, for tooltips. */
  source?: string;
  /** Target for traits like Vengeful (an enemy type id). */
  target?: string;
}

// ---------------------------------------------------------------- gear

export const SLOTS = ['weapon', 'armor', 'tool', 'trinket'] as const;
export type Slot = (typeof SLOTS)[number];

export const QUALITIES = ['rusty', 'common', 'solid', 'prime', 'relic'] as const;
export type Quality = (typeof QUALITIES)[number];

export interface GearHooks {
  /** Bonus to scavenge checks. */
  scavengeBonus?: number;
  /** Multiplier on radiation absorbed. */
  radMult?: number;
  /** Warns of radiation hazards (lets the crew avoid them). */
  radWarning?: boolean;
  /** Ambush detection and scouting bonus. */
  ambushBonus?: number;
  /** Consumed to automatically pass a death save. */
  autoDeathSave?: boolean;
  /** Bonus to finding stashes. */
  stashBonus?: number;
  /** Stress relief per beat for the holder. */
  stressRelief?: number;
  /** Stress relief per beat for the whole crew. */
  crewStressRelief?: number;
  /** Silent weapon: bonus when the crew is sneaking. */
  silent?: boolean;
  /** Penalty to sneaking (heavy armor). */
  sneakPenalty?: number;
  /** Close-range weapon (bonus in ambushes, penalty at range). */
  closeRange?: boolean;
  /** Free failed-check rerolls per run. */
  rerollFails?: number;
  checkMods?: CheckMod[];
}

export interface GearDef {
  id: string;
  name: string;
  slot: Slot;
  description: string;
  /** Weapons only. */
  weaponType?: 'melee' | 'ranged';
  damage?: number;
  /** Modifier to attack rolls. */
  toHit?: number;
  /** Ranged weapons that spend ammo. */
  usesAmmo?: boolean;
  /** Armor: damage soaked per hit and added to defense. */
  armor?: number;
  statMods?: Partial<Stats>;
  hooks?: GearHooks;
  /** Single-use items (Medkit) are removed after use. */
  consumable?: boolean;
  /** Relative rarity in loot tables (higher = more common). */
  lootWeight: number;
}

export interface ItemInstance {
  uid: string;
  defId: string;
  quality: Quality;
  /** Weapons earn a name at NAMED_GEAR_KILLS kills. */
  name?: string;
  kills?: number;
  /** A named weapon's story: how it got its name, and what it has done since. */
  history?: StoryLine[];
  /** Consecutive runs carried by the same survivor (trinket attachment). */
  runsWithHolder?: number;
  /** Trinkets: survivor id this item became Cherished by. */
  cherishedBy?: string;
}

export type Equipment = Partial<Record<Slot, ItemInstance>>;

// ---------------------------------------------------------------- survivors

/** Survivors are men ('he') or women ('she'). */
export type Pronouns = 'he' | 'she';

/** Who someone can fall for: the other sex, their own, or either (§5.1). */
export type Orientation = 'straight' | 'gay' | 'bi';

export interface Appearance {
  /** Master seed for anything the portrait composer wants to vary. */
  seed: number;
  skinTone: number;
  hairColor: number;
  hairStyle: number;
  faceShape: number;
  eyes: number;
  brows: number;
  nose: number;
  mouth: number;
  facialHair: number;
}

export interface LifeCounters {
  runs: number;
  /** Runs at danger HARD_RUN_DANGER or more, counting the level gone to (Veteran counts these). */
  hardRuns: number;
  combats: number;
  kills: number;
  rangedKills: number;
  meleeKills: number;
  killsByEnemy: Record<string, number>;
  timesDowned: number;
  nearDeaths: number;
  rads: number;
  alliesLost: number;
  alliesSaved: number;
  scavenges: number;
  daysAtDepot: number;
}

export interface ChronicleEntry {
  day: number;
  text: string;
  tags?: string[];
}

export type SurvivorStatus = 'ready' | 'away' | 'dead' | 'left';

export interface Survivor {
  id: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  pronouns: Pronouns;
  /** Who they can fall for. Not shown on its own: it shows in who they end up with. */
  orientation: Orientation;
  age: number;
  origin: string;
  backstory: string;
  appearance: Appearance;
  /** Base stats (without trait/gear modifiers). */
  stats: Stats;
  /** Practice points toward the next increase of each stat. */
  practice: Stats;
  hp: number;
  stress: number;
  traits: TraitInstance[];
  equipment: Equipment;
  counters: LifeCounters;
  chronicle: ChronicleEntry[];
  status: SurvivorStatus;
  joinedDay: number;
  diedDay?: number;
  causeOfDeath?: string;
  /** Walked out of the guild (status 'left'): when, and why, written without a subject. */
  leftDay?: number;
  leftReason?: string;
  /** Their job at the Depot, done on days they're home and fit. */
  post?: Post;
  /** Living at the guild's outpost at this place (§7.9), not at the Depot. */
  outpost?: string;
}

// ---------------------------------------------------------------- relationships

export type RelationshipLabel = 'feud' | 'rival' | 'neutral' | 'friend' | 'bonded';

export type RelationshipFlag =
  | { kind: 'owesLife'; debtor: string }
  | { kind: 'mentor'; mentor: string }
  | { kind: 'partners' };

export interface Relationship {
  /** Survivor ids, sorted so that a < b. */
  a: string;
  b: string;
  score: number;
  flags: RelationshipFlag[];
}

// ---------------------------------------------------------------- expeditions

/** Rescue: answer a call for help (§10.1); only while someone is calling from that place. */
export type RunJob = 'scavenge' | 'scout' | 'hunt' | 'rescue';
export type Approach = 'sneaky' | 'balanced' | 'aggressive';
/** When the crew pulls out of a fight: someone below half HP, someone downed, or never. */
export type RetreatOrder = 'wounded' | 'downed' | 'never';

export interface RunPlan {
  locationId: string;
  /** Survivor ids, 1 to MAX_CREW. */
  crew: string[];
  job: RunJob;
  /** Supplies taken from the Depot. Rations are added automatically (rationsNeeded). */
  meds: number;
  ammo: number;
  approach: Approach;
  retreat: RetreatOrder;
  /** If the crew finds more than it can carry, this resource is kept first. */
  lootPriority?: ResourceId;
  /** Vehicle ids. Missing or empty: the crew walks. */
  vehicles?: string[];
  /** How far in: 1 the outskirts (missing means 1), 2 deeper in, 3 the heart of it (§7.10). */
  depth?: number;
}

export type BeatKind = 'depart' | 'travel' | 'scavenge' | 'hazard' | 'combat' | 'social' | 'discovery' | 'rescue' | 'return';

/** A dice check shown next to a log line: "Wits 6+5 vs 10". */
export interface CheckInfo {
  who: string;
  stat: StatId;
  roll: number;
  bonus: number;
  dc: number;
  success: boolean;
  rerolled?: boolean;
}

export interface LogLine {
  text: string;
  check?: CheckInfo;
  tone?: 'good' | 'bad';
}

/** One step of a run. `at` is ms after departure; the UI reveals beats as time passes. */
export interface Beat {
  at: number;
  kind: BeatKind;
  title: string;
  lines: LogLine[];
}

/**
 * completed: finished the job. turnedBack: came home early. routed: carried
 * each other home with nothing. lost: nobody came back.
 */
export type RunOutcome = 'completed' | 'turnedBack' | 'routed' | 'lost';

// ---------------------------------------------------------------- stories

/** A line in a nemesis's or a named weapon's story. Written without a subject. */
export interface StoryLine {
  day: number;
  text: string;
}

/** An enemy that put someone down and got away, and now has a name. */
export interface Nemesis {
  id: string;
  name: string;
  /** Enemy content id: what it is (rad_hound, raider_brute, ...). */
  enemyId: string;
  /** Where it was met. It turns up in fights there. */
  locationId: string;
  status: 'atLarge' | 'dead';
  /** Survivor ids it has put down, and those it has killed. */
  downed: string[];
  killed: string[];
  /** Fights with the guild it has walked away from. */
  escapes: number;
  bornDay: number;
  diedDay?: number;
  /** Survivor id of whoever killed it. */
  killedBy?: string;
  history: StoryLine[];
}

/** What one run did to one nemesis, applied when the crew is back. */
export interface NemesisNews {
  id: string;
  /** Met and named on this run: the whole record. */
  born?: Nemesis;
  /** Put down or killed on this run (survivor ids). */
  downed: string[];
  killed: string[];
  /** Got away from the crew this many times. */
  escapes: number;
  /** Killed on this run, by this survivor. */
  killedBy?: string;
  history: StoryLine[];
}

export interface RunDeath {
  survivorId: string;
  name: string;
  cause: string;
  /** Enemy type id, when an enemy did it. */
  enemyType?: string;
}

/** A Chronicle entry written during the run, for the "what changed" summary. */
export interface RunHighlight {
  survivorId: string;
  text: string;
}

export interface RunSummary {
  outcome: RunOutcome;
  loot: Resources;
  items: ItemInstance[];
  /** Loot units abandoned because the crew couldn't carry them. */
  leftBehind: number;
  medsLeft: number;
  ammoLeft: number;
  exploredGain: number;
  /** Location ids discovered. */
  discovered: string[];
  deaths: RunDeath[];
  highlights: RunHighlight[];
  /** Ids of the scripted events that happened. */
  events: string[];
  /** Nemeses met, named or killed (missing on runs from before save version 7). */
  nemeses?: NemesisNews[];
  /** The vehicles taken, after the run. Missing on foot and before save version 11. */
  vehicles?: VehicleNews[];
  /** Vehicles found out there and brought home. */
  foundVehicles?: Vehicle[];
  /** A rescue run: what became of the person calling for help. */
  rescue?: RescueNews;
  /** Animals that followed the crew home (§9.7). */
  animals?: Animal[];
  /** People the crew found out there and brought home (§10). */
  found?: FoundNews[];
}

/** Someone a crew found out there, and who found them. */
export interface FoundNews {
  person: Survivor;
  by: string;
}

/** What a rescue run came to (§10.1). */
export interface RescueNews {
  /** The person, as they come home (or as they were last seen). */
  person: Survivor;
  /** saved: brought home alive. lost: found too late, or lost on the way home. missed: never found. */
  outcome: 'saved' | 'lost' | 'missed';
  /** Who got them out. */
  by?: string;
}

/** Everything decided at departure and applied when the crew returns. */
export interface RunResult extends RunSummary {
  /** The crew as they will be after the run. */
  crew: Survivor[];
  /** Relationships between crew members after the run. */
  relationships: Relationship[];
}

/** A crew member as they left, so what happens to them at the Depot meanwhile survives their return. */
export interface DepartureMark {
  traits: string[];
  stress: number;
  /** Chronicle length when they left. */
  chronicle: number;
}

export interface Run {
  id: string;
  plan: RunPlan;
  seed: string;
  departAt: number;
  returnAt: number;
  rations: number;
  /** Gas taken for the vehicles. */
  gas?: number;
  beats: Beat[];
  result: RunResult;
  /** By survivor id. Missing on runs sent before save version 8. */
  departed?: Record<string, DepartureMark>;
}

/** A finished run kept for the report screen. */
export interface RunReport {
  id: string;
  plan: RunPlan;
  departAt: number;
  returnAt: number;
  beats: Beat[];
  summary: RunSummary;
  /** Survivor id -> full name at the time, so reports survive deaths. */
  crewNames: Record<string, string>;
  /** Whether the player has opened the report. */
  read: boolean;
}

export interface LocationState {
  discovered: boolean;
  /** 0..100: the outskirts, the first level. */
  explored: number;
  runs: number;
  /** Explored 0..100 of the deeper levels (§7.10): [deeper in, the heart of it]. Missing until the first is opened. */
  depths?: number[];
}

/** A camp the guild keeps at a fully explored place (§7.9). Its people are survivors with `outpost` set to the place. */
export interface Outpost {
  locationId: string;
  builtDay: number;
  /** Raided and broken into: it sends home half until repaired, and burns if it happens again. */
  damaged: boolean;
}

// ---------------------------------------------------------------- the Depot

export const BUILDING_IDS = ['bunks', 'garden', 'firepit', 'infirmary', 'workshop', 'radio_tower', 'watchtower', 'training_yard'] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

/** A job at one of the Depot's buildings. */
export interface BuildingPost {
  building: BuildingId;
  /** Training Yard: the stat they practice. */
  stat?: StatId;
}

/** A place on a project's crew (§9.6). */
export interface ProjectPost {
  project: ProjectId;
}

/** A survivor's job at the Depot: a building, or a project's crew. */
export type Post = BuildingPost | ProjectPost;

export const PROJECT_IDS = ['the_line', 'the_wall', 'the_clinic', 'the_relay', 'memorial_garden'] as const;
export type ProjectId = (typeof PROJECT_IDS)[number];

/** How far a project has got (§9.6). */
export interface ProjectState {
  /** Stages finished, 0 to 3. */
  done: number;
  /** Work put into the stage under way. Absent: no stage under way (the next one isn't paid for). */
  work?: number;
  /** The day its first stage was started, and the day its last was finished. */
  startedDay?: number;
  finishedDay?: number;
}

/** Someone at the gate who could join. */
export interface Candidate {
  survivor: Survivor;
  /** They move on at the start of this day. */
  expiresDay: number;
  /** Came on their own (a Depot event) rather than answering the radio. */
  wanderer?: boolean;
  /** Brought home by a rescue run, with no bed free: who got them out, and where (§10.1). */
  rescued?: { by: string; locationId: string };
  /** Found out there by a crew (a run event), with no bed free: who found them, and where (§10). */
  found?: { by: string; locationId: string };
}

/** The kinds of animal the guild can keep (§9.7). */
export const ANIMAL_KINDS = ['dog', 'cat', 'goat', 'crow'] as const;
export type AnimalKind = (typeof ANIMAL_KINDS)[number];

/** An animal the guild keeps, or one waiting at the gate. */
export interface Animal {
  id: string;
  kind: AnimalKind;
  name: string;
  /** Survivor id of whoever looks after it. */
  keeper?: string;
  /** The day it came to the Depot. */
  sinceDay: number;
}

/** A stray at the gate: kept if the player says so before it wanders off. */
export interface Stray {
  animal: Animal;
  /** It moves on at the start of this day. */
  expiresDay: number;
}

/** Someone calling for help over the radio (§10.1). */
export interface RescueCall {
  id: string;
  locationId: string;
  /** Who is calling: they join the guild if brought home. */
  person: Survivor;
  /** What trouble they're in: decides what getting them out takes. */
  trouble: RescueTrouble;
  day: number;
  /** Unanswered, the voice goes quiet at the start of this day. */
  expiresDay: number;
  /** The run sent to answer it. */
  runId?: string;
}

export type RescueTrouble = 'trapped' | 'hurt' | 'cornered' | 'lost';

export interface RescueState {
  call?: RescueCall;
  /** The game day the next call may come, with a Radio Tower. */
  nextDay: number;
}

/** A trader caravan's offer: the guild gives `give` and gets `get` (and the item, if any). */
export interface TradeOffer {
  id: string;
  give: Partial<Resources>;
  get: Partial<Resources>;
  item?: ItemInstance;
  /** A vehicle for sale, now and then (§7.8). */
  vehicle?: Vehicle;
  /** The caravan leaves at the start of this day. */
  expiresDay: number;
}

// ---------------------------------------------------------------- vehicles

/** A vehicle the guild owns (§7.8). Wrecked and stolen ones are gone. */
export interface Vehicle {
  id: string;
  /** VehicleDef id in content/vehicles.ts. */
  defId: string;
  /** 0 to 100. At 0 it won't run until the Workshop repairs it. */
  condition: number;
  /** Runs it has been on. */
  runs: number;
  /** The run it's out on, if any. */
  runId?: string;
}

/** What a run did to a vehicle it took, applied when the crew is back. */
export interface VehicleNews {
  id: string;
  /** What kind it is, for the report once it's gone. */
  defId: string;
  condition: number;
  /** Wrecked out in the Reach and left there. */
  wrecked?: boolean;
}

/** A decision waiting at the Depot (§9.5): who it's about, and until when. */
export interface ActiveDilemma {
  /** Content id in `content/dilemmas.ts`. */
  defId: string;
  /** Role letter to survivor id: who it's about. */
  cast: Record<string, string>;
  /** Someone at the gate, for decisions about a stranger. Joins the guild only if taken in. */
  stranger?: Survivor;
  /** Game day it came up. */
  day: number;
  /** Game day on which, still unanswered, the people involved settle it themselves. */
  deadlineDay: number;
}

export interface DilemmaState {
  active?: ActiveDilemma;
  /** The game day the next one may come up. */
  nextDay: number;
  /** Times each one has come up, so new ones come first. */
  seen: Record<string, number>;
}

export interface DepotState {
  /** The last game day whose Depot day has been played. */
  lastDay: number;
  recruits: Candidate[];
  offers: TradeOffer[];
  /** Ran out of rations on the last day played. */
  hungry?: boolean;
  /** Buildings whose upkeep couldn't be paid on the last day played: they work one level lower (1.6.2). */
  unpaid?: BuildingId[];
  /** Animals at the gate (§9.7). */
  strays: Stray[];
}

// ---------------------------------------------------------------- guild

export const RESOURCE_IDS = ['scrap', 'rations', 'meds', 'ammo', 'tech', 'gas'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];
export type Resources = Record<ResourceId, number>;

export interface GuildLogEntry {
  day: number;
  text: string;
  tags?: string[];
}

export interface GameState {
  /** Save format version; bump and add a migration in save.ts when the shape changes. */
  version: number;
  seed: string;
  rng: RngState;
  /** Epoch ms when the guild was founded. Day 1 starts here. */
  createdAt: number;
  /** Epoch ms of the last time the state was advanced. */
  lastUpdate: number;
  guildName: string;
  /** Counter for deterministic ids (s1, s2, i1, ...). */
  nextId: number;
  /** Living members of the guild (any status except dead/left). */
  survivors: Survivor[];
  /** Survivors who died, kept for the Memorial Wall. */
  memorial: Survivor[];
  /** Survivors who walked out of the guild (status 'left'), kept for their story. */
  departed: Survivor[];
  /** Keyed by pairKey(a, b). */
  relationships: Record<string, Relationship>;
  stash: ItemInstance[];
  resources: Resources;
  /** Keyed by location id. Use locationState() to read; new content may be missing. */
  locations: Record<string, LocationState>;
  /** Level of each Depot building; 0 means not built. */
  buildings: Record<BuildingId, number>;
  depot: DepotState;
  /** Crews currently out. */
  runs: Run[];
  /** Finished runs, newest first, capped at MAX_REPORTS. */
  reports: RunReport[];
  /** How many times each scripted event has happened, so fresh ones come up first. */
  eventsSeen: Record<string, number>;
  /** Named enemies, at large and dead. */
  nemeses: Nemesis[];
  /** Vehicles the guild owns, at home or out (§7.8). */
  vehicles: Vehicle[];
  /** Outposts at fully explored places (§7.9). */
  outposts: Outpost[];
  /** Decisions the player is asked to make at the Depot (§9.5). */
  dilemmas: DilemmaState;
  /** Big works at the Depot, by id; absent ones haven't been started (§9.6). */
  projects: Partial<Record<ProjectId, ProjectState>>;
  /** Animals the guild keeps (§9.7). */
  animals: Animal[];
  /** Calls for help over the radio (§10.1). */
  rescue: RescueState;
  log: GuildLogEntry[];
  settings: {
    mercyMode: boolean;
  };
}
