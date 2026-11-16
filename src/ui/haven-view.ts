/**
 * Haven (§9.11) on screen: the Haven tab (what the guild knows, the leads to
 * follow, what was found and what was heard), and the lines the planner, the
 * Reach and a run's report show for a lead. Plain TypeScript, tested in Node.
 */
import {
  DEPTH_NAMES,
  HAVEN_BROADCAST,
  HAVEN_CLUES,
  HAVEN_VULTURES,
  buildingDef,
  clueReady,
  depthOpen,
  getClue,
  getLocation,
  havenLeads,
  havenRoadOpen,
  knownLocations,
  leadAt,
  planDepth,
  type GameState,
  type HavenClue,
  type HavenHeard,
  type HavenHintSource,
  type RunPlan,
} from '../engine/index.ts';
import type { Route } from './route.ts';

export interface HavenLeadView {
  id: string;
  title: string;
  /** Why anyone thinks it's there. */
  lead: string;
  /** "Hilltop Radio Station, the outskirts", "The Radio Tower, level 2". */
  where: string;
  /** How it stands: not found yet, the level not open, tried before, or the building not up. */
  note?: string;
  /** Where to go about it. */
  go?: { label: string; to: Route };
  /** A building clue that can be worked out now: the button's words. */
  action?: string;
}

export interface HavenFoundView {
  id: string;
  title: string;
  text: string;
  /** "Found by Briar at Hilltop Radio Station, day 12." */
  line: string;
  isNew: boolean;
}

export interface HavenHeardView {
  text: string;
  /** "On a run to the Old Metro, day 14." */
  line: string;
  isNew: boolean;
}

export interface HavenView {
  broadcast: string;
  /** "First heard on day 9." */
  since: string;
  /** What the guild knows so far, a line a clue, in the order found. */
  known: string[];
  /** Once the guild knows where Haven is and how to get in. */
  road?: string;
  leads: HavenLeadView[];
  /** Newest first. */
  found: HavenFoundView[];
  /** Newest first. */
  heard: HavenHeardView[];
}

/** "the Old Metro" in a sentence, "Hilltop Radio Station" as it is. */
function placeIn(id: string): string {
  return getLocation(id).name.replace(/^The /, 'the ');
}

/**
 * The Haven tab. `seen` is what the player had seen when they opened it, so
 * what came after shows as new.
 */
export function havenView(state: GameState, seen: { found: number; heard: number } = { found: Infinity, heard: Infinity }): HavenView | undefined {
  const haven = state.haven;
  if (!haven) return undefined;
  const title = (id: string): string => (id === HAVEN_VULTURES.id ? HAVEN_VULTURES.title : getClue(id).title);
  const text = (id: string): string => (id === HAVEN_VULTURES.id ? HAVEN_VULTURES.text : getClue(id).text);
  const learned = (id: string): string => (id === HAVEN_VULTURES.id ? HAVEN_VULTURES.learned : getClue(id).learned);
  const found = haven.found.map((f, i) => {
    const who = f.by ? state.survivors.find((s) => s.id === f.by)?.firstName ?? state.memorial.find((m) => m.id === f.by)?.firstName : undefined;
    const where = f.at ? ` at ${placeIn(f.at)}` : '';
    const line = who ? `Found by ${who}${where}, day ${f.day}.` : f.at ? `Found${where}, day ${f.day}.` : `Day ${f.day}.`;
    return { id: f.id, title: title(f.id), text: text(f.id), line, isNew: i >= seen.found };
  });
  const heard = haven.heard.map((h, i) => ({ text: h.text, line: `${heardFrom(h)}, day ${h.day}.`, isNew: i >= seen.heard }));
  return {
    broadcast: HAVEN_BROADCAST,
    since: `First heard on day ${haven.day}.`,
    known: haven.found.map((f) => learned(f.id)),
    ...(havenRoadOpen(state) ? { road: 'They know where Haven is, and how to get in.' } : {}),
    // Something to work out now comes first.
    leads: havenLeads(state)
      .map((c) => leadView(state, c))
      .sort((a, b) => Number(!!b.action) - Number(!!a.action)),
    found: found.reverse(),
    heard: heard.reverse(),
  };
}

const FROM: Record<HavenHintSource, string> = {
  run: 'On a run',
  gate: 'From someone new at the gate',
  trader: 'From a trader',
  radio: 'On the radio',
  fire: 'At the fire',
  captive: 'From a captive',
  vultures: 'From the Vultures',
};

function heardFrom(h: HavenHeard): string {
  return h.source === 'run' && h.at ? `On a run to ${placeIn(h.at)}` : FROM[h.source];
}

