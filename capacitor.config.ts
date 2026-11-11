import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor wraps the built web app (dist/) in an Android app.
 * The app id must never change: Android treats a new id as a different app,
 * and the save (in the app's storage) would not carry over.
 */
const config: CapacitorConfig = {
  appId: 'io.github.barvaziyel.theguild',
  appName: 'The Guild',
  webDir: 'dist',
  android: {
    // The depot steel, so there's no white flash before the game draws.
    backgroundColor: '#24332f',
  },
  plugins: {
    SystemBars: {
      // Inject --safe-area-inset-* CSS variables; older Android WebViews report env() wrongly.
      insetsHandling: 'css',
      // Light status bar icons on the dark game.
      style: 'DARK',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_guild',
      iconColor: '#a64d27',
    },
  },
};

export default config;
