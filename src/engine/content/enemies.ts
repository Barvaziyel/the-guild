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
    damage: 3,
    defense: 9,
    armor: 0,
    stealth: 10,
    threat: 2,
    morale: 'breaks',
    backsOff: 'calm',
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
    hitVerb: 'shot by',
    loot: { ammo: [1, 3], scrap: [0, 1] },
  },
  {
    id: 'raider_brute',
    type: 'raider',
    name: 'Raider Brute',
    plural: 'Raider Brutes',
    description: 'Wears a car door and swings an engine block on a chain.',
    hp: 14,
    attack: 4,
    damage: 5,
    defense: 9,
    armor: 1,
    stealth: 6,
    threat: 5,
    morale: 'breaks',
    backsOff: 'intimidate',
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
    hitVerb: 'mauled by',
    loot: { scrap: [2, 4], ammo: [0, 2] },
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
    hp: 5,
    attack: 4,
    damage: 3,
    defense: 11,
    armor: 1,
    stealth: 9,
    threat: 3,
    morale: 'fearless',
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
    hitVerb: 'shot by',
    loot: { tech: [1, 2], scrap: [2, 4], ammo: [0, 2] },
  },
];
