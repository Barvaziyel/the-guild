import { buildVehicle, dayAt, repairVehicle, type GameState } from '../../engine/index.ts';
import { Meter } from '../components/Bars.tsx';
import { goBack, navigate, useAction } from '../hooks.ts';
import { vehicleBuildRows, vehicleRows } from '../vehicles-view.ts';

const today = (s: GameState): number => dayAt(s, Date.now());

/** The guild's vehicles: what each does, its condition and repairs, and what the Workshop can build. */
export function Vehicles({ state }: { state: GameState }) {
  const { act, error } = useAction();
  const rows = vehicleRows(state);
  const builds = vehicleBuildRows(state);

  return (
    <article className="sheet" aria-labelledby="vehicles-title">
      <div className="sheet-nav">
        <button type="button" className="back" onClick={() => goBack({ screen: 'depot' })}>
          <span aria-hidden="true">&lsaquo;</span> The Depot
        </button>
      </div>
      <header className="sheet-head">
        <h2 id="vehicles-title" className="plan-title">
          Vehicles
        </h2>
        <p className="place-facts">
          They seat more than four, get there faster and carry more home. They&rsquo;re loud, burn gas every run and wear down, and a worn one can be
          wrecked out there. Gas: {state.resources.gas}.
        </p>
      </header>

      <section className="panel" aria-labelledby="garage-title" data-tour="vehicles">
        <h3 id="garage-title" className="panel-title">
          In the yard
        </h3>
        {rows.length === 0 ? (
          <p className="panel-help">None yet. Scouting turns up the odd wreck worth getting running, traders sometimes sell one, and the Workshop can build a motorcycle or a car.</p>
        ) : (
          <ul className="vehicles">
            {rows.map((r) => (
              <li key={r.vehicle.id} className="vehicle">
                <h4 className="vehicle-name">{r.name}</h4>
                <p className="vehicle-desc">{r.description}</p>
                <p className="item-stats">{r.facts}</p>
                <Meter label="Condition" value={r.condition} max={100} reading={r.conditionLabel} kind="hp" />
                <p className="vehicle-status">{r.status}</p>
                {r.repair && (
                  <div className="recipe">
                    <span className="recipe-body">
                      <span className="recipe-cost">{r.repair.problem ?? `Repair to full: ${r.repair.cost}.`}</span>
                    </span>
                    <button type="button" className="btn btn-small" disabled={r.repair.problem !== undefined} onClick={() => act((s) => void repairVehicle(s, r.vehicle.id, today(s)))}>
                      Repair
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {rows.length > 0 && (
          <button type="button" className="btn btn-small btn-quiet" onClick={() => navigate({ screen: 'reach' })}>
            Plan a run
          </button>
        )}
      </section>

      <section className="panel" aria-labelledby="build-title">
        <h3 id="build-title" className="panel-title">
          Build in the Workshop
        </h3>
        <ul className="recipes">
          {builds.map((b) => (
            <li key={b.id} className="recipe">
              <span className="recipe-body">
                <span className="item-name">{b.name}</span>
                <span className="item-stats">{b.facts}</span>
                <span className="recipe-cost">{b.problem && b.problem !== `Needs ${b.cost}.` ? b.problem : `Costs ${b.cost}.`}</span>
              </span>
              <button type="button" className="btn btn-small" disabled={b.problem !== undefined} onClick={() => act((s) => void buildVehicle(s, b.id, today(s)))}>
                Build
              </button>
            </li>
          ))}
        </ul>
        {error && <p className="field-error">{error}</p>}
      </section>
    </article>
  );
}
