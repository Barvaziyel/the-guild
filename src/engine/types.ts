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
  /** Moves this trait adds in a fight the player commands (§7.13). Hidden traits add none. */
  moves?: MoveId[];
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
  /** Keeps them off runs and nothing else (Exhausted): tired, not hurt, so they still work their posts and hold the gate. */
  onlyRuns?: boolean;
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
  /** Moves this item adds in a fight the player commands (§7.13). */
  moves?: MoveId[];
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
  /** The game day of their next birthday (§5.2). Missed while away on a run, it comes when they're home. */
  nextBirthday?: number;
  /** Born at the Depot: the game day, and their mother's and father's ids (§5.3). */
  bornDay?: number;
  parents?: { mother: string; father: string };
  /** Expecting a baby (§5.3): who the father is, and the game day it's due. */
  expecting?: { father: string; dueDay: number };
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
/** `haven`: the road east, the whole guild together, once (§9.12, 3.0.0). */
/** `trade`: goods to the market at the Drive-In and something else back (§7.14, 3.4.0); only there. */
export type RunJob = 'scavenge' | 'scout' | 'hunt' | 'rescue' | 'assault' | 'haven' | 'trade';
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
  /**
   * The player leads the fights over the radio (§7.13). Any crew can be led (2.2.0; before, it needed a Radio Tower).
   * `true`: they call home at every fight. `'matters'` (3.10.0, the planner's default): only at fights that matter,
   * a named foe or one that would put someone down if they fought it alone; the rest they fight on their own.
   */
  lead?: boolean | 'matters';
  /**
   * Set by `startRun` (3.11.0): going a level further in is a real gamble for this crew, this risky (the planner's
   * word for the next level down), so at the deepest point they may call home to ask whether to press on. Kept in
   * the plan so every replay agrees.
   */
  pressOn?: 'Moderate' | 'High' | 'Deadly';
  /**
   * Go after the place's elite (§7.15, 3.12.0): once the guild has seen it and while it's at large, the crew
   * looks for it, and at the deepest point of the run they find where it lives.
   */
  elite?: boolean;
  /** A trade run's goods and what they're for (§7.14, 3.4.0). Only with job `trade`. */
  trade?: TradeOrder;
}

/** What a trade run takes to the market and what it brings back (§7.14). */
export interface TradeOrder {
  /** What goes in the packs. */
  give: ResourceId;
  amount: number;
  /** What it's traded for. */
  get: ResourceId;
  /** What the market would give at the prices when the crew set out, before any haggling. Set by `startRun`. */
  quote?: number;
  /**
   * Exactly how many of `get` to buy (3.7.2; Aviel: "I should be able to buy an exact amount of x and tell
   * me the price in y. It should round up, don't make it easier on me"). `amount` is then its price,
   * rounded up (`priceOf`), and the trader hands over this many, however much the goods were worth.
   * Missing on trades planned before: they buy whatever the goods fetch.
   */
  want?: number;
}

/**
 * The market at the Drive-In (§7.14, 3.4.0): how much of each supply the guild has
 * sold there (more than 0) or bought (less than 0) lately, which moves its price.
 * Eases back toward 0 every game day.
 */
export interface MarketState {
  glut: Partial<Record<ResourceId, number>>;
}

// ---------------------------------------------------------------- commanded fights (§7.13)

/** A move in a fight the player commands. Everyone has the first four; gear and traits add the rest (`moves` hooks). */
export type MoveId =
  | 'attack'
  /** A blow at an enemy on the ground that would get back up (2.4.0): it can't miss. */
  | 'finish'
  /** Working the job the fight came with (2.5.0): hold the door, haul the crate... */
  | 'job'
  | 'cover'
  | 'patch'
  | 'aim'
  | 'called_shot'
  | 'spray'
  | 'smash'
  | 'stun'
  | 'charge'
  | 'draw_fire'
  | 'guard'
  | 'spot'
  | 'intimidate'
  | 'soothe'
  | 'short_out'
  /** Shove (a blow) or Pin down (a shot), 3.8.0: no harm, but it breaks what the enemy was winding up, and it's off balance. Everyone has it. */
  | 'shove'
  /** Held by a hollow (3.8.0): the one move left, getting out of its grip. */
  | 'break_free';

