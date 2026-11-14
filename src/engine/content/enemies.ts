import type { ResourceId } from '../types.ts';

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
  /** "{name} is {hitVerb} a Rad-hound." */
  hitVerb: string;
  /** Resources dropped when killed: [min, max]. */
  loot: Partial<Record<ResourceId, [number, number]>>;
}

export const ENEMIES: readonly EnemyDef[] = [
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
    hitVerb: 'shot by',
    loot: { ammo: [1, 3], scrap: [0, 1] },
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
