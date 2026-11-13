/**
 * Screens are addressed by the URL hash (#/roster, #/s/s3/bonds), so the
 * browser's and Android's back button move between them.
 */

export const SHEET_TABS = ['stats', 'bonds', 'story'] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

/** A place's tabs on the Reach. 'about' is the default and has no part in the hash. */
export const PLACE_TABS = ['about', 'outpost'] as const;
export type PlaceTab = (typeof PLACE_TABS)[number];

/** The Depot's tabs. 'today' is the default and has no part in the hash. */
export const DEPOT_TABS = ['today', 'yard', 'buildings', 'projects', 'news'] as const;
export type DepotTab = (typeof DEPOT_TABS)[number];

export type Route =
  /** The Depot: what needs you today, the buildings, or the news. */
  | { screen: 'depot'; tab?: Exclude<DepotTab, 'today'> }
  /** A Depot building: its workers and what it does. */
  | { screen: 'building'; id: string }
  /** Who is at the gate. */
  | { screen: 'recruits' }
  /** The stash, and what everyone carries. */
  | { screen: 'gear' }
  /** The guild's vehicles: condition, repairs, and building more. */
  | { screen: 'vehicles' }
  | { screen: 'roster' }
  | { screen: 'survivor'; id: string; tab: SheetTab }
  | { screen: 'memorial' }
  | { screen: 'settings' }
  /** The Reach map, optionally with a location picked, and its outpost tab. */
  | { screen: 'reach'; id?: string; tab?: Exclude<PlaceTab, 'about'> }
  | { screen: 'plan'; locationId: string }
  /** The Vultures (§7.11). */
  | { screen: 'vultures' }
  | { screen: 'runs' }
  /** A crew that is out, or the report once they're back (same id). */
  | { screen: 'run'; id: string }
  /** A fight on a led run, under the player's command (§7.13). */
  | { screen: 'fight'; id: string };

/** The screens in the tab bar. */
export type TabScreen = 'depot' | 'roster' | 'reach' | 'runs' | 'settings';

export const DEFAULT_ROUTE: Route = { screen: 'depot' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, a, b] = parts;
  switch (head) {
    case 'depot': {
      const tab = DEPOT_TABS.find((t) => t === a);
      return tab && tab !== 'today' ? { screen: 'depot', tab } : DEFAULT_ROUTE;
    }
    case 'roster':
      return { screen: 'roster' };
    case 'recruits':
      return { screen: 'recruits' };
    case 'gear':
      return { screen: 'gear' };
    case 'vehicles':
      return { screen: 'vehicles' };
    case 'b':
      return a ? { screen: 'building', id: a } : DEFAULT_ROUTE;
    case 'memorial':
      return { screen: 'memorial' };
    case 'settings':
      return { screen: 'settings' };
    case 'runs':
      return { screen: 'runs' };
    case 'reach': {
      if (!a) return { screen: 'reach' };
      const tab = PLACE_TABS.find((t) => t === b);
      return tab && tab !== 'about' ? { screen: 'reach', id: a, tab } : { screen: 'reach', id: a };
    }
    case 'plan':
      return a ? { screen: 'plan', locationId: a } : { screen: 'reach' };
    case 'vultures':
      return { screen: 'vultures' };
    case 'run':
      return a ? { screen: 'run', id: a } : { screen: 'runs' };
    case 'fight':
      return a ? { screen: 'fight', id: a } : { screen: 'runs' };
    case 's': {
      if (!a) return DEFAULT_ROUTE;
      const tab = SHEET_TABS.find((t) => t === b) ?? 'stats';
      return { screen: 'survivor', id: a, tab };
    }
    default:
      return DEFAULT_ROUTE;
  }
}

export function routeHash(route: Route): string {
  const enc = encodeURIComponent;
  switch (route.screen) {
    case 'depot':
      return route.tab ? `#/depot/${route.tab}` : '#/depot';
    case 'recruits':
    case 'gear':
    case 'vehicles':
    case 'roster':
    case 'memorial':
    case 'settings':
    case 'runs':
    case 'vultures':
      return `#/${route.screen}`;
    case 'building':
      return `#/b/${enc(route.id)}`;
    case 'reach':
      return route.id ? `#/reach/${enc(route.id)}${route.tab ? `/${route.tab}` : ''}` : '#/reach';
    case 'plan':
      return `#/plan/${enc(route.locationId)}`;
    case 'run':
      return `#/run/${enc(route.id)}`;
    case 'fight':
      return `#/fight/${enc(route.id)}`;
    case 'survivor':
      return `#/s/${enc(route.id)}${route.tab === 'stats' ? '' : `/${route.tab}`}`;
  }
}

/** Which tab bar entry is lit for a route. */
export function tabFor(route: Route): TabScreen {
  switch (route.screen) {
    case 'depot':
    case 'building':
    case 'recruits':
    case 'gear':
    case 'vehicles':
      return 'depot';
    case 'roster':
    case 'survivor':
    case 'memorial':
      return 'roster';
    case 'reach':
    case 'plan':
    case 'vultures':
      return 'reach';
    case 'runs':
    case 'run':
    case 'fight':
      return 'runs';
    case 'settings':
      return 'settings';
  }
}