function leadView(state: GameState, c: HavenClue): HavenLeadView {
  const base = { id: c.id, title: c.title, lead: c.lead };
  if (c.where.kind === 'build') {
    const w = c.where;
    const name = buildingDef(w.building).name;
    const where = `The ${name}, level ${w.level}`;
    if (clueReady(state, c)) return { ...base, where, action: w.action };
    return { ...base, where, note: `Once the ${name} is at level ${w.level}.`, go: { label: 'See the Buildings', to: { screen: 'depot', tab: 'buildings' } } };
  }
  const w = c.where;
  const place = getLocation(w.locationId).name;
  const where = `${place}, ${DEPTH_NAMES[w.depth - 1]!.toLowerCase()}`;
  const known = state.locations[w.locationId]?.discovered ?? false;
  if (!known) {
    // The way the Reach says it: scout where the road leads from (2.9.0).
    const from = knownLocations(state).find((l) => l.leadsTo.includes(w.locationId));
    if (!from) return { ...base, where, note: `Nobody has found ${placeIn(w.locationId)} yet.`, go: { label: 'Look on the Reach', to: { screen: 'reach' } } };
    return { ...base, where, note: `Nobody has found ${placeIn(w.locationId)} yet. A road leads there from ${placeIn(from.id)}: scouting there is the best way to find it.`, go: { label: `Plan a run to ${placeIn(from.id)}`, to: { screen: 'plan', locationId: from.id } } };
  }
  if (!depthOpen(state, w.locationId, w.depth)) {
    return { ...base, where, note: `${DEPTH_NAMES[w.depth - 1]} isn’t open yet: explore the level before it fully.`, go: { label: 'See the place', to: { screen: 'reach', id: w.locationId } } };
  }
  const tries = state.haven?.tries[c.id] ?? 0;
  const note = tries === 0 ? undefined : tries === 1 ? 'One crew looked and came back without it. Scouting looks harder.' : `${tries} crews looked and came back without it. Scouting looks harder.`;
  return { ...base, where, ...(note ? { note } : {}), go: { label: 'Plan a run there', to: { screen: 'plan', locationId: w.locationId } } };
}

/** The planner's line when the run would follow a lead: "A lead for Haven here: the engineer's logbook." */
export function planLeadLine(state: GameState, plan: Pick<RunPlan, 'locationId'> & Partial<RunPlan>): string | undefined {
  const depth = planDepth(plan);
  const clue = leadAt(state, plan.locationId, depth);
  if (clue) return `A lead for Haven here: ${lower(clue.title)}. If the crew gets there, they’ll look for it.`;
  // A lead deeper in than the level picked.
  const deeper = havenLeads(state).find((c) => c.where.kind === 'run' && c.where.locationId === plan.locationId && c.where.depth > depth);
  if (deeper && deeper.where.kind === 'run') return `A lead for Haven here, ${DEPTH_NAMES[deeper.where.depth - 1]!.toLowerCase()}: ${lower(deeper.title)}.`;
  return undefined;
}

/** The Reach's line for a place with leads: "A lead for Haven: the engineer's logbook." */
export function placeLeadLine(state: GameState, locationId: string): string | undefined {
  const here = havenLeads(state).filter((c) => c.where.kind === 'run' && c.where.locationId === locationId);
  if (here.length === 0) return undefined;
  return `A lead for Haven: ${here.map((c) => `${lower(c.title)}${c.where.kind === 'run' && c.where.depth > 1 ? ` (${DEPTH_NAMES[c.where.depth - 1]!.toLowerCase()})` : ''}`).join(', ')}.`;
}

/** Places with a lead to follow, for marks on the map. */
export function leadPlaces(state: GameState): Set<string> {
  return new Set(havenLeads(state).flatMap((c) => (c.where.kind === 'run' ? [c.where.locationId] : [])));
}

/** A report's line about Haven: who found what, or that it wasn't found. Undefined when the run had nothing to do with it. */
export function reportHavenLine(news: { lead?: { clue: string; found: boolean; by?: string } } | undefined, names: Record<string, string>): string | undefined {
  const lead = news?.lead;
  if (!lead) return undefined;
  const t = lower(getClue(lead.clue).title);
  if (!lead.found) return `For Haven: no sign of ${t} this time.`;
  const who = lead.by ? names[lead.by] : undefined;
  return who ? `For Haven: ${who} found ${t}.` : `For Haven: found ${t}.`;
}

/** Building clues ready to work out: something on the Haven tab waits for the player. */
export function havenReady(state: GameState): string[] {
  return HAVEN_CLUES.filter((c) => clueReady(state, c)).map((c) => c.id);
}

function lower(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}
