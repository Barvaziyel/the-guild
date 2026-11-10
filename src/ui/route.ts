/**
 * Screens are addressed by the URL hash (#/roster, #/s/s3/bonds), so the
 * browser's and Android's back button move between them.
 */

export const SHEET_TABS = ['stats', 'bonds', 'story'] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

export type Route =
  | { screen: 'depot' }
  /** A Depot building: its workers and what it does. */
  | { screen: 'building'; id: string }
  /** Who is at the gate. */
  | { screen: 'recruits' }
  | { screen: 'roster' }
  | { screen: 'survivor'; id: string; tab: SheetTab }
  | { screen: 'memorial' }
  | { screen: 'settings' }
  /** The Reach map, optionally with a location picked. */
  | { screen: 'reach'; id?: string }
  | { screen: 'plan'; locationId: string }
  | { screen: 'runs' }
  /** A crew that is out, or the report once they're back (same id). */
  | { screen: 'run'; id: string };

/** The screens in the tab bar. */
export type TabScreen = 'depot' | 'roster' | 'reach' | 'runs' | 'settings';

export const DEFAULT_ROUTE: Route = { screen: 'depot' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  const [head, a, b] = parts;
  switch (head) {
    case 'roster':
      return { screen: 'roster' };
    case 'recruits':
      return { screen: 'recruits' };
    case 'b':
      return a ? { screen: 'building', id: a } : DEFAULT_ROUTE;
    case 'memorial':
      return { screen: 'memorial' };
    case 'settings':
      return { screen: 'settings' };
    case 'runs':
      return { screen: 'runs' };
    case 'reach':
      return a ? { screen: 'reach', id: a } : { screen: 'reach' };
    case 'plan':
      return a ? { screen: 'plan', locationId: a } : { screen: 'reach' };
    case 'run':
      return a ? { screen: 'run', id: a } : { screen: 'runs' };
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
    case 'recruits':
    case 'roster':
    case 'memorial':
    case 'settings':
    case 'runs':
      return `#/${route.screen}`;
    case 'building':
      return `#/b/${enc(route.id)}`;
    case 'reach':
      return route.id ? `#/reach/${enc(route.id)}` : '#/reach';
    case 'plan':
      return `#/plan/${enc(route.locationId)}`;
    case 'run':
      return `#/run/${enc(route.id)}`;
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
      return 'depot';
    case 'roster':
    case 'survivor':
    case 'memorial':
      return 'roster';
    case 'reach':
    case 'plan':
      return 'reach';
    case 'runs':
    case 'run':
      return 'runs';
    case 'settings':
      return 'settings';
  }
}
