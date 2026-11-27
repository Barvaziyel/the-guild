import type { ResourceId } from '../types.ts';
import { ELITES } from './elites.ts';
import type { CrewLines } from './flavor.ts';

/** Enemy type ids are also check-mod contexts: 'enemy:feral', 'enemy:scrapbot', ... */
export type EnemyType = 'raider' | 'feral' | 'hollow' | 'scrapbot';

export interface EnemyDef {
  id: string;
  type: EnemyType;
  name: string;
  plural: string;
  description: string;
  hp: number;
  /** Added to the d10 attack roll. */
  attack: number;
  damage: number;
  /** Attack rolls against it must reach this. */
  defense: number;
  /** Damage soaked per hit. */
  armor: number;
  /** DC of the crew's ambush check. */
  stealth: number;
  /** Cost against the encounter's threat budget. */
  threat: number;
  /** 'breaks': runs once more than half the group is dead. 'fearless': fights to the end. */
  morale: 'breaks' | 'fearless';
  /**
   * How the crew can end the encounter without a fight.
   * intimidate: a Nerve check, always attempted (unless hunting or sneaking).
   * calm: only attempted by someone with a Nerve bonus against this enemy type.
   */
  backsOff?: 'intimidate' | 'calm';
  /** Radiation dealt with each hit. */
  rads?: number;
  /** Fights from a distance (§7.4, 2.3.0): stands in the back rank, out of melee reach while anyone stands in front, and can hit anyone. */
  ranged?: boolean;
  /** Flies (§7.4, 2.3.0): never in melee reach, and hits anyone. Only shots bring it down. */
  flies?: boolean;
  /** Chance each round of winding up a big hit (double damage) instead of a normal one, shown before the crew acts (§7.4, 2.3.0). */
  heavy?: number;
  /** Leads the group: when it falls, the rest lose much of their nerve (§7.4, 2.3.0). */
  leader?: boolean;
  /** Drops instead of dying the first time, and gets back up at the end of the next round with half its HP unless someone finishes it (§7.4, 2.4.0). */
  rises?: boolean;
  /** Hunts as a pack (§7.4, 2.4.0): they all go for the same one of the crew, +1 to hit for each other one on them (up to +2). */
  pack?: boolean;
  /**
   * Chance each round of lining up a shot instead of firing (3.8.0): nothing this round, and next round a
   * shot at the same one, 3 easier to land and twice the damage. A shove, a stun or a pin down spoils it.
   */
  aims?: number;
  /** A patcher (3.8.0): each round it mends this much on one of its own hurt to 3/4 or less, instead of fighting. */
  mends?: number;
  /** Chance each round of throwing a firebomb at a rank of the crew (3.8.0): this much on everyone standing there, halved in cover. Shoved or pinned down, it drops it at its own feet. */
  throws?: { chance: number; damage: number };
  /**
   * Chance each round of grabbing the one it goes for instead of hitting (3.8.0): if it lands, it holds them.
   * Held, they can only try to break free, and it bites them every round, sure as anything, until it's
   * hurt, shoved, stunned or put down.
   */
  grabs?: number;
  /** Blows a round (§9.12, 3.0.0): the Shepherd's four arms strike twice, at a second one of the crew when it can. One when missing. */
  attacks?: number;
  /** Never met in the Reach: only at Haven (§9.12). Kept out of encounters, raids and the balance table. */
  havenOnly?: boolean;
  /**
   * Brings more into the fight (3.12.0): a chance each round, `max` at most in a fight, of one of `id`
   * coming to its call. Shoved or pinned down, it doesn't get the call out. "{It} {how}, and {a X} {comes}."
   */
  calls?: { id: string; chance: number; max: number; how: string; comes: string };
  /** Plates (3.12.0): each hit that lands knocks one off instead of hurting it. Many small hits strip them; then it's soft. */
  plates?: number;
  /** Chance each round of a sweep at a whole rank of the crew (3.12.0): its hit on everyone standing there, halved in cover. Shoved or pinned down, it doesn't. */
  sweeps?: number;
  /** Chance each round of going under (3.12.0): nothing reaches it for a round, then it comes up under someone (anyone, front or back) with a big hit. */
  dives?: number;
  /** Strikes twice once it's down to half its HP (3.12.0). */
  enrages?: boolean;
  /** One of a kind that lives at a place (§7.15, 3.12.0). Kept out of encounters, raids and the balance table, like Haven's. */
  elite?: EliteDef;
  /** "{name} is {hitVerb} a Rad-hound." */
  hitVerb: string;
  /** Resources dropped when killed: [min, max]. */
  loot: Partial<Record<ResourceId, [number, number]>>;
}

