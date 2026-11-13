import { useState } from 'react';
import { answerRadio, type GameState } from '../../engine/index.ts';
import { navigate, useAction } from '../hooks.ts';
import { answeredLine, radioCard, radioCards, type RadioCardView } from '../radio-view.ts';
import { Portrait } from './Portrait.tsx';

/**
 * Crews on the radio (§7.12): every one waiting now, or just the one on this
 * run. Once answered a call stops waiting, so what was said is kept here, not
 * in the card.
 */
export function RadioCalls({ state, now, runId }: { state: GameState; now: number; runId?: string }) {
  const [said, setSaid] = useState<{ runId: string; text: string }[]>([]);
  const run = runId === undefined ? undefined : state.runs.find((r) => r.id === runId);
  const live = runId === undefined ? radioCards(state, now) : run ? [radioCard(state, run, now)].filter((c): c is RadioCardView => c !== undefined) : [];
  const showRun = runId === undefined;
  return (
    <>
      {said.map((s) => (
        <section key={s.runId} className="panel radio-call is-done" role="status">
          <p className="radio-said">{s.text}</p>
          <div className="radio-done-actions">
            {showRun && state.runs.some((r) => r.id === s.runId) && (
              <button type="button" className="btn" onClick={() => navigate({ screen: 'run', id: s.runId })}>
                Follow the run
              </button>
            )}
            <button type="button" className="btn btn-quiet" onClick={() => setSaid((list) => list.filter((x) => x !== s))}>
              Done
            </button>
          </div>
        </section>
      ))}
      {live.map((card) => (
        <RadioCard key={card.runId} card={card} showRun={showRun} onAnswered={(label) => setSaid((list) => [...list, { runId: card.runId, text: answeredLine(card.callerName, label) }])} />
      ))}
    </>
  );
}

/** One crew on the radio: what they found, what they ask, and the orders. Answered, the run goes on from now. */
function RadioCard({ card, showRun, onAnswered }: { card: RadioCardView; showRun: boolean; onAnswered: (label: string) => void }) {
  const { act, error } = useAction();
  const answer = (id: string, label: string): void => {
    if (act((s) => answerRadio(s, card.runId, id, Date.now()))) onAnswered(label);
  };

  return (
    <section className="panel radio-call" aria-labelledby={`radio-${card.runId}`}>
      <p className="dilemma-kicker">On the radio from {card.place}</p>
      <h3 id={`radio-${card.runId}`} className="dilemma-title">
        {card.title}
      </h3>
      <div className="radio-caller">
        {card.caller && <Portrait survivor={card.caller} size={56} decorative />}
        <p className="radio-intro">{card.intro}</p>
      </div>
      <blockquote className="radio-ask">
        <p>&ldquo;{card.ask}&rdquo;</p>
        <footer>{card.callerName}</footer>
      </blockquote>
      <div className="dilemma-choices">
        {card.orders.map((o) => (
          <button key={o.id} type="button" className="btn dilemma-choice" onClick={() => answer(o.id, o.label)}>
            {o.label}
          </button>
        ))}
      </div>
      <p className="panel-help">{card.wait}</p>
      {showRun && (
        <button type="button" className="link" onClick={() => navigate({ screen: 'run', id: card.runId })}>
          See the run so far
        </button>
      )}
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
