import { useState } from 'react';
import { dayAt, equipFromStash, getSurvivor, salvage, salvageSpares, type GameState } from '../../engine/index.ts';
import { ItemDetails } from '../components/ItemDetails.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { carriedRows, gearTakers, salvageButton, sparesPanel, stashGroups, stashLine } from '../gear-view.ts';
import { goBack, navigate, useAction } from '../hooks.ts';
import type { ItemView } from '../view.ts';

/** The guild's stash, with a way to hand each piece to someone, and what everyone carries. */
export function Gear({ state }: { state: GameState }) {
  const { act, error } = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const [given, setGiven] = useState<string | null>(null);
  const groups = stashGroups(state);
  const carried = carriedRows(state);
  const spares = sparesPanel(state);

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
    <article className="sheet" aria-labelledby="gear-title">
      <div className="sheet-nav">
        <button type="button" className="back" onClick={() => goBack({ screen: 'depot' })}>
          <span aria-hidden="true">&lsaquo;</span> The Depot
        </button>
      </div>
      <header className="sheet-head">
        <h2 id="gear-title" className="plan-title">
          Gear
        </h2>
        <p className="place-facts">{stashLine(state)} People change gear only while they&rsquo;re at the Depot. What nobody needs can be taken apart in the Workshop for scrap.</p>
      </header>

      {spares && (
        <section className="panel" aria-labelledby="spares-title" data-tour="salvage">
          <h3 id="spares-title" className="panel-title">
            Spare gear
          </h3>
          <p className="panel-help">{spares.text}</p>
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
          <p className="panel-help">Nothing here. Crews bring gear home from runs, and the Workshop makes it.</p>
        ) : (
          groups.map((g) => (
            <div key={g.slot} className="stash-group">
              <h4 className="slot-name">{g.title}</h4>
              <ul>
                {g.items.map((item) => (
                  <li key={item.uid} className="gear-slot">
                    <div className="gear-row">
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

      <section className="panel" aria-labelledby="carried-title">
        <h3 id="carried-title" className="panel-title">
          Carried
        </h3>
        {carried.length === 0 ? (
          <p className="panel-help">Nobody is carrying anything.</p>
        ) : (
          <ul className="carried">
            {carried.map((r) => (
              <li key={r.survivor.id}>
                <button type="button" className="pick pick-person" onClick={() => navigate({ screen: 'survivor', id: r.survivor.id, tab: 'stats' })}>
                  <Portrait survivor={r.survivor} size={40} decorative />
                  <span className="pick-text">
                    <span className="item-name">
                      {r.survivor.firstName} {r.survivor.lastName}
                    </span>
                    <span className="item-desc">
                      {r.items.join(', ')}
                      {r.away ? '. Out on a run.' : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </article>
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
