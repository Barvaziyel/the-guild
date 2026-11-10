/**
 * The Workshop: making gear from scrap and tech, and improving what the guild has.
 */
import { addGuildLog } from '../chronicle.ts';
import { RECIPES, UPGRADES, getGear, type Recipe, type Upgrade } from '../content/index.ts';
import { createItem, itemName } from '../gear.ts';
import type { GameState, ItemInstance, Quality } from '../types.ts';
import { SLOTS } from '../types.ts';
import { atDepot, buildingLevel, canAfford, costText, payCost } from './buildings.ts';

export function findRecipe(gearId: string): Recipe | undefined {
  return RECIPES.find((r) => r.gear === gearId);
}

/** Quality of things made at this Workshop level. */
export function craftQuality(state: GameState): Quality {
  return buildingLevel(state, 'workshop') >= 3 ? 'solid' : 'common';
}

export function craftProblem(state: GameState, gearId: string): string | undefined {
  const recipe = findRecipe(gearId);
  if (!recipe) return `The Workshop can't make a ${getGear(gearId).name}.`;
  const level = buildingLevel(state, 'workshop');
  if (level === 0) return 'Build the Workshop first.';
  if (level < recipe.level) return `Needs a level ${recipe.level} Workshop.`;
  if (!canAfford(state, recipe.cost)) return `Needs ${costText(recipe.cost)}.`;
  return undefined;
}

/** Make a piece of gear. It goes into the stash. Throws if it can't be made. */
export function craft(state: GameState, gearId: string, day: number): ItemInstance {
  const problem = craftProblem(state, gearId);
  if (problem) throw new Error(problem);
  payCost(state, findRecipe(gearId)!.cost);
  const item = createItem(state, gearId, craftQuality(state));
  state.stash.push(item);
  addGuildLog(state, day, `Made a ${itemName(item)} in the Workshop.`, ['workshop', item.uid]);
  return item;
}

/** The next step up for an item. Quality only matters for weapons and armor, so only they can be improved. */
export function upgradeFor(item: ItemInstance): Upgrade | undefined {
  const def = getGear(item.defId);
  if (def.slot !== 'weapon' && def.slot !== 'armor') return undefined;
  return UPGRADES.find((u) => u.from === item.quality);
}

/** Items the Workshop can reach: the stash and whatever people at the Depot carry. */
export function workshopItems(state: GameState): ItemInstance[] {
  const carried = state.survivors.filter(atDepot).flatMap((s) => SLOTS.map((slot) => s.equipment[slot]).filter((i): i is ItemInstance => i !== undefined));
  return [...state.stash, ...carried];
}

export function upgradeProblem(state: GameState, uid: string): string | undefined {
  const item = workshopItems(state).find((i) => i.uid === uid);
  if (!item) return 'That item isn’t at the Depot.';
  const up = upgradeFor(item);
  if (!up) return `The ${itemName(item)} can't be improved here.`;
  const level = buildingLevel(state, 'workshop');
  if (level === 0) return 'Build the Workshop first.';
  if (level < up.level) return `Needs a level ${up.level} Workshop.`;
  if (!canAfford(state, up.cost)) return `Needs ${costText(up.cost)}.`;
  return undefined;
}

/** Improve an item one step (Rusty to Common, Common to Solid, Solid to Prime). Throws if it can't be done. */
export function upgradeItem(state: GameState, uid: string, day: number): ItemInstance {
  const problem = upgradeProblem(state, uid);
  if (problem) throw new Error(problem);
  const item = workshopItems(state).find((i) => i.uid === uid)!;
  const up = upgradeFor(item)!;
  payCost(state, up.cost);
  const before = itemName(item);
  item.quality = up.to;
  addGuildLog(state, day, `Improved the ${before} in the Workshop: now ${itemName(item)}.`, ['workshop', item.uid]);
  return item;
}
