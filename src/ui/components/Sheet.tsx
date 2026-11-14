import { useEffect, useId, useRef, type ReactNode } from 'react';

/**
 * A sheet that slides up over the screen (2.6.0): for what a one-screen layout
 * keeps a tap away, like a fight's whole log. A tap outside it, the back
 * gesture's Escape, or Close shuts it.
 */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className="bottom-sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        // The dialog itself only gets the click when it lands on the backdrop.
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="bottom-sheet-body">
        <div className="bottom-sheet-head">
          <h3 id={titleId} className="panel-title">
            {title}
          </h3>
          <button type="button" className="btn btn-quiet btn-small" onClick={onClose}>
            Close
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
