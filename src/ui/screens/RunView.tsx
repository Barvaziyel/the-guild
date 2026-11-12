import { useEffect } from 'react';
import {
  amountOf,
  dayAt,
  getLocation,
  markReportRead,
  visibleBeats,
  type GameState,
  type Run,
  type RunReport,
  type Survivor,
} from '../../engine/index.ts';
import { BeatLog } from '../components/BeatLog.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { skipToReturn } from '../dev.ts';
import { goBack, navigate, useNow, usePrefs, useServices } from '../hooks.ts';
import {
  APPROACHES,
  JOBS,
  RETREATS,
  changesByPerson,
  choiceName,
  firstNames,
  formatCountdown,
  formatDuration,
  lootList,
  vehicleOutcomes,
  outcomeHeadline,
  outcomeTone,
  reportFirstNames,
  runProgress,
} from '../runs-view.ts';
import { clockTime } from '../time.ts';
import { foundLines, rescueLine, rescuedWhere } from '../rescue-view.ts';
import { followedHome } from '../animals-view.ts';
import { findAnySurvivor } from '../view.ts';

export function RunView({ state, id }: { state: GameState; id: string }) {
  const run = state.runs.find((r) => r.id === id);
  const report = state.reports.find((r) => r.id === id);
  return (
    <article className="sheet run-view">
      <div className="sheet-nav">
        <button type="button" className="back" onClick={() => goBack({ screen: 'runs' })}>
          <span aria-hidden="true">&lsaquo;</span> Runs
        </button>
      </div>
      {run ? (
        <ActiveRun state={state} run={run} />
      ) : report ? (
        <Report state={state} report={report} />
      ) : (
        <p className="empty">This run isn&rsquo;t in the guild&rsquo;s records any more. Only the last 20 reports are kept.</p>
      )}
    </article>
  );
}

function ordersLine(plan: Run['plan']): string {
  return `${choiceName(JOBS, plan.job)}, ${choiceName(APPROACHES, plan.approach).toLowerCase()}. Pull out when: ${choiceName(RETREATS, plan.retreat).toLowerCase()}.`;
}

