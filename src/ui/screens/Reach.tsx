import { useState } from 'react';
import {
  bringHome,
  buildOutpost,
  dayAt,
  deepestOpen,
  findLocation,
  findOutpost,
  getLocation,
  knownLocations,
  locationState,
  repairOutpost,
  station,
  type GameState,
} from '../../engine/index.ts';
import { Portrait } from '../components/Portrait.tsx';
import { ReachMapSvg } from '../components/ReachMapSvg.tsx';
import { navigate, useAction } from '../hooks.ts';
import { depthRows, exploredShort, mostlyFinds, outpostView } from '../outposts-view.ts';
import { PLACE_TABS, type PlaceTab } from '../route.ts';
import { callCard } from '../rescue-view.ts';
import { dangerText, formatDuration, joinNames, locationView, placeNote, radiationText, runCrewNames } from '../runs-view.ts';
import { nemesesAt, nemesisRows } from '../stories-view.ts';
import { vulturePlaceLine, vulturesSummary, vultureTag } from '../vultures-view.ts';

const today = (s: GameState): number => dayAt(s, Date.now());
const PLACE_TAB_LABELS: Record<PlaceTab, string> = { about: 'About', outpost: 'Outpost' };

export function Reach({ state, selected, tab = 'about' }: { state: GameState; selected?: string; tab?: PlaceTab }) {
  const places = knownLocations(state);
  const pick = (id: string): void => navigate({ screen: 'reach', id }, { replace: true, keepScroll: true });
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
      {sel && <PlacePanel state={state} id={sel} tab={tab} />}
      <div className="panel">
        <h3 className="panel-title">Known places</h3>
        <ul className="places">
          {[...places]
            .sort((a, b) => a.danger - b.danger || a.durationMin - b.durationMin)
            .map((loc) => {
              const here = locationState(state, loc.id);
              const outpost = findOutpost(state, loc.id);
              return (
                <li key={loc.id}>
                  <button type="button" className={`place-row${loc.id === sel ? ' is-selected' : ''}`} onClick={() => pick(loc.id)}>
                    <span className={`danger-dot d${loc.danger}`} aria-hidden="true">
                      {loc.danger}
                    </span>
                    <span className="place-body">
                      <span className="place-name">
                        {loc.name}
                        {outpost && <span className={`place-tag${outpost.damaged ? ' is-damaged' : ''}`}>{outpost.damaged ? 'Outpost, damaged' : 'Outpost'}</span>}
                        {state.rescue.call?.locationId === loc.id && <span className="place-tag is-calling">Calling for help</span>}
                        {vultureTag(state, loc.id) && <span className="place-tag is-vultures">{vultureTag(state, loc.id)}</span>}
                      </span>
                      <span className="place-facts">
                        {dangerText(loc.danger)}, {radiationText(loc.radiation).toLowerCase()}, {formatDuration(loc.durationMin * 60_000)}
                      </span>
                      {mostlyFinds(loc) && <span className="place-facts">Mostly {mostlyFinds(loc)}</span>}
                    </span>
                    <span className="place-explored">{here.explored >= 100 && deepestOpen(state, loc.id) > 1 ? exploredShort(state, loc.id) : `${here.explored}%`}</span>
                  </button>
                </li>
              );
            })}
        </ul>
      </div>
      <VulturesPanel state={state} />
      <NemesesPanel state={state} />
    </section>
  );
}

/** Enemies the guild knows by name. Only shown once there is one. */
/** The rival guild: how things stand, and the way to their screen (§7.11). */
function VulturesPanel({ state }: { state: GameState }) {
  const arrived = state.vultures.arrived;
  return (
    <div className="panel" aria-labelledby="vultures-panel-title" data-tour="vultures">
      <h3 id="vultures-panel-title" className="panel-title">
        The Vultures
      </h3>
      <p className="panel-help">{vulturesSummary(state)}</p>
      {arrived && (
        <button type="button" className="btn btn-wide" onClick={() => navigate({ screen: 'vultures' })}>
          See the Vultures
        </button>
      )}
    </div>
  );
}

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

function PlacePanel({ state, id, tab }: { state: GameState; id: string; tab: PlaceTab }) {
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

  const loc = getLocation(id);
  const outpost = findOutpost(state, id);
  return (
    <div className="panel place-panel" aria-live="polite">
      <p className="place-biome">{loc.biome}</p>
      <h3 className="place-title">{loc.name}</h3>
      <div className="sheet-tabs place-tabs" role="tablist" aria-label={loc.name} data-tour="place-tabs">
        {PLACE_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`place-tab-${t}`}
            aria-selected={t === tab}
            aria-controls="place-tabpanel"
            className="sheet-tab"
            onClick={() => navigate(t === 'about' ? { screen: 'reach', id } : { screen: 'reach', id, tab: t }, { replace: true, keepScroll: true })}
          >
            {PLACE_TAB_LABELS[t]}
            {t === 'outpost' && outpost && <span className={`tab-mark${outpost.damaged ? ' is-damaged' : ''}`} aria-label={outpost.damaged ? ', needs mending' : ', set up'} />}
          </button>
        ))}
      </div>
      <div id="place-tabpanel" role="tabpanel" aria-labelledby={`place-tab-${tab}`}>
        {tab === 'about' ? <About state={state} id={id} /> : <OutpostTab state={state} id={id} />}
      </div>
    </div>
  );
}

