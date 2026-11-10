/** React glue: the game store, preferences, the clock and hash navigation. */
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { Notifier } from './notify.ts';
import type { Prefs, PrefsStore } from './prefs.ts';
import { parseRoute, routeHash, type Route } from './route.ts';
import type { GameStore, Snapshot } from './store.ts';

export interface AppServices {
  store: GameStore;
  prefs: PrefsStore;
  notifier: Notifier;
}

export const ServicesContext = createContext<AppServices | null>(null);

export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('ServicesContext is missing');
  return services;
}

export function useSnapshot(): Snapshot {
  const { store } = useServices();
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}

export function usePrefs(): Prefs {
  const { prefs } = useServices();
  return useSyncExternalStore(prefs.subscribe, prefs.get);
}

/**
 * The current time, refreshed every `everyMs`, when the app comes back to the
 * foreground, and at `wakeAt` (e.g. the next crew's return) if given.
 */
export function useNow(everyMs = 30_000, wakeAt?: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (wakeAt === undefined) return;
    const delay = wakeAt - Date.now();
    if (delay > 2 ** 31 - 1) return;
    // Already passed (a developer skip, or the phone slept through it): wake right away.
    const id = window.setTimeout(() => setNow(Date.now()), Math.max(0, delay) + 50);
    return () => window.clearTimeout(id);
  }, [wakeAt]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') setNow(Date.now());
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [everyMs]);
  return now;
}

// ---------------------------------------------------------------- navigation

const NAVIGATE_EVENT = 'guild:navigate';

/** How many in-app screens deep we are, so Back knows whether there's somewhere to go back to. */
function depth(): number {
  const d = (window.history.state as { depth?: number } | null)?.depth;
  return typeof d === 'number' ? d : 0;
}

/** Scroll positions by hash, so going back lands where you were. */
const scrollPositions = new Map<string, number>();

export function rememberScroll(): void {
  scrollPositions.set(window.location.hash || routeHash({ screen: 'roster' }), window.scrollY);
}

export function savedScroll(hash: string): number {
  return scrollPositions.get(hash) ?? 0;
}

/** Go to a screen. `replace` swaps the current history entry (tabs) instead of adding one (drilling in). */
export function navigate(route: Route, opts: { replace?: boolean } = {}): void {
  const hash = routeHash(route);
  if (hash === window.location.hash) return;
  rememberScroll();
  if (opts.replace) {
    window.history.replaceState({ depth: depth() }, '', hash);
  } else {
    scrollPositions.delete(hash);
    window.history.pushState({ depth: depth() + 1 }, '', hash);
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT));
}

/** Back to wherever we came from, or to `fallback` if this screen was opened directly. */
export function goBack(fallback: Route): void {
  if (depth() > 0) window.history.back();
  else navigate(fallback, { replace: true });
}

function subscribeToLocation(listener: () => void): () => void {
  window.addEventListener('popstate', listener);
  window.addEventListener('hashchange', listener);
  window.addEventListener(NAVIGATE_EVENT, listener);
  return () => {
    window.removeEventListener('popstate', listener);
    window.removeEventListener('hashchange', listener);
    window.removeEventListener(NAVIGATE_EVENT, listener);
  };
}

export function useHash(): string {
  return useSyncExternalStore(subscribeToLocation, () => window.location.hash);
}

export function useRoute(): Route {
  return parseRoute(useHash());
}
