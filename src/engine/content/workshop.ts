import type { Quality, Resources } from '../types.ts';

export interface Recipe {
  /** Gear id that comes out. */
  gear: string;
  cost: Partial<Resources>;
  /** Workshop level needed. */
  level: number;
}

/** What the Workshop can make. Trinkets can't be made; they're found. */
export const RECIPES: readonly Recipe[] = [
  { gear: 'pipe', cost: { scrap: 4 }, level: 1 },
  { gear: 'machete', cost: { scrap: 8 }, level: 1 },
  { gear: 'sledge', cost: { scrap: 12 }, level: 1 },
  { gear: 'crossbow', cost: { scrap: 14, tech: 2 }, level: 1 },
  { gear: 'pipe_pistol', cost: { scrap: 10, tech: 2 }, level: 1 },
  { gear: 'leather_jacket', cost: { scrap: 8 }, level: 1 },
  { gear: 'scrap_vest', cost: { scrap: 14 }, level: 1 },
  { gear: 'crowbar', cost: { scrap: 5 }, level: 1 },
  { gear: 'lockpicks', cost: { scrap: 6, tech: 2 }, level: 1 },
  { gear: 'medkit', cost: { scrap: 4, meds: 3 }, level: 1 },
  { gear: 'shock_baton', cost: { scrap: 10, tech: 4 }, level: 2 },
  { gear: 'hunting_rifle', cost: { scrap: 16, tech: 4 }, level: 2 },
  { gear: 'scattergun', cost: { scrap: 18, tech: 5 }, level: 2 },
  { gear: 'riot_gear', cost: { scrap: 22, tech: 6 }, level: 2 },
  { gear: 'hazmat_suit', cost: { scrap: 16, tech: 8 }, level: 2 },
  { gear: 'binoculars', cost: { scrap: 8, tech: 4 }, level: 2 },
  { gear: 'multitool', cost: { scrap: 8, tech: 4 }, level: 2 },
  { gear: 'geiger_counter', cost: { scrap: 8, tech: 6 }, level: 2 },
];

export interface Upgrade {
  from: Quality;
  to: Quality;
  cost: Partial<Resources>;
  level: number;
}

/** Improving an item one step. Relics can't be made, only found. */
export const UPGRADES: readonly Upgrade[] = [
  { from: 'rusty', to: 'common', cost: { scrap: 4 }, level: 1 },
  { from: 'common', to: 'solid', cost: { scrap: 10, tech: 2 }, level: 1 },
  { from: 'solid', to: 'prime', cost: { scrap: 20, tech: 6 }, level: 2 },
];
