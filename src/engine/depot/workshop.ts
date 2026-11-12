/**
 * The Workshop: making gear from scrap and tech, and improving what the guild has.
 */
import { addGuildLog } from '../chronicle.ts';
import { SALVAGE_SHARE, SALVAGE_TRINKET_SCRAP } from '../constants.ts';
import { RECIPES, UPGRADES, getGear, type Recipe, type Upgrade } from '../content/index.ts';
import { createItem, itemName } from '../gear.ts';
import type { GameState, ItemInstance, Quality, Resources } from '../types.ts';
import { RESOURCE_IDS, SLOTS } from '../types.ts';
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

// ---------------------------------------------------------------- salvage (1.8.0)

/** What taking an item apart gives back: a share of its recipe by quality, or a little scrap for a trinket. */
export function salvageValue(item: ItemInstance): Partial<Resources> {
  const recipe = findRecipe(item.defId);
  if (!recipe) return { scrap: SALVAGE_TRINKET_SCRAP };
  const share = SALVAGE_SHARE[item.quality];
  const scrap = Math.max(1, Math.round((recipe.cost.scrap ?? 0) * share));
  const tech = Math.floor((recipe.cost.tech ?? 0) * share);
  return tech > 0 ? { scrap, tech } : { scrap };
}

/** Why an item can't be taken apart, or undefined if it can. Only gear in the stash, and only at a Workshop. */
export function salvageProblem(state: GameState, uid: string): string | undefined {
  if (buildingLevel(state, 'workshop') === 0) return 'Build the Workshop first.';
  const item = state.stash.find((i) => i.uid === uid);
  if (!item) return 'Only gear in the stash can be taken apart.';
  const def = getGear(item.defId);
  if (item.quality === 'relic') return 'A relic is worth more whole.';
  if (item.name) return `Nobody will take apart ${item.name}.`;
  if (def.consumable) return `A ${def.name} is worth more used.`;
  if (item.cherishedBy) {
    const s = state.survivors.find((x) => x.id === item.cherishedBy);
    if (s) return `${s.firstName} would never forgive it.`;
  }
  return undefined;
}

/** Take an item in the stash apart for scrap (and tech). Throws if it can't be done. */
export function salvage(state: GameState, uid: string, day: number): Partial<Resources> {
  const problem = salvageProblem(state, uid);
  if (problem) throw new Error(problem);
  const item = state.stash.find((i) => i.uid === uid)!;
  const got = salvageValue(item);
  state.stash = state.stash.filter((i) => i.uid !== uid);
  for (const r of RESOURCE_IDS) state.resources[r] += got[r] ?? 0;
  addGuildLog(state, day, `Took apart a ${itemName(item)} in the Workshop: ${costText(got)}.`, ['workshop']);
  return got;
}

/** Spare gear: Rusty and Common weapons and armor in the stash that can be taken apart. */
export function spareGear(state: GameState): ItemInstance[] {
  return state.stash.filter((i) => {
    const slot = getGear(i.defId).slot;
    return (slot === 'weapon' || slot === 'armor') && (i.quality === 'rusty' || i.quality === 'common') && !salvageProblem(state, i.uid);
  });
}

/** What taking all the spare gear apart would give. */
export function spareValue(state: GameState): Partial<Resources> {
  const total: Partial<Resources> = {};
  for (const i of spareGear(state)) for (const [r, n] of Object.entries(salvageValue(i))) total[r as keyof Resources] = (total[r as keyof Resources] ?? 0) + (n ?? 0);
  return total;
}

/** Take all the spare gear apart at once. Returns how many pieces, and what they gave. */
export function salvageSpares(state: GameState, day: number): { count: number; got: Partial<Resources> } {
  const items = spareGear(state);
  if (items.length === 0) return { count: 0, got: {} };
  const got = spareValue(state);
  const gone = new Set(items.map((i) => i.uid));
  state.stash = state.stash.filter((i) => !gone.has(i.uid));
  for (const r of RESOURCE_IDS) state.resources[r] += got[r] ?? 0;
  addGuildLog(state, day, `Took apart ${items.length === 1 ? 'a piece' : `${items.length} pieces`} of spare gear in the Workshop: ${costText(got)}.`, ['workshop']);
  return { count: items.length, got };
}
