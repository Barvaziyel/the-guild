import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { itemName, type RunReport } from '../../engine/index.ts';
import { HOME_BACK_AT, HOME_FLY_AFTER, HOME_FLY_MS, HOME_TOOK_AT, HOME_USED_AT, flights, homecoming } from '../homecoming-view.ts';
import { ItemIcon } from './Art.tsx';
import { Chips, Glyph } from './Glyph.tsx';

const still = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * What a crew took, used and brought back (3.7.0). The first time the report is opened, each thing
 * that came back pops up and flies home: supplies into the Depot's tab, gear into the Gear tab, which
 * bump as it lands (3.7.2; a strip of the Depot's stores under the rows was more confusing than it helped).
 */
export function Homecoming({ report, fresh }: { report: RunReport; fresh: boolean }) {
  const h = useMemo(() => homecoming(report, itemName), [report]);
  const [play] = useState(() => fresh && !still() && !h.empty);
  const plan = useMemo(() => flights(h), [h]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!play) return;
    const timers: number[] = [];
    const clones: HTMLElement[] = [];
    for (const f of plan) {
      timers.push(
        window.setTimeout(() => {
          const el = root.current?.querySelector<HTMLElement>(`[data-fly="${f.key}"]`);
          const target = document.querySelector<HTMLElement>(`.tabbar [data-tab="${f.kind === 'item' ? 'gear' : 'depot'}"]`);
          if (!el || !target || typeof el.animate !== 'function') return;
          const from = el.getBoundingClientRect();
          const to = target.getBoundingClientRect();
          const clone = el.cloneNode(true) as HTMLElement;
          clone.classList.add('home-flyer');
          Object.assign(clone.style, { left: `${from.left}px`, top: `${from.top}px`, width: `${from.width}px`, height: `${from.height}px` });
          document.body.appendChild(clone);
          clones.push(clone);
          const dx = to.left + to.width / 2 - (from.left + from.width / 2);
          const dy = to.top + to.height / 2 - (from.top + from.height / 2);
          const flight = clone.animate(
            [
              { transform: 'translate(0, 0) scale(1)', opacity: 1 },
              { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.1)`, opacity: 1, offset: 0.45 },
              { transform: `translate(${dx}px, ${dy}px) scale(0.45)`, opacity: 0.2 },
            ],
            { duration: HOME_FLY_MS, easing: 'cubic-bezier(0.45, 0, 0.6, 1)', fill: 'forwards' },
          );
          flight.onfinish = () => {
            clone.remove();
            // The tab it lands on gives a little bump.
            target.classList.remove('is-bumped');
            void target.offsetWidth;
            target.classList.add('is-bumped');
          };
        }, f.showAt + HOME_FLY_AFTER),
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
      for (const c of clones) c.remove();
    };
  }, [play, plan]);

  if (h.empty) return <p>Brought nothing home.</p>;
  const shownAt = Object.fromEntries(plan.map((f) => [f.key, f.showAt]));
  return (
    <div ref={root} className={`home${play ? ' is-playing' : ''}`}>
      {h.took.length > 0 && (
        <div className="home-row is-took" style={{ '--at': `${HOME_TOOK_AT}ms` } as CSSProperties}>
          <span className="home-label">Took</span>
          <Chips chips={h.took} />
        </div>
      )}
      {h.used.length > 0 && (
        <div className="home-row is-used" style={{ '--at': `${HOME_USED_AT}ms` } as CSSProperties}>
          <span className="home-label">Used</span>
          <Chips chips={h.used} />
        </div>
      )}
      <div className="home-row is-back" style={{ '--at': `${HOME_BACK_AT}ms` } as CSSProperties}>
        <span className="home-label">Back</span>
        <span className="tags home-back">
          {h.back.length === 0 && h.items.length === 0 && <span className="tag">nothing</span>}
          {h.back.map((c) => (
            <span
              key={c.glyph}
              data-fly={c.glyph}
              className="tag is-good home-pop"
              style={{ '--at': `${shownAt[c.glyph] ?? HOME_BACK_AT}ms` } as CSSProperties}
              aria-label={c.label}
              {...(c.label ? { 'data-tip': c.label } : {})}
            >
              <Glyph name={c.glyph} className={`res-${c.glyph}`} />
              <span aria-hidden="true">{c.text}</span>
            </span>
          ))}
          {h.items.map((i) => (
            <span key={i.uid} data-fly={i.uid} className="haul-item home-pop" style={{ '--at': `${shownAt[i.uid] ?? HOME_BACK_AT}ms` } as CSSProperties}>
              <ItemIcon defId={i.defId} quality={i.quality} /> {i.name}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
