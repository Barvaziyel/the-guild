import { useEffect, useLayoutEffect, useState } from 'react';
import { advanceTime, dayAt, dueRuns, getLocation, nextDayAt, type AdvanceResult, type DepotSummary, type GameState } from '../engine/index.ts';
import { mergeSummaries } from './depot-view.ts';
import { TourCard } from './components/TourCard.tsx';
import { navigate, savedScroll, useHash, useNow, usePrefs, useRoute, useServices, useSnapshot } from './hooks.ts';
import { tabFor, type Route, type TabScreen } from './route.ts';
import { joinNames, noticesFor, reportFirstNames, unreadCount } from './runs-view.ts';
import { dilemmaNotices } from './dilemma-view.ts';
import { rescueNotices } from './rescue-view.ts';
import { Building } from './screens/Building.tsx';
import { Depot } from './screens/Depot.tsx';
import { Gear } from './screens/Gear.tsx';
import { Vehicles } from './screens/Vehicles.tsx';
import { LoadError } from './screens/LoadError.tsx';
import { Memorial } from './screens/Memorial.tsx';
import { Planner } from './screens/Planner.tsx';
import { Reach } from './screens/Reach.tsx';
import { Recruits } from './screens/Recruits.tsx';
import { Roster } from './screens/Roster.tsx';
import { Runs } from './screens/Runs.tsx';
import { RunView } from './screens/RunView.tsx';
import { Settings } from './screens/Settings.tsx';
import { SurvivorSheet } from './screens/SurvivorSheet.tsx';
import { tourStep } from './tour.ts';
import { resourceList } from './view.ts';

/** Screens that have their own back bar instead of the guild header. */
const DETAIL_SCREENS: Route['screen'][] = ['survivor', 'plan', 'run', 'building', 'recruits', 'gear'];

export function App() {
  const snap = useSnapshot();
  const route = useRoute();
  const hash = useHash();
  const state = snap.status === 'ready' ? snap.state : null;
  // Wake for the next crew home or the next Depot day, whichever comes first.
  const wakeAt = state ? Math.min(nextDayAt(state, Date.now()), ...state.runs.map((r) => r.returnAt)) : undefined;
  const now = useNow(30_000, wakeAt);
  const time = useTime(state, now, route);
  useNotices(state);
  const { tour } = usePrefs();

  // Each screen opens at the top, or where it was left when coming back to it.
  useLayoutEffect(() => {
    window.scrollTo(0, savedScroll(hash));
  }, [hash]);

  if (snap.status === 'broken') return <LoadError message={snap.message} raw={snap.raw} />;
  const s = snap.state;
  const day = dayAt(s, now);

  let screen;
  switch (route.screen) {
    case 'depot':
      screen = <Depot state={s} now={now} tab={route.tab ?? 'today'} away={time.away} onDismissAway={time.dismissAway} />;
      break;
    case 'building':
      screen = <Building key={route.id} state={s} id={route.id} />;
      break;
    case 'recruits':
      screen = <Recruits state={s} day={day} />;
      break;
    case 'gear':
      screen = <Gear state={s} />;
      break;
    case 'vehicles':
      screen = <Vehicles state={s} />;
      break;
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
      screen = <Reach state={s} {...(route.id ? { selected: route.id } : {})} {...(route.tab ? { tab: route.tab } : {})} />;
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

  const touring = tourStep(tour) !== undefined;

  return (
    <div className={touring ? 'app is-touring' : 'app'}>
      {!DETAIL_SCREENS.includes(route.screen) && <TopBar state={s} day={day} />}
      {snap.saveError && (
        <p className="banner" role="alert">
          {snap.saveError} Your progress is kept until you close the game. Export the save from Settings to be safe.
        </p>
      )}
      <main className="screen">{screen}</main>
      {time.current && <ReturnToast state={s} reportId={time.current} more={time.more} onClose={time.dismiss} />}
      {touring && tour && <TourCard state={s} stepId={tour} />}
      <TabBar current={tabFor(route)} unread={unreadCount(s)} deciding={s.dilemmas.active !== undefined} />
    </div>
  );
}

/**
 * Let time pass (on opening the game, at each new Depot day and when a crew is
 * due): play the Depot days and bring crews home. Remembers which reports
 * arrived while the player was looking at something else, and what the Depot
 * days brought, for the "while you were away" note.
 */
function useTime(state: GameState | null, now: number, route: Route) {
  const { store } = useServices();
  const [pending, setPending] = useState<string[]>([]);
  const [away, setAway] = useState<DepotSummary | null>(null);
  const behind = state ? dueRuns(state, now).length > 0 || dayAt(state, now) > state.depot.lastDay : false;

  useEffect(() => {
    if (!behind) return;
    const out: { result?: AdvanceResult } = {};
    store.update((s) => {
      out.result = advanceTime(s, Date.now());
    });
    const { result } = out;
    if (!result) return;
    const days = result.depot;
    if (days.days > 0) setAway((a) => (a ? mergeSummaries(a, days) : days));
    // Someone watching the run turn into a report doesn't need telling.
    const watching = route.screen === 'run' ? route.id : undefined;
    const news = result.reports.map((r) => r.id).filter((id) => id !== watching);
    if (news.length > 0) setPending((p) => [...p, ...news]);
  }, [behind, now, store, route]);

  // Reports opened some other way don't need a banner.
  const unread = pending.filter((id) => state?.reports.some((r) => r.id === id && !r.read));
  const current = unread[unread.length - 1];
  return {
    current,
    more: Math.max(0, unread.length - 1),
    dismiss: () => setPending([]),
    away,
    dismissAway: () => setAway(null),
  };
}

/** Keep "crew is back" notices in step with the crews that are out. */
function useNotices(state: GameState | null): void {
  const { notifier } = useServices();
  const { notify } = usePrefs();
  const d = state?.dilemmas.active;
  const call = state?.rescue.call;
  const key = state
    ? [
        ...state.runs.map((r) => `${r.id}@${r.returnAt}`),
        d ? `d${d.day}` : `n${state.dilemmas.nextDay}`,
        call ? `c${call.day}${call.runId ?? ''}` : `h${state.rescue.nextDay}@${state.buildings.radio_tower ?? 0}`,
      ].join(',')
    : '';
  useEffect(() => {
    notifier.sync(notify && state ? [...noticesFor(state), ...dilemmaNotices(state), ...rescueNotices(state)] : []);
    // Re-sync only when the crews, their return times, or the decisions due change.
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
      <ul className="resources" aria-label="Supplies at the Depot" data-tour="resources">
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
  { screen: 'depot', label: 'Depot' },
  { screen: 'roster', label: 'Roster' },
  { screen: 'reach', label: 'Reach' },
  { screen: 'runs', label: 'Runs' },
  { screen: 'settings', label: 'Settings' },
];

function TabBar({ current, unread, deciding }: { current: TabScreen; unread: number; deciding: boolean }) {
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
          {t.screen === 'depot' && deciding && (
            <span className="badge" aria-label=", something to decide">
              !
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
