import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { advanceTime, dayAt, dueRuns, getLocation, nextDayAt, returnUnsure, searchDue, type AdvanceResult, type DepotSummary, type GameState } from '../engine/index.ts';
import { mergeSummaries, nextDayView } from './depot-view.ts';
import { TourCard } from './components/TourCard.tsx';
import { navigate, savedScroll, useHash, useNow, usePrefs, useRoute, useMarkSeen, useSeen, useServices, useSnapshot } from './hooks.ts';
import { tabFor, type Route, type TabScreen } from './route.ts';
import { joinNames, noticesFor, reportFirstNames } from './runs-view.ts';
import { dilemmaNotices } from './dilemma-view.ts';
import { rescueNotices } from './rescue-view.ts';
import { familyNoticeKey, familyNotices } from './family-view.ts';
import { radioNoticeKey, radioNotices, radioWakeTimes } from './radio-view.ts';
import { raidNoticeKey, raidNotices, raidWakeTimes } from './raid-view.ts';
import { Raid } from './screens/Raid.tsx';
import { fightNoticeKey, fightNotices, fightWakeTimes } from './fight-view.ts';
import { cornerNoticeKey, cornerNotices, cornerWakeTimes } from './corners-view.ts';
import { Fight } from './screens/Fight.tsx';
import { Building } from './screens/Building.tsx';
import { Depot } from './screens/Depot.tsx';
import { Gear } from './screens/Gear.tsx';
import { Vehicles } from './screens/Vehicles.tsx';
import { LoadError } from './screens/LoadError.tsx';
import { Memorial } from './screens/Memorial.tsx';
import { Vultures } from './screens/Vultures.tsx';
import { Haven } from './screens/Haven.tsx';
import { Planner } from './screens/Planner.tsx';
import { Reach } from './screens/Reach.tsx';
import { Recruits } from './screens/Recruits.tsx';
import { Roster } from './screens/Roster.tsx';
import { Runs } from './screens/Runs.tsx';
import { RunView } from './screens/RunView.tsx';
import { Settings } from './screens/Settings.tsx';
import { SurvivorSheet } from './screens/SurvivorSheet.tsx';
import { tourStep } from './tour.ts';
import { TagTips } from './components/TagTips.tsx';
import { UrgentStrip } from './components/UrgentStrip.tsx';
import { Glyph } from './components/Glyph.tsx';
import { dots, seeStores, storesNews, type Dots } from './attention-view.ts';
import { resourceList } from './view.ts';
import { useSound } from './use-sound.ts';
import { COUNT_MS, changeText, countAt, screenKey } from './motion-view.ts';

/** Screens that have their own back bar instead of the guild header. */
const DETAIL_SCREENS: Route['screen'][] = ['survivor', 'plan', 'run', 'fight', 'raid', 'building', 'recruits', 'vultures'];

