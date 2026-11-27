import type { StatId } from '../types.ts';

/**
 * Crew perks (§7.16, 3.13.0): two in a crew whose traits work together. Only traits that show count,
 * in the planner and on the run alike, so what the planner promises is what the run gets.
 */
export interface PerkDef {
  id: string;
  /** The chip's words. */
  name: string;
  /** What it does, read out in full. */
  does: string;
  /** The pair's traits; the same one twice is two people who both have it. */
  traits: readonly [string, string];
  /** Checks in these contexts get the mod, for both of the pair or (`who`) only the first or the second. */
  mods: readonly { who?: 0 | 1; stat?: StatId; context: string; mod: number }[];
}

export const PERKS: readonly PerkDef[] = [
  {
    id: 'look_and_check',
    name: 'One looks, one checks',
    does: "Curious and Cautious: one pokes into everything, the other checks it first. Both find more, and spot what's rigged",
    traits: ['curious', 'cautious'],
    mods: [
      { stat: 'wits', context: 'scavenge', mod: 2 },
      { stat: 'wits', context: 'spot', mod: 2 },
    ],
  },
  {
    id: 'keep_breathing',
    name: 'Keep them breathing',
    does: 'A Patcher with someone Loyal: one keeps people breathing, the other never leaves them. The Patcher patches people up better',
    traits: ['patcher', 'loyal'],
    mods: [{ who: 0, stat: 'wits', context: 'medicine', mod: 2 }],
  },
  {
    id: 'old_hands',
    name: 'Old hands',
    does: "Two Veterans watch each other's backs. Both are harder to catch off guard",
    traits: ['veteran', 'veteran'],
    mods: [{ stat: 'wits', context: 'ambush', mod: 2 }],
  },
  {
    id: 'strip_it',
    name: 'Strip it bare',
    does: 'A Tinkerer and a Scav: one knows where the good stuff is, the other how to get it out. Both find more, and do better with machines',
    traits: ['tinkerer', 'scav'],
    mods: [
      { stat: 'wits', context: 'scavenge', mod: 2 },
      { stat: 'wits', context: 'tech', mod: 2 },
    ],
  },
  {
    id: 'bait_and_shot',
    name: 'Bait and shot',
    does: 'Someone Brave draws them out, and the Dead-Eye takes the shot. The Dead-Eye aims better',
    traits: ['brave', 'dead_eye'],
    mods: [{ who: 1, stat: 'aim', context: 'combat', mod: 1 }],
  },
];
