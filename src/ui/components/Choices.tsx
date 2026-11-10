import type { Choice } from '../runs-view.ts';

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
            <span className="choice-desc">{c.description}</span>
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
