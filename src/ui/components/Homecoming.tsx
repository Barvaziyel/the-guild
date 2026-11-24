import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { itemName, RESOURCE_IDS, type GameState, type RunReport } from '../../engine/index.ts';
import { GLYPHS } from '../glyphs.ts';
import { HOME_BACK_AT, HOME_FLY_AFTER, HOME_FLY_MS, HOME_TOOK_AT, HOME_USED_AT, flights, homecoming, storesBefore } from '../homecoming-view.ts';
import { COUNT_MS, countAt } from '../motion-view.ts';
import { ItemIcon } from './Art.tsx';
import { Chips, Glyph } from './Glyph.tsx';

const still = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * What a crew took, used and brought back (3.7.0). The first time the report is opened, each thing
 * that came back pops up and flies into the Depot's stores, which count up to what's there now.
 */
export function Homecoming({ state, report, fresh }: { state: GameState; report: RunReport; fresh: boolean }) {
  const h = useMemo(() => homecoming(report, itemName), [report]);
  const [play] = useState(() => fresh && !still() && !h.empty);
  const plan = useMemo(() => flights(h), [h]);
  const root = useRef<HTMLDivElement>(null);
  const [landed, setLanded] = useState<Record<string, true>>({});
  // The stores before the haul: what's there now, less what came back (taken once, so they don't move under it).
  const [before] = useState(() => storesBefore(state.resources, h.backBy));
  const [stashBefore] = useState(() => Math.max(0, state.stash.length - h.items.length));

  useEffect(() => {
    if (!play) return;
    const timers: number[] = [];
    const clones: HTMLElement[] = [];
    for (const f of plan) {
      timers.push(
        window.setTimeout(() => {
          const el = root.current?.querySelector<HTMLElement>(`[data-fly="${f.key}"]`);
          const target = root.current?.querySelector<HTMLElement>(`[data-store="${f.kind === 'item' ? 'stash' : f.key}"]`);
          const land = (): void => setLanded((l) => ({ ...l, [f.kind === 'item' ? `stash:${f.key}` : f.key]: true }));
          if (!el || !target || typeof el.animate !== 'function') return land();
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
              { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 28}px) scale(1.1)`, opacity: 1, offset: 0.45 },
              { transform: `translate(${dx}px, ${dy}px) scale(0.5)`, opacity: 0.2 },
            ],
            { duration: HOME_FLY_MS, easing: 'cubic-bezier(0.45, 0, 0.6, 1)', fill: 'forwards' },
          );
          flight.onfinish = () => {
            clone.remove();
            land();
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
  const stashLanded = h.items.filter((i) => landed[`stash:${i.uid}`]).length;
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
      {play && (
        <div className="home-stores" aria-hidden="true">
          {RESOURCE_IDS.map((r) => (
            <span key={r} className="home-store" data-store={r}>
              <Glyph name={r} className={`res-glyph res-${r}`} />
              {/* Up by what this crew brought, from what was there before them: not whatever else came in since. */}
              <StoreCount from={before[r]} to={before[r] + (h.backBy[r] ?? 0)} go={landed[r] === true} />
            </span>
          ))}
          {h.items.length > 0 && (
            <span className="home-store" data-store="stash">
              <svg className="glyph res-glyph" viewBox="0 0 24 24" aria-hidden="true">
                <path d={GLYPHS.crate} />
              </svg>
              <StoreCount from={stashBefore} to={stashBefore + stashLanded} go={stashLanded > 0} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** A store's count: still until something lands, then counting to its new amount, with the change floating up. */
function StoreCount({ from, to, go }: { from: number; to: number; go: boolean }) {
  const [shown, setShown] = useState(from);
  const last = useRef(from);
  useEffect(() => {
    if (!go) return;
    const start = performance.now();
    const begin = last.current;
    last.current = to;
    let frame = 0;
    const step = (t: number): void => {
      const elapsed = t - start;
      setShown(countAt(begin, to, elapsed));
      if (elapsed < COUNT_MS) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [go, to]);
  const gained = to - from;
  return (
    <span className="res-amount-box">
      <span key={go ? `on${to}` : 'off'} className={`res-amount${go && gained > 0 ? ' is-up' : ''}`}>
        {shown}
      </span>
      {go && gained > 0 && (
        <span key={`c${to}`} className="res-change is-up">
          +{gained}
        </span>
      )}
    </span>
  );
}

