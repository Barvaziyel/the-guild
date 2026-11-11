import { bunksCap, dayAt, getOrigin, recruitProblem, takeIn, withRng, type GameState } from '../../engine/index.ts';
import { Portrait } from '../components/Portrait.tsx';
import { goBack, navigate, useAction } from '../hooks.ts';
import { candidateNote, candidateStats, newMouthNote } from '../depot-view.ts';
import { candidateTraitsLine as traitsLine } from '../depot-view.ts';
import { hiddenTraitCount, sexLabel, traitName } from '../view.ts';

export function Recruits({ state, day }: { state: GameState; day: number }) {
  const { act, error } = useAction();
  const cap = bunksCap(state);
  const full = state.survivors.length >= cap;

  return (
    <article className="sheet" aria-labelledby="gate-title">
      <div className="sheet-nav">
        <button type="button" className="back" onClick={() => goBack({ screen: 'depot' })}>
          <span aria-hidden="true">&lsaquo;</span> The Depot
        </button>
      </div>
      <header className="sheet-head">
        <h2 id="gate-title" className="plan-title">
          At the gate
        </h2>
        <p className="place-facts">
          {state.survivors.length} of {cap} beds taken.{full ? ' Improve the Bunks to take anyone in.' : ''}
        </p>
        {!full && state.depot.recruits.length > 0 && newMouthNote(state) && <p className="place-facts food-note">{newMouthNote(state)}</p>}
      </header>

      {state.depot.recruits.length === 0 ? (
        <p className="empty">Nobody is waiting. New people answer the radio each day.</p>
      ) : (
        <ul className="candidates">
          {state.depot.recruits.map((c) => {
            const s = c.survivor;
            const problem = recruitProblem(state, s.id);
            const visible = s.traits.filter((t) => !t.hidden);
            return (
              <li key={s.id} className="candidate panel">
                <div className="candidate-id">
                  <Portrait survivor={s} size={88} className="pinned" />
                  <div>
                    <h3 className="candidate-name">
                      {s.firstName} {s.lastName}
                    </h3>
                    <p className="sheet-origin">
                      {getOrigin(s.origin).name}, {s.age}
                    </p>
                    <p className="sheet-sex">{sexLabel(s)}</p>
                    <p className="candidate-wait">{candidateNote(c, day)}</p>
                  </div>
                </div>
                <p className="backstory">{s.backstory}</p>
                <dl className="candidate-stats">
                  {candidateStats(state, s).map((st) => (
                    <div key={st.id}>
                      <dt>{st.name}</dt>
                      <dd>{st.value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="candidate-traits">{traitsLine(visible.map(traitName), hiddenTraitCount(s) > 0)}</p>
                {problem && !full && <p className="field-error">{problem}</p>}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={problem !== undefined}
                  onClick={() => {
                    if (act((st) => void withRng(st, (rng) => takeIn(st, s.id, rng, dayAt(st, Date.now()))))) {
                      navigate({ screen: 'survivor', id: s.id, tab: 'stats' }, { replace: true });
                    }
                  }}
                >
                  Take {s.firstName} in
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="field-error panel">{error}</p>}
    </article>
  );
}
