/**
 * "Your crew is back" notices. In a browser they can only fire while the page
 * is open (the tab may be in the background). The Android app uses Capacitor's
 * local notifications, which the system fires with the app closed.
 */
import { LocalNotifications } from '@capacitor/local-notifications';
import { syncNotices } from './notice-sync.ts';
import { noticeNumber, type PlannedNotice } from './runs-view.ts';

export type NoticePermission = 'granted' | 'denied' | 'default' | 'unsupported';
/** Whether notices may come exactly on time (Android's "Alarms & reminders"). */
export type ExactAlarms = 'granted' | 'denied' | 'unsupported';

export interface Notifier {
  permission(): NoticePermission;
  /** Ask the player. Resolves to whether notices are allowed now. */
  request(): Promise<boolean>;
  /** Make the scheduled notices exactly these (adds new ones, drops the rest). */
  sync(notices: readonly PlannedNotice[]): void;
  /** Whether notices may come on the minute, as last read. Without it Android may hold them back a while. */
  exact(): ExactAlarms;
  /** Read it again from the system. */
  checkExact(): Promise<ExactAlarms>;
  /** Open the system page where the player lets notices come on time. Resolves to whether they may now. */
  allowExact(): Promise<boolean>;
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
    exact: () => 'unsupported',
    checkExact: async () => 'unsupported',
    allowExact: async () => false,
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
 * its time, so it can be moved.
 *
 * On time (3.9.1): an exact alarm needs the player's yes since Android 14
 * (`SCHEDULE_EXACT_ALARM`, "Alarms & reminders"). Until 3.9.1 the app had
 * `USE_EXACT_ALARM`, granted on install, but Google Play only allows that one
 * in alarm clock and calendar apps. Without the yes a notice is inexact and
 * may come late; the notices are written for that (clock times, and late ones
 * taken down, 3.7.4). Each notice says which it wants: asking for an exact one
 * without the yes would open the settings page on every sync.
 */
export function nativeNotifier(): Notifier {
  let permission: NoticePermission = 'default';
  let exact: ExactAlarms = 'unsupported';
  const toPermission = (display: string): NoticePermission => (display === 'granted' ? 'granted' : display === 'denied' ? 'denied' : 'default');
  void LocalNotifications.checkPermissions().then((p) => (permission = toPermission(p.display)));

  const readExact = async (): Promise<ExactAlarms> => {
    try {
      exact = (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted' ? 'granted' : 'denied';
    } catch {
      exact = 'unsupported';
    }
    return exact;
  };
  void readExact();

  // Calls are chained so two syncs never race each other.
  let queue: Promise<void> = Promise.resolve();
  let last: readonly PlannedNotice[] = [];
  /**
   * How the held notices were scheduled; when that changes they're all scheduled again. Kept on the
   * phone: taking the yes back restarts the app, and Android drops the exact alarms while the
   * plugin still lists them as pending.
   */
  let scheduledExact: boolean | null = readExactMark();
  const run = (notices: readonly PlannedNotice[]): void => {
    last = notices;
    queue = queue
      .then(async () => {
        const onTime = (await readExact()) !== 'denied';
        // Unknown (the first sync since 3.9.1, which took USE_EXACT_ALARM away) counts as changed.
        await syncNative(notices, onTime, scheduledExact !== onTime);
        scheduledExact = onTime;
        writeExactMark(onTime);
      })
      .catch(() => undefined);
  };

  return {
    permission: () => permission,
    exact: () => exact,
    checkExact: readExact,
    async request() {
      const p = await LocalNotifications.requestPermissions();
      permission = toPermission(p.display);
      return permission === 'granted';
    },
    sync: run,
    async allowExact() {
      try {
        exact = (await LocalNotifications.changeExactNotificationSetting()).exact_alarm === 'granted' ? 'granted' : 'denied';
      } catch {
        await readExact();
      }
      // Back from the settings page: the ones already set are scheduled again, on time this time.
      run(last);
      return exact === 'granted';
    },
  };
}

const EXACT_MARK = 'the-guild:notices:exact';

function readExactMark(): boolean | null {
  try {
    const v = window.localStorage.getItem(EXACT_MARK);
    return v === null ? null : v === '1';
  } catch {
    return null;
  }
}

function writeExactMark(onTime: boolean): void {
  try {
    window.localStorage.setItem(EXACT_MARK, onTime ? '1' : '0');
  } catch {
    // Nothing to do: at worst the held notices are scheduled again next time.
  }
}

/**
 * Make the system's pending notices match `notices`: cancel the rest, (re)schedule what's missing or moved.
 * `again`: everything held is scheduled anew (the player let notices come on time, or took that back).
 */
async function syncNative(notices: readonly PlannedNotice[], onTime: boolean, again: boolean): Promise<void> {
  const held = (await LocalNotifications.getPending()).notifications;
  const { cancel, schedule } = again ? { cancel: held.map((p) => p.id), schedule: syncNotices([], notices, Date.now()).schedule } : syncNotices(held, notices, Date.now());
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
      isExactNotification: onTime,
      extra: { runId: n.id, at: n.at, ...(n.until !== undefined ? { until: n.until } : {}) },
    })),
  });
}
