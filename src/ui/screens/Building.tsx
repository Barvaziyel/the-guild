import { useState } from 'react';
import {
  BUILDING_IDS,
  assignPost,
  build,
  buildingDef,
  hasEmptyBed,
  keepFamilyBed,
  craft,
  dayAt,
  statName,
  upgradeItem,
  type BuildingId,
  type GameState,
  type StatId,
} from '../../engine/index.ts';
import { Portrait } from '../components/Portrait.tsx';
import { goBack, navigate, useAction } from '../hooks.ts';
import { buildingRow, postCandidates, recipeRows, trainableStats, upgradeRows, workerLine } from '../depot-view.ts';

const today = (s: GameState): number => dayAt(s, Date.now());

export function Building({ state, id }: { state: GameState; id: string }) {
  const known = (BUILDING_IDS as readonly string[]).includes(id);
  return (
    <article className="sheet building">
      <div className="sheet-nav">
        <button type="button" className="back" onClick={() => goBack({ screen: 'depot', tab: 'buildings' })}>
          <span aria-hidden="true">&lsaquo;</span> The Depot
        </button>
      </div>
      {known ? <BuildingBody state={state} id={id as BuildingId} /> : <p className="empty">There&rsquo;s no such building at the Depot.</p>}
    </article>
  );
}

function BuildingBody({ state, id }: { state: GameState; id: BuildingId }) {
  const r = buildingRow(state, id);
  const def = buildingDef(id);
  const { act, error } = useAction();

  return (
    <>
      <header className="sheet-head">
        <p className="place-biome">{r.built ? `Level ${r.level} of 3` : 'Not built yet'}</p>
        <h2 className="plan-title">{r.name}</h2>
        <p className="backstory">{r.description}</p>
      </header>

      <section className="panel">
        {r.built && (
          <>
            <h3 className="panel-title">Now</h3>
            <p>{r.effect}</p>
            <p className="building-now">{r.status}</p>
            {r.upkeep && <p className="panel-help">{r.upkeep}</p>}
            {r.unpaid && <p className="field-error">{r.unpaid}</p>}
          </>
        )}
        {r.next ? (
          <div className={r.built ? 'next-level' : undefined}>
            <h3 className="panel-title">{r.built ? `Level ${r.level + 1}` : 'Build it'}</h3>
            <p>{r.next.effect}</p>
            <p className="panel-help">Costs {r.next.cost}.</p>
            {r.next.problem && <p className="field-error">{r.next.problem}</p>}
            <button type="button" className="btn btn-primary" disabled={r.next.problem !== undefined} onClick={() => act((s) => build(s, id, today(s)))}>
              {r.built ? `Improve to level ${r.level + 1}` : `Build the ${def.name}`}
            </button>
          </div>
        ) : (
          <p className="panel-help">As good as it gets.</p>
        )}
        {error && <p className="field-error">{error}</p>}
      </section>

      {r.built && id === 'bunks' && <FamilyBed state={state} />}
      {r.built && r.slots > 0 && <Workers state={state} id={id} />}
      {r.built && id === 'workshop' && <Workshop state={state} />}
    </>
  );
}

/** Keep a bed free so a couple can have a baby (§5.3). */
function FamilyBed({ state }: { state: GameState }) {
  const { act } = useAction();
  const on = state.depot.familyBed === true;
  return (
    <section className="panel" aria-labelledby="family-bed-title">
      <h3 id="family-bed-title" className="panel-title">
        A bed for a family
      </h3>
      <p className="panel-help">
        A couple at home can only have a baby with a bed free for it. Keep one free, and nobody new takes it: not recruits, not people your crews bring home.
      </p>
      {on && <p className="building-now">{hasEmptyBed(state) ? 'One bed is kept free for a family.' : 'The next bed to come free will be kept for a family.'}</p>}
      <button type="button" className={on ? 'btn' : 'btn btn-primary'} onClick={() => act((s) => keepFamilyBed(s, !on))}>
        {on ? 'Let anyone take it' : 'Keep a bed free'}
      </button>
    </section>
  );
}

