/**
 * The first week (§9.10, 2.8.0) as the Yard tab shows it: the step under way,
 * its goal and reward, and how the last one went. Plain TypeScript so it can
 * be tested in Node.
 */
import { FIRST_WEEK, RESOURCE_IDS, buildingName, getLocation, getVehicleDef, locationState, storyProgress, storyStep, type GameState, type StoryGift, type StoryGoal } from '../engine/index.ts';
import { suppliesLine } from './dilemma-view.ts';
import type { Route } from './route.ts';

export interface StoryCard {
  /** "The first week · 3 of 8". */
  kicker: string;
  title: string;
  text: string;
  /** "Search three corners of the Depot: 2 of 3." */
  goal: string;
  /** "Reward: 2 meds." */
  reward: string;
  /** The goal is met: the reward is there to collect. */
  met: boolean;
  /** Where it's done, until it is: the Gear screen, a building, the planner; or further down this tab (the corners). */
  go?: { label: string; to: Route } | { label: string; scrollTo: string };
}

/** The step under way, or undefined once the week is done (or while the last step's ending waits to be read). */
export function storyCard(state: GameState): StoryCard | undefined {
  const step = storyStep(state);
  if (!step || storyEnding(state)) return undefined;
  const p = storyProgress(state);
  const count = p.need !== undefined && p.need > 1 ? `: ${p.have} of ${p.need}` : '';
  return {
    kicker: `The first week · ${state.story!.step + 1} of ${FIRST_WEEK.length}`,
    title: step.title,
    text: step.text,
    goal: p.met ? `Done: ${lowerFirst(step.goalText)}.` : `${step.goalText}${count}.`,
    reward: `Reward: ${giftsText(step.gives)}.`,
    met: p.met,
    ...(p.met ? {} : goTo(state, step.goal)),
  };
}

/** A button to where the goal is worked on. The corners are on the same tab, under the yard. */
function goTo(state: GameState, goal: StoryGoal): { go?: StoryCard['go'] } {
  switch (goal.kind) {
    case 'kitted':
      return { go: { label: 'Open the Gear screen', to: { screen: 'gear' } } };
    case 'building':
      return { go: { label: `Go to the ${buildingName(state, goal.building)}`, to: { screen: 'building', id: goal.building } } };
    case 'runs':
      if (goal.at && locationState(state, goal.at).discovered) return { go: { label: `Plan a run to ${getLocation(goal.at).name.replace(/^The /, 'the ')}`, to: { screen: 'plan', locationId: goal.at } } };
      return { go: { label: 'Open the Reach', to: { screen: 'reach' } } };
    case 'corners':
      return { go: { label: 'Show the corners', scrollTo: 'corners' } };
  }
}

export interface StoryEndingCard {
  title: string;
  text: string;
  /** "Ammo +6." */
  supplies?: string;
  /** "And a Motorcycle." */
  gifts?: string;
  /** The week is over: this was its last step. */
  last: boolean;
  /** After the broadcast: where Haven goes from here (§9.11). */
  haven?: string;
}

/** How the last step went, until read. */
export function storyEnding(state: GameState): StoryEndingCard | undefined {
  const e = state.story?.last;
  if (!e || e.seen) return undefined;
  const supplies = suppliesLine(e.supplies);
  return {
    title: e.title,
    text: e.text,
    ...(supplies ? { supplies } : {}),
    ...(e.gifts && e.gifts.length > 0 ? { gifts: `${supplies ? 'And ' : ''}${e.gifts.join(', ')}.`.replace(/^a /, 'A ') } : {}),
    last: state.story!.step >= FIRST_WEEK.length,
    ...(state.story!.step >= FIRST_WEEK.length && state.haven ? { haven: 'Whatever the guild finds out about Haven goes in the new Haven tab, with the first leads to follow.' } : {}),
  };
}

/** "6 ammo", "10 rations and 6 scrap", "a Motorcycle and 8 gas", "someone at the gate". */
export function giftsText(gifts: readonly StoryGift[]): string {
  const parts: string[] = [];
  for (const g of gifts) {
    if (g.kind === 'vehicle') parts.push(`a ${getVehicleDef(g.defId).name}`);
    if (g.kind === 'wanderer') parts.push('someone at the gate');
  }
  for (const g of gifts) {
    if (g.kind !== 'supplies') continue;
    for (const r of RESOURCE_IDS) if (g.change[r]) parts.push(`${g.change[r]} ${r}`);
  }
  return parts.length <= 1 ? (parts[0] ?? 'nothing') : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
