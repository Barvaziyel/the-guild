/**
 * What a new guild starts without (§9.10, 3.14.0): leading fights, decisions, the market, vehicles, calls
 * for help, raids, outposts and projects, each opened when the first week reaches it (`opens` on its steps
 * in content/story.ts). A guild from before 3.14.0 has everything open. Also the new guild's first trip:
 * short, with the first fight the player leads.
 */
import { LOCATIONS, getLocation } from './content/index.ts';
import { ensureLocationState } from './locations.ts';
import type { GameState, RunPlan, SystemId } from './types.ts';

/** Whether a system is open: always, for a guild from before the story opened them. */
export function isOpen(state: GameState, id: SystemId): boolean {
  if (!state.opened) return true;
  // A vehicle found or given some other way opens them too: the guild has one to use.
  if (id === 'vehicles' && state.vehicles.length > 0) return true;
  return state.opened[id] !== undefined;
}

/** Open a system on this game day. False if it was open already (or always is, in an older guild). */
export function openSystem(state: GameState, id: SystemId, day: number): boolean {
  if (!state.opened || state.opened[id] !== undefined) return false;
  state.opened[id] = day;
  // The market is a place: the guild hears where it is.
  if (id === 'market') for (const loc of LOCATIONS) if (loc.market) ensureLocationState(state, loc.id).discovered = true;
  return true;
}

/** A new guild starts with these closed, the market off the map, and its opening still to watch. */
export function closeForStory(state: GameState): void {
  state.opened = {};
  state.intro = true;
  for (const loc of LOCATIONS) if (loc.market) ensureLocationState(state, loc.id).discovered = false;
}

/**
 * The next system whose first-time moment is still to show (3.14.0): opened in a new guild, in the order
 * they opened. A vehicle that came some other way counts as opening vehicles then.
 */
export function nextOpening(state: GameState): SystemId | undefined {
  if (!state.opened) return undefined;
  const seen = new Set(state.openedSeen ?? []);
  const open = (Object.entries(state.opened) as [SystemId, number][]).sort((a, b) => a[1] - b[1]).map(([id]) => id);
  if (!open.includes('vehicles') && state.vehicles.length > 0) open.push('vehicles');
  return open.find((id) => !seen.has(id));
}

/** The player has seen a system's first-time moment. */
export function seenOpening(state: GameState, id: SystemId): void {
  if (!state.opened) return;
  const seen = (state.openedSeen ??= []);
  if (!seen.includes(id)) seen.push(id);
}

/** The opening scene has been watched, or skipped. */
export function seenIntro(state: GameState): void {
  delete state.intro;
}

/**
 * Whether this plan would be the new guild's first trip: nobody has led a fight yet and no crew has gone
 * out, the crew scavenging somewhere quiet (danger 1).
 */
export function isFirstTrip(state: GameState, plan: RunPlan): boolean {
  if (!state.opened || state.opened.lead !== undefined) return false;
  if (plan.job !== 'scavenge' || getLocation(plan.locationId).danger !== 1 || (plan.depth ?? 1) > 1) return false;
  return state.runs.length === 0 && Object.values(state.locations).every((l) => l.runs === 0);
}

/**
 * The plan as the guild can run it now: a first trip marked as one (and led), a plan that would lead fights
 * before that's open not led.
 */
export function planAsOpened(state: GameState, plan: RunPlan): RunPlan {
  const { first: _first, ...rest } = plan;
  if (isFirstTrip(state, rest)) return { ...rest, first: true, lead: 'matters' };
  if (!isOpen(state, 'lead')) {
    const { lead: _lead, ...unled } = rest;
    return unled;
  }
  return rest;
}
