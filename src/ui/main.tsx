import '@fontsource-variable/big-shoulders-stencil/wght.css';
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
import { memoryStore, type KeyValueStore } from './persist.ts';
import { createPrefsStore } from './prefs.ts';
import { createGameStore, randomSeed } from './store.ts';
import { startTour } from './components/TourCard.tsx';

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

window.history.scrollRestoration = 'manual';
const kv = deviceStorage();
const prefs = createPrefsStore(kv);
const services: AppServices = {
  // A new guild starts with the tour.
  store: createGameStore(kv, { now: () => Date.now(), newSeed: randomSeed, onNewGuild: (state) => startTour(prefs, state) }),
  prefs,
  notifier: isNative() ? nativeNotifier() : webNotifier(),
};

setupNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesContext.Provider value={services}>
      <App />
    </ServicesContext.Provider>
  </StrictMode>,
);
