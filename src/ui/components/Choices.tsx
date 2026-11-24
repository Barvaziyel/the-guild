import { useEffect, useRef } from 'react';
import type { Choice } from '../runs-view.ts';
import { Chips } from './Glyph.tsx';

interface ChoiceListProps<T extends string> {
  legend: string;
  name: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** A set of radio buttons, one per row, each with a line of explanation. */
export function ChoiceList<T extends string>({ legend, name, choices, value, onChange }: ChoiceListProps<T>) {
  return (
    <fieldset className="choices">
      <legend className="choices-legend">{legend}</legend>
      {choices.map((c) => (
        <label key={c.id} className="choice">
          <input type="radio" name={name} value={c.id} checked={c.id === value} onChange={() => onChange(c.id)} />
          <span className="choice-text">
            <span className="choice-name">{c.name}</span>
            {c.chips ? <Chips chips={c.chips} className="choice-chips" /> : <span className="choice-desc">{c.description}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Shown under the label, e.g. "4 at the Depot". */
  note: string;
  onChange: (value: number) => void;
}

/** A number picked with − and + buttons. */
export function Stepper({ label, value, min, max, step = 1, note, onChange }: StepperProps) {
  const set = (v: number): void => onChange(Math.max(min, Math.min(max, v)));
  return (
    <div className="stepper">
      <span className="stepper-text">
        <span className="stepper-label">{label}</span>
        <span className="stepper-note">{note}</span>
      </span>
      <span className="stepper-controls">
        <button type="button" className="step" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => set(value - step)}>
          &minus;
        </button>
        <output className="step-value" aria-live="polite">
          {value}
        </output>
        <button type="button" className="step" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => set(value + step)}>
          +
        </button>
      </span>
    </div>
  );
}

/**
 * A row of buttons, one per choice, and under it what the one picked does: as pictures when it has
 * them (3.6.0), a line of text when it doesn't. For forms that should fit a screen.
 */
export function Segmented<T extends string>({ legend, name, choices, value, onChange }: ChoiceListProps<T>) {
  const picked = choices.find((c) => c.id === value);
  return (
    <div className="seg" role="radiogroup" aria-labelledby={`${name}-legend`}>
      <span id={`${name}-legend`} className="seg-legend">
        {legend}
      </span>
      <div className="seg-options">
        {choices.map((c) => (
          <label key={c.id} className={`seg-option${c.id === value ? ' is-on' : ''}`}>
            <input type="radio" name={name} value={c.id} checked={c.id === value} onChange={() => onChange(c.id)} />
            {c.short ?? c.name}
          </label>
        ))}
      </div>
      {picked?.chips ? (
        <p className="seg-desc seg-chips">
          <Chips chips={picked.chips} />
        </p>
      ) : (
        picked && <p className="seg-desc">{picked.description}</p>
      )}
    </div>
  );
}

/** A small number picker on one line: the label and how many there are, then − n +. Two sit side by side. */
export function MiniStepper({ label, value, min, max, step = 1, note, onChange }: StepperProps) {
  const set = (v: number): void => onChange(Math.max(min, Math.min(max, v)));
  // Hold a button to keep counting (3.7.2), for steps of one up to a big number.
  const now = useRef(value);
  now.current = value;
  const hold = useRef<{ wait: number; tick: number; held: boolean }>({ wait: 0, tick: 0, held: false });
  const stop = (): void => {
    window.clearTimeout(hold.current.wait);
    window.clearInterval(hold.current.tick);
  };
  useEffect(() => stop, []);
  const press = (dir: 1 | -1) => ({
    onPointerDown: () => {
      stop();
      hold.current.held = false;
      hold.current.wait = window.setTimeout(() => {
        hold.current.held = true;
        hold.current.tick = window.setInterval(() => {
          const next = Math.max(min, Math.min(max, now.current + dir * step));
          if (next === now.current) return stop();
          now.current = next;
          onChange(next);
        }, 70);
      }, 380);
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      // A hold already counted; the click that ends it doesn't add one more.
      if (hold.current.held) hold.current.held = false;
      else set(value + dir * step);
    },
  });
  return (
    <div className="mini-stepper">
      <span className="mini-stepper-label">
        {label}
        <span className="mini-stepper-note">{note}</span>
      </span>
      <span className="stepper-controls">
        <button type="button" className="step" aria-label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} {...press(-1)}>
          &minus;
        </button>
        <output className="step-value" aria-live="polite">
          {value}
        </output>
        <button type="button" className="step" aria-label={`More ${label.toLowerCase()}`} disabled={value >= max} {...press(1)}>
          +
        </button>
      </span>
    </div>
  );
}
