/**
 * Haven (§9.11) on screen: the Haven tab (what the guild knows, the leads to
 * follow, what was found and what was heard), and the lines the planner, the
 * Reach and a run's report show for a lead. Plain TypeScript, tested in Node.
 */
import {
  DEPTH_NAMES,
  HAVEN_BROADCAST,
  HAVEN_CLUES,
  HAVEN_DREAMER,
  HAVEN_VULTURES,
  buildingDef,
  fillRoles,
  clueReady,
  depthOpen,
  getClue,
  getLocation,
  havenDreamer,
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
  // The one who went (§9.11): their goodbye is filed with the clues, in their name.
  const gone = havenDreamer(state);
  const them = (t: string): string => (gone ? fillRoles(t, { a: gone }) : t);
  const title = (id: string): string => (id === HAVEN_VULTURES.id ? HAVEN_VULTURES.title : id === HAVEN_DREAMER.id ? them(HAVEN_DREAMER.title) : getClue(id).title);
  const learned = (id: string): string => (id === HAVEN_VULTURES.id ? HAVEN_VULTURES.learned : id === HAVEN_DREAMER.id ? them(HAVEN_DREAMER.learned) : getClue(id).learned);
  const text = (f: { id: string; at?: string }): string =>
    f.id === HAVEN_VULTURES.id ? HAVEN_VULTURES.text : f.id === HAVEN_DREAMER.id ? them(f.at ? HAVEN_DREAMER.said : HAVEN_DREAMER.note) : getClue(f.id).text;
  const found = haven.found.map((f, i) => {
    if (f.id === HAVEN_DREAMER.id) {
      const line = f.at ? `On the way home from ${placeIn(f.at)}, day ${f.day}.` : `Gone in the night, day ${f.day}.`;
      return { id: f.id, title: title(f.id), text: text(f), line, isNew: i >= seen.found };
    }
    const who = f.by ? state.survivors.find((s) => s.id === f.by)?.firstName ?? state.memorial.find((m) => m.id === f.by)?.firstName : undefined;
    const where = f.at ? ` at ${placeIn(f.at)}` : '';
    // What came to the Depot rather than on a run: the Vultures at the fence, or a building's clue worked out.
    const line = who
      ? `Found by ${who}${where}, day ${f.day}.`
      : f.at
        ? `Found${where}, day ${f.day}.`
        : f.id === HAVEN_VULTURES.id
          ? `At the fence, day ${f.day}.`
          : `Worked out at the Depot, day ${f.day}.`;
    return { id: f.id, title: title(f.id), text: text(f), line, isNew: i >= seen.found };
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

/** "Rook went east to Haven, alone.": the one the broadcast pulled in, walking off from the road home. */
export function reportGoneLine(news: { ran?: { id: string } } | undefined, names: Record<string, string>): string | undefined {
  const id = news?.ran?.id;
  return id ? `${names[id] ?? 'One of them'} went east to Haven, alone.` : undefined;
}

/** Building clues ready to work out: something on the Haven tab waits for the player. */
export function havenReady(state: GameState): string[] {
  return HAVEN_CLUES.filter((c) => clueReady(state, c)).map((c) => c.id);
}

function lower(title: string): string {
  return title.charAt(0).toLowerCase() + title.slice(1);
}

// ---------------------------------------------------------------- the road (2.9.0, Aviel: "make it look better")

/** A clue on the road: found, a lead open now, or still unknown. */
export type RoadStop = 'found' | 'open' | 'unknown';

export interface RoadView {
  /** One a clue, found ones first (in the order found), then the open leads, then the rest. */
  stops: RoadStop[];
  found: number;
  total: number;
  /** The far end: "Haven?" until they know where it is. */
  end: string;
  /** Under the map, in the notebook's hand: "6 of 13 found." or "The road is open." */
  line: string;
  roadOpen: boolean;
}

/** The hand-drawn road from the Depot to Haven at the top of the tab: how far along the guild is. */
export function roadView(state: GameState): RoadView | undefined {
  const haven = state.haven;
  if (!haven) return undefined;
  const total = HAVEN_CLUES.length;
  const found = HAVEN_CLUES.filter((c) => haven.found.some((f) => f.id === c.id)).length;
  const open = havenLeads(state).length;
  const stops: RoadStop[] = [...Array<RoadStop>(found).fill('found'), ...Array<RoadStop>(open).fill('open'), ...Array<RoadStop>(total - found - open).fill('unknown')];
  const roadOpen = havenRoadOpen(state);
  const known = haven.found.some((f) => f.id === 'bearing');
  return {
    stops,
    found,
    total,
    end: known ? 'Corwin Dam' : 'Haven?',
    line: roadOpen ? 'The road is open.' : `${found} of ${total} found.`,
    roadOpen,
  };
}

/** Where the stops sit on the 340 × 120 map: a wandering road, left to right, the same every time. */
export function roadPoints(stops: number): { x: number; y: number }[] {
  const pts = [{ x: 22, y: 86 }];
  for (let i = 0; i < stops; i++) {
    const t = (i + 1) / (stops + 1);
    // Climbing gently east toward Haven, with a lazy bend or two, like a road on a map.
    pts.push({ x: Math.round(22 + t * 284), y: Math.round(84 - 30 * t + 11 * Math.sin(t * 9.5 + 0.3)) });
  }
  pts.push({ x: 312, y: 44 });
  return pts;
}

/** A smooth line through points (Catmull-Rom as cubic Béziers), as an SVG path. */
export function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const p = points;
  let d = `M${p[0]!.x} ${p[0]!.y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const e = p[Math.min(p.length - 1, i + 2)]!;
    const c1 = { x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 };
    const c2 = { x: c.x - (e.x - b.x) / 6, y: c.y - (e.y - b.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${c.x} ${c.y}`;
  }
  return d;
}

/** How many hints the Heard page shows before "Older": the rest fold away, so the tab stays short. */
export const HEARD_SHOWN = 6;
