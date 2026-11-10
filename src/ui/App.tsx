import { useEffect, useLayoutEffect, useState } from 'react';
import { completeDueRuns, dayAt, dueRuns, getLocation, type GameState } from '../engine/index.ts';
import { navigate, savedScroll, useHash, useNow, usePrefs, useRoute, useServices, useSnapshot } from './hooks.ts';
import { tabFor, type Route, type TabScreen } from './route.ts';
import { joinNames, noticesFor, reportFirstNames, unreadCount } from './runs-view.ts';
import { LoadError } from './screens/LoadError.tsx';
import { Memorial } from './screens/Memorial.tsx';
import { Planner } from './screens/Planner.tsx';
import { Reach } from './screens/Reach.tsx';
import { Roster } from './screens/Roster.tsx';
import { Runs } from './screens/Runs.tsx';
import { RunView } from './screens/RunView.tsx';
import { Settings } from './screens/Settings.tsx';
import { SurvivorSheet } from './screens/SurvivorSheet.tsx';
import { resourceList } from './view.ts';

/** Screens that have their own back bar instead of the guild header. */
const DETAIL_SCREENS: Route['screen'][] = ['survivor', 'plan', 'run'];

export function App() {
  const snap = useSnapshot();
  const route = useRoute();
  const hash = useHash();
  const state = snap.status === 'ready' ? snap.state : null;
  const nextReturn = state && state.runs.length > 0 ? Math.min(...state.runs.map((r) => r.returnAt)) : undefined;
  const now = useNow(30_000, nextReturn);
  const returned = useReturns(state, now, route);
  useNotices(state);

  // Each screen opens at the top, or where it was left when coming back to it.
  useLayoutEffect(() => {
    window.scrollTo(0, savedScroll(hash));
  }, [hash]);

  if (snap.status === 'broken') return <LoadError message={snap.message} raw={snap.raw} />;
  const s = snap.state;
  const day = dayAt(s, now);

  let screen;
  switch (route.screen) {
    case 'roster':
      screen = <Roster state={s} day={day} now={now} />;
      break;
    case 'memorial':
      screen = <Memorial state={s} day={day} />;
      break;
    case 'settings':
      screen = <Settings state={s} now={now} day={day} />;
      break;
    case 'survivor':
      screen = <SurvivorSheet state={s} id={route.id} tab={route.tab} day={day} now={now} />;
      break;
    case 'reach':
      screen = <Reach state={s} {...(route.id ? { selected: route.id } : {})} />;
      break;
    case 'plan':
      screen = <Planner key={route.locationId} state={s} locationId={route.locationId} />;
      break;
    case 'runs':
      screen = <Runs state={s} />;
      break;
    case 'run':
      screen = <RunView key={route.id} state={s} id={route.id} />;
      break;
  }

  return (
    <div className="app">
      {!DETAIL_SCREENS.includes(route.screen) && <TopBar state={s} day={day} />}
      {snap.saveError && (
        <p className="banner" role="alert">
          {snap.saveError} Your progress is kept until you close the game. Export the save from Settings to be safe.
        </p>
      )}
      <main className="screen">{screen}</main>
      {returned.current && <ReturnToast state={s} reportId={returned.current} more={returned.more} onClose={returned.dismiss} />}
      <TabBar current={tabFor(route)} unread={unreadCount(s)} />
    </div>
  );
}

/**
 * Bring crews home as soon as they're due (also on opening the game), and
 * remember which reports arrived while the player was looking at something else.
 */
function useReturns(state: GameState | null, now: number, route: Route) {
  const { store } = useServices();
  const [pending, setPending] = useState<string[]>([]);
  const due = state ? dueRuns(state, now).length : 0;

  useEffect(() => {
    if (due === 0) return;
    let ids: string[] = [];
    store.update((s) => {
      ids = completeDueRuns(s, Date.now()).map((r) => r.id);
    });
    // Someone watching the run turn into a report doesn't need telling.
    const watching = route.screen === 'run' ? route.id : undefined;
    const news = ids.filter((id) => id !== watching);
    if (news.length > 0) setPending((p) => [...p, ...news]);
  }, [due, now, store, route]);

  // Reports opened some other way don't need a banner.
  const unread = pending.filter((id) => state?.reports.some((r) => r.id === id && !r.read));
  const current = unread[unread.length - 1];
  return {
    current,
    more: Math.max(0, unread.length - 1),
    dismiss: () => setPending([]),
  };
}

/** Keep "crew is back" notices in step with the crews that are out. */
function useNotices(state: GameState | null): void {
  const { notifier } = useServices();
  const { notify } = usePrefs();
  const key = state ? state.runs.map((r) => `${r.id}@${r.returnAt}`).join(',') : '';
  useEffect(() => {
    notifier.sync(notify && state ? noticesFor(state) : []);
    // Re-sync only when the set of crews or their return times change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, notify, notifier]);
}

function ReturnToast({ state, reportId, more, onClose }: { state: GameState; reportId: string; more: number; onClose: () => void }) {
  const report = state.reports.find((r) => r.id === reportId);
  if (!report) return null;
  const names = Object.values(reportFirstNames(report));
  const place = getLocation(report.plan.locationId).name;
  return (
    <div className="toast" role="status">
      <p>
        {joinNames(names)} {names.length === 1 ? 'is' : 'are'} back from {place}.{more > 0 && ` ${more} more ${more === 1 ? 'report' : 'reports'} waiting.`}
      </p>
      <div className="btn-row">
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={() => {
            onClose();
            navigate({ screen: 'run', id: reportId });
          }}
        >
          Read the report
        </button>
        <button type="button" className="btn btn-quiet btn-small" onClick={onClose}>
          Later
        </button>
      </div>
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
  { screen: 'reach', label: 'Reach' },
  { screen: 'runs', label: 'Runs' },
  { screen: 'settings', label: 'Settings' },
];

function TabBar({ current, unread }: { current: TabScreen; unread: number }) {
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
          {t.screen === 'runs' && unread > 0 && (
            <span className="badge" aria-label={`${unread} new`}>
              {unread}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
