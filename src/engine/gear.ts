import { QUALITY_MOD, QUALITY_NAME } from './constants.ts';
import { getGear } from './content/index.ts';
import { newId } from './ids.ts';
import type { GameState, GearDef, GearHooks, ItemInstance, Quality, Slot, Survivor } from './types.ts';

export function createItem(state: GameState, defId: string, quality: Quality = 'common'): ItemInstance {
  getGear(defId); // validate
  return { uid: newId(state, 'i'), defId, quality };
}

export function itemDef(item: ItemInstance): GearDef {
  return getGear(item.defId);
}

/** "Solid Machete", "Rusty Pipe", or a custom name if the item earned one. */
export function itemName(item: ItemInstance): string {
  return item.name ?? baseItemName(item);
}

/** "Solid Machete": what the item is, even when it has a name of its own. */
export function baseItemName(item: ItemInstance): string {
  const prefix = QUALITY_NAME[item.quality];
  const base = itemDef(item).name;
  return prefix ? `${prefix} ${base}` : base;
}

/** Quality modifier: applies to weapon damage/to-hit and armor value. */
export function qualityMod(item: ItemInstance): number {
  return QUALITY_MOD[item.quality];
}

/** Weapon damage including quality (minimum 1). */
export function weaponDamage(item: ItemInstance): number {
  const def = itemDef(item);
  return Math.max(1, (def.damage ?? 0) + qualityMod(item));
}

/** Armor value including quality (minimum 0). */
export function armorValue(item: ItemInstance): number {
  const def = itemDef(item);
  if (def.armor === undefined) return 0;
  return Math.max(0, def.armor + qualityMod(item));
}

export function equippedItems(s: Survivor): ItemInstance[] {
  const out: ItemInstance[] = [];
  for (const item of Object.values(s.equipment)) if (item) out.push(item);
  return out;
}

/** A Cherished trinket works twice as well for the survivor who cherishes it. */
export function attachmentMult(item: ItemInstance, s: Survivor): number {
  return item.cherishedBy === s.id ? 2 : 1;
}

/** All gear hook objects for a survivor's equipped items. */
export function gearHooks(s: Survivor): GearHooks[] {
  const out: GearHooks[] = [];
  for (const item of equippedItems(s)) {
    const hooks = itemDef(item).hooks;
    if (hooks) out.push(hooks);
  }
  return out;
}

type NumericGearHook = {
  [K in keyof GearHooks]-?: NonNullable<GearHooks[K]> extends number ? K : never;
}[keyof GearHooks];

type FlagGearHook = {
  [K in keyof GearHooks]-?: NonNullable<GearHooks[K]> extends boolean ? K : never;
}[keyof GearHooks];

/** Sum a numeric gear hook across equipped items (Cherished items count double). */
export function sumGearHook(s: Survivor, key: NumericGearHook): number {
  let total = 0;
  for (const item of equippedItems(s)) total += (itemDef(item).hooks?.[key] ?? 0) * attachmentMult(item, s);
  return total;
}

/** Multiply a multiplier gear hook across equipped items (absent = 1). */
export function mulGearHook(s: Survivor, key: NumericGearHook): number {
  let total = 1;
  for (const item of equippedItems(s)) total *= itemDef(item).hooks?.[key] ?? 1;
  return total;
}

export function anyGearHook(s: Survivor, key: FlagGearHook): boolean {
  return equippedItems(s).some((item) => itemDef(item).hooks?.[key] === true);
}

/** The equipped item with a given flag hook, if any (e.g. a Medkit). */
export function findGearWithHook(s: Survivor, key: FlagGearHook): ItemInstance | undefined {
  return equippedItems(s).find((item) => itemDef(item).hooks?.[key] === true);
}

/**
 * Gear can only change at the Depot. A crew that is out was simulated with the
 * gear it left with, and comes home with exactly that (see completeRun), so
 * swapping items in the meantime would duplicate or lose them.
 */
export function canChangeGear(s: Survivor): boolean {
  return s.status === 'ready';
}

/**
 * Move an item from the guild stash onto a survivor. Anything already in that
 * slot goes back to the stash. Returns false if the item isn't in the stash or
 * the survivor isn't at the Depot.
 */
export function equipFromStash(state: GameState, s: Survivor, uid: string): boolean {
  if (!canChangeGear(s)) return false;
  const idx = state.stash.findIndex((i) => i.uid === uid);
  if (idx < 0) return false;
  const item = state.stash[idx]!;
  const slot = itemDef(item).slot;
  state.stash.splice(idx, 1);
  const previous = s.equipment[slot];
  if (previous) {
    resetAttachment(previous);
    state.stash.push(previous);
  }
  s.equipment[slot] = item;
  return true;
}

/** Move whatever is in a slot back to the stash. Does nothing unless the survivor is at the Depot. */
export function unequip(state: GameState, s: Survivor, slot: Slot): ItemInstance | undefined {
  if (!canChangeGear(s)) return undefined;
  const item = s.equipment[slot];
  if (!item) return undefined;
  delete s.equipment[slot];
  resetAttachment(item);
  state.stash.push(item);
  return item;
}

/** Trinket attachment only counts consecutive runs with the same holder. */
function resetAttachment(item: ItemInstance): void {
  if (item.runsWithHolder) item.runsWithHolder = 0;
}