/** One person's move for a round. `target`: an enemy's place in the fight (a number) or an ally's survivor id. */
export interface MoveOrder {
  move: MoveId;
  target?: number | string;
}

/**
 * Where someone stands in a fight (§7.4, 2.3.0). Blows reach only the front rank
 * while anyone stands there; shots reach both. Those who can shoot start at the back.
 */
export type Rank = 'front' | 'back';

/** The orders for one round, by survivor id. Anyone without one fights as they would on their own. */
export interface RoundOrders {
  moves: Record<string, MoveOrder>;
  /** Where people stand this round, by survivor id; anyone not named stays where they were (2.3.0). */
  ranks?: Record<string, Rank>;
  /** The whole crew tries to break away (the withdrawal check). */
  pullOut?: boolean;
}

/** A fight on a run the player leads (§7.13). */
export interface LedFight {
  /** When the crew stopped and called home, and until when they wait (epoch ms). */
  at: number;
  until: number;
  /** Survivor id of whoever called. */
  by: string;
  /** "three Raider Scavs", for the card and the notice. */
  against: string;
  /** Index of the beat the fight is played in; hidden from the log until it's over. */
  fromBeat: number;
  /** Where on the road east the fight is (§9.12), a key of `HAVEN_JOURNEY.sites`, for its name and backdrop. Missing elsewhere: it's at the run's place. */
  site?: string;
  /** Left to fight it alone, someone would die (3.10.0): the call says so. Only on a run that calls when it matters. */
  grave?: boolean;
  /** An elite in it (§7.15, 3.12.0): its enemy id, for its prize on the card. */
  elite?: string;
  /** When the player took command, or sent them in on their own. */
  took?: number;
  /** The rounds given so far. */
  rounds: RoundOrders[];
  /** Sent in on their own (*Let them fight*), or the time ran out: the crew plays every round not given. */
  auto?: boolean;
  /** When it was over, under command; or when the wait ran out. Missing while it waits or is under way. */
  ended?: number;
}

/** A run the player leads: what it set out with, and its fights so far. */
export interface RunLead {
  /** The copy of the game the run is played on, as it was at departure; replayed with the orders given. */
  start: GameState;
  /** Names already in use at departure (nemeses, nicknames, named weapons), so a replay names things the same way. */
  taken: string[];
  fights: LedFight[];
}

export type BeatKind = 'depart' | 'travel' | 'scavenge' | 'hazard' | 'combat' | 'social' | 'discovery' | 'rescue' | 'vultures' | 'trade' | 'return';

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

/** What the guild knows of one elite (§7.15, 3.12.0). */
export interface EliteRecord {
  /** The day someone first saw it. */
  seen: number;
  status: 'atLarge' | 'dead';
  /** Fights with the guild. */
  fights: number;
  diedDay?: number;
  /** Who brought it down: survivor id and name, kept in case they're gone since. */
  killedBy?: { id: string; name: string };
}

/** What one run did to one elite (§7.15, 3.12.0), applied when the crew is back: runs overlap, like nemeses. */
export interface EliteNews {
  id: string;
  /** Seen for the first time on this run, by this survivor. */
  seen?: string;
  /** Fought it. */
  fought?: boolean;
  /** Brought it down: who. */
  killed?: string;
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
  /** They pressed on, a level further in than planned (3.11.0): the level. */
  deeper?: number;
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
  /** Elites seen, fought or killed (§7.15, 3.12.0). */
  elites?: EliteNews[];
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
  /** What the run did to the Vultures (§7.11). */
  vultures?: VultureNews;
  /** What the crew turned up about Haven (§9.11). */
  haven?: HavenNews;
  /** The road east (§9.12): how it ended at the gate. */
  havenEnd?: HavenEnd;
}

