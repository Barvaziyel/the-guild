import type { BuildingId, Resources, StatId } from '../types.ts';

export interface BuildingLevel {
  /** Name at this level, if it changes (the Firepit becomes a Bar). */
  name?: string;
  /** What the building does at this level, for the player. */
  effect: string;
  /** Cost to reach this level from the one below. */
  cost: Partial<Resources>;
}

export interface BuildingDef {
  id: BuildingId;
  name: string;
  description: string;
  /** Levels 1..3. Index 0 is level 1. */
  levels: readonly BuildingLevel[];
  /** The stat workers use and practice. 'any' lets each worker pick (Training Yard). Absent: no workers. */
  workStat?: StatId | 'any';
  /** Level at the start of a new game (0 or absent: not built). */
  startLevel?: number;
}

/**
 * The Depot's buildings. Numbers in the effect text must match constants.ts;
 * the depot tests check the important ones.
 */
export const BUILDINGS: readonly BuildingDef[] = [
  {
    id: 'bunks',
    name: 'Bunks',
    description: 'Cots in the old ticket hall. Every survivor needs one.',
    startLevel: 1,
    levels: [
      { effect: 'Beds for 4.', cost: {} },
      { effect: 'Beds for 8.', cost: { scrap: 30, rations: 15 } },
      { effect: 'Beds for 12.', cost: { scrap: 60, tech: 6, rations: 30 } },
    ],
  },
  {
    id: 'garden',
    name: 'Garden',
    description: 'Raised beds on the platform roof, watered from the tank.',
    workStat: 'wits',
    startLevel: 1,
    levels: [
      { effect: 'Grows a few rations a day, more with gardeners. Two can work here.', cost: {} },
      { effect: 'Grows twice as much. Three can work here.', cost: { scrap: 25, rations: 10 } },
      { effect: 'Grows three times as much. Three can work here.', cost: { scrap: 50, tech: 6, rations: 20 } },
    ],
  },
  {
    id: 'firepit',
    name: 'Firepit',
    description: 'Somewhere warm to sit at night and talk about anything but the Reach.',
    workStat: 'nerve',
    startLevel: 1,
    levels: [
      { name: 'Firepit', effect: 'Everyone at the Depot sheds 3 more stress a day. Whoever keeps it lit helps more.', cost: {} },
      { name: 'Bar', effect: 'Sheds 5 more stress a day, and people warm to each other over a drink. Keeping it stocked takes a ration a day.', cost: { scrap: 30, tech: 3, rations: 20 } },
      { name: 'Bar and Stage', effect: 'Sheds 8 more stress a day, and people warm to each other faster. Takes two rations a day.', cost: { scrap: 60, tech: 8, rations: 40 } },
    ],
  },
  {
    id: 'infirmary',
    name: 'Infirmary',
    description: 'Clean sheets, a locked cabinet and someone who knows what to do.',
    workStat: 'wits',
    levels: [
      { effect: 'Faster healing. Medics cure rad sickness and fever with meds, one patient a day each.', cost: { scrap: 25, tech: 2, meds: 5 } },
      { effect: 'Faster still. Wounds close sooner. Uses some meds every day.', cost: { scrap: 45, tech: 8, meds: 10 } },
      { effect: 'The best care in the Reach. Uses more meds.', cost: { scrap: 70, tech: 15, meds: 20 } },
    ],
  },
  {
    id: 'workshop',
    name: 'Workshop',
    description: 'A bench, a vice and a wall of salvaged tools.',
    workStat: 'wits',
    levels: [
      { effect: 'Craft basic gear and fix up worn kit. Workers turn scrap into ammo.', cost: { scrap: 30 } },
      { effect: 'Craft guns, armor and instruments, and improve gear to Prime. Uses some tech every day.', cost: { scrap: 50, tech: 8 } },
      { effect: 'Everything made here comes out Solid. Uses more tech.', cost: { scrap: 80, tech: 18 } },
    ],
  },
  {
    id: 'radio_tower',
    name: 'Radio Tower',
    description: 'A mast on the water tower and a radio that mostly works.',
    workStat: 'wits',
    levels: [
      { effect: 'One more recruit at the gate each day, with their stats known. Sometimes picks up a place nobody has found. Keeps in touch with one outpost.', cost: { scrap: 30, tech: 5 } },
      { effect: 'Two more recruits, and better ones. Hears more. Keeps in touch with two outposts. Uses some tech every day.', cost: { scrap: 50, tech: 14 } },
      { effect: 'Three more recruits, the best around. Hears the most. Keeps in touch with three outposts. Uses more tech.', cost: { scrap: 80, tech: 22 } },
    ],
  },
  {
    id: 'watchtower',
    name: 'Watchtower',
    description: 'A lookout on the signal gantry with a view of every road in.',
    workStat: 'aim',
    levels: [
      { effect: 'Raiders are spotted coming, which helps hold them off and halves what they take.', cost: { scrap: 25 } },
      { effect: 'A stronger defense. Uses some ammo every day for practice.', cost: { scrap: 45, tech: 5, ammo: 15 } },
      { effect: 'Few raiders get past the fence. Uses more ammo.', cost: { scrap: 70, tech: 12, ammo: 30 } },
    ],
  },
  {
    id: 'training_yard',
    name: 'Training Yard',
    description: 'Targets, a heavy bag and a rope course in the freight yard.',
    workStat: 'any',
    levels: [
      { effect: 'People here practice a stat of their choice: 2 practice a day.', cost: { scrap: 20 } },
      { effect: '3 practice a day.', cost: { scrap: 40, tech: 5 } },
      { effect: '4 practice a day.', cost: { scrap: 60, tech: 12 } },
    ],
  },
];
