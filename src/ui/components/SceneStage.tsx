import { useEffect, useMemo, useState } from 'react';
import { stageSvg } from '../../scene/index.ts';
import type { SceneFrame } from '../gate-scene.ts';
import { useServices } from '../hooks.ts';

/**
 * A scene played on the battle stage before a fight (Haven's gate, §9.12):
 * one still after another, each with its line under it. A tap on the stage
 * goes to the next; Skip ends it. `onDone` once it's over either way.
 */
export function SceneStage({ frames, onDone }: { frames: SceneFrame[]; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const frame = frames[Math.min(step, frames.length - 1)];
  const over = step >= frames.length;

  useEffect(() => {
    if (over) {
      onDone();
      return;
    }
    const t = window.setTimeout(() => setStep((s) => s + 1), frame!.ms);
    return () => window.clearTimeout(t);
  }, [step, over, frame, onDone]);

  const svg = useMemo(() => (frame ? stageSvg(frame.model) : ''), [frame]);
  // The shot from the wall is heard (3.1.0).
  const { sound } = useServices();
  useEffect(() => {
    if (!over && frame?.model.shot) sound.play({ id: 'rifle', pan: -0.3 });
  }, [frame, over, sound]);
  if (!frame) return null;
  return (
    <figure className="battle-stage scene-stage">
      <div
        className="battle-svg"
        role="button"
        tabIndex={0}
        aria-label="Next"
        onClick={() => setStep((s) => s + 1)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setStep((s) => s + 1);
          }
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption className="scene-caption" aria-live="polite">
        {frame.caption}
      </figcaption>
      <div className="scene-controls">
        <span className="scene-pips" aria-hidden="true">
          {frames.map((_, k) => (
            <span key={k} className={k <= step ? 'is-on' : undefined} />
          ))}
        </span>
        <button type="button" className="btn btn-quiet btn-small" onClick={() => setStep(frames.length)}>
          Skip
        </button>
      </div>
    </figure>
  );
}
