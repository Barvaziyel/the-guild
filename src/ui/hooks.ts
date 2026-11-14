/** React glue: the game store, preferences, the clock and hash navigation. */
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { GameState } from '../engine/index.ts';
import type { Notifier } from './notify.ts';
import type { Prefs, PrefsStore } from './prefs.ts';
import { DEFAULT_ROUTE, parseRoute, routeHash, type Route } from './route.ts';
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
 * Run a game action through the store and keep its error message (the engine
 * throws readable ones) for the screen to show. Returns whether it worked.
 */
export function useAction(): { act: (fn: (state: GameState) => void) => boolean; error: string | null; clear: () => void } {
  const { store } = useServices();
  const [error, setError] = useState<string | null>(null);
  return {
    act: (fn) => {
      try {
        store.update(fn);
        setError(null);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    error,
    clear: () => setError(null),
  };
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
  scrollPositions.set(window.location.hash || routeHash(DEFAULT_ROUTE), window.scrollY);
}

export function savedScroll(hash: string): number {
  return scrollPositions.get(hash) ?? 0;
}

/**
 * Go to a screen. `replace` swaps the current history entry (tabs) instead of
 * adding one (drilling in). `keepScroll`: a tab within the screen, so the page
 * stays where it is rather than jumping to the top (or to where that tab was
 * last left).
 */
export function navigate(route: Route, opts: { replace?: boolean; keepScroll?: boolean } = {}): void {
  const hash = routeHash(route);
  if (hash === window.location.hash) return;
  rememberScroll();
  if (opts.keepScroll) scrollPositions.set(hash, window.scrollY);
  if (opts.replace) {
    window.history.replaceState({ depth: depth() }, '', hash);
  } else {
    if (!opts.keepScroll) scrollPositions.delete(hash);
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

// ---------------------------------------------------------------- keeping things in view

/** Smooth unless the phone asks for less motion. */
export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Keep an element in view when `key` changes under the reader: a card that
 * shrinks once answered (a decision, a call on the radio) shouldn't leave them
 * scrolled past it, looking at something else.
 */
export function useKeepInView<T extends HTMLElement>(key: unknown): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    if (top < 0 || top > window.innerHeight * 0.75) el.scrollIntoView({ block: 'start', behavior: scrollBehavior() });
  }, [key]);
  return ref;
}

/** Back to the top when `key` changes: a screen that turns into another (raiders on the road, then at the gate, then the fight). */
export function useTopOnChange(key: unknown): void {
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }, [key]);
}
