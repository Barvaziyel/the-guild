import { useEffect, useMemo, useRef, useState } from 'react';
import { stageSvg } from '../../scene/index.ts';
import { useServices } from '../hooks.ts';
import type { SceneShot } from '../scene-view.ts';

/**
 * A scene played on the battle stage before a fight (Haven's gate, §9.12; 4b): one moving shot after
 * another, each line coming up under it as the pictures go on, with its own sound and music over the
 * screen's. A tap on the stage goes to the next shot; Skip ends it. `onDone` once it's over either way.
 */
export function SceneStage({ frames, onDone }: { frames: SceneShot[]; onDone: () => void }) {
  // The scene as it was when it began: the screen's clock moving on mustn't start it over.
  const [shots] = useState(frames);
  const [step, setStep] = useState(0);
  // Which of the shot's lines is up, for the shot it was set in.
  const [line, setLine] = useState({ step: 0, k: 0 });
  const over = step >= shots.length;
  const shot = shots[Math.min(step, shots.length - 1)];
  const done = useRef(onDone);
  done.current = onDone;
  const { sound } = useServices();

  useEffect(() => {
    if (over) {
      sound.scene([], undefined, true);
      done.current();
      return;
    }
    const s = shots[step]!;
    if (s.sound.ambience) sound.sceneAmbience(s.sound.ambience);
    sound.scene(s.sound.cues, s.sound.duck);
    const timers = [window.setTimeout(() => setStep((n) => n + 1), s.ms)];
    s.lines.forEach((l, k) => {
      if (k > 0) timers.push(window.setTimeout(() => setLine({ step, k }), l.at * 1000));
    });
    for (const m of s.sound.music ?? []) timers.push(window.setTimeout(() => sound.sceneMusic(m.id), m.at * 1000));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [step, over, shots, sound]);
  // Leaving the scene any way gives the screen its own sound back.
  useEffect(
    () => () => {
      sound.scene([], undefined, true);
      sound.sceneMusic(undefined);
      sound.sceneAmbience(undefined);
    },
    [sound],
  );

  const svg = useMemo(() => (shot ? stageSvg(shot.model) : ''), [shot]);
  if (!shot) return null;
  const k = line.step === step ? line.k : 0;
  const text = shot.lines[Math.min(k, shot.lines.length - 1)]?.text ?? '';
  const next = (): void => setStep((s) => s + 1);
  return (
    <figure className="battle-stage scene-stage">
      <div
        key={step}
        className="battle-svg"
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
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <figcaption key={`${step}:${k}`} className="scene-caption is-new" aria-live="polite">
        {text}
      </figcaption>
      <div className="scene-controls">
        <span className="scene-pips" aria-hidden="true">
          {shots.map((_, k) => (
            <span key={k} className={k <= step ? 'is-on' : undefined} />
          ))}
        </span>
        <button type="button" className="btn btn-quiet btn-small" onClick={() => setStep(shots.length)}>
          Skip
        </button>
      </div>
    </figure>
  );
}
