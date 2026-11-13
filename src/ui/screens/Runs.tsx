import { getLocation, ledFightNow, radioWaiting, type GameState } from '../../engine/index.ts';
import { navigate, useNow } from '../hooks.ts';
import { activeRuns, backIn, joinNames, latestBeat, reportItems, runCrewNames, runProgress, unreadCount } from '../runs-view.ts';

export function Runs({ state }: { state: GameState }) {
  // Its own clock, so a crew that just left already shows their first beat.
  const now = useNow(10_000);
  const out = activeRuns(state);
  const reports = reportItems(state);
  const unread = unreadCount(state);

  return (
    <section aria-labelledby="runs-title">
      <div className="screen-head">
        <h2 id="runs-title" className="screen-title">
          Runs
        </h2>
        <p className="screen-sub">
          {out.length === 0 ? 'No crews out' : `${out.length} ${out.length === 1 ? 'crew' : 'crews'} out`}
          {unread > 0 && `, ${unread} new ${unread === 1 ? 'report' : 'reports'}`}
        </p>
      </div>

      <div className="panel">
        <h3 className="panel-title">Out now</h3>
        {out.length === 0 ? (
          <>
            <p className="panel-help">Nobody is out. Pick a place on the Reach map to send a crew.</p>
            <button type="button" className="btn" onClick={() => navigate({ screen: 'reach' }, { replace: true })}>
              Open the map
            </button>
          </>
        ) : (
          <ul className="run-cards">
            {out.map((run) => {
              const beat = latestBeat(run, now);
              const pct = Math.round(runProgress(run, now) * 100);
              return (
                <li key={run.id}>
                  <button type="button" className="run-card" onClick={() => navigate({ screen: 'run', id: run.id })}>
                    <span className="run-card-place">{getLocation(run.plan.locationId).name}</span>
                    <span className="run-card-crew">{joinNames(runCrewNames(run))}</span>
                    {ledFightNow(run, now) ? (
                      <span className="run-card-beat is-calling">In a fight, waiting for your orders</span>
                    ) : radioWaiting(run, now) ? (
                      <span className="run-card-beat is-calling">On the radio now, waiting for your answer</span>
                    ) : (
                      beat && <span className="run-card-beat">Last heard: {beat.title.toLowerCase()}</span>
                    )}
                    <span className="run-track" aria-hidden="true">
                      <span className="run-fill" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="run-card-back">{backIn(run, now)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="panel">
        <h3 className="panel-title">Reports</h3>
        {reports.length === 0 ? (
          <p className="panel-help">When a crew comes home, the story of their run is kept here.</p>
        ) : (
          <ul className="report-list">
            {reports.map((r) => (
              <li key={r.report.id}>
                <button type="button" className={`report-row${r.report.read ? '' : ' is-unread'}`} onClick={() => navigate({ screen: 'run', id: r.report.id })}>
                  <span className={`report-dot tone-${r.tone}`} aria-hidden="true" />
                  <span className="report-body">
                    <span className="report-headline">{r.headline}</span>
                    <span className="report-meta">
                      {r.crew}. Day {r.day}.{r.report.read ? '' : ' New.'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