/**
 * What makes an enemy one of a kind (§7.15, 3.12.0): where it lives, how the guild
 * first hears of it, what it says when it turns up, and what it leaves behind.
 * {a.*} in the lines is whoever's there to see it (the one with the best Wits).
 */
export interface EliteDef {
  /** The place it lives. */
  place: string;
  /** The first time anyone sees it: a beat of its own on a run there. */
  signs: { title: string; lines: CrewLines };
  /** When it turns up in a fight, before the first blow. */
  met: string;
  /** Going after it (the planner's order): where they find it, at the deepest point of the run. */
  lair: { title: string; lines: CrewLines };
  /** Its end. */
  killed: string;
  /** What it leaves: a Relic with a name of its own (`name`) and a first line of its story. */
  prize: { item: string; name: string; story: string };
}

const KINDS: readonly EnemyDef[] = [
  // ------------------------------------------------------------ ferals
  {
    id: 'rad_hound',
    type: 'feral',
    name: 'Rad-hound',
    plural: 'Rad-hounds',
    description: 'Hairless, half-blind pack hunters. Fast and always hungry.',
    hp: 5,
    attack: 3,
    damage: 2,
    defense: 9,
    armor: 0,
    stealth: 10,
    threat: 2,
    morale: 'breaks',
    backsOff: 'calm',
    pack: true,
    hitVerb: 'bitten by',
    loot: { rations: [0, 1] },
  },
  {
    id: 'mire_stalker',
    type: 'feral',
    name: 'Mire Stalker',
    plural: 'Mire Stalkers',
    description: 'Something that used to be a big cat. It waits in the reeds.',
    hp: 12,
    attack: 5,
    damage: 5,
    defense: 10,
    armor: 0,
    stealth: 12,
    threat: 5,
    morale: 'breaks',
    backsOff: 'calm',
    heavy: 0.2,
    hitVerb: 'mauled by',
    loot: { rations: [2, 3] },
  },

  // ------------------------------------------------------------ raiders
  {
    id: 'raider_scav',
    type: 'raider',
    name: 'Raider Scav',
    plural: 'Raider Scavs',
    description: 'Hungry, badly armed, and happy to take what you found.',
    hp: 7,
    attack: 3,
    damage: 3,
    defense: 9,
    armor: 0,
    stealth: 8,
    threat: 2,
    morale: 'breaks',
    backsOff: 'intimidate',
    hitVerb: 'slashed by',
    loot: { scrap: [0, 2], ammo: [0, 1] },
  },
  {
    id: 'raider_gunner',
    type: 'raider',
    name: 'Raider Gunner',
    plural: 'Raider Gunners',
    description: 'Has a real gun and enough ammo to be careless with it.',
    hp: 8,
    attack: 5,
    damage: 4,
    defense: 10,
    armor: 1,
    stealth: 8,
    threat: 4,
    morale: 'breaks',
    backsOff: 'intimidate',
    ranged: true,
    aims: 0.3,
    hitVerb: 'shot by',
    loot: { ammo: [1, 3], scrap: [0, 1] },
  },
  {
    // 3.8.0: kill it first, or it puts the others back together.
    id: 'raider_patcher',
    type: 'raider',
    name: 'Raider Patcher',
    plural: 'Raider Patchers',
    description: 'Keeps the others on their feet with stolen meds, and a pistol for anyone who minds.',
    hp: 7,
    attack: 3,
    damage: 2,
    defense: 9,
    armor: 0,
    stealth: 8,
    threat: 3,
    morale: 'breaks',
    backsOff: 'intimidate',
    ranged: true,
    mends: 6,
    hitVerb: 'shot by',
    loot: { meds: [0, 1], scrap: [0, 1] },
  },
  {
    // 3.8.0: spread out, take cover, or pin it down before it throws.
    id: 'raider_firebug',
    type: 'raider',
    name: 'Raider Firebug',
    plural: 'Raider Firebugs',
    description: 'A bag of bottles, a rag in each, and a lighter it keeps flicking.',
    hp: 7,
    attack: 4,
    damage: 3,
    defense: 9,
    armor: 0,
    stealth: 8,
    threat: 4,
    morale: 'breaks',
    backsOff: 'intimidate',
    ranged: true,
    throws: { chance: 0.4, damage: 3 },
    hitVerb: 'shot by',
    loot: { gas: [0, 1], scrap: [0, 2] },
  },
  {
    id: 'raider_brute',
    type: 'raider',
    name: 'Raider Brute',
    plural: 'Raider Brutes',
    description: 'Wears a car door and swings an engine block on a chain.',
    hp: 12,
    attack: 4,
    damage: 5,
    defense: 9,
    armor: 3,
    stealth: 6,
    threat: 5,
    morale: 'breaks',
    backsOff: 'intimidate',
    heavy: 0.35,
    hitVerb: 'smashed by',
    loot: { scrap: [1, 3], rations: [0, 2] },
  },
  {
    id: 'raider_enforcer',
    type: 'raider',
    name: 'Raider Enforcer',
    plural: 'Raider Enforcers',
    description: 'Plated in welded road signs, swinging a rebar maul. The others step aside for it. Found where the raiders are strongest.',
    hp: 20,
    attack: 6,
    damage: 7,
    defense: 10,
    armor: 2,
    stealth: 6,
    threat: 8,
    morale: 'breaks',
    backsOff: 'intimidate',
    heavy: 0.3,
    leader: true,
    hitVerb: 'mauled by',
    loot: { scrap: [2, 4], ammo: [0, 2] },
  },

  // ------------------------------------------------------------ the Vultures (§7.11)
  // Met only through the Vultures (a meeting on a run, their camps), never in a place's encounters.
  {
    id: 'vulture_scav',
    type: 'raider',
    name: 'Vulture',
    plural: 'Vultures',
    description: 'A scavenger like your own, in a coat with black feathers stitched to the collar.',
    hp: 9,
    attack: 4,
    damage: 3,
    defense: 10,
    armor: 1,
    stealth: 9,
    threat: 3,
    morale: 'breaks',
    backsOff: 'intimidate',
    hitVerb: 'cut by',
    loot: { scrap: [1, 3], rations: [0, 2] },
  },
  {
    id: 'vulture_shot',
    type: 'raider',
    name: 'Vulture Shot',
    plural: 'Vulture Shots',
    description: 'Keeps back and keeps a rifle on you. The Vultures look after their guns.',
    hp: 9,
    attack: 6,
    damage: 4,
    defense: 10,
    armor: 1,
    stealth: 9,
    threat: 4,
    morale: 'breaks',
    backsOff: 'intimidate',
    ranged: true,
    aims: 0.3,
    hitVerb: 'shot by',
    loot: { ammo: [1, 4], scrap: [0, 2] },
  },
  {
    // A named lieutenant or the boss: their name, this kind's numbers.
    id: 'vulture_lieutenant',
    type: 'raider',
    name: 'Vulture Lieutenant',
    plural: 'Vulture Lieutenants',
    description: 'One of the people the Vultures answer to.',
    hp: 16,
    attack: 6,
    damage: 5,
    defense: 11,
    armor: 2,
    stealth: 9,
    threat: 7,
    morale: 'fearless',
    heavy: 0.25,
    leader: true,
    hitVerb: 'struck by',
    loot: { scrap: [2, 5], tech: [0, 2] },
  },

  // ------------------------------------------------------------ hollows
  {
    id: 'hollow',
    type: 'hollow',
    name: 'Hollow',
    plural: 'Hollows',
    description: 'A husk the radiation left walking. Slow, and it never stops.',
    hp: 8,
    attack: 2,
    damage: 3,
    defense: 7,
    armor: 0,
    stealth: 6,
    threat: 2,
    morale: 'fearless',
    rads: 4,
    rises: true,
    grabs: 0.3,
    hitVerb: 'clawed by',
    loot: { scrap: [0, 1] },
  },
  {
    id: 'glowing_hollow',
    type: 'hollow',
    name: 'Glowing Hollow',
    plural: 'Glowing Hollows',
    description: 'Bright enough to read by. Standing near it makes your teeth ache.',
    hp: 12,
    attack: 4,
    damage: 4,
    defense: 8,
    armor: 0,
    stealth: 5,
    threat: 4,
    morale: 'fearless',
    rads: 10,
    rises: true,
    grabs: 0.25,
    hitVerb: 'burned by',
    loot: { tech: [0, 1], scrap: [0, 1] },
  },

  {
    id: 'hollow_hulk',
    type: 'hollow',
    name: 'Hollow Hulk',
    plural: 'Hollow Hulks',
    description: 'Something that was a big man once, swollen and glowing under the skin. It does not stop, and it does not miss for long. Found only in the Glow.',
    hp: 24,
    attack: 5,
    damage: 8,
    defense: 7,
    armor: 1,
    stealth: 5,
    threat: 8,
    morale: 'fearless',
    rads: 15,
    heavy: 0.35,
    hitVerb: 'crushed by',
    loot: { tech: [0, 2], scrap: [1, 2] },
  },

  // ------------------------------------------------------------ Haven (§9.12, 3.0.0)
  {
    id: 'haven_orderly',
    type: 'raider',
    name: 'Haven Orderly',
    plural: 'Haven Orderlies',
    description: 'A white coat, a rubber apron and a bone saw. Calm, careful, and sure of what it is doing.',
    hp: 10,
    attack: 4,
    damage: 4,
    defense: 7,
    armor: 1,
    stealth: 5,
    threat: 4,
    morale: 'fearless',
    havenOnly: true,
    hitVerb: 'cut by',
    loot: { meds: [0, 1] },
  },
  {
    id: 'haven_marksman',
    type: 'raider',
    name: 'Haven Marksman',
    plural: 'Haven Marksmen',
    description: 'Up on the wall with a long rifle, picking out whoever moves. It never misses twice.',
    hp: 7,
    attack: 6,
    damage: 5,
    defense: 7,
    armor: 0,
    stealth: 7,
    threat: 4,
    morale: 'fearless',
    ranged: true,
    aims: 0.35,
    havenOnly: true,
    hitVerb: 'shot by',
    loot: { ammo: [1, 3] },
  },
  {
    id: 'the_shepherd',
    type: 'hollow',
    name: 'The Shepherd',
    plural: 'Shepherds',
    description: 'A giant sewn together out of many people: four arms, two heads, three legs, and every face on it still looking around. Haven’s best work.',
    hp: 64,
    attack: 5,
    damage: 6,
    defense: 8,
    armor: 2,
    stealth: 4,
    threat: 20,
    morale: 'fearless',
    heavy: 0.3,
    attacks: 2,
    havenOnly: true,
    hitVerb: 'torn at by',
    loot: { tech: [2, 4] },
  },

  // ------------------------------------------------------------ scrapbots
  {
    id: 'scrap_drone',
    type: 'scrapbot',
    name: 'Scrap Drone',
    plural: 'Scrap Drones',
    description: 'A patched-up security drone, still guarding something long gone.',
    hp: 3,
    attack: 4,
    damage: 3,
    defense: 11,
    armor: 0,
    stealth: 9,
    threat: 3,
    morale: 'fearless',
    flies: true,
    hitVerb: 'zapped by',
    loot: { tech: [0, 1], scrap: [1, 2] },
  },
  {
    id: 'scrapbot_sentry',
    type: 'scrapbot',
    name: 'Sentry Bot',
    plural: 'Sentry Bots',
    description: 'Pre-Burn security hardware on treads. Asks for a badge, then opens fire.',
    hp: 14,
    attack: 5,
    damage: 5,
    defense: 10,
    armor: 2,
    stealth: 7,
    threat: 6,
    morale: 'fearless',
    ranged: true,
    hitVerb: 'shot by',
    loot: { tech: [1, 2], scrap: [2, 4], ammo: [0, 2] },
  },
];

/** Every enemy: the kinds met in fights, and the elites (3.12.0). */
export const ENEMIES: readonly EnemyDef[] = [...KINDS, ...ELITES];