function CrewStrip({ crew, faded }: { crew: { id: string; name: string; survivor: Survivor | undefined }[]; faded?: Set<string> }) {
  return (
    <ul className="crew-strip">
      {crew.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            className="crew-face"
            disabled={!c.survivor}
            onClick={() => c.survivor && navigate({ screen: 'survivor', id: c.id, tab: 'stats' })}
          >
            {c.survivor && <Portrait survivor={c.survivor} size={64} memorial={faded?.has(c.id) ?? false} decorative />}
            <span>{c.name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------- a crew that is out

function ActiveRun({ state, run }: { state: GameState; run: Run }) {
  const now = useNow(1000, run.returnAt);
  const { store } = useServices();
  const { devTools } = usePrefs();
  const loc = getLocation(run.plan.locationId);
  const beats = visibleBeats(run, now);
  const left = run.returnAt - now;
  const crew = run.plan.crew.map((cid) => ({
    id: cid,
    name: run.result.crew.find((c) => c.id === cid)?.firstName ?? cid,
    survivor: state.survivors.find((s) => s.id === cid),
  }));

  return (
    <>
      <header className="sheet-head">
        <p className="place-biome">Out at</p>
        <h2 className="plan-title">{loc.name}</h2>
        <p className="place-facts">{ordersLine(run.plan)}</p>
        <CrewStrip crew={crew} />
        <div className="countdown">
          <span className="countdown-time" role="timer" aria-live="off">
            {formatCountdown(left)}
          </span>
          <span className="countdown-text">
            {left > 0 ? `until they're due back, at ${clockTime(run.returnAt)}` : 'They should be at the gate now.'}
          </span>
          <span className="run-track" aria-hidden="true">
            <span className="run-fill" style={{ width: `${Math.round(runProgress(run, now) * 100)}%` }} />
          </span>
        </div>
        {devTools && left > 0 && (
          <button
            type="button"
            className="btn btn-small dev-btn"
            onClick={() =>
              store.update((s) => {
                skipToReturn(s, Date.now(), run.id);
              })
            }
          >
            Skip ahead until they&rsquo;re back
          </button>
        )}
      </header>
      <section className="panel" aria-labelledby="log-title">
        <h3 id="log-title" className="panel-title">
          So far
        </h3>
        <BeatLog beats={beats} names={firstNames(run.result.crew)} more={beats.length < run.beats.length} />
      </section>
    </>
  );
}

// ---------------------------------------------------------------- the report

function Report({ state, report }: { state: GameState; report: RunReport }) {
  const { store } = useServices();
  useEffect(() => {
    if (!report.read) store.update((s) => markReportRead(s, report.id));
  }, [report.id, report.read, store]);

  const loc = getLocation(report.plan.locationId);
  const s = report.summary;
  const tone = outcomeTone(s);
  const dead = new Set(s.deaths.map((d) => d.survivorId));
  const names = reportFirstNames(report);
  const crew = report.plan.crew.map((cid) => ({ id: cid, name: names[cid] ?? cid, survivor: findAnySurvivor(state, cid) }));
  const loot = lootList(s);
  const rescue = rescueLine(s);
  const rescuedAt = rescuedWhere(state, s);
  const changes = changesByPerson(report);

  return (
    <>
      <header className="sheet-head">
        <p className="place-biome">
          Day {dayAt(state, report.returnAt)}, {formatDuration(report.returnAt - report.departAt)} away
        </p>
        <h2 className={`plan-title outcome-${tone}`}>{outcomeHeadline(s.outcome, loc.name)}</h2>
        <p className="place-facts">{ordersLine(report.plan)}</p>
        <CrewStrip crew={crew} faded={dead} />
      </header>

      <section className="panel report-summary" aria-label="Summary">
        {s.deaths.map((d) => (
          <p key={d.survivorId} className="summary-death">
            {d.name} died. {d.cause}.
          </p>
        ))}
        {rescue && (
          <p className={s.rescue!.outcome === 'saved' ? 'summary-found' : 'summary-death'}>
            {rescue}{' '}
            {rescuedAt === 'sheet' && (
              <button type="button" className="link" onClick={() => navigate({ screen: 'survivor', id: s.rescue!.person.id, tab: 'stats' })}>
                See {s.rescue!.person.firstName}
              </button>
            )}
            {rescuedAt === 'gate' && (
              <button type="button" className="link" onClick={() => navigate({ screen: 'recruits' })}>
                {s.rescue!.person.firstName} is waiting at the gate for a bed
              </button>
            )}
          </p>
        )}
        <p>{loot.length > 0 ? `Brought home ${loot.join(', ')}.` : 'Brought nothing home.'}</p>
        {foundLines(state, s, report.plan.locationId).map((f) => (
          <p key={f.id} className="summary-found">
            {f.text}{' '}
            {f.where === 'sheet' && (
              <button type="button" className="link" onClick={() => navigate({ screen: 'survivor', id: f.id, tab: 'stats' })}>
                Open their sheet
              </button>
            )}
            {f.where === 'gate' && (
              <button type="button" className="link" onClick={() => navigate({ screen: 'recruits' })}>
                Waiting at the gate for a bed
              </button>
            )}
          </p>
        ))}
        {followedHome(s, names).map((line) => (
          <p key={line} className="summary-found">
            {line}{' '}
            <button type="button" className="link" onClick={() => navigate({ screen: 'depot', tab: 'yard' })}>
              See the yard
            </button>
          </p>
        ))}
        {s.items.length > 0 && (
          <p className="summary-minor">
            The gear went into the stash.{' '}
            <button type="button" className="text-link" onClick={() => navigate({ screen: 'gear' })}>
              See the gear
            </button>
          </p>
        )}
        {vehicleOutcomes(s).map((line) => (
          <p key={line} className="summary-minor">
            {line}
          </p>
        ))}
        {(s.foundVehicles ?? []).length > 0 && (
          <p className="summary-minor">
            It&rsquo;s at the Depot now.{' '}
            <button type="button" className="text-link" onClick={() => navigate({ screen: 'vehicles' })}>
              See the vehicles
            </button>
          </p>
        )}
        {s.leftBehind > 0 && <p className="summary-minor">Left {s.leftBehind} loads behind: too much to carry.</p>}
        {(s.medsLeft > 0 || s.ammoLeft > 0) && (
          <p className="summary-minor">
            Unused supplies back in the store: {[s.medsLeft > 0 && amountOf('meds', s.medsLeft), s.ammoLeft > 0 && amountOf('ammo', s.ammoLeft)].filter(Boolean).join(', ')}.
          </p>
        )}
        {s.exploredGain > 0 && <p className="summary-minor">Explored {loc.name} a little more (+{s.exploredGain}%).</p>}
        {s.discovered.map((d) => (
          <p key={d} className="summary-found">
            Found the way to {getLocation(d).name}.{' '}
            <button type="button" className="link" onClick={() => navigate({ screen: 'reach', id: d })}>
              Show it on the map
            </button>
          </p>
        ))}
      </section>

      <section className="panel" aria-labelledby="log-title">
        <h3 id="log-title" className="panel-title">
          The log
        </h3>
        <BeatLog beats={report.beats} names={names} />
      </section>

      {changes.length > 0 && (
        <section className="panel" aria-labelledby="changes-title">
          <h3 id="changes-title" className="panel-title">
            What changed
          </h3>
          <ul className="changes">
            {changes.map((g) => (
              <li key={g.survivorId} className={g.died ? 'is-dead' : undefined}>
                <button type="button" className="link change-name" onClick={() => navigate({ screen: 'survivor', id: g.survivorId, tab: 'story' })}>
                  {g.name}
                </button>
                <ul>
                  {g.changes.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="panel">
        <button type="button" className="btn btn-primary" onClick={() => navigate({ screen: 'plan', locationId: report.plan.locationId })}>
          Plan another run to {loc.name}
        </button>
      </div>
    </>
  );
}