/** How the road east ended (§9.12). */
export interface HavenEnd {
  won: boolean;
  /** The one who went east, shot at the gate (a survivor id in `departed`); missing for the stranger. */
  shot?: string;
  /** Whether the Vultures came and fought beside the guild. */
  vultures: boolean;
  /** Won: the people freed from the wards who can walk. They fill the Depot's free beds; the rest go with the Vultures. */
  freed?: Survivor[];
}

/** What a run turned up about Haven (§9.11): a clue it was looking for, or a hint on the way. */
export interface HavenNews {
  /** A lead followed: the clue's id, and whether they found it (if not, it counts as a try). */
  lead?: { clue: string; found: boolean; by?: string };
  /** Something heard or seen on the way: a hint, as it was heard. */
  hint?: { id: string; text: string };
  /** The one the broadcast pulled in went east from the road home (§9.11), and who saw them go. */
  ran?: { id: string; saw: string[] };
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
  /** When they're back. While a radio call waits, as if nobody answers. */
  returnAt: number;
  rations: number;
  /** Gas taken for the vehicles. */
  gas?: number;
  /** As if nobody answers a radio call, until someone does. */
  beats: Beat[];
  result: RunResult;
  /** By survivor id. Missing on runs sent before save version 8. */
  departed?: Record<string, DepartureMark>;
  /** The crew called home from a fork (§7.12). */
  radio?: RadioCall;
  /** The player leads the fights (§7.13). */
  lead?: RunLead;
  /** With a Radio Tower, what the run set out with, so the crew can be called home (§9.8). A led run uses its own copy. */
  home?: RunHome;
  /** Called home over the radio at this time: raiders on the way. */
  recalled?: number;
}

/** A run's copy of the game as it set out, to play it again with the crew called home. */
export interface RunHome {
  start: GameState;
  taken: string[];
}

/** An order the player can give over the radio. */
export interface RadioOrder {
  id: string;
  label: string;
}

/**
 * A crew on the radio at a fork (§7.12). Every answer's run was played at
 * departure; answering picks one, and the rest of the run moves to start then.
 */
export interface RadioCall {
  /** The fork's content id, or 'vultures'. */
  forkId: string;
  title: string;
  /** Survivor id of whoever is on the radio. */
  by: string;
  /** What they found, and what they say. */
  intro: string;
  ask: string;
  orders: RadioOrder[];
  /** When they called, and how long they wait for an answer (epoch ms). */
  at: number;
  until: number;
  /** Index of the first beat after the call: the answer, and the rest. */
  fromBeat: number;
  /** Each order's run from the fork on, timed as if answered the moment they called. Dropped once the call is settled. */
  branches?: Record<string, RadioBranch>;
  /** A call to press on or come home (3.11.0): what they carry, how they are, and what's ahead. */
  deeper?: PressOnView;
  /** The order given; 'none' when nobody answered in time. Missing while they wait. */
  answer?: string;
  /** When the order was given (epoch ms). */
  answeredAt?: number;
}

/** What a crew shows when it calls about pressing on (3.11.0). */
export interface PressOnView {
  /** What's ahead, as they see it: 'stash', 'big' or 'voice' (`content/press-on.ts`). */
  teaser: string;
  /** The level they'd go into: 2 deeper in, 3 the heart of it. */
  level: number;
  /** How risky that level is for this crew, as the planner would say it. */
  risk: 'Moderate' | 'High' | 'Deadly';
  /** What they carry so far: supplies, and how many pieces of gear. */
  haul: Partial<Resources>;
  items: number;
  /** How each of them is, by survivor id. */
  crew: { id: string; hp: number; maxHp: number; down: boolean }[];
}

/** One order's run from the fork on. */
export interface RadioBranch {
  returnAt: number;
  /** The beats from `fromBeat` on. */
  beats: Beat[];
  result: RunResult;
}

