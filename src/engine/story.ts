/**
 * The first week (§9.10, 2.8.0): a new guild's short chain of things to do,
 * one at a time. Each step's goal is read from the game as it is; once it's
 * met, the player collects the reward and the next step begins. The steps are
 * data in content/story.ts.
 */
import { addGuildLog } from './chronicle.ts';
import { FIRST_WEEK, type StoryGift, type StoryGoal, type StoryStep } from './content/story.ts';
import { addWanderer } from './depot/recruits.ts';
import { startHaven } from './haven.ts';
import { dayAt, withRng } from './game.ts';
import type { Rng } from './rng.ts';
import { getGear, getVehicleDef } from './content/index.ts';
import { fullName } from './text.ts';
import { createVehicle } from './vehicles.ts';
import { openSystem } from './unlocks.ts';
import type { GameState, Resources, StoryBase, StoryEnding } from './types.ts';
import { RESOURCE_IDS } from './types.ts';

/** The first week from the start: its first step, counting from how things stand. */
export function newStory(state: GameState): GameState['story'] {
  return { step: 0, base: storyBase(state) };
}

/** What a step counts from: runs home, in all and at each place. */
export function storyBase(state: GameState): StoryBase {
  const at: Record<string, number> = {};
  let runs = 0;
  for (const [id, l] of Object.entries(state.locations)) {
    if (l.runs > 0) at[id] = l.runs;
    runs += l.runs;
  }
  return { runs, at };
}

/** The step under way, or undefined once the week is done (or this guild never had one). */
export function storyStep(state: GameState): StoryStep | undefined {
  const story = state.story;
  return story ? FIRST_WEEK[story.step] : undefined;
}

/** How far along the step is: met or not, and a count where there is one ("2 of 3"). */
export function storyProgress(state: GameState): { met: boolean; have?: number; need?: number } {
  const step = storyStep(state);
  if (!step) return { met: false };
  return goalProgress(state, step.goal);
}

function goalProgress(state: GameState, goal: StoryGoal): { met: boolean; have?: number; need?: number } {
  switch (goal.kind) {
    case 'kitted': {
      // Nothing in the stash would fill an empty slot on anyone in the guild (at an outpost, they're out of reach).
      const people = state.survivors.filter((s) => s.outpost === undefined);
      const fits = state.stash.some((i) => {
        const slot = getGear(i.defId).slot;
        return slot !== 'trinket' && people.some((s) => !s.equipment[slot]);
      });
      return { met: !fits };
    }
    case 'building': {
      const have = state.buildings[goal.building] ?? 0;
      return { met: have >= goal.level };
    }
    case 'runs': {
      const base = state.story!.base;
      const now = goal.at ? (state.locations[goal.at]?.runs ?? 0) : Object.values(state.locations).reduce((n, l) => n + l.runs, 0);
      const was = goal.at ? (base.at[goal.at] ?? 0) : base.runs;
      const have = Math.min(goal.count, now - was);
      return { met: have >= goal.count, have, need: goal.count };
    }
    case 'corners': {
      const have = Math.min(goal.count, state.corners.searched.length);
      return { met: have >= goal.count, have, need: goal.count };
    }
  }
}

/** Why the reward can't be collected yet, or undefined if it can. */
export function storyProblem(state: GameState): string | undefined {
  const step = storyStep(state);
  if (!step) return 'The guild has found its feet.';
  if (!storyProgress(state).met) return `Not yet: ${step.goalText.charAt(0).toLowerCase()}${step.goalText.slice(1)}.`;
  return undefined;
}

/** Collect a met step's reward, and start the next. Throws if it isn't met. */
export function claimStory(state: GameState, now: number): StoryEnding {
  const problem = storyProblem(state);
  if (problem) throw new Error(problem);
  const story = state.story!;
  const step = FIRST_WEEK[story.step]!;
  const day = dayAt(state, now);
  const before: Resources = { ...state.resources };
  const gifts: string[] = [];
  withRng(state, (rng) => {
    for (const g of step.gives) give(state, g, day, gifts, rng);
  });
  const supplies: Partial<Resources> = {};
  for (const r of RESOURCE_IDS) if (state.resources[r] !== before[r]) supplies[r] = state.resources[r] - before[r];
  // What it opens in a new guild (3.14.0).
  const opened = (step.opens ?? []).filter((id) => openSystem(state, id, day));
  const ending: StoryEnding = {
    stepId: step.id,
    title: step.title,
    text: step.done,
    ...(Object.keys(supplies).length > 0 ? { supplies } : {}),
    ...(gifts.length > 0 ? { gifts } : {}),
    ...(opened.length > 0 ? { opened } : {}),
  };
  addGuildLog(state, day, `${step.title}: ${step.done}`, ['story', step.id]);
  story.step += 1;
  // A step already done in an older order is passed over (3.14.0).
  while (story.step < FIRST_WEEK.length && story.skip?.includes(FIRST_WEEK[story.step]!.id)) story.step += 1;
  story.base = storyBase(state);
  story.last = ending;
  if (story.step >= FIRST_WEEK.length) {
    // However long it took (3.7.3; Aviel finished on day 14 to "The first week is behind them.").
    addGuildLog(state, day, 'The guild has found its feet.', ['story']);
    // The week ends with the broadcast: from here on, Haven (§9.11).
    startHaven(state, day);
  }
  return ending;
}

/** The player has read how the last step went. */
export function seenStory(state: GameState): void {
  if (state.story?.last) state.story.last.seen = true;
}

function give(state: GameState, gift: StoryGift, day: number, gifts: string[], rng: Rng): void {
  switch (gift.kind) {
    case 'supplies':
      for (const r of RESOURCE_IDS) if (gift.change[r]) state.resources[r] = Math.max(0, state.resources[r] + gift.change[r]!);
      return;
    case 'vehicle':
      state.vehicles.push(createVehicle(state, gift.defId, gift.condition));
      gifts.push(`a ${getVehicleDef(gift.defId).name}`);
      return;
    case 'wanderer': {
      const c = addWanderer(state, day, rng);
      gifts.push(`${fullName(c.survivor)}, at the gate`);
      return;
    }
  }
}

