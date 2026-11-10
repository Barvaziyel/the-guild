/**
 * "Your crew is back" notices. In a browser they can only fire while the page
 * is open (the tab may be in the background). The Android build (PR 8) swaps
 * in Capacitor's local notifications, which fire with the app closed.
 */
import type { PlannedNotice } from './runs-view.ts';

export type NoticePermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface Notifier {
  permission(): NoticePermission;
  /** Ask the player. Resolves to whether notices are allowed now. */
  request(): Promise<boolean>;
  /** Make the scheduled notices exactly these (adds new ones, drops the rest). */
  sync(notices: readonly PlannedNotice[]): void;
}

export function webNotifier(): Notifier {
  const timers = new Map<string, number>();
  const supported = typeof window !== 'undefined' && 'Notification' in window;

  const fire = (n: PlannedNotice): void => {
    timers.delete(n.id);
    // While the game is on screen, the in-game banner says it.
    if (!supported || Notification.permission !== 'granted' || document.visibilityState === 'visible') return;
    try {
      new Notification(n.title, { body: n.body, tag: n.id });
    } catch {
      // Some browsers only allow notices from a service worker; the in-game banner still shows.
    }
  };

  return {
    permission: () => (supported ? Notification.permission : 'unsupported'),
    async request() {
      if (!supported) return false;
      if (Notification.permission === 'granted') return true;
      return (await Notification.requestPermission()) === 'granted';
    },
    sync(notices) {
      const wanted = new Set(notices.map((n) => n.id));
      for (const [id, timer] of timers) {
        if (!wanted.has(id)) {
          window.clearTimeout(timer);
          timers.delete(id);
        }
      }
      for (const n of notices) {
        if (timers.has(n.id)) continue;
        // Browsers cap timers at about 24.8 days; runs are hours at most.
        const delay = Math.min(Math.max(0, n.at - Date.now()), 2 ** 31 - 1);
        timers.set(n.id, window.setTimeout(() => fire(n), delay));
      }
    },
  };
}