function About({ state, id }: { state: GameState; id: string }) {
  const v = locationView(state, id);
  const loc = v.def;
  const haunting = nemesesAt(state, id);
  const levels = depthRows(state, id);
  const deeper = levels[0]!.explored >= 100;
  const call = callCard(state, Date.now());
  const calling = call?.locationId === id ? call : undefined;
  return (
    <>
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
        {mostlyFinds(loc) && (
          <div className="facts-wide">
            <dt>Mostly finds</dt>
            <dd>{mostlyFinds(loc).replace(/^./, (c) => c.toUpperCase())}</dd>
          </div>
        )}
      </dl>
      {deeper && (
        <div className="levels" data-tour="levels">
          <h4 className="levels-title">How far in</h4>
          <ul>
            {levels.map((l) => (
              <li key={l.depth} className={`level${l.open ? '' : ' is-locked'}`}>
                <span className="level-name">{l.name}</span>
                <span className="level-line">{l.line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="place-note">{placeNote(v, deeper)}</p>
      {vulturePlaceLine(state, id) && (
        <button type="button" className="vulture-here" onClick={() => navigate({ screen: 'vultures' })}>
          {vulturePlaceLine(state, id)}
        </button>
      )}
      {haunting.map((n) => (
        <p key={n.id} className="nemesis-here">
          <strong>{n.name}</strong>, {n.kind}, haunts this place. {n.record}
        </p>
      ))}
      {calling && (
        <p className="call-here">
          {calling.text} {calling.when}
        </p>
      )}
      {v.crewsOut.map((run) => (
        <button key={run.id} type="button" className="crew-here" onClick={() => navigate({ screen: 'run', id: run.id })}>
          {joinNames(runCrewNames(run))} {run.plan.crew.length === 1 ? 'is' : 'are'} here now. Follow the run.
        </button>
      ))}
      <button type="button" className="btn btn-primary btn-wide" onClick={() => navigate({ screen: 'plan', locationId: id })}>
        {calling && !calling.runId ? `Plan a rescue at ${loc.name}` : `Plan a run to ${loc.name}`}
      </button>
    </>
  );
}

/** Setting up an outpost, or who lives at it and what it sends home. */
function OutpostTab({ state, id }: { state: GameState; id: string }) {
  const { act, error } = useAction();
  const [adding, setAdding] = useState(false);
  const v = outpostView(state, id);

  if (!v.built) {
    return (
      <div className="outpost">
        <p className="place-desc">{v.pitch}</p>
        <p className="panel-help">{v.hardship}</p>
        <p className="panel-help">{v.contactLine}</p>
        <p className="panel-help">Costs {v.buildCost}.</p>
        {v.buildProblem && <p className="field-error">{v.buildProblem}</p>}
        <button type="button" className="btn btn-primary" disabled={v.buildProblem !== undefined} onClick={() => act((s) => void buildOutpost(s, id, today(s)))}>
          Set up an outpost
        </button>
        {error && <p className="field-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="outpost">
      <p className={`outpost-state${v.damaged ? ' is-damaged' : ''}`}>
        {v.damaged ? 'Raiders broke in. It sends home half until it is mended.' : 'Standing, and in good shape.'}
      </p>
      {v.damaged && (
        <div className="recipe">
          <span className="recipe-body">
            <span className="recipe-cost">{v.repairProblem ?? `Mend it: ${v.repairCost}.`}</span>
          </span>
          <button type="button" className="btn btn-small" disabled={v.repairProblem !== undefined} onClick={() => act((s) => repairOutpost(s, id, today(s)))}>
            Mend
          </button>
        </div>
      )}
      <p className="place-note">{v.yieldLine}</p>
      <p className="place-note">{v.nearLine}</p>

      <h4 className="levels-title">
        Living here <span className="count">{v.room}</span>
      </h4>
      {v.staff.length === 0 && <p className="panel-help">Nobody. An empty outpost sends nothing home, and raiders walk right in.</p>}
      <ul className="workers">
        {v.staff.map(({ survivor: s, aim }) => (
          <li key={s.id} className="worker">
            <button type="button" className="worker-face" onClick={() => navigate({ screen: 'survivor', id: s.id, tab: 'stats' })}>
              <Portrait survivor={s} size={48} decorative />
            </button>
            <span className="worker-body">
              <span className="crew-name">
                {s.firstName} {s.lastName}
              </span>
              <span className="crew-stats">{aim}</span>
            </span>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => act((st) => bringHome(st, s.id, today(st)))}>
              Bring home
            </button>
          </li>
        ))}
      </ul>
      {!v.full &&
        (adding ? (
          <div className="picker">
            {v.candidates.length === 0 ? (
              <p className="panel-help">Nobody can go right now: everyone is out on a run, resting until healed, or already out here.</p>
            ) : (
              <ul>
                {v.candidates.map((c) => (
                  <li key={c.survivor.id}>
                    <button
                      type="button"
                      className="pick pick-person"
                      onClick={() => {
                        if (act((st) => station(st, c.survivor.id, id, today(st)))) setAdding(false);
                      }}
                    >
                      <Portrait survivor={c.survivor} size={40} decorative />
                      <span className="pick-text">
                        <span className="item-name">
                          {c.survivor.firstName} {c.survivor.lastName}
                        </span>
                        <span className="item-stats">
                          {c.aim}. {c.where}.
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="btn btn-small btn-quiet" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            Send someone to live here
          </button>
        ))}
      <p className="panel-help outpost-help">{v.hardship}</p>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
