/**
 * The Android app's extras: the hardware back button, catching up when the
 * app comes back to the foreground, opening a report from its notice, and
 * clearing the game's notices once it's open.
 * In a browser all of this is skipped.
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { SoundSystem } from './audio.ts';
import { navigate } from './hooks.ts';
import { staleNotice } from './notice-sync.ts';
import { noticeRoute } from './radio-view.ts';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function setupNative(sound: SoundSystem): void {
  // Sound stops while the game is in the background, in a browser tab too.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sound.pause();
    else sound.resume();
  });
  if (!isNative()) return;

  void App.addListener('pause', () => sound.pause());

  // Notices already in the shade are about what the game now shows: clear them,
  // or yesterday's are still there tomorrow, looking like new ones.
  const clearShade = (): void => void LocalNotifications.removeAllDeliveredNotifications().catch(() => undefined);
  clearShade();
  // One Android held back until what it was about is over (it lets a pile of them go when the game
  // is opened after a day away) is taken down as it comes. The plugin keeps the event for us until
  // this listener is added, so ones let go as the game starts are caught too.
  void LocalNotifications.addListener('localNotificationReceived', (n) => {
    if (staleNotice(n.extra, Date.now())) void LocalNotifications.removeDeliveredNotificationsById({ ids: [n.id] }).catch(() => undefined);
  });

  // Back goes back through the screens; from a tab, it puts the game in the background.
  void App.addListener('backButton', () => {
    const depth = (window.history.state as { depth?: number } | null)?.depth ?? 0;
    if (depth > 0) window.history.back();
    else void App.minimizeApp();
  });

  // Coming back to the game: let the clock catch up (useNow listens for this).
  void App.addListener('resume', () => {
    clearShade();
    sound.resume();
    document.dispatchEvent(new Event('visibilitychange'));
  });

  // Tapping a notice opens what it's about: a crew's run, or the Depot.
  void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const id: unknown = action.notification.extra?.runId;
    if (typeof id === 'string') navigate(noticeRoute(id));
  });
}