function Workers({ state, id }: { state: GameState; id: BuildingId }) {
  const r = buildingRow(state, id);
  const training = buildingDef(id).workStat === 'any';
  const [adding, setAdding] = useState(false);
  const { act, error } = useAction();
  const full = r.workers.length >= r.slots;

  return (
    <section className="panel" aria-labelledby="workers-title" data-tour="workers">
      <h3 id="workers-title" className="panel-title">
        {training ? 'Training here' : 'Working here'} <span className="count">{r.workers.length} of {r.slots}</span>
      </h3>
      {r.workers.length === 0 && <p className="panel-help">Nobody yet.</p>}
      <ul className="workers">
        {r.workers.map((s) => {
          const line = workerLine(state, s);
          return (
            <li key={s.id} className="worker">
              <button type="button" className="worker-face" onClick={() => navigate({ screen: 'survivor', id: s.id, tab: 'stats' })}>
                <Portrait survivor={s} size={48} decorative />
              </button>
              <span className="worker-body">
                <span className="crew-name">
                  {s.firstName} {s.lastName}
                </span>
                {training ? (
                  <label className="train-pick">
                    Trains
                    <select
                      value={(s.post && 'stat' in s.post ? s.post.stat : undefined) ?? ''}
                      onChange={(e) => act((st) => assignPost(st, s.id, { building: id, stat: e.target.value as StatId }))}
                    >
                      {trainableStats(s).map((stat) => (
                        <option key={stat} value={stat}>
                          {statName(stat)} ({s.stats[stat]})
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="crew-stats">{line.stat}</span>
                )}
                {line.away && <span className="crew-reason">{line.away}</span>}
              </span>
              <button type="button" className="btn btn-small btn-quiet" onClick={() => act((st) => assignPost(st, s.id, undefined))}>
                Take off
              </button>
            </li>
          );
        })}
      </ul>
      {!full &&
        (adding ? (
          <div className="picker">
            <ul>
              {postCandidates(state, id).map((c) => (
                <li key={c.survivor.id}>
                  <button
                    type="button"
                    className="pick pick-person"
                    disabled={c.problem !== undefined}
                    onClick={() => {
                      if (act((st) => assignPost(st, c.survivor.id, { building: id }))) setAdding(false);
                    }}
                  >
                    <Portrait survivor={c.survivor} size={40} decorative />
                    <span className="pick-text">
                      <span className="item-name">
                        {c.survivor.firstName} {c.survivor.lastName}
                      </span>
                      <span className="item-stats">{[c.stat, c.current].filter(Boolean).join('. ')}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-small btn-quiet" onClick={() => setAdding(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            Post someone here
          </button>
        ))}
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}

function Workshop({ state }: { state: GameState }) {
  const { act, error } = useAction();
  const recipes = recipeRows(state);
  const upgrades = upgradeRows(state);
  return (
    <>
      <section className="panel" aria-labelledby="make-title">
        <h3 id="make-title" className="panel-title">
          Make
        </h3>
        <p className="panel-help">New gear goes to the stash. Hand it out from a survivor&rsquo;s sheet.</p>
        <ul className="recipes">
          {recipes.map((r) => (
            <li key={r.gear} className="recipe">
              <span className="recipe-body">
                <span className="item-name">{r.name}</span>
                <span className="item-stats">{r.stats}</span>
                <span className="recipe-cost">{r.problem && r.problem !== `Needs ${r.cost}.` ? r.problem : `Costs ${r.cost}.`}</span>
              </span>
              <button type="button" className="btn btn-small" disabled={r.problem !== undefined} onClick={() => act((s) => void craft(s, r.gear, today(s)))}>
                Make
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel" aria-labelledby="improve-title">
        <h3 id="improve-title" className="panel-title">
          Improve
        </h3>
        {upgrades.length === 0 ? (
          <p className="panel-help">Nothing at the Depot can be improved.</p>
        ) : (
          <ul className="recipes">
            {upgrades.map((u) => (
              <li key={u.item.uid} className="recipe">
                <span className="recipe-body">
                  <span className="item-name">
                    {u.name}
                    {u.holder && <span className="holder"> ({u.holder})</span>}
                  </span>
                  <span className="item-stats">Becomes {u.to}.</span>
                  <span className="recipe-cost">{u.problem && u.problem !== `Needs ${u.cost}.` ? u.problem : `Costs ${u.cost}.`}</span>
                </span>
                <button type="button" className="btn btn-small" disabled={u.problem !== undefined} onClick={() => act((s) => void upgradeItem(s, u.item.uid, today(s)))}>
                  Improve
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="field-error">{error}</p>}
      </section>
      <section className="panel">
        <h3 className="panel-title">Vehicles</h3>
        <p className="panel-help">The Workshop also repairs vehicles, and builds motorcycles and cars.</p>
        <button type="button" className="btn btn-small" onClick={() => navigate({ screen: 'vehicles' })}>
          Go to the vehicles
        </button>
      </section>
    </>
  );
}
