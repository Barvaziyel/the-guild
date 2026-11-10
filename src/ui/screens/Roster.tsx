import type { GameState, Survivor } from '../../engine/index.ts';
import { Vitals } from '../components/Bars.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { navigate } from '../hooks.ts';
import { headlineTraits, originLine, rosterOrder, survivorStatus } from '../view.ts';

export function Roster({ state, day }: { state: GameState; day: number }) {
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
            <RosterRow key={s.id} survivor={s} day={day} />
          ))}
        </ul>
      )}
    </section>
  );
}

function RosterRow({ survivor: s, day }: { survivor: Survivor; day: number }) {
  const status = survivorStatus(s, day);
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
            {s.firstName} {s.lastName}
          </span>
          <span className="roster-origin">{originLine(s)}</span>
          <span className={`status status-${status.tone}`}>{status.label}</span>
          <Vitals survivor={s} />
          {traits.length > 0 && <span className="roster-traits">{traits.join(', ')}</span>}
        </span>
      </button>
    </li>
  );
}
