import type { Resources } from '../types.ts';

export type HazardKind = 'radiation' | 'collapse' | 'storm' | 'trap' | 'toxic';

export interface EncounterDef {
  /** Enemy ids this encounter is built from (bought against the threat budget). */
  enemies: string[];
  weight: number;
}

export interface LocationDef {
  id: string;
  name: string;
  biome: string;
  description: string;
  /** 1..5. Adds to check DCs and enemy numbers. */
  danger: number;
  /** 0..3. Radiation absorbed every beat. */
  radiation: number;
  /** Base run length in real minutes. */
  durationMin: number;
  encounters: EncounterDef[];
  /** Relative weights of what scavenging turns up. */
  loot: Resources;
  /** Chance that a successful scavenge also finds a piece of gear. */
  gearChance: number;
  /** Vehicles a crew might find here and get running (§7.8). */
  wrecks?: readonly string[];
  hazards: HazardKind[];
  /** Known from the start of the game. */
  startKnown?: boolean;
  /** Locations that scouting here can reveal. */
  leadsTo: string[];
  /** Things the crew sees on the way; used for travel beats. */
  sights: string[];
}

export const LOCATIONS: readonly LocationDef[] = [
  {
    id: 'rail_yard',
    name: 'The Rail Yard',
    biome: 'Rail Yard',
    description: 'Rows of rusted freight cars just past the Depot fence. Picked over, but never empty.',
    danger: 1,
    radiation: 0,
    durationMin: 10,
    encounters: [
      { enemies: ['rad_hound'], weight: 5 },
      { enemies: ['scrap_drone'], weight: 2 },
      { enemies: ['raider_scav'], weight: 2 },
    ],
    loot: { scrap: 8, rations: 1, meds: 0, ammo: 1, tech: 1, gas: 1 },
    gearChance: 0.05,
    wrecks: ['pickup'],
    hazards: ['collapse', 'storm'],
    startKnown: true,
    leadsTo: ['old_metro', 'water_plant'],
    sights: [
      'A freight car lies on its side, its cargo of office chairs spilled and sun-bleached.',
      'Someone has painted a row of tally marks on a signal box. Hundreds of them.',
      'Crows lift off the gantry as the crew passes underneath.',
    ],
  },
  {
    id: 'maple_street',
    name: 'Maple Street',
    biome: 'Ruined Suburb',
    description: 'A dead suburb of sagging houses and overgrown lawns. Kitchens still hold the odd tin.',
    danger: 1,
    radiation: 0,
    durationMin: 15,
    encounters: [
      { enemies: ['rad_hound'], weight: 5 },
      { enemies: ['raider_scav'], weight: 4 },
      { enemies: ['hollow'], weight: 1 },
    ],
    loot: { scrap: 4, rations: 5, meds: 1, ammo: 1, tech: 0, gas: 2 },
    gearChance: 0.06,
    wrecks: ['car', 'motorcycle'],
    hazards: ['collapse', 'storm', 'trap'],
    startKnown: true,
    leadsTo: ['drowned_mall', 'st_judes'],
    sights: [
      "A child's bicycle rusts in a driveway, a tree growing up through its frame.",
      'Every mailbox on the street has been pried open. Someone was looking for something.',
      'A swing set creaks in the wind. Nobody looks at it for long.',
    ],
  },
  {
    id: 'kessler_farm',
    name: 'Kessler Farm',
    biome: 'Farmstead',
    description: 'An abandoned farm gone wild. The orchard still fruits, and the hounds know it.',
    danger: 2,
    radiation: 0,
    durationMin: 25,
    encounters: [
      { enemies: ['rad_hound'], weight: 6 },
      { enemies: ['raider_scav', 'raider_gunner'], weight: 3 },
    ],
    loot: { scrap: 2, rations: 8, meds: 1, ammo: 0, tech: 0, gas: 1 },
    gearChance: 0.05,
    wrecks: ['pickup'],
    hazards: ['storm', 'trap'],
    startKnown: true,
    leadsTo: ['blackwater', 'radio_station'],
    sights: [
      'The scarecrow in the north field is wearing a gas mask.',
      'Apples rot in the long grass, wasps drunk on them.',
      'A tractor sits where it stopped forty years ago, a bird nesting in the seat.',
    ],
  },
  {
    id: 'old_metro',
    name: 'The Old Metro',
    biome: 'Tunnels',
    description: 'Flooded subway tunnels under the city. Dark, close, and full of things that hate light.',
    danger: 2,
    radiation: 0,
    durationMin: 30,
    encounters: [
      { enemies: ['hollow'], weight: 5 },
      { enemies: ['rad_hound'], weight: 3 },
      { enemies: ['raider_scav'], weight: 2 },
    ],
    loot: { scrap: 6, rations: 1, meds: 1, ammo: 2, tech: 2, gas: 0 },
    gearChance: 0.08,
    hazards: ['collapse', 'toxic', 'trap'],
    leadsTo: ['checkpoint_bravo'],
    sights: [
      'A train sits dead in the tunnel, every window fogged from the inside.',
      'Water drips somewhere ahead, steady as a clock.',
      'Old posters peel from the tiles: a film nobody alive has seen.',
    ],
  },
  {
    id: 'drowned_mall',
    name: 'The Drowned Mall',
    biome: 'Drowned Mall',
    description: 'A shopping mall with a lake where the food court was. The upper floors are still dry.',
    danger: 2,
    radiation: 1,
    durationMin: 35,
    encounters: [
      { enemies: ['hollow'], weight: 5 },
      { enemies: ['raider_scav', 'raider_gunner'], weight: 4 },
    ],
    loot: { scrap: 4, rations: 2, meds: 3, ammo: 1, tech: 1, gas: 2 },
    gearChance: 0.1,
    wrecks: ['car', 'van'],
    hazards: ['collapse', 'radiation', 'toxic'],
    leadsTo: ['red_hand_camp'],
    sights: [
      'Mannequins stand waist-deep in green water, still dressed for summer.',
      'The escalators are waterfalls now.',
      'Fish move under the surface of what used to be a shoe store.',
    ],
  },
  {
    id: 'radio_station',
    name: 'Hilltop Radio Station',
    biome: 'Radio Station',
    description: 'A transmitter on a windy ridge. Raiders use the mast as a lookout.',
    danger: 2,
    radiation: 0,
    durationMin: 60,
    encounters: [
      { enemies: ['raider_scav', 'raider_gunner'], weight: 6 },
      { enemies: ['rad_hound'], weight: 2 },
    ],
    loot: { scrap: 3, rations: 1, meds: 0, ammo: 2, tech: 6, gas: 1 },
    gearChance: 0.08,
    hazards: ['storm', 'trap'],
    leadsTo: ['red_hand_camp'],
    sights: [
      'The mast hums in the wind, a low note that gets into the teeth.',
      'From the ridge the whole Reach is visible, grey and green to the horizon.',
      'A booth still has its ON AIR sign, cracked but legible.',
    ],
  },
  {
    id: 'st_judes',
    name: "St. Jude's Hospital",
    biome: 'Hospital',
    description: 'Seven floors of wards and locked cabinets. The patients never left.',
    danger: 3,
    radiation: 1,
    durationMin: 45,
    encounters: [
      { enemies: ['hollow', 'glowing_hollow'], weight: 7 },
      { enemies: ['raider_scav', 'raider_gunner'], weight: 2 },
    ],
    loot: { scrap: 2, rations: 1, meds: 8, ammo: 0, tech: 2, gas: 1 },
    gearChance: 0.1,
    wrecks: ['van'],
    hazards: ['collapse', 'radiation', 'toxic'],
    leadsTo: ['the_glow'],
    sights: [
      'Wheelchairs are lined up in the lobby as if waiting for a bus.',
      'A whiteboard on the third floor still lists the day shift.',
      'Something has dragged the beds of an entire ward into one corner.',
    ],
  },
  {
    id: 'water_plant',
    name: 'The Water Plant',
    biome: 'Water Plant',
    description: 'A treatment plant whose machines never got the order to stop guarding it.',
    danger: 3,
    radiation: 1,
    durationMin: 50,
    encounters: [
      { enemies: ['scrap_drone', 'scrapbot_sentry'], weight: 7 },
      { enemies: ['hollow'], weight: 2 },
    ],
    loot: { scrap: 5, rations: 0, meds: 1, ammo: 1, tech: 6, gas: 2 },
    gearChance: 0.1,
    wrecks: ['pickup', 'van'],
    hazards: ['toxic', 'collapse', 'radiation'],
    leadsTo: ['checkpoint_bravo'],
    sights: [
      'The settling tanks are full of something that is no longer water.',
      'A recorded voice repeats a safety notice from a speaker nobody can find.',
      'Pipes as wide as a truck run off into the dark.',
    ],
  },
  {
    id: 'blackwater',
    name: 'Blackwater Swamp',
    biome: 'Irradiated Swamp',
    description: 'A drowned forest where the water glows faintly at night. Good hunting, for both sides.',
    danger: 3,
    radiation: 2,
    durationMin: 75,
    encounters: [
      { enemies: ['mire_stalker', 'rad_hound'], weight: 7 },
      { enemies: ['hollow', 'glowing_hollow'], weight: 3 },
    ],
    loot: { scrap: 1, rations: 8, meds: 2, ammo: 0, tech: 0, gas: 0 },
    gearChance: 0.05,
    hazards: ['radiation', 'toxic', 'storm'],
    leadsTo: ['the_glow'],
    sights: [
      'Dead trees stand in black water, hung with something like moss.',
      'A rowboat is tied to a branch three meters up, left by a flood.',
      'The frogs go quiet all at once.',
    ],
  },
  {
    id: 'checkpoint_bravo',
    name: 'Checkpoint Bravo',
    biome: 'Military Checkpoint',
    description: 'An army roadblock from the last days. The soldiers are gone. Their machines are not.',
    danger: 4,
    radiation: 1,
    durationMin: 60,
    encounters: [
      { enemies: ['scrapbot_sentry', 'scrap_drone'], weight: 6 },
      { enemies: ['raider_gunner', 'raider_brute', 'raider_enforcer'], weight: 4 },
    ],
    loot: { scrap: 3, rations: 1, meds: 2, ammo: 8, tech: 3, gas: 3 },
    gearChance: 0.15,
    wrecks: ['pickup', 'motorcycle'],
    hazards: ['trap', 'radiation', 'collapse'],
    leadsTo: [],
    sights: [
      'Sandbags have burst and grown grass. The machine gun behind them is still pointed down the road.',
      'A line of cars waits at the barrier, doors open, forty years late.',
      'Spent brass covers the tarmac like gravel.',
    ],
  },
  {
    id: 'red_hand_camp',
    name: 'Red Hand Camp',
    biome: 'Raider Camp',
    description: 'The Red Hand gang lives here, in a stadium ringed with stakes. Rich, and very well defended.',
    danger: 4,
    radiation: 0,
    durationMin: 100,
    encounters: [
      { enemies: ['raider_gunner', 'raider_brute', 'raider_scav'], weight: 6 },
      { enemies: ['raider_enforcer', 'raider_gunner', 'raider_scav'], weight: 4 },
      { enemies: ['rad_hound'], weight: 1 },
    ],
    loot: { scrap: 4, rations: 5, meds: 2, ammo: 5, tech: 1, gas: 3 },
    gearChance: 0.15,
    wrecks: ['motorcycle', 'pickup'],
    hazards: ['trap', 'storm'],
    leadsTo: [],
    sights: [
      'Red handprints mark every wall for a kilometer around the camp.',
      'Smoke rises from inside the stadium, and with it the smell of cooking meat.',
      'A warning has been nailed to a post. It used to be a person.',
    ],
  },
  {
    id: 'the_glow',
    name: 'The Glow',
    biome: 'Crater',
    description: 'Where one of the bombs fell. The ground is glass, the air tastes of metal, and nothing there is poor.',
    danger: 5,
    radiation: 3,
    durationMin: 150,
    encounters: [
      { enemies: ['glowing_hollow', 'hollow'], weight: 5 },
      { enemies: ['hollow_hulk', 'glowing_hollow'], weight: 3 },
      { enemies: ['mire_stalker'], weight: 2 },
      { enemies: ['scrapbot_sentry'], weight: 1 },
    ],
    loot: { scrap: 2, rations: 0, meds: 2, ammo: 2, tech: 8, gas: 0 },
    gearChance: 0.25,
    hazards: ['radiation', 'radiation', 'storm', 'collapse'],
    leadsTo: [],
    sights: [
      'The crater rim is fused to green glass that crunches underfoot.',
      'At night the whole basin gives off a light with no source.',
      'Shadows are burned into a wall: people, a dog, a bicycle.',
    ],
  },
];
