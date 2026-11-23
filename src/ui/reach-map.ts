/**
 * Where things sit on the Reach map. Positions are presentation, not game
 * rules, so they live in the UI. The map is a 100 x 100 box with the Depot
 * near the middle; the three roads out lead west, north and east.
 * `npm run check` tests that every place has a spot and none crowd each other.
 */
import { campAt, LOCATIONS, findLocation, locationState, type GameState, type Run } from '../engine/index.ts';
import { runProgress } from './runs-view.ts';

export type LabelSide = 'above' | 'below' | 'left' | 'right';

export interface MapSpot {
  x: number;
  y: number;
  label: LabelSide;
}

export const DEPOT_SPOT: MapSpot = { x: 50, y: 62, label: 'below' };

/*
 * Two loops leave Maple Street and rejoin at Kessler Farm: an inner one
 * through the Drowned Mall, Red Hand Camp and the Radio Station, and an outer
 * one round the edge through St. Jude's, The Glow and Blackwater. West of the
 * Depot, the Rail Yard's two roads meet again at Checkpoint Bravo.
 */
export const MAP_SPOTS: Record<string, MapSpot> = {
  rail_yard: { x: 30, y: 70, label: 'below' },
  maple_street: { x: 50, y: 44, label: 'left' },
  kessler_farm: { x: 66, y: 72, label: 'below' },
  old_metro: { x: 14, y: 50, label: 'above' },
  water_plant: { x: 22, y: 92, label: 'right' },
  checkpoint_bravo: { x: 10, y: 74, label: 'below' },
  drowned_mall: { x: 62, y: 30, label: 'above' },
  st_judes: { x: 36, y: 24, label: 'above' },
  red_hand_camp: { x: 80, y: 22, label: 'below' },
  radio_station: { x: 79, y: 50, label: 'left' },
  the_glow: { x: 92, y: 7, label: 'left' },
  blackwater: { x: 88, y: 90, label: 'left' },
};

/** Map labels drop a leading "The" (except The Glow) and break onto two lines when long. */
export function mapLabel(name: string): string[] {
  const short = name === 'The Glow' ? name : name.replace(/^The /, '');
  if (short.length <= 12 || !short.includes(' ')) return [short];
  const words = short.split(' ');
  let best: string[] = [short];
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ');
    const b = words.slice(i).join(' ');
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) {
      best = [a, b];
      bestDiff = diff;
    }
  }
  return best;
}

export interface MapNode {
  id: string;
  spot: MapSpot;
  /** Discovered places have a name and can be visited. Undiscovered ones on the edge of the map show as a question mark. */
  known: boolean;
  label: string[];
  danger: number;
  radiation: number;
  explored: number;
  /** Crews out here now. */
  crewsOut: number;
  /** The guild's outpost here, if it has one. */
  outpost?: 'ok' | 'damaged';
  /** A Vultures' camp here (§7.11). */
  vultureCamp?: true;
}

export interface MapRoad {
  from: MapSpot;
  to: MapSpot;
  /** A road to somewhere not yet found is drawn faint. */
  known: boolean;
}

export interface ReachMap {
  nodes: MapNode[];
  roads: MapRoad[];
}

/**
 * The map as the guild knows it: every discovered place, the roads between
 * them, and question marks where a known place leads somewhere unexplored.
 */
export function reachMap(state: GameState): ReachMap {
  const known = (id: string): boolean => locationState(state, id).discovered;
  const spot = (id: string): MapSpot => MAP_SPOTS[id] ?? DEPOT_SPOT;
  const nodes: MapNode[] = [];
  const roads: MapRoad[] = [];
  const frontier = new Set<string>();

  for (const loc of LOCATIONS) {
    if (!known(loc.id)) continue;
    if (loc.startKnown) roads.push({ from: DEPOT_SPOT, to: spot(loc.id), known: true });
    for (const next of loc.leadsTo) {
      if (!findLocation(next)) continue;
      roads.push({ from: spot(loc.id), to: spot(next), known: known(next) });
      if (!known(next)) frontier.add(next);
    }
  }

  for (const loc of LOCATIONS) {
    const isKnown = known(loc.id);
    if (!isKnown && !frontier.has(loc.id)) continue;
    const here = locationState(state, loc.id);
    nodes.push({
      id: loc.id,
      spot: spot(loc.id),
      known: isKnown,
      label: isKnown ? mapLabel(loc.name) : [],
      danger: loc.danger,
      radiation: loc.radiation,
      explored: here.explored,
      crewsOut: state.runs.filter((r) => r.plan.locationId === loc.id).length,
      ...outpostMark(state, loc.id),
      ...(campAt(state, loc.id) ? { vultureCamp: true as const } : {}),
    });
  }
  return { nodes, roads };
}

