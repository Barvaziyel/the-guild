/**
 * "Your crew is back" notices. In a browser they can only fire while the page
 * is open (the tab may be in the background). The Android app uses Capacitor's
 * local notifications, which the system fires with the app closed.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { syncNotices } from './notice-sync.ts';
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
 * closed. Each notice carries its id, so tapping it opens what it's about, and
 * its time, so it can be moved. They're exact: the app has the alarms
 * permission (USE_EXACT_ALARM, 3.7.4), or a reminder could come after the
 * thing it reminds you of.
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
  const held = (await LocalNotifications.getPending()).notifications;
  const { cancel, schedule } = syncNotices(held, notices, Date.now());
  if (cancel.length > 0) await LocalNotifications.cancel({ notifications: cancel.map((id) => ({ id })) });

  // Never prompt from here: the player turns notices on in Settings.
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  if (schedule.length === 0) return;
  await LocalNotifications.schedule({
    notifications: schedule.map((n) => ({
      id: noticeNumber(n.id),
      title: n.title,
      body: n.body,
      schedule: { at: new Date(n.at), allowWhileIdle: true },
      extra: { runId: n.id, at: n.at, ...(n.until !== undefined ? { until: n.until } : {}) },
    })),
  });
}
