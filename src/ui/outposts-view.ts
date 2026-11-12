/**
 * Outposts and deeper levels, as the Reach, the planner and the sheet show
 * them. Plain TypeScript so it can be tested in Node.
 */
import {
  DEPTH_NAMES,
  OUTPOST_COST,
  OUTPOST_RELIEF,
  OUTPOST_REPAIR,
  OUTPOST_SHORTCUT,
  OUTPOST_STAFF,
  RESOURCE_IDS,
  atDepth,
  buildOutpostProblem,
  buildingName,
  costText,
  deepestOpen,
  depthOpen,
  effectiveStat,
  exploredAt,
  findOutpost,
  getLocation,
  locationState,
  outpostLimit,
  outpostNear,
  outpostStaff,
  outpostYieldEach,
  repairOutpostProblem,
  stationProblem,
  watchStress,
  type GameState,
  type LocationDef,
  type RunPlan,
  type Survivor,
} from '../engine/index.ts';
import { joinNames, type Choice } from './runs-view.ts';
import { RESOURCE_NAMES } from './view.ts';

// ---------------------------------------------------------------- levels

export interface DepthRow {
  depth: number;
  name: string;
  open: boolean;
  explored: number;
  /** "Danger 3. 40% explored." or "Opens when deeper in is fully explored." */
  line: string;
}

/** "the outskirts are", "deeper in is": the level as the end of a sentence's subject. */
function levelIs(depth: number): string {
  return `${DEPTH_NAMES[depth - 1]!.toLowerCase()} ${depth === 1 ? 'are' : 'is'}`;
}

/** Each level of a place: how dangerous, how much is explored, or what opens it. */
export function depthRows(state: GameState, id: string): DepthRow[] {
  const def = getLocation(id);
  return DEPTH_NAMES.map((name, i) => {
    const depth = i + 1;
    const open = depthOpen(state, id, depth);
    const explored = exploredAt(state, id, depth);
    const danger = atDepth(def, depth).danger;
    const line = !open ? `Opens when ${levelIs(depth - 1)} fully explored.` : `Danger ${danger}. ${explored >= 100 ? 'Fully explored' : `${explored}% explored`}.`;
    return { depth, name, open, explored, line };
  });
}

/** The known places list's short progress: "60%", "Deeper 20%", "Heart 100%". */
export function exploredShort(state: GameState, id: string): string {
  const depth = deepestOpen(state, id);
  const pct = `${exploredAt(state, id, depth)}%`;
  return depth === 1 ? pct : `${depth === 2 ? 'Deeper' : 'Heart'} ${pct}`;
}

/** The planner's level choice: only levels that are open. Empty while only the outskirts are. */
export function depthChoices(state: GameState, id: string): Choice<string>[] {
  if (deepestOpen(state, id) === 1) return [];
  return depthRows(state, id)
    .filter((r) => r.open)
    .map((r) => ({
      id: String(r.depth),
      name: r.name,
      description: r.depth === 1 ? r.line : `${r.line} Longer and deadlier, with more to find and better gear.`,
    }));
}

/** Set the plan's level, leaving it out for the outskirts. */
export function withDepth(plan: RunPlan, depth: number): RunPlan {
  const { depth: _drop, ...rest } = plan;
  return depth > 1 ? { ...rest, depth } : rest;
}

// ---------------------------------------------------------------- outposts

/** "mostly scrap and tech": the two things a place gives up most. */
function mostly(def: LocationDef): string {
  const top = [...RESOURCE_IDS].filter((r) => def.loot[r] > 0).sort((a, b) => def.loot[b] - def.loot[a]);
  return top.length === 0 ? '' : `, mostly ${joinNames(top.slice(0, 2).map((r) => RESOURCE_NAMES[r].toLowerCase()))}`;
}

/** Places whose runs start from an outpost here: the place itself and its neighbours, as far as the guild knows them. */
export function placesServed(state: GameState, id: string): string[] {
  const def = getLocation(id);
  const near = new Set(def.leadsTo);
  for (const l of Object.keys(state.locations)) if (getLocation(l).leadsTo.includes(id)) near.add(l);
  return [id, ...[...near].filter((l) => l !== id && locationState(state, l).discovered)].map((l) => getLocation(l).name);
}

export interface OutpostPerson {
  survivor: Survivor;
  /** "Works the Garden", "At the outpost at Rail Yard", "No post". Empty for those already here. */
  where: string;
  /** "Aim 4": the better the shots out here, the likelier they hold off raiders. */
  aim: string;
}

export interface OutpostView {
  place: string;
  built: boolean;
  damaged: boolean;
  /** What an outpost does, before there is one. */
  pitch: string;
  /** Why it can't be set up yet, if it can't. */
  buildProblem?: string;
  buildCost: string;
  /** "The Radio Tower keeps in contact with 1 outpost. 0 set up." */
  contactLine: string;
  staff: OutpostPerson[];
  /** "2 of 3". */
  room: string;
  full: boolean;
  /** What it sends home a day. */
  yieldLine: string;
  /** What life out there is like: healing, rest, the watch, trouble and raids. */
  hardship: string;
  /** Which runs start from it. */
  nearLine: string;
  repairCost: string;
  repairProblem?: string;
  /** People who could move out here now. */
  candidates: OutpostPerson[];
}

