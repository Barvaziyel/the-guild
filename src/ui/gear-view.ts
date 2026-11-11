/**
 * The Gear screen: what's in the guild's stash, who could take each piece,
 * and what everyone is carrying. Plain TypeScript so it can be tested in Node.
 */
import { SLOTS, canChangeGear, itemDef, itemName, type GameState, type Slot, type Survivor } from '../engine/index.ts';
import { itemView, stashFor, type ItemView } from './view.ts';

export const SLOT_GROUPS: Record<Slot, string> = { weapon: 'Weapons', armor: 'Armor', tool: 'Tools', trinket: 'Trinkets' };

export interface StashGroup {
  slot: Slot;
  title: string;
  items: ItemView[];
}

/** The stash by slot, best first. Empty slots are left out. */
export function stashGroups(state: GameState): StashGroup[] {
  return SLOTS.map((slot) => ({ slot, title: SLOT_GROUPS[slot], items: stashFor(state, slot).map(itemView) })).filter((g) => g.items.length > 0);
}

/** "The stash is empty." / "Lockpicks in the stash." / "5 pieces of gear in the stash." */
export function stashLine(state: GameState): string {
  const n = state.stash.length;
  if (n === 0) return 'The stash is empty.';
  if (n <= 2) return `${state.stash.map(itemName).join(' and ')} in the stash.`;
  return `${n} pieces of gear in the stash.`;
}

export interface Taker {
  survivor: Survivor;
  /** What they carry in that slot now: "Carrying Rusty Crowbar", "No tool". */
  current: string;
  /** Why they can't take it now, if they can't. */
  problem?: string;
}

/** Everyone who could be handed a stash item: those at the Depot first, then those who are out. */
export function gearTakers(state: GameState, uid: string): Taker[] {
  const item = state.stash.find((i) => i.uid === uid);
  if (!item) return [];
  const slot = itemDef(item).slot;
  const takers = state.survivors.map((s): Taker => {
    const held = s.equipment[slot];
    const current = held ? `Carrying ${itemName(held)}` : `No ${slot}`;
    return canChangeGear(s) ? { survivor: s, current } : { survivor: s, current, problem: 'Out on a run' };
  });
  return takers.sort((a, b) => Number(a.problem !== undefined) - Number(b.problem !== undefined) || a.survivor.firstName.localeCompare(b.survivor.firstName));
}

export interface CarriedRow {
  survivor: Survivor;
  /** Item names in slot order: weapon, armor, tool, trinket. */
  items: string[];
  away: boolean;
}

/** What each survivor carries, for those carrying anything. */
export function carriedRows(state: GameState): CarriedRow[] {
  return state.survivors
    .map((s) => ({
      survivor: s,
      items: SLOTS.flatMap((slot) => {
        const it = s.equipment[slot];
        return it ? [itemName(it)] : [];
      }),
      away: !canChangeGear(s),
    }))
    .filter((r) => r.items.length > 0)
    .sort((a, b) => a.survivor.firstName.localeCompare(b.survivor.firstName));
}
