import { letThemFight, takeCommand, type GameState } from '../../engine/index.ts';
import { fightCard, fightCards, type FightCardView } from '../fight-view.ts';
import { navigate, useAction } from '../hooks.ts';
import { Portrait } from './Portrait.tsx';

/** Crews stopped at a fight on a led run (§7.13): every one now, or just the one on this run. */
export function FightCalls({ state, now, runId }: { state: GameState; now: number; runId?: string }) {
  const run = runId === undefined ? undefined : state.runs.find((r) => r.id === runId);
  const cards = runId === undefined ? fightCards(state, now) : run ? [fightCard(state, run, now)].filter((c): c is FightCardView => c !== undefined) : [];
  return (
    <>
      {cards.map((card) => (
        <FightCard key={card.runId} card={card} />
      ))}
    </>
  );
}

function FightCard({ card }: { card: FightCardView }) {
  const { act, error } = useAction();
  const command = (): void => {
    if (card.inCommand || act((s) => void takeCommand(s, card.runId, Date.now()))) navigate({ screen: 'fight', id: card.runId });
  };
  return (
    <section className="panel fight-call" aria-labelledby={`fight-${card.runId}`}>
      <p className="dilemma-kicker">{card.inCommand ? `Your fight at ${card.place}` : `A fight at ${card.place}`}</p>
      <h3 id={`fight-${card.runId}`} className="dilemma-title">
        Against {card.against}
      </h3>
      <div className="radio-caller">
        {card.caller && <Portrait survivor={card.caller} size={56} decorative />}
        <p className="radio-intro">
          {card.inCommand ? `${card.callerName}'s crew is waiting for your next orders.` : `${card.callerName} is on the radio: they're about to fight, and wait for your orders.`}
        </p>
      </div>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={command}>
          {card.inCommand ? 'Back to the fight' : 'Take command'}
        </button>
        <button type="button" className="btn" onClick={() => act((s) => letThemFight(s, card.runId, Date.now()))}>
          {card.inCommand ? 'Let them finish it' : 'Let them fight'}
        </button>
      </div>
      <p className="panel-help">{card.wait}</p>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
