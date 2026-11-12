import { getLocation, type GameState, type Survivor } from '../../engine/index.ts';
import { Vitals } from '../components/Bars.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { navigate } from '../hooks.ts';
import { childRows, childrenSummary, type ChildRow } from '../family-view.ts';
import { backIn, runOfSurvivor } from '../runs-view.ts';
import { headlineTraits, nameWithNickname, originLine, rosterOrder, survivorStatus } from '../view.ts';

export function Roster({ state, day, now }: { state: GameState; day: number; now: number }) {
  const people = rosterOrder(state);
  const ready = people.filter((s) => survivorStatus(s).tone === 'ready').length;
  return (
    <section aria-labelledby="roster-title">
      <div className="screen-head">
        <h2 id="roster-title" className="screen-title">
          Roster
        </h2>
        <p className="screen-sub">
          {people.length} {people.length === 1 ? 'survivor' : 'survivors'}, {ready} ready to go out
        </p>
      </div>
      {people.length === 0 ? (
        <p className="empty">Nobody is left at the Depot. Start a new guild from Settings.</p>
      ) : (
        <ul className="roster">
          {people.map((s) => (
            <RosterRow key={s.id} state={state} survivor={s} day={day} now={now} />
          ))}
        </ul>
      )}
      {(state.children.length > 0 || state.survivors.some((s) => s.expecting)) && (
        <div className="panel children">
          <h3 className="panel-title">Children</h3>
          <p className="panel-help">
            {childrenSummary(state)} Children eat, take a bed and lift everyone&rsquo;s spirits. They never go out, and join the guild at 16.
          </p>
          {state.children.length > 0 && (
            <ul className="roster children-list">
              {childRows(state, day).map((row) => (
                <ChildRowView key={row.id} state={state} row={row} />
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="panel memorial-link">
        <button type="button" className="btn" onClick={() => navigate({ screen: 'memorial' })}>
          Memorial Wall
        </button>
        <span className="screen-sub">
          {state.memorial.length === 0 ? 'No names yet.' : `${state.memorial.length} ${state.memorial.length === 1 ? 'name' : 'names'} on the wall.`}
        </span>
      </div>
    </section>
  );
}

function RosterRow({ state, survivor: s, day, now }: { state: GameState; survivor: Survivor; day: number; now: number }) {
  const status = survivorStatus(s, day);
  const run = runOfSurvivor(state, s.id);
  const label = run ? `At ${getLocation(run.plan.locationId).name}, ${backIn(run, now)}` : status.label;
  const traits = headlineTraits(s);
  return (
    <li>
      <button
        type="button"
        className={`roster-row tone-${status.tone}`}
        onClick={() => navigate({ screen: 'survivor', id: s.id, tab: 'stats' })}
      >
        <Portrait survivor={s} size={84} decorative className="pinned" />
        <span className="roster-body">
          <span className="roster-name">
            {nameWithNickname(s)}
          </span>
          <span className="roster-origin">{originLine(s)}</span>
          <span className={`status status-${status.tone}`}>{label}</span>
          <Vitals survivor={s} />
          {traits.length > 0 && <span className="roster-traits">{traits.join(', ')}</span>}
        </span>
      </button>
    </li>
  );
}

function ChildRowView({ state, row }: { state: GameState; row: ChildRow }) {
  const child = state.children.find((c) => c.id === row.id)!;
  return (
    <li>
      <button type="button" className="roster-row child-row" onClick={() => navigate({ screen: 'survivor', id: row.id, tab: 'stats' })}>
        <Portrait survivor={child} size={64} decorative className="pinned" />
        <span className="roster-body">
          <span className="roster-name">{row.name}</span>
          <span className="roster-origin">{row.origin}</span>
          <span className="roster-family">{row.family}</span>
          <span className="roster-traits">{row.growing}</span>
        </span>
      </button>
    </li>
  );
}
