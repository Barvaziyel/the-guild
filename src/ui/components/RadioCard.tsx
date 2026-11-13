import { useState } from 'react';
import { answerRadio } from '../../engine/index.ts';
import { navigate, useAction } from '../hooks.ts';
import type { RadioCardView } from '../radio-view.ts';
import { Portrait } from './Portrait.tsx';

/**
 * A crew on the radio from a fork (§7.12): what they found, what they ask,
 * and the orders. Answered, the run goes on from now the way the order says.
 */
export function RadioCard({ card, showRun = true }: { card: RadioCardView; showRun?: boolean }) {
  const { act, error } = useAction();
  const [said, setSaid] = useState<string | null>(null);

  if (said) {
    return (
      <section className="panel radio-call is-done" role="status" aria-label={`${card.callerName} on the radio`}>
        <p className="radio-said">
          You told {card.callerName}: {said.charAt(0).toLowerCase() + said.slice(1)}. &ldquo;Understood.&rdquo;
        </p>
        <div className="radio-done-actions">
          {showRun && (
            <button type="button" className="btn" onClick={() => navigate({ screen: 'run', id: card.runId })}>
              Follow the run
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={() => setSaid(null)}>
            Done
          </button>
        </div>
      </section>
    );
  }

  const answer = (id: string, label: string): void => {
    if (act((s) => answerRadio(s, card.runId, id, Date.now()))) setSaid(label);
  };

  return (
    <section className="panel radio-call" aria-labelledby={`radio-${card.runId}`} data-tour="radio">
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
