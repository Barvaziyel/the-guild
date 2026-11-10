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
  if (item.name) return item.name;
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

/** All gear hook objects for a survivor's equipped items. */
export function gearHooks(s: Survivor): GearHooks[] {
  const out: GearHooks[] = [];
  for (const item of equippedItems(s)) {
    const hooks = itemDef(item).hooks;
    if (hooks) out.push(hooks);
  }
  return out;
}

/**
 * Move an item from the guild stash onto a survivor. Anything already in that
 * slot goes back to the stash. Returns false if the item isn't in the stash.
 */
export function equipFromStash(state: GameState, s: Survivor, uid: string): boolean {
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

/** Move whatever is in a slot back to the stash. */
export function unequip(state: GameState, s: Survivor, slot: Slot): ItemInstance | undefined {
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
