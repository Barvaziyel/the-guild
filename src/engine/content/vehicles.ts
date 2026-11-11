import type { Resources } from '../types.ts';

/**
 * Vehicles (§7.8). Rare: found on runs, sold by traders now and then, or built
 * in the Workshop. They seat more people, get there faster and carry more, but
 * they're loud, burn gas every run and wear down.
 */
export interface VehicleDef {
  id: string;
  name: string;
  description: string;
  seats: number;
  /** Extra loads it carries home, on top of what the crew carries. */
  cargo: number;
  /** Run time against walking: 0.5 gets there in half the time. */
  speed: number;
  /** Gas burned per leg of the trip (GAS_LEG_MINUTES of walking). */
  gas: number;
  /** Extra trouble its noise draws: added to the combat weight multiplier. */
  noise: number;
  /** Condition lost on an ordinary run, before any knocks. */
  wear: readonly [number, number];
  /** What a trader asks for one. */
  price: Partial<Resources>;
  /** The Workshop can build it at this level, for this much. */
  build?: { cost: Partial<Resources>; level: number };
  /** How often it turns up, among the wrecks a place has. */
  findWeight: number;
}

export const VEHICLES: readonly VehicleDef[] = [
  {
    id: 'motorcycle',
    name: 'Motorcycle',
    description: 'Two seats if nobody minds, a rack for a couple of sacks, and an engine you can hear two streets away.',
    seats: 2,
    cargo: 4,
    speed: 0.45,
    gas: 1,
    noise: 0.25,
    wear: [4, 9],
    price: { scrap: 45, tech: 6 },
    build: { cost: { scrap: 50, tech: 8 }, level: 2 },
    findWeight: 4,
  },
  {
    id: 'car',
    name: 'Hatchback',
    description: 'Five seats, a boot that takes more than it should, and a rattle nobody can find.',
    seats: 5,
    cargo: 10,
    speed: 0.55,
    gas: 2,
    noise: 0.3,
    wear: [3, 8],
    price: { scrap: 70, tech: 10 },
    build: { cost: { scrap: 90, tech: 15 }, level: 3 },
    findWeight: 4,
  },
  {
    id: 'pickup',
    name: 'Pickup Truck',
    description: 'Three up front, two in the bed, and room behind them for half a scrapyard.',
    seats: 5,
    cargo: 20,
    speed: 0.6,
    gas: 3,
    noise: 0.35,
    wear: [3, 7],
    price: { scrap: 90, tech: 12 },
    findWeight: 3,
  },
  {
    id: 'van',
    name: 'Cargo Van',
    description: 'Eight if they squeeze, and a long box for whatever the Reach gives up. Thirsty, and loud with it.',
    seats: 8,
    cargo: 24,
    speed: 0.65,
    gas: 4,
    noise: 0.45,
    wear: [3, 7],
    price: { scrap: 110, tech: 15 },
    findWeight: 2,
  },
];
