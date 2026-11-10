import { useLayoutEffect } from 'react';
import { dayAt, type GameState } from '../engine/index.ts';
import { navigate, savedScroll, useHash, useNow, useRoute, useSnapshot } from './hooks.ts';
import { tabFor, type TabScreen } from './route.ts';
import { LoadError } from './screens/LoadError.tsx';
import { Memorial } from './screens/Memorial.tsx';
import { Roster } from './screens/Roster.tsx';
import { Settings } from './screens/Settings.tsx';
import { SurvivorSheet } from './screens/SurvivorSheet.tsx';
import { findAnySurvivor, resourceList } from './view.ts';

export function App() {
  const snap = useSnapshot();
  const route = useRoute();
  const hash = useHash();
  const now = useNow();

  // Each screen opens at the top, or where it was left when coming back to it.
  useLayoutEffect(() => {
    window.scrollTo(0, savedScroll(hash));
  }, [hash]);

  if (snap.status === 'broken') return <LoadError message={snap.message} raw={snap.raw} />;

  const { state } = snap;
  const day = dayAt(state, now);
  const sheetOf = route.screen === 'survivor' ? findAnySurvivor(state, route.id) : undefined;
  const tab = tabFor(route, sheetOf?.status === 'dead');

  let screen;
  switch (route.screen) {
    case 'roster':
      screen = <Roster state={state} day={day} />;
      break;
    case 'memorial':
      screen = <Memorial state={state} day={day} />;
      break;
    case 'settings':
      screen = <Settings state={state} now={now} day={day} />;
      break;
    case 'survivor':
      screen = <SurvivorSheet state={state} id={route.id} tab={route.tab} day={day} />;
      break;
  }

  return (
    <div className="app">
      {route.screen !== 'survivor' && <TopBar state={state} day={day} />}
      {snap.saveError && (
        <p className="banner" role="alert">
          {snap.saveError} Your progress is kept until you close the game. Export the save from Settings to be safe.
        </p>
      )}
      <main className="screen">{screen}</main>
      <TabBar current={tab} />
    </div>
  );
}

function TopBar({ state, day }: { state: GameState; day: number }) {
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1 className="guild-name">{state.guildName}</h1>
        <span className="day">Day {day}</span>
      </div>
      <ul className="resources" aria-label="Supplies at the Depot">
        {resourceList(state).map((r) => (
          <li key={r.id}>
            <span className="res-name">{r.name}</span> <span className="res-amount">{r.amount}</span>
          </li>
        ))}
      </ul>
    </header>
  );
}

const TABS: { screen: TabScreen; label: string }[] = [
  { screen: 'roster', label: 'Roster' },
  { screen: 'memorial', label: 'Memorial' },
  { screen: 'settings', label: 'Settings' },
];

function TabBar({ current }: { current: TabScreen }) {
  return (
    <nav className="tabbar" aria-label="Screens">
      {TABS.map((t) => (
        <button
          key={t.screen}
          type="button"
          className="tab"
          aria-current={t.screen === current ? 'page' : undefined}
          onClick={() => navigate({ screen: t.screen }, { replace: true })}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
