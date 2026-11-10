import { useState, type ReactNode } from 'react';

interface Props {
  /** The button that starts it, e.g. "Start a new guild". */
  label: string;
  /** What will happen, shown before the final button. */
  warning: ReactNode;
  /** The final button, named for the action: "Start over". */
  confirmLabel: string;
  onConfirm: () => void;
  disabled?: boolean;
  danger?: boolean;
}

/** A two-step button for things that can't be undone with one tap. */
export function ConfirmButton({ label, warning, confirmLabel, onConfirm, disabled, danger }: Props) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={`btn ${danger ? 'btn-danger' : ''}`} disabled={disabled} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <div className="confirm" role="group" aria-label={label}>
      <p className="confirm-warning">{warning}</p>
      <div className="btn-row">
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => {
            setAsking(false);
            onConfirm();
          }}
        >
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => setAsking(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
