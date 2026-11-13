/**
 * The Android app's extras: the hardware back button, catching up when the
 * app comes back to the foreground, and opening a report from its notice.
 * In a browser all of this is skipped.
 */
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { navigate } from './hooks.ts';
import { noticeRoute } from './radio-view.ts';

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export function setupNative(): void {
  if (!isNative()) return;

  // Back goes back through the screens; from a tab, it puts the game in the background.
  void App.addListener('backButton', () => {
    const depth = (window.history.state as { depth?: number } | null)?.depth ?? 0;
    if (depth > 0) window.history.back();
    else void App.minimizeApp();
  });

  // Coming back to the game: let the clock catch up (useNow listens for this).
  void App.addListener('resume', () => document.dispatchEvent(new Event('visibilitychange')));

  // Tapping a notice opens what it's about: a crew's run, or the Depot.
  void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
    const id: unknown = action.notification.extra?.runId;
    if (typeof id === 'string') navigate(noticeRoute(id));
  });
}
