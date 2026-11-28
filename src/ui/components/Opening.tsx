import { useEffect, useMemo, useRef, useState } from 'react';
import { seenIntro, type GameState } from '../../engine/index.ts';
import { useAction } from '../hooks.ts';
import { openingShots } from '../opening-view.ts';

/**
 * A new guild's opening scene (§9.10, 3.14.0), full screen before anything else: each shot fades in and
 * moves, its line comes up under it, a tap goes on, Skip ends it. Then the guild's name is stamped and
 * the Depot opens.
 */
export function Opening({ state }: { state: GameState }) {
  const { act } = useAction();
  const finish = useRef(act);
  finish.current = act;
  // Drawn once: the founders and the yard as they were when it began.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const shots = useMemo(() => openingShots(state), [state.seed]);
  const [step, setStep] = useState(0);
  const over = step >= shots.length;
  const shot = shots[Math.min(step, shots.length - 1)]!;

  useEffect(() => {
    if (over) {
      finish.current((s) => seenIntro(s));
      return;
    }
    const t = window.setTimeout(() => setStep((n) => n + 1), shot.ms);
    return () => window.clearTimeout(t);
  }, [step, over, shot]);

  const next = (): void => setStep((n) => n + 1);
  return (
    <div className="opening" role="dialog" aria-modal="true" aria-label="How it began">
      <div
        className="opening-stage"
        role="button"
        tabIndex={0}
        aria-label="Next"
        onClick={next}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            next();
          }
        }}
      >
        {shot.title ? (
          <div className="opening-title" key={step}>
            <p className="opening-name">{shot.title.name}</p>
            <p className="opening-day">{shot.title.day}</p>
          </div>
        ) : (
          <div
            key={step}
            className={`opening-shot-wrap${shot.push ? ' is-push' : ''}${shot.dark ? ' is-dark' : ''}`}
            style={shot.push ? { transformOrigin: `${shot.push.x}% ${shot.push.y}%`, ['--push-s' as string]: `${shot.ms / 1000}s` } : undefined}
            dangerouslySetInnerHTML={{ __html: shot.svg ?? '' }}
          />
        )}
      </div>
      <p className="opening-caption" key={`c${step}`} aria-live="polite">
        {shot.caption}
      </p>
      <div className="opening-controls">
        <span className="scene-pips" aria-hidden="true">
          {shots.map((_, k) => (
            <span key={k} className={k <= step ? 'is-on' : undefined} />
          ))}
        </span>
        <button type="button" className="btn btn-quiet btn-small" onClick={() => setStep(shots.length)}>
          Skip
        </button>
      </div>
    </div>
  );
}
