/**
 * "Your crew is back" notices. In a browser they can only fire while the page
 * is open (the tab may be in the background). The Android app uses Capacitor's
 * local notifications, which the system fires with the app closed.
 */
import { LocalNotifications, type PendingLocalNotificationSchema } from '@capacitor/local-notifications';
import { noticeNumber, type PlannedNotice } from './runs-view.ts';

export type NoticePermission = 'granted' | 'denied' | 'default' | 'unsupported';

export interface Notifier {
  permission(): NoticePermission;
  /** Ask the player. Resolves to whether notices are allowed now. */
  request(): Promise<boolean>;
  /** Make the scheduled notices exactly these (adds new ones, drops the rest). */
  sync(notices: readonly PlannedNotice[]): void;
}

export function webNotifier(): Notifier {
  // By notice id: the timer, and the time it was set for.
  const timers = new Map<string, { timer: number; at: number }>();
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
      const wanted = new Map(notices.map((n) => [n.id, n]));
      for (const [id, t] of timers) {
        // Gone, or moved (a crew answered on the radio comes back at another time).
        if (wanted.get(id)?.at !== t.at) {
          window.clearTimeout(t.timer);
          timers.delete(id);
        }
      }
      for (const n of notices) {
        if (timers.has(n.id)) continue;
        // Browsers cap timers at about 24.8 days; runs are hours at most.
        const delay = Math.min(Math.max(0, n.at - Date.now()), 2 ** 31 - 1);
        timers.set(n.id, { timer: window.setTimeout(() => fire(n), delay), at: n.at });
      }
    },
  };
}

/**
 * Android: notices scheduled with the system, so they fire with the game
 * closed. Each run's notice carries the run id, so tapping it opens the report.
 * Timing is inexact (Android may hold it a few minutes to save battery).
 */
export function nativeNotifier(): Notifier {
  let permission: NoticePermission = 'default';
  const toPermission = (display: string): NoticePermission => (display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default');
  void LocalNotifications.checkPermissions().then((p) => (permission = toPermission(p.display)));

  // Calls are chained so two syncs never race each other.
  let queue: Promise<void> = Promise.resolve();

  return {
    permission: () => permission,
    async request() {
      const p = await LocalNotifications.requestPermissions();
      permission = toPermission(p.display);
      return permission === 'granted';
    },
    sync(notices) {
      queue = queue.then(() => syncNative(notices)).catch(() => undefined);
    },
  };
}

/** Make the system's pending notices match `notices`: cancel the rest, (re)schedule what's missing or moved. */
async function syncNative(notices: readonly PlannedNotice[]): Promise<void> {
  const pending = (await LocalNotifications.getPending()).notifications;
  const wanted = new Map(notices.map((n) => [noticeNumber(n.id), n]));
  const scheduledAt = (p: PendingLocalNotificationSchema): number => (p.schedule?.at ? new Date(p.schedule.at).getTime() : 0);

  // A notice is stale if its run is over, or the return time moved (a developer skip).
  const stale = pending.filter((p) => {
    const n = wanted.get(p.id);
    return !n || Math.abs(scheduledAt(p) - n.at) > 60_000;
  });
  if (stale.length > 0) await LocalNotifications.cancel({ notifications: stale.map((p) => ({ id: p.id })) });

  // Never prompt from here: the player turns notices on in Settings.
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  const kept = new Set(pending.filter((p) => !stale.includes(p)).map((p) => p.id));
  const fresh = notices.filter((n) => !kept.has(noticeNumber(n.id)) && n.at > Date.now() + 1000);
  if (fresh.length === 0) return;
  await LocalNotifications.schedule({
    notifications: fresh.map((n) => ({
      id: noticeNumber(n.id),
      title: n.title,
      body: n.body,
      schedule: { at: new Date(n.at), allowWhileIdle: true },
      extra: { runId: n.id },
    })),
  });
}
