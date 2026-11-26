import '@fontsource-variable/big-shoulders-stencil/wght.css';
import '@fontsource-variable/caveat/wght.css';
import '@fontsource/atkinson-hyperlegible-next/latin-400.css';
import '@fontsource/atkinson-hyperlegible-next/latin-400-italic.css';
import '@fontsource/atkinson-hyperlegible-next/latin-700.css';
import './styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { ServicesContext, type AppServices } from './hooks.ts';
import { isNative, setupNative } from './native.ts';
import { nativeNotifier, webNotifier } from './notify.ts';
import { appDisk } from './files.ts';
import { SAVE_KEY, memoryStore, type KeyValueStore } from './persist.ts';
import { dayStamp, mirrorSaves, reconcileSave, type Disk } from './save-disk.ts';
import { createPrefsStore } from './prefs.ts';
import { createGameStore, randomSeed } from './store.ts';
import { startTour } from './components/TourCard.tsx';
import { SoundSystem } from './audio.ts';

/** localStorage, or memory if the device won't give us any (the game then warns that it can't save). */
function deviceStorage(): KeyValueStore {
  try {
    const probe = 'the-guild:probe';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const fallback = memoryStore();
    return {
      ...fallback,
      setItem: () => {
        throw new Error('this browser is not letting the game store anything');
      },
    };
  }
}

/**
 * Start the game. In the app the save also lives in a file (3.9.1): before the game loads, a save
 * that only the file still has is put back, and from then on every save is written there too.
 */
async function boot(): Promise<void> {
  window.history.scrollRestoration = 'manual';
  const device = deviceStorage();
  let kv: KeyValueStore = device;
  let disk: Disk | null = null;
  let flush: (() => Promise<void>) | undefined;
  if (isNative()) {
    disk = appDisk();
    const { seq, fileBehind } = await reconcileSave(device, disk);
    const mirror = mirrorSaves(device, disk, { seq, today: () => dayStamp(Date.now()), initial: fileBehind ? device.getItem(SAVE_KEY) : null });
    kv = mirror.kv;
    flush = mirror.flush;
  }
  const prefs = createPrefsStore(kv);
  const services: AppServices = {
    // A new guild starts with the tour.
    store: createGameStore(kv, { now: () => Date.now(), newSeed: randomSeed, onNewGuild: (state) => startTour(prefs, state) }),
    prefs,
    notifier: isNative() ? nativeNotifier() : webNotifier(),
    sound: new SoundSystem(),
    disk,
  };

  setupNative(services.sound, flush);

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ServicesContext.Provider value={services}>
        <App />
      </ServicesContext.Provider>
    </StrictMode>,
  );
}

void boot();
