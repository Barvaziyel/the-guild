import { useState } from 'react';
import { dayAt, decidePrisoner, type GameState, type PrisonerAction } from '../../engine/index.ts';
import { Portrait } from '../components/Portrait.tsx';
import { goBack, navigate, useAction } from '../hooks.ts';
import { vulturesView, type PrisonerRow } from '../vultures-view.ts';

/** The rival guild (§7.11): how things stand, what they do, their people and camps, and the guild's prisoners. */
export function Vultures({ state }: { state: GameState }) {
  const v = vulturesView(state, dayAt(state, Date.now()));
  // What became of a prisoner: they leave the list, so the line is kept here.
  const [said, setSaid] = useState<string | null>(null);
  return (
    <article className="sheet" aria-labelledby="vultures-title">
      <div className="sheet-nav">
        <button type="button" className="back" onClick={() => goBack({ screen: 'reach' })}>
          <span aria-hidden="true">&lsaquo;</span> The Reach
        </button>
      </div>
      <header className="sheet-head">
        <h2 id="vultures-title" className="plan-title">
          The Vultures
        </h2>
        <p className="place-facts">Another scavenger guild that works the Reach. They compete for places, people, outposts and trade, and they can be dealt with.</p>
      </header>

      {v.note && (
        <section className="panel">
          <p className="panel-help">{v.note}</p>
        </section>
      )}

      {v.arrived && (
        <section className="panel" aria-labelledby="standing-title">
          <h3 id="standing-title" className="panel-title">
            How things stand
          </h3>
          <Standing value={v.standing} name={v.bandName} />
          <p className="vulture-meaning">{v.meaning}</p>
          <p className="place-facts">Strength: {v.strength}.</p>
          {v.effects.length > 0 && (
            <ul className="vulture-effects">
              {v.effects.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
          <p className="panel-help">
            Fights, raids on their camps and killing their people turn them against the guild; tribute, trade and letting prisoners go warm them. Their envoys come to the
            gate now and then with something to decide.
          </p>
        </section>
      )}

      {said && (
        <section className="panel" role="status">
          <p className="vulture-meaning">{said}</p>
        </section>
      )}

      {v.prisoners.length > 0 && (
        <section className="panel" aria-labelledby="prisoners-title">
          <h3 id="prisoners-title" className="panel-title">
            Prisoners
          </h3>
          <p className="panel-help">Held at the Depot. Each eats a ration a day, and might slip out one night.</p>
          <ul className="vulture-people">
            {v.prisoners.map((p) => (
              <PrisonerCard key={p.id} row={p} onDone={setSaid} />
            ))}
          </ul>
        </section>
      )}

      {v.camps.length > 0 && (
        <section className="panel" aria-labelledby="camps-title">
          <h3 id="camps-title" className="panel-title">
            Their camps
          </h3>
          <ul className="vulture-camps">
            {v.camps.map((c) => (
              <li key={c.id}>
                <button type="button" className="vulture-camp" onClick={() => navigate({ screen: 'reach', id: c.id })}>
                  <span className="vulture-camp-name">
                    {c.place}
                    {c.home && <span className="place-tag">Their home</span>}
                  </span>
                  <span className="place-facts">{c.held}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="panel-help">A crew can hit a camp from the planner. It&rsquo;s a hard fight, and it means war.</p>
        </section>
      )}

      {v.people.length > 0 && (
        <section className="panel" aria-labelledby="people-title">
          <h3 id="people-title" className="panel-title">
            Their people
          </h3>
          <ul className="vulture-people">
            {v.people.map((p) => (
              <li key={p.id} className={`vulture-person${p.where === 'Dead.' ? ' is-dead' : ''}`}>
                <span className="vulture-portrait">
                  {p.person ? <Portrait survivor={p.person} size={64} decorative /> : <span className="vulture-unknown" aria-hidden="true">?</span>}
                </span>
                <span className="vulture-body">
                  <span className="roster-name">{p.name}</span>
                  <span className="roster-origin">{p.role}</span>
                  <span className="roster-traits">{p.where}</span>
                  {p.story.length > 0 && (
                    <details className="nemesis-story">
                      <summary>With the guild</summary>
                      <ul>
                        {p.story.map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {v.history.length > 0 && (
        <section className="panel" aria-labelledby="vulture-history-title">
          <h3 id="vulture-history-title" className="panel-title">
            Lately
          </h3>
          <ul className="vulture-history">
            {v.history.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** Where the standing sits, from war to trading partners. */
function Standing({ value, name }: { value: number; name: string }) {
  const pct = (value + 100) / 2;
  return (
    <div className="standing">
      <div className="standing-head">
        <span className="standing-name">{name}</span>
        <span className="standing-value">{value > 0 ? `+${value}` : value}</span>
      </div>
      <div className="standing-track" role="meter" aria-label="Standing with the Vultures" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={value}>
        <span className="standing-band band-war" />
        <span className="standing-band band-wary" />
        <span className="standing-band band-truce" />
        <span className="standing-band band-trade" />
        <span className="standing-mark" style={{ left: `${pct}%` }} />
      </div>
      <div className="standing-scale" aria-hidden="true">
        <span>War</span>
        <span>Wary</span>
        <span>Truce</span>
        <span>Trade</span>
      </div>
    </div>
  );
}

function PrisonerCard({ row, onDone }: { row: PrisonerRow; onDone: (text: string) => void }) {
  const { act, error } = useAction();
  const decide = (action: PrisonerAction): void => {
    let text = '';
    if (act((s) => void (text = decidePrisoner(s, row.id, action, Date.now())))) onDone(text);
  };
  return (
    <li className="vulture-person">
      <span className="vulture-portrait">
        <Portrait survivor={row.person} size={64} decorative />
      </span>
      <span className="vulture-body">
        <span className="roster-name">{row.name}</span>
        <span className="roster-origin">{row.role}</span>
        <span className="roster-traits">{row.ransomProblem ?? row.ransom}</span>
        <span className="roster-traits">{row.recruitProblem ?? row.recruit}</span>
        <span className="prisoner-actions">
          <button type="button" className="btn btn-small" onClick={() => decide('release')}>
            Let go
          </button>
          <button type="button" className="btn btn-small" disabled={row.ransomProblem !== undefined} onClick={() => decide('ransom')}>
            Trade back
          </button>
          <button type="button" className="btn btn-small" disabled={row.recruitProblem !== undefined} onClick={() => decide('recruit')}>
            Ask to join
          </button>
        </span>
        {error && <span className="field-error">{error}</span>}
      </span>
    </li>
  );
}
