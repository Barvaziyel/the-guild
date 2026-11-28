import { useEffect, useMemo, useRef, useState } from 'react';
import { stageSvg } from '../../scene/index.ts';
import { useServices } from '../hooks.ts';
import type { SceneShot } from '../scene-view.ts';
import { Portrait } from './Portrait.tsx';

/**
 * A scene played on the battle stage (Haven's gate, §9.12, 4b; an elite's first sight, 4c): one moving shot after
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
  const stamp = shot.stamp;
  return (
    <figure className="battle-stage scene-stage">
      <div className="scene-frame" key={step}>
        <div
          className={stamp ? 'battle-svg is-stamped' : 'battle-svg'}
          style={stamp ? { animationDelay: `${stamp.at}s` } : undefined}
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
        {/* A name slammed down over the stage (4c): it drops, the stage jolts, dust flies, and its place under it. */}
        {stamp && (
          <div className={stamp.top ? 'scene-stamp is-top' : 'scene-stamp'} style={{ ['--at' as string]: `${stamp.at}s` }} aria-live="polite">
            {[0, 1, 2, 3, 4, 5].map((k) => (
              <span key={k} className="scene-stamp-dust" style={{ ['--a' as string]: `${k * 60 + 15}deg` }} aria-hidden="true" />
            ))}
            <span className="scene-stamp-title">{stamp.title}</span>
            {stamp.sub && <span className="scene-stamp-sub">{stamp.sub}</span>}
          </div>
        )}
      </div>
      {/* Close-ups: in, shaking or hard, and out, on the shot's own clock. */}
      {shot.faces?.map((f, k) => (
        <div
          key={`${step}:${k}`}
          className={`scene-face is-${f.tone} is-${f.side}`}
          style={{ animationDelay: `${f.at}s`, animationDuration: `${Math.max(1, f.until - f.at)}s` }}
          aria-hidden="true"
        >
          <span className="scene-face-shake" style={{ animationDelay: `${f.at}s` }}>
            <Portrait survivor={f.survivor} size={112} decorative vulture={f.tone === 'vulture'} />
          </span>
          <span className="scene-face-name">{f.name}</span>
        </div>
      ))}
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
