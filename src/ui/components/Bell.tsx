import { useEffect, useId, useRef, useState } from 'react';
import type { GameState } from '../../engine/index.ts';
import { bellGroups, bellItems } from '../bell-view.ts';
import { navigate } from '../hooks.ts';

/** The bell at the top (2.2.0): how many things need the player, and a list of them that opens where each is dealt with. */
export function Bell({ state, now }: { state: GameState; now: number }) {
  const [open, setOpen] = useState(false);
  const items = bellItems(state, now);
  const panelId = useId();
  const box = useRef<HTMLDivElement>(null);

  // Closes on Escape and on a tap anywhere else.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: PointerEvent): void => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const groups = bellGroups(items);
  return (
    <div className="bell" ref={box} data-tour="bell">
      <button
        type="button"
        className={`bell-button${items.length > 0 ? ' is-ringing' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={items.length === 0 ? 'Nothing needs you' : `${items.length} ${items.length === 1 ? 'thing needs' : 'things need'} you`}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M12 3a6 6 0 0 0-6 6v4.2L4.3 16.5a.9.9 0 0 0 .8 1.3h13.8a.9.9 0 0 0 .8-1.3L18 13.2V9a6 6 0 0 0-6-6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M9.6 19.6a2.6 2.6 0 0 0 4.8 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        {items.length > 0 && <span className="badge bell-count">{items.length}</span>}
      </button>
      {open && (
        <div id={panelId} className="bell-panel" role="region" aria-label="What needs you">
          {groups.length === 0 ? (
            <p className="bell-empty">Nothing needs you right now.</p>
          ) : (
            groups.map((g) => (
              <section key={g.id} className={`bell-group is-${g.id}`}>
                <h3 className="bell-group-title">{g.title}</h3>
                <ul className="bell-list">
                  {g.items.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        className="bell-item"
                        onClick={() => {
                          setOpen(false);
                          navigate(i.to);
                        }}
                      >
                        <span>{i.text}</span>
                        <span aria-hidden="true">&rsaquo;</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
