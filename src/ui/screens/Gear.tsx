import { useState } from 'react';
import { canChangeGear, dayAt, equipFromStash, getSurvivor, salvage, salvageSpares, type GameState } from '../../engine/index.ts';
import { ItemDetails } from '../components/ItemDetails.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { gearTakers, salvageButton, sparesPanel, stashGroups, stashLine } from '../gear-view.ts';
import { GearSlots } from '../components/GearSlots.tsx';
import { seeStash } from '../attention-view.ts';
import { rosterOrder } from '../view.ts';
import { vehiclesLine } from '../vehicles-view.ts';
import { navigate, useAction, useMarkSeen, useSeen } from '../hooks.ts';
import type { ItemView } from '../view.ts';
import { ItemIcon } from '../components/Art.tsx';
import { Chips, Glyph } from '../components/Glyph.tsx';

/** The guild's stash, with a way to hand each piece to someone, and what everyone carries. */
export function Gear({ state }: { state: GameState }) {
  const { act, error } = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const [given, setGiven] = useState<string | null>(null);
  const groups = stashGroups(state);
  const spares = sparesPanel(state);
  // What came in since the last look keeps its dot while the tab is open; leaving, it's seen (3.5.0).
  const seen = useSeen(state);
  const [fresh] = useState(() => new Set(state.stash.filter((i) => !seen.stash.includes(i.uid)).map((i) => i.uid)));
  useMarkSeen(state, seeStash, [state.stash.length]);
  const people = rosterOrder(state);

  const takeApart = (item: ItemView): void => {
    if (!act((st) => salvage(st, item.uid, dayAt(st, Date.now())))) return;
    setOpen(null);
    setGiven(`The ${item.name} is in pieces in the Workshop.`);
  };

  const give = (item: ItemView, survivorId: string): void => {
    const ok = act((st) => {
      if (!equipFromStash(st, getSurvivor(st, survivorId), item.uid)) throw new Error(`Couldn't hand over the ${item.name}.`);
    });
    if (!ok) return;
    setOpen(null);
    setGiven(`${getSurvivor(state, survivorId).firstName} has the ${item.name} now.`);
  };

  return (
    <section aria-labelledby="gear-title">
      <div className="screen-head">
        <h2 id="gear-title" className="screen-title">
          Gear
        </h2>
        <p className="screen-sub">{stashLine(state)}</p>
      </div>

      <section className="panel" aria-labelledby="everyone-title" data-tour="gear">
        <h3 id="everyone-title" className="panel-title">
          Everyone
        </h3>
        <ul className="carried">
          {people.map((s) => (
            <li key={s.id}>
              <button type="button" className="pick pick-person carried-row" onClick={() => navigate({ screen: 'survivor', id: s.id, tab: 'stats' })}>
                <Portrait survivor={s} size={40} decorative />
                <span className="pick-text">
                  <span className="item-name">
                    {s.firstName} {s.lastName}
                    {!canChangeGear(s) && <span className="carried-away"> · out</span>}
                  </span>
                  <GearSlots state={state} survivor={s} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {spares && (
        <section className="panel" aria-labelledby="spares-title" data-tour="salvage">
          <h3 id="spares-title" className="panel-title">
            Spare gear
          </h3>
          {spares.chips ? <Chips chips={spares.chips} className="spares-chips" /> : <p className="panel-help">{spares.text}</p>}
          {spares.button && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (act((st) => salvageSpares(st, dayAt(st, Date.now())))) setGiven('The spare gear is in pieces in the Workshop.');
              }}
            >
              {spares.button}
            </button>
          )}
        </section>
      )}

      <section className="panel" aria-labelledby="stash-title">
        <h3 id="stash-title" className="panel-title">
          In the stash
        </h3>
        {given && (
          <p className="hint" role="status">
            {given}
          </p>
        )}
        {groups.length === 0 ? (
          <p className="empty">Nothing here.</p>
        ) : (
          groups.map((g) => (
            <div key={g.slot} className="stash-group">
              <h4 className="slot-name">{g.title}</h4>
              <ul>
                {g.items.map((item) => (
                  <li key={item.uid} className="gear-slot">
                    <div className="gear-row">
                      <span className="fresh-wrap">
                        <ItemIcon defId={item.defId} quality={item.quality} />
                        {fresh.has(item.uid) && <span className="dot dot-corner" aria-label="New" />}
                      </span>
                      <div className="gear-item">
                        <ItemDetails view={item} />
                      </div>
                      <button
                        type="button"
                        className="btn"
                        aria-expanded={open === item.uid}
                        onClick={() => {
                          setGiven(null);
                          setOpen(open === item.uid ? null : item.uid);
                        }}
                      >
                        Give
                      </button>
                    </div>
                    {open === item.uid && (
                      <div className="picker">
                        <ul>
                          {gearTakers(state, item.uid).map((t) => (
                            <li key={t.survivor.id}>
                              <button type="button" className="pick pick-person" disabled={t.problem !== undefined} onClick={() => give(item, t.survivor.id)}>
                                <Portrait survivor={t.survivor} size={40} decorative />
                                <span className="pick-text">
                                  <span className="item-name">
                                    {t.survivor.firstName} {t.survivor.lastName}
                                  </span>
                                  <span className="item-stats">{t.problem ?? t.current}</span>
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                        <SalvageButton state={state} uid={item.uid} onTake={() => takeApart(item)} />
                        <button type="button" className="btn btn-small btn-quiet" onClick={() => setOpen(null)}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {error && <p className="field-error">{error}</p>}
      </section>

      <section className="panel" aria-labelledby="vehicles-title" data-tour="vehicles-panel">
        <h3 id="vehicles-title" className="panel-title">
          Vehicles
        </h3>
        <button type="button" className="link-row" onClick={() => navigate({ screen: 'vehicles' })}>
          {state.vehicles.length === 0 ? 'None yet.' : vehiclesLine(state)} <Glyph name="gas" /> {state.resources.gas}
        </button>
      </section>
    </section>
  );
}

/** Below the people to give it to: taking it apart instead, or why it can't be. */
function SalvageButton({ state, uid, onTake }: { state: GameState; uid: string; onTake: () => void }) {
  const b = salvageButton(state, uid);
  return (
    <div className="salvage-row">
      <button type="button" className="btn btn-small" disabled={b.problem !== undefined} onClick={onTake}>
        {b.label}
      </button>
      {b.problem && <span className="crew-reason">{b.problem}</span>}
    </div>
  );
}
