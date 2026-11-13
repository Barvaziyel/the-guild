/**
 * Where things sit on the Reach map. Positions are presentation, not game
 * rules, so they live in the UI. The map is a 100 x 100 box with the Depot
 * near the middle; the three roads out lead west, north and east.
 * `npm run check` tests that every place has a spot and none crowd each other.
 */
import { campAt, LOCATIONS, findLocation, locationState, type GameState } from '../engine/index.ts';

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