export function App() {
  const snap = useSnapshot();
  const route = useRoute();
  const hash = useHash();
  const state = snap.status === 'ready' ? snap.state : null;
  // Wake for the next crew home, the next Depot day, or a crew calling in (or giving up on an answer), whichever comes first.
  const wakeAt = state ? Math.min(nextDayAt(state, Date.now()), ...state.runs.filter((r) => !returnUnsure(r)).map((r) => r.returnAt), ...radioWakeTimes(state, Date.now()), ...fightWakeTimes(state, Date.now()), ...raidWakeTimes(state, Date.now()), ...cornerWakeTimes(state)) : undefined;
  const now = useNow(30_000, wakeAt);
  const time = useTime(state, now, route);
  useNotices(state);
  useSound(state, route, now);
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
      screen = <Depot state={s} now={now} tab={route.tab ?? 'yard'} away={time.away} onDismissAway={time.dismissAway} />;
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
      screen = <Planner key={route.locationId} state={s} locationId={route.locationId} step={route.step ?? 'crew'} />;
      break;
    case 'runs':
      screen = <Runs state={s} />;
      break;
    case 'run':
      screen = <RunView key={route.id} state={s} id={route.id} />;
      break;
    case 'raid':
      screen = <Raid state={s} />;
      break;
    case 'vultures':
      screen = <Vultures state={s} />;
      break;
    case 'haven':
      screen = <Haven state={s} tab={route.tab ?? 'leads'} />;
      break;
    case 'fight':
      screen = <Fight key={route.id} state={s} id={route.id} />;
      break;
  }

  const touring = tourStep(tour) !== undefined;

  return (
    <div className={touring ? 'app is-touring' : 'app'}>
      {!DETAIL_SCREENS.includes(route.screen) && <TopBar state={s} day={day} now={now} />}
      <UrgentStrip state={s} now={now} route={route} />
      {snap.saveError && (
        <p className="banner" role="alert">
          {snap.saveError} Your progress is kept until you close the game. Export the save from Settings to be safe.
        </p>
      )}
      {/* A new screen comes in; another tab of the same screen doesn't (3.2.0). */}
      <main className="screen" key={screenKey(route as { screen: string })}>
        {screen}
      </main>
      {/* Not over the report it points to: it's already open (3.7.0). */}
      {time.current && !(route.screen === 'run' && route.id === time.current) && <ReturnToast state={s} reportId={time.current} more={time.more} onClose={time.dismiss} />}
      {touring && tour && <TourCard state={s} stepId={tour} />}
      <TagTips />
      <TabBar current={tabFor(route)} state={s} now={now} touring={touring} />
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
  const behind = state ? dueRuns(state, now).length > 0 || dayAt(state, now) > state.depot.lastDay || searchDue(state, now) : false;

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
        familyNoticeKey(state),
        radioNoticeKey(state),
        fightNoticeKey(state),
        raidNoticeKey(state),
        cornerNoticeKey(state),
      ].join(',')
    : '';
  useEffect(() => {
    notifier.sync(notify && state ? [...noticesFor(state), ...dilemmaNotices(state), ...rescueNotices(state), ...familyNotices(state), ...radioNotices(state), ...fightNotices(state), ...raidNotices(state), ...cornerNotices(state)] : []);
    // Re-sync only when the crews, their return times, or the decisions due change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, notify, notifier]);
}

/** How long a "crew is back" toast stays. */
const TOAST_MS = 9000;

function ReturnToast({ state, reportId, more, onClose }: { state: GameState; reportId: string; more: number; onClose: () => void }) {
  // The bell keeps the report, so the toast steps aside by itself rather than sitting over the screen.
  useEffect(() => {
    const t = window.setTimeout(onClose, TOAST_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);
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

/** The day's dial (option B, Aviel 2.8.8): a ring that fills as the day goes. */
const DIAL_R = 11;
const DIAL_C = 2 * Math.PI * DIAL_R;

function TopBar({ state, day, now }: { state: GameState; day: number; now: number }) {
  const next = nextDayView(state, now);
  // What changed while the game was closed counts up (or down) the first time it's seen (3.7.0).
  const seen = useSeen(state);
  const [was] = useState(() => storesNews(state, seen));
  useMarkSeen(state, seeStores, [state.resources]);
  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1 className="guild-name">{state.guildName}</h1>
        <div className="topbar-right">
          <p className="day-block" data-tour="day">
            <svg className="day-dial" viewBox="0 0 30 30" aria-hidden="true">
              <circle className="day-dial-track" cx="15" cy="15" r={DIAL_R} />
              <circle className="day-dial-fill" cx="15" cy="15" r={DIAL_R} strokeDasharray={DIAL_C} strokeDashoffset={DIAL_C * (1 - next.progress)} transform="rotate(-90 15 15)" />
            </svg>
            <span className="day-text">
              <span className="day">Day {day}</span>
              <span className="day-next" aria-label={next.label}>
                {next.line}
              </span>
            </span>
          </p>
          <button type="button" className="cog-button" aria-label="Settings" onClick={() => navigate({ screen: 'settings' })}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Zm8.2 4.6-.1-2.4 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.1-1.2L15.2 3h-4l-.4 2.6c-.8.3-1.5.7-2.1 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2.1 1.2l.4 2.6h4l.4-2.6c.8-.3 1.5-.7 2.1-1.2l2.4 1 2-3.4-2-1.6Z" />
            </svg>
          </button>
        </div>
      </div>
      <ul className="resources" aria-label="Supplies at the Depot" data-tour="resources">
        {resourceList(state).map((r) => (
          <li key={r.id} aria-label={`${r.name} ${r.amount}`}>
            {/* A picture for each supply (3.6.0); the name is still read out. */}
            <Glyph name={r.id} className={`res-glyph res-${r.id}`} />
            <span className="res-name">{r.name}</span> <Amount value={r.amount} start={was[r.id]} />
          </li>
        ))}
      </ul>
    </header>
  );
}

/**
 * A supply's amount (3.2.0): when it changes, it counts to the new number and
 * flashes, with the change floating up beside it.
 */
function Amount({ value, start }: { value: number; start?: number | undefined }) {
  const [shown, setShown] = useState(start ?? value);
  const [change, setChange] = useState<{ text: string; up: boolean; n: number } | null>(null);
  const last = useRef(start ?? value);
  useEffect(() => {
    const from = last.current;
    last.current = value;
    if (from === value) return;
    const text = changeText(from, value);
    if (text) setChange((c) => ({ text, up: value > from, n: (c?.n ?? 0) + 1 }));
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const step = (t: number): void => {
      const elapsed = t - start;
      setShown(countAt(from, value, elapsed));
      if (elapsed < COUNT_MS) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  useEffect(() => {
    if (!change) return;
    const t = window.setTimeout(() => setChange(null), 1400);
    return () => window.clearTimeout(t);
  }, [change]);
  return (
    <span className="res-amount-box">
      <span key={change?.n ?? 0} className={`res-amount${change ? (change.up ? ' is-up' : ' is-down') : ''}`}>
        {shown}
      </span>
      {change && (
        <span key={`c${change.n}`} className={`res-change${change.up ? ' is-up' : ' is-down'}`} aria-hidden="true">
          {change.text}
        </span>
      )}
    </span>
  );
}

const TABS: { screen: TabScreen; label: string }[] = [
  { screen: 'depot', label: 'Depot' },
  { screen: 'roster', label: 'Roster' },
  { screen: 'gear', label: 'Gear' },
  { screen: 'reach', label: 'Reach' },
  { screen: 'runs', label: 'Runs' },
  { screen: 'haven', label: 'Haven' },
];

/**
 * The tabs, each with a red dot when something on it is new or waiting (3.5.0). Settings is behind the
 * cog in the header; the Haven tab is there once the broadcast is heard (§9.11).
 */
function TabBar({ current, state, now, touring }: { current: TabScreen; state: GameState; now: number; touring: boolean }) {
  const seen = useSeen(state);
  const d: Dots = dots(state, now, seen, { touring });
  const tabs = TABS.filter((t) => t.screen !== 'haven' || state.haven);
  return (
    <nav className={`tabbar${tabs.length > 5 ? ' is-six' : ''}`} aria-label="Screens" data-tour="tabbar">
      {tabs.map((t) => (
        <button
          key={t.screen}
          type="button"
          className="tab"
          aria-current={t.screen === current ? 'page' : undefined}
          onClick={() => navigate({ screen: t.screen }, { replace: true })}
        >
          <span className="tab-label">
            {t.label}
            {d.tabs[t.screen] && <span className="dot" aria-label=", something new" />}
          </span>
        </button>
      ))}
    </nav>
  );
}
