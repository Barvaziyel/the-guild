import type { Stats } from '../types.ts';

export interface OriginDef {
  id: string;
  name: string;
  description: string;
  /** Relative weights for distributing generation points across stats. */
  statWeights: Stats;
  /** Traits this origin may grant, each rolled independently. */
  traitChances: { trait: string; chance: number }[];
  ageRange: [number, number];
  /** Starting weapon is picked from these gear ids. */
  startingWeapons: string[];
  /** Optional extra starting item, picked from these gear ids (one roll). */
  startingExtras?: { gear: string[]; chance: number };
  /**
   * One-line backstories. Placeholders: {first} {they} {them} {their} {They} {Their}
   * {is} ("is"/"are") {was} ("was"/"were") {has} ("has"/"have").
   */
  backstories: string[];
  /** Relative weight when rolling a random origin. */
  weight: number;
}

export const ORIGINS: readonly OriginDef[] = [
  {
    id: 'bunker_born',
    name: 'Bunker-Born',
    description: 'Grew up underground in a sealed shelter. Book-smart, sun-blind.',
    statWeights: { grit: 1, brawn: 1, aim: 1, wits: 3, nerve: 1 },
    traitChances: [{ trait: 'curious', chance: 0.3 }],
    ageRange: [18, 35],
    startingWeapons: ['pipe', 'pipe_pistol'],
    startingExtras: { gear: ['multitool', 'old_photo'], chance: 0.5 },
    backstories: [
      '{first} walked out of the shelter doors at sixteen and never went back.',
      '{They} still {has} the shelter keycard, though the door it opened is long buried.',
      '{first} read every book in the bunker twice before the air filters failed.',
    ],
    weight: 3,
  },
  {
    id: 'caravan_kid',
    name: 'Caravan Kid',
    description: 'Raised on the trade roads. Knows how to talk, and how to run.',
    statWeights: { grit: 1, brawn: 1, aim: 2, wits: 2, nerve: 3 },
    traitChances: [{ trait: 'optimist', chance: 0.25 }],
    ageRange: [18, 40],
    startingWeapons: ['pipe_pistol', 'machete'],
    startingExtras: { gear: ['lucky_coin', 'binoculars'], chance: 0.4 },
    backstories: [
      "{first}'s caravan was scattered by raiders. {They} {is} still looking for {their} sister.",
      '{They} can haggle a Scrapbot out of its own bolts.',
      '{first} grew up sleeping under wagons and waking to gunfire.',
    ],
    weight: 3,
  },
  {
    id: 'city_rat',
    name: 'City Rat',
    description: 'Survived alone in the ruins since childhood.',
    statWeights: { grit: 2, brawn: 1, aim: 2, wits: 2, nerve: 1 },
    traitChances: [
      { trait: 'loner', chance: 0.3 },
      { trait: 'cautious', chance: 0.2 },
    ],
    ageRange: [18, 32],
    startingWeapons: ['pipe', 'crossbow'],
    startingExtras: { gear: ['crowbar'], chance: 0.4 },
    backstories: [
      '{first} knows every collapsed subway tunnel under the old city.',
      "{They} learned early that the quiet ones live longest.",
      '{first} survived three winters alone in a gutted department store.',
    ],
    weight: 3,
  },
  {
    id: 'farmhand',
    name: 'Farmhand',
    description: 'Worked the dirt at a settlement until the raiders came.',
    statWeights: { grit: 3, brawn: 3, aim: 1, wits: 1, nerve: 1 },
    traitChances: [
      { trait: 'calm', chance: 0.2 },
      { trait: 'glutton', chance: 0.15 },
    ],
    ageRange: [18, 55],
    startingWeapons: ['pipe', 'machete', 'sledge'],
    startingExtras: { gear: ['leather_jacket'], chance: 0.4 },
    backstories: [
      "{first}'s farm burned in the night. {They} carried two neighbors out before it fell.",
      '{They} can coax beans out of irradiated soil, mostly.',
      '{first} still wakes before dawn to tend crops that are long gone.',
    ],
    weight: 3,
  },
  {
    id: 'ex_raider',
    name: 'Ex-Raider',
    description: 'Used to be on the other side of the gun.',
    statWeights: { grit: 2, brawn: 3, aim: 2, wits: 1, nerve: 2 },
    traitChances: [
      { trait: 'hothead', chance: 0.3 },
      { trait: 'greedy', chance: 0.25 },
    ],
    ageRange: [20, 45],
    startingWeapons: ['machete', 'pipe_pistol', 'scattergun'],
    startingExtras: { gear: ['scrap_vest'], chance: 0.4 },
    backstories: [
      "{first} left the Red Hand after one raid too many. {They} won't say which.",
      "{They} {has} a raider brand on {their} wrist and a reason to hide it.",
      '{first} walked away from a gang with nothing but a gun and a conscience.',
    ],
    weight: 2,
  },
  {
    id: 'old_medic',
    name: 'Old Medic',
    description: "Patched people up long before the last hospital fell.",
    statWeights: { grit: 1, brawn: 1, aim: 1, wits: 3, nerve: 2 },
    traitChances: [{ trait: 'patcher', chance: 0.8 }],
    ageRange: [35, 62],
    startingWeapons: ['pipe', 'pipe_pistol'],
    startingExtras: { gear: ['medkit'], chance: 0.6 },
    backstories: [
      '{first} has set more bones than {they} can count, a few of them {their} own.',
      '{They} ran a clinic out of a gas station until the medicine ran dry.',
      "{first} doesn't talk about the plague years.",
    ],
    weight: 2,
  },
  {
    id: 'scrapper',
    name: 'Scrapper',
    description: 'Spent years stripping wrecks for parts.',
    statWeights: { grit: 2, brawn: 2, aim: 1, wits: 2, nerve: 1 },
    traitChances: [{ trait: 'tinkerer', chance: 0.7 }],
    ageRange: [18, 50],
    startingWeapons: ['pipe', 'shock_baton'],
    startingExtras: { gear: ['crowbar', 'multitool'], chance: 0.5 },
    backstories: [
      '{first} once rebuilt a generator from three dead cars and a toaster.',
      "{They} can hear what's wrong with an engine from across the yard.",
      "{first}'s hands are more scar than skin.",
    ],
    weight: 3,
  },
  {
    id: 'tracker',
    name: 'Tracker',
    description: 'Lived off the land, hunting ferals for food.',
    statWeights: { grit: 2, brawn: 1, aim: 3, wits: 2, nerve: 1 },
    traitChances: [
      { trait: 'animal_lover', chance: 0.2 },
      { trait: 'cautious', chance: 0.2 },
    ],
    ageRange: [18, 50],
    startingWeapons: ['hunting_rifle', 'crossbow'],
    startingExtras: { gear: ['binoculars'], chance: 0.4 },
    backstories: [
      '{first} can tell a rad-hound track from a coyote at fifty paces.',
      '{They} {was} raised by a trapper who taught {them} to wait, and wait, and wait.',
      '{first} has eaten things {they} would rather not name.',
    ],
    weight: 3,
  },
];