export function outpostView(state: GameState, id: string): OutpostView {
  const def = getLocation(id);
  const outpost = findOutpost(state, id);
  const staff = outpostStaff(state, id);
  const [lo, hi] = outpostYieldEach(id);
  const limit = outpostLimit(state);
  const buildProblem = outpost ? undefined : buildOutpostProblem(state, id);
  const repairProblem = outpost?.damaged ? repairOutpostProblem(state, id) : undefined;
  const served = placesServed(state, id);
  const candidates = outpost
    ? state.survivors
        .filter((s) => s.outpost !== id && stationProblem(state, s.id, id) === undefined)
        .map((s) => person(state, s))
        .sort((a, b) => Number(Boolean(a.survivor.outpost)) - Number(Boolean(b.survivor.outpost)) || a.survivor.firstName.localeCompare(b.survivor.firstName))
    : [];
  return {
    place: def.name,
    built: outpost !== undefined,
    damaged: outpost?.damaged ?? false,
    pitch: `A camp out here, and a hard posting. Up to ${numberWord(OUTPOST_STAFF)} people live at it, keep watch, and send home a share of what ${def.name} gives up every day. Runs here and next door set out from it and take ${shortcutWords()}, and crews stop there to rest on the way home.`,
    ...(buildProblem ? { buildProblem } : {}),
    buildCost: costText(OUTPOST_COST),
    contactLine:
      limit === 0
        ? 'Outposts need the Radio Tower to keep in contact.'
        : `The Radio Tower keeps in contact with ${limit === 1 ? 'one outpost' : `${limit} outposts`}. The guild has ${state.outposts.length === 0 ? 'none yet' : state.outposts.length}.`,
    staff: staff.map((s) => person(state, s)),
    room: `${staff.length} of ${OUTPOST_STAFF}`,
    full: staff.length >= OUTPOST_STAFF,
    yieldLine: `Each person living here sends home ${lo} to ${hi} supplies a day${mostly(def)}${outpost?.damaged ? ', half while it is damaged' : ''}, and eats a ration from the Depot's stores.`,
    hardship: hardship(def),
    nearLine: `Runs to ${joinNames(served)} set out from here and take ${shortcutWords()}, and crews stop here to rest on the way home.`,
    repairCost: costText(OUTPOST_REPAIR),
    ...(repairProblem ? { repairProblem } : {}),
    candidates,
  };
}

function person(state: GameState, s: Survivor): OutpostPerson {
  const where = s.outpost ? `At the outpost at ${getLocation(s.outpost).name}` : s.post ? `Works the ${buildingName(state, s.post.building)}` : 'No post';
  return { survivor: s, where, aim: `Aim ${effectiveStat(s, 'aim')}` };
}

/** Life out there, in a few sentences, with this place's numbers. */
function hardship(def: LocationDef): string {
  const watch = watchStress(def.id);
  const rest =
    watch === 0
      ? `Out here people heal a third as fast as at home and rest only a little.`
      : `Out here people heal a third as fast as at home, and keeping watch wears on them${
          watch < OUTPOST_RELIEF
            ? ', though they still calm down a little each day.'
            : watch === OUTPOST_RELIEF
              ? ' about as fast as they rest, unless they have a close friend out here.'
              : `: about ${watch - OUTPOST_RELIEF} more stress a day than they shed, less with a close friend out here.`
        }`;
  const trouble = `Trouble comes calling: prowlers at the fence, long nights, accidents${def.radiation > 0 ? ', radiation' : ''}.`;
  return `${rest} ${trouble} Raiders come now and then, and the better the shots out here, the likelier they hold it; an outpost raided while it is damaged burns down.`;
}

function numberWord(n: number): string {
  return ['no', 'one', 'two', 'three', 'four', 'five'][n] ?? String(n);
}

/** "half the time". */
function shortcutWords(): string {
  return OUTPOST_SHORTCUT === 0.5 ? 'half the time' : `${Math.round(OUTPOST_SHORTCUT * 100)}% of the time`;
}

/** The planner's line when the run starts from an outpost, if it does. */
export function outpostPlanNote(state: GameState, plan: RunPlan): string | undefined {
  const near = outpostNear(state, plan.locationId);
  if (!near) return undefined;
  return `They set out from the outpost at ${getLocation(near.locationId).name}, which cuts the trip to ${shortcutWords()}, and stop there to rest on the way home.`;
}

/** The sheet's line for someone living at an outpost. */
export function outpostLine(s: Survivor): string | undefined {
  return s.outpost ? `Lives at the outpost at ${getLocation(s.outpost).name}.` : undefined;
}

/** Outposts someone could move to, for the post picker on their sheet. */
export function outpostChoices(state: GameState, s: Survivor): { id: string; name: string; problem?: string }[] {
  return state.outposts.map((o) => {
    const problem = s.outpost === o.locationId ? undefined : stationProblem(state, s.id, o.locationId);
    return { id: o.locationId, name: `The outpost at ${getLocation(o.locationId).name}`, ...(problem ? { problem } : {}) };
  });
}

/** The Depot's lines about each outpost: "The outpost at Maple Street: Ava and Cal live there." */
export function outpostRows(state: GameState): { id: string; text: string; damaged: boolean }[] {
  return state.outposts.map((o) => {
    const names = outpostStaff(state, o.locationId).map((s) => s.firstName);
    const who = names.length === 0 ? 'nobody lives there' : `${joinNames(names)} ${names.length === 1 ? 'lives' : 'live'} there`;
    return { id: o.locationId, text: `The outpost at ${getLocation(o.locationId).name}: ${who}${o.damaged ? ', and it needs mending' : ''}.`, damaged: o.damaged };
  });
}
