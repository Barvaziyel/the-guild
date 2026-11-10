/**
 * Screens are addressed by the URL hash (#/roster, #/s/s3/bonds), so the
 * browser's and Android's back button move between them.
 */

export const SHEET_TABS = ['stats', 'bonds', 'story'] as const;
export type SheetTab = (typeof SHEET_TABS)[number];

export type Route =
  | { screen: 'roster' }
  | { screen: 'survivor'; id: string; tab: SheetTab }
  | { screen: 'memorial' }
  | { screen: 'settings' };

/** The screens in the tab bar. */
export type TabScreen = 'roster' | 'memorial' | 'settings';

export const DEFAULT_ROUTE: Route = { screen: 'roster' };

export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  switch (parts[0]) {
    case 'memorial':
      return { screen: 'memorial' };
    case 'settings':
      return { screen: 'settings' };
    case 's': {
      const id = parts[1];
      if (!id) return DEFAULT_ROUTE;
      const tab = SHEET_TABS.find((t) => t === parts[2]) ?? 'stats';
      return { screen: 'survivor', id, tab };
    }
    default:
      return DEFAULT_ROUTE;
  }
}

export function routeHash(route: Route): string {
  switch (route.screen) {
    case 'roster':
      return '#/roster';
    case 'memorial':
      return '#/memorial';
    case 'settings':
      return '#/settings';
    case 'survivor':
      return `#/s/${encodeURIComponent(route.id)}${route.tab === 'stats' ? '' : `/${route.tab}`}`;
  }
}

/** Which tab bar entry is lit for a route. A survivor sheet belongs to the roster or the memorial. */
export function tabFor(route: Route, isDead: boolean): TabScreen {
  if (route.screen === 'survivor') return isDead ? 'memorial' : 'roster';
  return route.screen;
}