/** A finished run kept for the report screen. */
export interface RunReport {
  id: string;
  plan: RunPlan;
  /** The radio call on the run, if there was one: what was asked, and the answer. */
  radio?: { title: string; by: string; answer: string; orders: RadioOrder[] };
  /** A led run (§7.13): how many fights it stopped for, and how many the player commanded. */
  lead?: { fights: number; commanded: number };
  departAt: number;
  returnAt: number;
  beats: Beat[];
  summary: RunSummary;
  /** Survivor id -> full name at the time, so reports survive deaths. */
  crewNames: Record<string, string>;
  /** Whether the player has opened the report. */
  read: boolean;
  /** What the crew set out with besides meds and ammo, all of it used up out there (3.7.0). Missing on older reports. */
  packed?: { rations: number; gas: number };
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

export const BUILDING_IDS = ['bunks', 'garden', 'scrapyard', 'firepit', 'infirmary', 'workshop', 'radio_tower', 'watchtower', 'training_yard'] as const;
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

/** The Depot's own corners (§9.9, 2.7.0). */
export interface CornerState {
  /** Corner ids, in the order they were searched. */
  searched: string[];
  /** The one search under way (one at a time). */
  search?: CornerSearch;
  /** The last search's outcome, for its card, until the player has seen it. */
  last?: CornerResult;
}

export interface CornerSearch {
  cornerId: string;
  /** Who is searching. */
  by: string;
  start: number;
  /** When it's done, in epoch ms. */
  until: number;
}

export interface CornerResult {
  cornerId: string;
  by: string;
  at: number;
  text: string;
  /** What came into the stores (or went out). */
  supplies?: Partial<Resources>;
  /** Names of the gear found, now in the stash. */
  gear?: string[];
  seen?: boolean;
}

/** The first week (§9.10, 2.8.0). */
export interface StoryState {
  /** The step under way, by its index in the first week; past the last, the week is done. */
  step: number;
  /** What the step counts from. */
  base: StoryBase;
  /** How the last step went, for its card until read. */
  last?: StoryEnding;
}

/**
 * Haven (§9.11): the long goal, from the broadcast at the end of the first
 * week. What the guild has found and heard about it, in order.
 */
export interface HavenState {
  /** The game day the broadcast was first heard. */
  day: number;
  /** Clues found, in the order they were found. */
  found: HavenFound[];
  /** Runs that followed a lead and came back without it, by clue id. */
  tries: Record<string, number>;
  /** Hints heard, in order. */
  heard: HavenHeard[];
  /** The game day of the last hint, so they don't all come at once. */
  lastHint?: number;
  /** Found and heard when the player last opened the Haven tab: anything past these is new. */
  seen: { found: number; heard: number };
  /**
   * The one of the guild the broadcast pulls in (§9.11, Aviel): picked partway
   * through the hunt, heard talking about Haven at the fire, then gone east
   * alone on a run home. At Haven's gate they get out and run to the guild,
   * and are shot (Haven, part 2).
   */
  dreamer?: HavenDreamer;
  /** Places bought in a trader's caravan for the road east (§9.12): seats beyond the guild's own vehicles. */
  caravan?: number;
  /** The road east under way (§9.12): its run, and the children riding along. */
  road?: { runId: string; children: string[] };
  /** How the road east ended (§9.12, 3.0.0), for good. */
  end?: { day: number; won: boolean; freed: number; withVultures: number };
}

export interface HavenDreamer {
  /** A survivor id (in `state.departed` once gone). */
  id: string;
  /** The game day they were picked. */
  day: number;
  /** The game day they were ready to go: every line about them heard, or the road open. */
  ready?: number;
  /** The game day they went. */
  gone?: number;
}

export interface HavenFound {
  id: string;
  day: number;
  /** Who found it (a survivor id), and where. Missing for what came to the Depot (the Vultures' word). */
  by?: string;
  at?: string;
}

export interface HavenHeard {
  id: string;
  day: number;
  /** As it was heard, with the names filled in. */
  text: string;
  /** Where it came from (§9.11): a run, a newcomer, a trader, the radio, the fire, a captive, the Vultures. */
  source: HavenHintSource;
  /** The place, for a hint on a run. */
  at?: string;
}

export type HavenHintSource = 'run' | 'gate' | 'trader' | 'radio' | 'fire' | 'captive' | 'vultures';

/** Runs home when a step began, in all and at each place (where there were any). */
export interface StoryBase {
  runs: number;
  at: Record<string, number>;
}

export interface StoryEnding {
  stepId: string;
  title: string;
  text: string;
  /** What came into the stores. */
  supplies?: Partial<Resources>;
  /** Anything else: "a Motorcycle", "Ada Moss, at the gate". */
  gifts?: string[];
  seen?: boolean;
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
  /** The Vultures' own trader, once they're trading partners (§7.11): better swaps, and trading warms them. */
  vultures?: true;
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
  /** The Vultures' envoy, a member id, for their decisions (§7.11). Shown as {v}. */
  envoy?: string;
  /** A Vulture the guild holds, a member id, for the decisions about them. Shown as {p}. */
  prisoner?: string;
  /** Game day it came up. */
  day: number;
  /** Game day on which, still unanswered, the people involved settle it themselves. */
  deadlineDay: number;
}

// ---------------------------------------------------------------- the Vultures (§7.11)

export type VultureRole = 'boss' | 'lieutenant';
/** free: with the Vultures; captured: the guild's prisoner; joined: one of the guild now. */
export type VultureStatus = 'free' | 'captured' | 'dead' | 'joined';

export interface VultureMember {
  /** A person made like a survivor, for the portrait, name and stats. Their id is the member's id. */
  person: Survivor;
  role: VultureRole;
  status: VultureStatus;
  /** The place of the camp they hold, while free. */
  campId?: string;
  /** Whether the guild has met them (seen at the gate, on a run, in a fight). */
  met: boolean;
  /** What happened between them and the guild, oldest first. */
  history: StoryLine[];
}

export interface VultureCamp {
  locationId: string;
  /** Game day it was set up. */
  since: number;
  /** Their first camp, where the boss is. */
  home?: true;
}

export interface VulturesState {
  /** The game day they turn up; until then they aren't in the Reach. */
  arriveDay: number;
  arrived: boolean;
  /** −100 (war) to 100 (trading partners). */
  standing: number;
  /** 0 to 100: how many camps, how big their crews, how much they cut into the trade. */
  strength: number;
  camps: VultureCamp[];
  people: VultureMember[];
  /** Game day of their next camp, while their strength allows one. */
  nextCampDay: number;
  /** Game day a lost lieutenant (or boss) is replaced. */
  nextPromotionDay?: number;
  /** Driven out of their last camp: back on this game day, under a new boss. */
  returnDay?: number;
  /** Game day the next envoy may come to the gate (a decision, §9.5). */
  nextEnvoyDay: number;
}

/** What a run did to the Vultures, applied when the crew is back (runs overlap, like nemeses). */
export interface VultureNews {
  standing: number;
  strength: number;
  /** Members met on the run. */
  met: string[];
  killed: string[];
  captured: string[];
  /** A camp the crew took (Hit their camp). */
  campTaken?: string;
  /** Lines for each member's history. */
  history: { id: string; line: StoryLine }[];
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
  /** More people than beds on the last day played: someone sleeps on the floor (§9.1). */
  crowded?: boolean;
  /** Raiders coming for the Depot, at the gate, or the last raid fought (§9.8). */
  raid?: DepotRaid;
  /** The rations in the stores by the game day they came in, oldest first (§9.1): they go off after a while. */
  pantry?: RationBatch[];
}

/**
 * A raid on the Depot (§9.8). Decided on the Depot day that brings it, it
 * arrives at a set time: seen coming first if the Watchtower spots it. At the
 * gate the raiders wait for the player's orders, and only those who were home
 * and fit when they arrived can defend. Kept once it's over, for the screen
 * that shows how it went, until the next one.
 */
/** Who comes (§9.8): raiders, the Vultures, or the Reach's other bands. */
export type RaidBand = 'raiders' | 'vultures' | 'ferals' | 'hollows' | 'scrapbots';

/** What raiders came for in particular (§9.8). `missing`: it wasn't there when they came. */
export type RaidWant = (
  | { what: 'vehicle'; vehicleId: string; name: string }
  | { what: 'prisoner'; id: string; name: string }
  | { what: 'score'; id: string; name: string; kills: number }
  | { what: 'store'; resource: 'rations' | 'meds' | 'ammo'; amount: number }
) & { missing?: true };

/** What a held raid left behind: supplies off the beaten, gear (item uids) and maybe a captive (a captive's id). */
export interface RaidSpoils {
  found: Partial<Resources>;
  gear: string[];
  captive?: string;
}

/** Rations that came into the stores on one game day. */
export interface RationBatch {
  day: number;
  n: number;
}

export interface DepotRaid {
  id: string;
  /** Raiders, the Vultures with one of their named people at their head, or another band from the Reach. */
  by: RaidBand;
  leadId?: string;
  /** Raiders at one of the guild's outposts (its place id) rather than the Depot. */
  outpost?: string;
  /** What they came for in particular, if anything. */
  wants?: RaidWant;
  /** What a held raid left behind. */
  spoils?: RaidSpoils;
  /** The fight's dice. */
  seed: string;
  /** The game day that brought them. */
  day: number;
  /** When they reach the gate, and when the Watchtower sees them coming (if it does). */
  arrive: number;
  seen?: number;
  /** After this they stop waiting: the defenders fight on their own. */
  until: number;
  /** A second band behind the first: they come on if the gate holds. */
  waves?: 2;
  /** Getting ready while they're on the road: the fence shored up, and stores hidden (half out of reach, of the raiders and the defenders both). */
  shored?: boolean;
  hidden?: boolean;
  /** Set when they arrive: the enemies (ids, the leader first), the second band's, and who was home and fit to fight. */
  enemies?: string[];
  enemies2?: string[];
  defenders?: string[];
  /** Words at the gate before any fighting: paid off, or stared down (by whom, and whether it worked). */
  talk?: RaidTalk;
  /** Who holds the gate against the first band (every defender unless the player picks), and the second. */
  team?: string[];
  team2?: string[];
  /** Set when the fight begins: those who fight, as they were then, and the Depot's meds and ammo for them. */
  start?: GameState;
  marks?: Record<string, DepartureMark>;
  /** Lookouts with a gun on the Watchtower: they shoot from up there. */
  perch?: string[];
  meds?: number;
  ammo?: number;
  /** The player took command at this time, and the orders given since, round by round. */
  took?: number;
  rounds?: RoundOrders[];
  /** Orders in the fight with the second band, once the player has picked who holds the gate. */
  rounds2?: RoundOrders[];
  /** Over: when, and how it ended. */
  ended?: number;
  end?: 'held' | 'broken' | 'paid' | 'stared';
}

/** What was said at the gate. */
export type RaidTalk = { how: 'pay'; paid: Partial<Resources>; gave?: string } | { how: 'stare'; by: string; ok: boolean; check: CheckInfo };

/** Someone a raid left behind, held at the Depot (§9.8). */
export interface Captive {
  /** Made like a survivor, for the portrait, name and stats; joins as one if asked and willing. */
  person: Survivor;
  from: 'raiders' | 'vultures';
  /** Game day they were taken. */
  since: number;
  questioned?: true;
  /** Asked to join and said no. */
  refused?: true;
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
  /** Children born at the Depot, until they turn 16 and join the guild (§5.3). */
  children: Survivor[];
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
  /** The elites the guild knows of (§7.15, 3.12.0), by enemy id. One not here hasn't been seen yet. */
  elites: Record<string, EliteRecord>;
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
  /** The rival guild (§7.11). */
  vultures: VulturesState;
  /** People raids left behind, held at the Depot (§9.8). */
  captives: Captive[];
  /** The Depot's own corners (§9.9): which have been searched, and the search under way. */
  corners: CornerState;
  /** The first week (§9.10): the step under way. Undefined for a guild that never had one (older than its first week when it came in). */
  story?: StoryState;
  /** Haven (§9.11), from the broadcast on. Missing before it. */
  haven?: HavenState;
  /** The market at the Drive-In (§7.14, 3.4.0). Missing until the guild first trades there. */
  market?: MarketState;
  log: GuildLogEntry[];
  settings: {
    mercyMode: boolean;
  };
}
