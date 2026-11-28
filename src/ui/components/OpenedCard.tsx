import { useEffect } from 'react';
import { seenOpening, type GameState } from '../../engine/index.ts';
import { navigate, useAction, useServices } from '../hooks.ts';
import { openingCard } from '../opened-view.ts';
import { Glyph } from './Glyph.tsx';

/**
 * A system opens in a new guild (§9.10, 3.14.0): a paper card drops in over the screen, its picture pops
 * out of a ring of dust, and a stamp slams down on it. Once, then it's gone.
 */
export function OpenedCard({ state }: { state: GameState }) {
  const { act } = useAction();
  const { sound } = useServices();
  const card = openingCard(state);
  const id = card?.id;
  // The stamp lands about half a second in: that's when it's heard.
  useEffect(() => {
    if (!id) return;
    const t = window.setTimeout(() => sound.play({ id: 'reward' }), 520);
    return () => window.clearTimeout(t);
  }, [id, sound]);
  if (!card) return null;
  const done = (): void => {
    act((s) => seenOpening(s, card.id));
  };
  return (
    <div className="opened" role="dialog" aria-modal="true" aria-labelledby="opened-title" key={card.id}>
      <div className="opened-card">
        <div className="opened-art" aria-hidden="true">
          <span className="opened-ring" />
          {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
            <span key={k} className="opened-speck" style={{ ['--a' as string]: `${k * 45 + 20}deg` }} />
          ))}
          <Glyph name={card.glyph} className="opened-glyph" />
        </div>
        <p className="opened-stamp" aria-hidden="true">
          Opened
        </p>
        <h2 id="opened-title" className="opened-title">
          {card.title}
        </h2>
        <p className="opened-line">{card.line}</p>
        <div className="opened-actions">
          {card.go && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                done();
                navigate(card.go!.to);
              }}
            >
              {card.go.label}
            </button>
          )}
          <button type="button" className={card.go ? 'btn' : 'btn btn-primary'} onClick={done}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
