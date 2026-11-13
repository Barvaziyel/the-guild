import { letRaidFight, type GameState } from '../../engine/index.ts';
import { navigate, useAction } from '../hooks.ts';
import { raidCard } from '../raid-view.ts';

/** Raiders seen on the road, or at the gate (§9.8), at the top of the Depot's Today tab. */
export function RaidCard({ state, now }: { state: GameState; now: number }) {
  const { act, error } = useAction();
  const card = raidCard(state, now);
  if (!card) return null;
  return (
    <section className="panel fight-call raid-call" aria-labelledby="raid-title">
      <p className="dilemma-kicker">{card.kind === 'seen' ? 'Seen from the Watchtower' : 'At the Depot'}</p>
      <h2 id="raid-title" className="dilemma-title">
        {card.title}
      </h2>
      {card.against && <p className="fight-sub">{card.against}</p>}
      <p>{card.kind === 'seen' ? card.lines[0] : card.wait}</p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => navigate({ screen: 'raid' })}>
          {card.kind === 'seen' ? 'Who will be home' : card.inCommand ? 'Back to the gate' : 'Go to the gate'}
        </button>
        {card.kind === 'gate' && (
          <button type="button" className="btn" onClick={() => act((s) => letRaidFight(s, Date.now()))}>
            {card.inCommand ? 'Let them finish it' : 'Let them fight'}
          </button>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}
