/**
 * Who comes for the Depot (§9.8), and what a held raid leaves behind.
 * Raiders always can; the Reach's other bands come once the guild knows a
 * place they come from. The Vultures come on their own schedule (§7.11).
 */

import type { RaidBand, ResourceId } from '../types.ts';
import type { EnemyType } from './enemies.ts';

export interface RaidBandDef {
  id: RaidBand;
  /** At the start of a sentence: "Raiders", "A feral pack". */
  name: string;
  /** Mid-sentence: "raiders", "a feral pack". */
  lower: string;
  /** The kind of enemy at the places that send them; raiders and the Vultures come whatever the guild knows. */
  from?: EnemyType;
  /** Who comes, bought from the raid's budget. */
  kinds: readonly string[];
  /** How big they come, against raiders. */
  budget: number;
  /** Weight among the bands that can come (not the Vultures, who come when they will). */
  weight: number;
  /** They can be paid off or stared down. */
  talk: boolean;
  /** What they carry off breaking in, and how much of it against raiders' share. */
  take: Partial<Record<ResourceId, number>>;
  /** They drive off a parked vehicle sometimes. */
  vehicles: boolean;
  /** Inside, they hurt this many of those home instead of taking stores. */
  hurt?: number;
  /** The Watchtower sees them coming this much as often. */
  spot: number;
  /** For the card: what's coming and what they're after. */
  after: string;
}

export const RAID_BANDS: Record<RaidBand, RaidBandDef> = {
  raiders: {
    id: 'raiders',
    name: 'Raiders',
    lower: 'raiders',
    kinds: ['raider_scav', 'raider_gunner', 'raider_brute'],
    budget: 1,
    weight: 6,
    talk: true,
    take: { scrap: 1, rations: 1, ammo: 1, gas: 1 },
    vehicles: true,
    spot: 1,
    after: 'They’re after the stores, and a vehicle if one is parked.',
  },
  vultures: {
    id: 'vultures',
    name: 'The Vultures',
    lower: 'the Vultures',
    kinds: ['vulture_scav', 'vulture_shot'],
    budget: 1,
    weight: 0,
    talk: true,
    take: { scrap: 1, rations: 1, ammo: 1, gas: 1 },
    vehicles: true,
    spot: 1,
    after: 'They’re after the stores, and a vehicle if one is parked.',
  },
  ferals: {
    id: 'ferals',
    name: 'A feral pack',
    lower: 'a feral pack',
    from: 'feral',
    kinds: ['rad_hound', 'mire_stalker'],
    budget: 1.12,
    weight: 2,
    talk: false,
    take: { rations: 1.5 },
    vehicles: false,
    spot: 1,
    after: 'They’re after food. There’s no talking to them.',
  },
  hollows: {
    id: 'hollows',
    name: 'Hollows',
    lower: 'hollows',
    from: 'hollow',
    kinds: ['hollow', 'glowing_hollow'],
    budget: 1.15,
    weight: 1.5,
    talk: false,
    take: {},
    vehicles: false,
    hurt: 2,
    spot: 0.5,
    after: 'They don’t want the stores. Inside, they go for people. There’s no talking to them.',
  },
  scrapbots: {
    id: 'scrapbots',
    name: 'Scrapbots',
    lower: 'scrapbots',
    from: 'scrapbot',
    kinds: ['scrap_drone', 'scrapbot_sentry'],
    budget: 1,
    weight: 1.5,
    talk: false,
    take: { scrap: 1, tech: 1.5 },
    vehicles: false,
    spot: 1,
    after: 'They’re after scrap and tech. The Workshop’s people know where to hit them.',
  },
};

/** Gear a killed raider may leave behind, by enemy (§9.8). */
export const RAID_SPOILS: Record<string, readonly string[]> = {
  raider_scav: ['pipe', 'machete', 'leather_jacket'],
  raider_gunner: ['pipe_pistol', 'hunting_rifle'],
  raider_brute: ['sledge', 'scrap_vest'],
  raider_enforcer: ['riot_gear', 'scattergun'],
  vulture_scav: ['machete', 'leather_jacket'],
  vulture_shot: ['pipe_pistol', 'crossbow'],
  vulture_lieutenant: ['scattergun', 'scrap_vest'],
};
