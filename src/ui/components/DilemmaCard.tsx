import { useState } from 'react';
import { decideDilemma, type DilemmaResult, type GameState } from '../../engine/index.ts';
import { dilemmaCard } from '../dilemma-view.ts';
import { navigate, useAction, useKeepInView } from '../hooks.ts';
import { Portrait } from './Portrait.tsx';

/** A decision waiting at the Depot (§9.5): what's going on, who it's about, and four answers. Then what came of it. */
export function DilemmaCard({ state, now }: { state: GameState; now: number }) {
  const { act, error } = useAction();
  const [result, setResult] = useState<DilemmaResult | null>(null);
  const card = dilemmaCard(state, now);
  // Answered, the card turns into a short one: bring it back into view.
  const ref = useKeepInView<HTMLElement>(result);

  if (result) {
    return (
      <section ref={ref} className="panel dilemma is-done" aria-labelledby="dilemma-title" role="status">
        <h3 id="dilemma-title" className="dilemma-title">
          {result.title}
        </h3>
        {result.choice && <p className="dilemma-chosen">{result.choice}</p>}
        <p className="dilemma-text">{result.text}</p>
        <button type="button" className="btn" onClick={() => setResult(null)}>
          Done
        </button>
      </section>
    );
  }
  if (!card) return null;

  const choose = (i: number): void => {
    let outcome: DilemmaResult | undefined;
    if (act((s) => void (outcome = decideDilemma(s, i, Date.now()))) && outcome) setResult(outcome);
  };

  return (
    <section ref={ref} className="panel dilemma" aria-labelledby="dilemma-title" data-tour="dilemma">
      <p className="dilemma-kicker">Something to decide</p>
      <h3 id="dilemma-title" className="dilemma-title">
        {card.title}
      </h3>
      <div className="dilemma-faces">
        {card.people.map((s) =>
          state.survivors.includes(s) ? (
            <button key={s.id} type="button" className="dilemma-face" onClick={() => navigate({ screen: 'survivor', id: s.id, tab: 'stats' })} aria-label={`${s.firstName} ${s.lastName}`}>
              <Portrait survivor={s} size={56} decorative />
              <span>{s.firstName}</span>
            </button>
          ) : (
            <span key={s.id} className="dilemma-face is-stranger">
              <Portrait survivor={s} size={56} decorative />
              <span>{s.firstName}</span>
            </span>
          ),
        )}
      </div>
      <p className="dilemma-text">{card.text}</p>
      <div className="dilemma-choices">
        {card.choices.map((label, i) => (
          <button key={label} type="button" className="btn dilemma-choice" onClick={() => choose(i)}>
            {label}
          </button>
        ))}
      </div>
      <p className="panel-help">
        {card.deadline} {card.otherwise}
      </p>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