function outpostMark(state: GameState, id: string): { outpost?: 'ok' | 'damaged' } {
  const o = state.outposts.find((x) => x.locationId === id);
  return o ? { outpost: o.damaged ? 'damaged' : 'ok' } : {};
}

// ---------------------------------------------------------------- crews on the map (3.2.0)

/**
 * The way from the Depot to a place along the roads the guild knows: the
 * shortest by distance on the map, through places already found. Empty for a
 * place that isn't on the map (Corwin Dam, on the road east).
 */
export function routeTo(state: GameState, locationId: string): MapSpot[] {
  const target = MAP_SPOTS[locationId];
  if (!target) return [];
  const known = (id: string): boolean => id === 'depot' || id === locationId || locationState(state, id).discovered;
  const spotOf = (id: string): MapSpot => (id === 'depot' ? DEPOT_SPOT : MAP_SPOTS[id] ?? DEPOT_SPOT);
  const next = new Map<string, Set<string>>();
  const onMap = (id: string): boolean => id === 'depot' || MAP_SPOTS[id] !== undefined;
  const link = (a: string, b: string): void => {
    if (!known(a) || !known(b) || !onMap(a) || !onMap(b)) return;
    (next.get(a) ?? next.set(a, new Set()).get(a)!).add(b);
    (next.get(b) ?? next.set(b, new Set()).get(b)!).add(a);
  };
  for (const loc of LOCATIONS) {
    if (loc.startKnown) link('depot', loc.id);
    for (const n of loc.leadsTo) if (findLocation(n)) link(loc.id, n);
  }
  // Dijkstra over a dozen places.
  const dist = new Map<string, number>([['depot', 0]]);
  const prev = new Map<string, string>();
  const open = new Set(['depot']);
  while (open.size > 0) {
    const here = [...open].reduce((a, b) => (dist.get(a)! <= dist.get(b)! ? a : b));
    open.delete(here);
    if (here === locationId) break;
    for (const n of next.get(here) ?? []) {
      const d = dist.get(here)! + Math.hypot(spotOf(n).x - spotOf(here).x, spotOf(n).y - spotOf(here).y);
      if (d < (dist.get(n) ?? Infinity)) {
        dist.set(n, d);
        prev.set(n, here);
        open.add(n);
      }
    }
  }
  if (!dist.has(locationId)) return [DEPOT_SPOT, target];
  const ids = [locationId];
  while (ids[0] !== 'depot') ids.unshift(prev.get(ids[0]!)!);
  return ids.map(spotOf);
}

/** The share of a run spent getting there; the same getting back, and the rest at the place. */
export const ROAD_SHARE = 0.3;

export interface CrewMarker {
  runId: string;
  x: number;
  y: number;
  /** Which way they're heading, for the marker to face: 1 right, -1 left. */
  facing: 1 | -1;
  stage: 'out' | 'there' | 'back';
  /** With vehicles, a vehicle; on foot, a walker. */
  driving: boolean;
  label: string;
}

/** Where along the roads a crew is now: on the way out, at the place, or on the way home. */
export function crewMarker(state: GameState, run: Run, now: number, label = ''): CrewMarker | undefined {
  const route = routeTo(state, run.plan.locationId);
  if (route.length < 2) return undefined;
  const p = runProgress(run, now);
  const stage: CrewMarker['stage'] = p < ROAD_SHARE ? 'out' : p > 1 - ROAD_SHARE ? 'back' : 'there';
  // How far from the Depot along the road, 0 to 1.
  const along = stage === 'out' ? p / ROAD_SHARE : stage === 'back' ? (1 - p) / ROAD_SHARE : 1;
  const at = pointAlong(route, along);
  const ahead = pointAlong(route, Math.min(1, along + 0.02));
  const behind = pointAlong(route, Math.max(0, along - 0.02));
  const dx = stage === 'back' ? behind.x - at.x : ahead.x - at.x;
  return { runId: run.id, x: at.x, y: at.y, facing: dx < 0 ? -1 : 1, stage, driving: (run.plan.vehicles ?? []).length > 0, label };
}

function pointAlong(route: readonly MapSpot[], share: number): { x: number; y: number } {
  const lengths = route.slice(1).map((s, i) => Math.hypot(s.x - route[i]!.x, s.y - route[i]!.y));
  let left = lengths.reduce((a, b) => a + b, 0) * Math.max(0, Math.min(1, share));
  for (let i = 0; i < lengths.length; i++) {
    const len = lengths[i]!;
    if (left <= len || i === lengths.length - 1) {
      const t = len === 0 ? 0 : Math.min(1, left / len);
      return { x: route[i]!.x + (route[i + 1]!.x - route[i]!.x) * t, y: route[i]!.y + (route[i + 1]!.y - route[i]!.y) * t };
    }
    left -= len;
  }
  return route[route.length - 1]!;
}
