import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { dayAt, setKeeper, type GameState } from '../../engine/index.ts';
import { animalRows } from '../animals-view.ts';
import { navigate, useAction } from '../hooks.ts';
import { yardSvg } from '../../scene/index.ts';

import { parseRoute } from '../route.ts';
import { awayLines, yardModel } from '../yard-view.ts';

interface Picked {
  key: string;
  label: string;
  go: string;
}

/**
 * The Depot drawn as it is right now. A tap picks something and says what it
 * is; the button under the drawing opens it.
 */
export function Yard({ state, now }: { state: GameState; now: number }) {
  const hour = new Date(now).getHours();
  const model = useMemo(() => yardModel(state, hour, dayAt(state, now)), [state, hour, now]);
  const key = JSON.stringify(model);
  // The drawing only changes when what it shows does, so its animations keep running.
  const svg = useMemo(() => yardSvg(model), [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const box = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);

  // What's picked is drawn again on top of everything, glowing, so it stands out even at night.
  useEffect(() => {
    const root = box.current;
    const drawing = root?.querySelector('svg');
    if (!root || !drawing) return;
    root.querySelectorAll('#yard-picked').forEach((el) => el.removeAttribute('id'));
    root.querySelectorAll('.yard-picked-copy').forEach((el) => el.remove());
    if (!picked) return;
    const el = [...root.querySelectorAll<SVGElement>('[data-key]')].find((e) => e.dataset.key === picked.key);
    if (!el) {
      setPicked(null);
      return;
    }
    el.id = 'yard-picked';
    const copy = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    copy.setAttribute('href', '#yard-picked');
    copy.setAttribute('class', 'yard-picked-copy');
    copy.setAttribute('pointer-events', 'none');
    drawing.appendChild(copy);
  }, [picked, svg]);

  const pick = (target: EventTarget | null): void => {
    const el = target instanceof Element ? target.closest<SVGElement>('[data-key]') : null;
    if (!el) {
      setPicked(null);
      return;
    }
    const { key: k = '', label = '', go = '' } = el.dataset;
    setPicked((p) => (p?.key === k ? null : { key: k, label, go }));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    pick(e.target);
  };

  const away = awayLines(state);
  return (
    <section aria-label="The yard">
      <div ref={box} className="yard-scene" data-tour="yard" onClick={(e: MouseEvent) => pick(e.target)} onKeyDown={onKey} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="yard-caption" role="status">
        {picked ? (
          <>
            <p>{picked.label}</p>
            {picked.key.startsWith('a:') ? (
              <button type="button" className="btn btn-small" onClick={() => document.getElementById('animals')?.scrollIntoView({ behavior: 'smooth' })}>
                See the animals
              </button>
            ) : (
              <button type="button" className="btn btn-small" onClick={() => navigate(parseRoute(picked.go))}>
                {picked.key.startsWith('s:') ? 'Open their sheet' : picked.key === 'trader' ? 'See the offer' : 'Open'}
              </button>
            )}
          </>
        ) : (
          <p className="panel-help">Tap anyone or anything to see who or what it is.</p>
        )}
      </div>
      {away.length > 0 && (
        <div className="panel">
          <h3 className="panel-title">Out in the Reach</h3>
          {away.map((line) => (
            <p key={line} className="panel-help">
              {line}
            </p>
          ))}
        </div>
      )}
      <Animals state={state} />
    </section>
  );
}

/** The guild's animals (§9.7): what each does, and who looks after it. */
function Animals({ state }: { state: GameState }) {
  const { act, error } = useAction();
  const rows = animalRows(state);
  if (rows.length === 0) return null;
  return (
    <div className="panel" id="animals">
      <h3 className="panel-title">Animals</h3>
      <p className="panel-help">Whoever looks after an animal sheds a little more stress at home with it.</p>
      <ul className="animal-list">
        {rows.map((r) => (
          <li key={r.id} className="animal">
            <p className="animal-title">{r.title}</p>
            <p className="panel-help">{r.description}</p>
            <p>{r.effect}</p>
            <label className="field select-field">
              Looked after by
              <select value={r.keeperId ?? ''} onChange={(e) => act((s) => setKeeper(s, r.id, e.target.value, dayAt(s, Date.now())))}>
                {!r.keeperId && <option value="">Nobody</option>}
                {r.keepers.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                  </option>
                ))}
              </select>
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
