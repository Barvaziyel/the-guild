import { findLocation, getLocation, knownLocations, locationState, type GameState } from '../../engine/index.ts';
import { ReachMapSvg } from '../components/ReachMapSvg.tsx';
import { navigate } from '../hooks.ts';
import { dangerText, formatDuration, joinNames, locationView, radiationText, runCrewNames } from '../runs-view.ts';
import { nemesesAt, nemesisRows } from '../stories-view.ts';

export function Reach({ state, selected }: { state: GameState; selected?: string }) {
  const places = knownLocations(state);
  const pick = (id: string): void => navigate({ screen: 'reach', id }, { replace: true });
  const sel = selected && findLocation(selected) ? selected : undefined;

  return (
    <section aria-labelledby="reach-title">
      <div className="screen-head">
        <h2 id="reach-title" className="screen-title">
          The Reach
        </h2>
        <p className="screen-sub">
          {places.length} places known. Tap one to see it, or a question mark to see how to find it.
        </p>
      </div>
      <div className="map-page" data-tour="map">
        <ReachMapSvg state={state} selected={sel} onPick={pick} />
      </div>
      {sel && <PlacePanel state={state} id={sel} />}
      <div className="panel">
        <h3 className="panel-title">Known places</h3>
        <ul className="places">
          {[...places]
            .sort((a, b) => a.danger - b.danger || a.durationMin - b.durationMin)
            .map((loc) => {
              const here = locationState(state, loc.id);
              return (
                <li key={loc.id}>
                  <button type="button" className={`place-row${loc.id === sel ? ' is-selected' : ''}`} onClick={() => pick(loc.id)}>
                    <span className={`danger-dot d${loc.danger}`} aria-hidden="true">
                      {loc.danger}
                    </span>
                    <span className="place-body">
                      <span className="place-name">{loc.name}</span>
                      <span className="place-facts">
                        {dangerText(loc.danger)}, {radiationText(loc.radiation).toLowerCase()}, {formatDuration(loc.durationMin * 60_000)}
                      </span>
                    </span>
                    <span className="place-explored">{here.explored}%</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </div>
      <NemesesPanel state={state} />
    </section>
  );
}

/** Enemies the guild knows by name. Only shown once there is one. */
function NemesesPanel({ state }: { state: GameState }) {
  const rows = nemesisRows(state);
  if (rows.length === 0) return null;
  return (
    <div className="panel" aria-labelledby="nemeses-title">
      <h3 id="nemeses-title" className="panel-title">
        Known by name
      </h3>
      <p className="panel-help">Enemies that put someone down and got away. They come back, tougher, where they were met.</p>
      <ul className="nemeses">
        {rows.map((n) => (
          <li key={n.id} className={`nemesis${n.atLarge ? '' : ' is-dead'}`}>
            <span className="nemesis-name">{n.name}</span>
            <span className="nemesis-kind">
              {n.kind[0]!.toUpperCase() + n.kind.slice(1)}. {n.status}
            </span>
            {n.record && <span className="nemesis-line">{n.record}</span>}
            {n.story.length > 0 && (
              <details className="nemesis-story">
                <summary>The story so far</summary>
                <ul>
                  {n.story.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlacePanel({ state, id }: { state: GameState; id: string }) {
  const known = locationState(state, id).discovered;
  if (!known) {
    const from = knownLocations(state).filter((l) => l.leadsTo.includes(id));
    return (
      <div className="panel place-panel" aria-live="polite">
        <h3 className="place-title">Somewhere unexplored</h3>
        <p className="panel-help">
          A road leads on from {joinNames(from.map((l) => l.name))}. Scouting there is the best way to find out what&rsquo;s at the end of it.
        </p>
        {from[0] && (
          <button type="button" className="btn" onClick={() => navigate({ screen: 'reach', id: from[0]!.id }, { replace: true })}>
            Show {from[0].name}
          </button>
        )}
      </div>
    );
  }

  const v = locationView(state, id);
  const loc = v.def;
  const haunting = nemesesAt(state, id);
  return (
    <div className="panel place-panel" aria-live="polite">
      <p className="place-biome">{loc.biome}</p>
      <h3 className="place-title">{loc.name}</h3>
      <p className="place-desc">{loc.description}</p>
      <dl className="facts">
        <div>
          <dt>Danger</dt>
          <dd className={`danger-text d${loc.danger}`}>{loc.danger} of 5</dd>
        </div>
        <div>
          <dt>Radiation</dt>
          <dd>{radiationText(loc.radiation).replace(/ radiation$/, '').replace(/^No$/, 'None')}</dd>
        </div>
        <div>
          <dt>Takes about</dt>
          <dd>{formatDuration(loc.durationMin * 60_000)}</dd>
        </div>
        <div>
          <dt>Explored</dt>
          <dd>{v.explored}%</dd>
        </div>
      </dl>
      <p className="place-note">
        {v.runs === 0 ? 'Nobody from the guild has been here yet.' : `The guild has been here ${v.runs === 1 ? 'once' : `${v.runs} times`}.`}{' '}
        {v.leadsTo.length > 0 && `Roads lead on to ${joinNames(v.leadsTo.map((l) => l.name))}.`}{' '}
        {v.unknownLeads > 0 && `${v.unknownLeads === 1 ? 'One road leads' : `${v.unknownLeads} roads lead`} somewhere nobody has found yet.`}
      </p>
      {haunting.map((n) => (
        <p key={n.id} className="nemesis-here">
          <strong>{n.name}</strong>, {n.kind}, haunts this place. {n.record}
        </p>
      ))}
      {v.crewsOut.map((run) => (
        <button key={run.id} type="button" className="crew-here" onClick={() => navigate({ screen: 'run', id: run.id })}>
          {joinNames(runCrewNames(run))} {run.plan.crew.length === 1 ? 'is' : 'are'} here now. Follow the run.
        </button>
      ))}
      <button type="button" className="btn btn-primary btn-wide" onClick={() => navigate({ screen: 'plan', locationId: id })}>
        Plan a run to {getLocation(id).name}
      </button>
    </div>
  );
}
