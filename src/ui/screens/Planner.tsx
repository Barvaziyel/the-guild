import { useEffect, useMemo, useState } from 'react';
import {
  crewLimit,
  estimateRisk,
  findLocation,
  locationState,
  planWarnings,
  runDuration,
  startRun,
  validatePlan,
  type GameState,
  type ResourceId,
  type RiskEstimate,
  type RunPlan,
} from '../../engine/index.ts';
import { Vitals } from '../components/Bars.tsx';
import { MiniStepper, Segmented } from '../components/Choices.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { goBack, navigate, useNow, useServices } from '../hooks.ts';
import {
  APPROACHES,
  JOBS,
  LOOT_PRIORITIES,
  RETREATS,
  crewLine,
  crewOptions,
  dangerText,
  defaultPlan,
  formatDuration,
  radiationText,
  rationsNote,
  riskText,
  suggestedAmmo,
  toggleCrew,
} from '../runs-view.ts';
import { errorMessage } from '../persist.ts';
import { depthChoices, outpostPlanNote, withDepth } from '../outposts-view.ts';
import { jobChoices, withRescue } from '../rescue-view.ts';
import { assaultChoice } from '../vultures-view.ts';
import { toggleVehicle, vehicleChoices, vehicleNote } from '../vehicles-view.ts';
import { clockTime } from '../time.ts';
import { leadChoice } from '../fight-view.ts';

export function Planner({ state, locationId, step }: { state: GameState; locationId: string; step: 'crew' | 'orders' }) {
  const loc = findLocation(locationId);
  if (!loc || !locationState(state, locationId).discovered) {
    return (
      <div className="sheet">
        <PlannerNav step="crew" locationId={locationId} />
        <p className="empty">The guild doesn&rsquo;t know the way there yet.</p>
      </div>
    );
  }
  return <PlannerForm state={state} locationId={locationId} step={step} />;
}

function PlannerNav({ step, locationId }: { step: 'crew' | 'orders'; locationId: string }) {
  return (
    <div className="sheet-nav">
      {step === 'orders' ? (
        <button type="button" className="back" onClick={() => goBack({ screen: 'plan', locationId })}>
          <span aria-hidden="true">&lsaquo;</span> Crew
        </button>
      ) : (
        <button type="button" className="back" onClick={() => goBack({ screen: 'reach' })}>
          <span aria-hidden="true">&lsaquo;</span> The Reach
        </button>
      )}
    </div>
  );
}

/**
 * Planning a run, in two steps (Aviel, 2.2.0): who goes, then the orders,
 * which fit a screen with *Send them* right under them. The plan lives here,
 * across both steps (the step is in the address, so Back goes from the orders
 * to the crew).
 */
function PlannerForm({ state, locationId, step }: { state: GameState; locationId: string; step: 'crew' | 'orders' }) {
  const { store } = useServices();
  const now = useNow(30_000);
  // While someone is calling for help from here, the plan starts as a rescue (§10.1).
  const [plan, setPlan] = useState<RunPlan>(() => withRescue(state, defaultPlan(state, locationId)));
  const [ammoTouched, setAmmoTouched] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const loc = findLocation(locationId)!;
  const options = crewOptions(state);

  const change = (patch: Partial<RunPlan>): void => {
    setPlan((p) => ({ ...p, ...patch }));
    setSendError(null);
  };
  const limit = crewLimit(state, plan);
  const vehicles = vehicleChoices(state);
  // A rescue goes to the outskirts, where the call came from.
  const depths = plan.job === 'rescue' || plan.job === 'assault' ? [] : depthChoices(state, locationId);
  const assault = assaultChoice(state, locationId);
  const jobs = jobChoices(state, locationId, assault ? [...JOBS, assault] : JOBS);
  const fromOutpost = outpostPlanNote(state, plan);
  const lead = leadChoice(state);
  const toggle = (id: string): void => {
    const crew = toggleCrew(plan.crew, id, limit);
    change(ammoTouched ? { crew } : { crew, ammo: suggestedAmmo(state, crew) });
  };
  const toggleRide = (id: string): void => {
    setPlan((p) => toggleVehicle(p, id));
    setSendError(null);
  };

  const problems = plan.crew.length === 0 ? [] : validatePlan(state, plan);
  const warnings = plan.crew.length === 0 ? [] : planWarnings(state, plan);
  const duration = runDuration(state, plan);
  const ready = plan.crew.length > 0 && problems.length === 0;
  const risk = useRisk(state, plan, ready && step === 'orders');

  const send = (): void => {
    let id = '';
    try {
      store.update((s) => {
        id = startRun(s, plan, Date.now()).id;
      });
    } catch (err) {
      setSendError(errorMessage(err));
      return;
    }
    navigate({ screen: 'run', id }, { replace: true });
  };

  const header = (
    <header className="sheet-head planner-head">
      <h2 id="plan-title" className="plan-title">
        <span className="visually-hidden">Plan a run to </span>
        {loc.name}
      </h2>
      <p className="place-facts">
        {dangerText(loc.danger)}, {radiationText(loc.radiation).toLowerCase()}, about {formatDuration(loc.durationMin * 60_000)} on foot.
      </p>
      <ol className="plan-steps" aria-label="Steps">
        <li aria-current={step === 'crew' ? 'step' : undefined}>
          <button type="button" onClick={() => step === 'orders' && goBack({ screen: 'plan', locationId })}>
            1. Crew <span className="count">{plan.crew.length > 0 ? crewLine(state, plan.crew) : 'nobody yet'}</span>
          </button>
        </li>
        <li aria-current={step === 'orders' ? 'step' : undefined}>
          <button type="button" disabled={plan.crew.length === 0} onClick={() => step === 'crew' && navigate({ screen: 'plan', locationId, step: 'orders' })}>
            2. Orders
          </button>
        </li>
      </ol>
    </header>
  );

  if (step === 'crew') {
    return (
      <article className="sheet planner" aria-labelledby="plan-title">
        <PlannerNav step="crew" locationId={locationId} />
        {header}
        {vehicles.length > 0 && (
          <section className="panel" aria-labelledby="ride-title">
            <h3 id="ride-title" className="panel-title">
              Vehicles
            </h3>
            <ul className="crew-pick">
              {vehicles.map((v) => {
                const picked = (plan.vehicles ?? []).includes(v.vehicle.id);
                return (
                  <li key={v.vehicle.id}>
                    <label className={`crew-option ride-option${v.reason ? ' is-unavailable' : ''}${picked ? ' is-picked' : ''}`}>
                      <input type="checkbox" checked={picked} disabled={v.reason !== undefined && !picked} onChange={() => toggleRide(v.vehicle.id)} />
                      <span className="crew-body">
                        <span className="crew-name">{v.name}</span>
                        {v.reason ? <span className="crew-reason">{v.reason}</span> : <span className="crew-stats">{v.label}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="panel-help">{vehicleNote(state, plan)}</p>
          </section>
        )}

        <section className="panel" aria-labelledby="crew-title" data-tour="crew">
          <h3 id="crew-title" className="panel-title">
            Crew <span className="count">{plan.crew.length} of {limit}</span>
          </h3>
          <ul className="crew-pick">
            {options.map(({ survivor: s, reason, stats }) => {
              const picked = plan.crew.includes(s.id);
              const full = !picked && plan.crew.length >= limit;
              return (
                <li key={s.id}>
                  <label className={`crew-option${reason ? ' is-unavailable' : ''}${picked ? ' is-picked' : ''}`}>
                    <input type="checkbox" checked={picked} disabled={reason !== undefined || full} onChange={() => toggle(s.id)} />
                    <Portrait survivor={s} size={52} decorative />
                    <span className="crew-body">
                      <span className="crew-name">
                        {s.firstName} {s.lastName}
                      </span>
                      {reason ? <span className="crew-reason">{reason}</span> : <span className="crew-stats">{stats}</span>}
                      {!reason && <Vitals survivor={s} />}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="action-bar">
          <div className="action-summary">
            <span className="action-sub">{plan.crew.length === 0 ? 'Pick at least one survivor.' : crewLine(state, plan.crew)}</span>
          </div>
          <button type="button" className="btn btn-primary" disabled={plan.crew.length === 0} onClick={() => navigate({ screen: 'plan', locationId, step: 'orders' })}>
            Orders <span aria-hidden="true">&rsaquo;</span>
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="sheet planner planner-orders" aria-labelledby="plan-title">
      <PlannerNav step="orders" locationId={locationId} />
      {header}
      <section className="panel orders-panel" aria-label="Orders">
        {(plan.vehicles ?? []).length > 0 && <p className="panel-help orders-crew">{vehicleNote(state, plan)}</p>}
        {depths.length > 0 && (
          <div data-tour="depth">
            <Segmented legend="How far in" name="depth" choices={depths} value={String(plan.depth ?? 1)} onChange={(d) => setPlan((p) => withDepth(p, Number(d)))} />
          </div>
        )}
        <Segmented
          legend="Job"
          name="job"
          choices={jobs}
          value={plan.job}
          onChange={(job) => {
            setPlan((p) => (job === 'rescue' ? { ...withDepth(p, 1), job } : { ...p, job }));
            setSendError(null);
          }}
        />
        <Segmented legend="Approach" name="approach" choices={APPROACHES} value={plan.approach} onChange={(approach) => change({ approach })} />
        <Segmented legend="Pull out when" name="retreat" choices={RETREATS} value={plan.retreat} onChange={(retreat) => change({ retreat })} />
        <div className="orders-supplies">
          <MiniStepper label="Meds" value={plan.meds} min={0} max={state.resources.meds} note={`of ${state.resources.meds}`} onChange={(meds) => change({ meds })} />
          <MiniStepper
            label="Ammo"
            value={plan.ammo}
            min={0}
            max={state.resources.ammo}
            step={5}
            note={`of ${state.resources.ammo}`}
            onChange={(ammo) => {
              setAmmoTouched(true);
              change({ ammo });
            }}
          />
        </div>
        <label className="toggle lead-toggle" data-tour="lead">
          <span className="toggle-text">
            <span className="toggle-label">Lead the fights</span>
            <span className="toggle-help">{lead.short}</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={lead.can && plan.lead === true}
            disabled={!lead.can}
            onChange={(e) => {
              const on = e.target.checked;
              setPlan((p) => {
                const { lead: _drop, ...rest } = p;
                return on ? { ...rest, lead: true } : rest;
              });
            }}
          />
        </label>
        <label className="orders-keep">
          <span>Too much to carry? Keep</span>
          <select
            value={plan.lootPriority ?? 'any'}
            onChange={(e) => {
              const v = e.target.value as ResourceId | 'any';
              setPlan((p) => {
                const { lootPriority: _drop, ...rest } = p;
                return v === 'any' ? rest : { ...rest, lootPriority: v };
              });
            }}
          >
            {LOOT_PRIORITIES.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="panel orders-send" aria-labelledby="check-title">
        <h3 id="check-title" className="visually-hidden">
          Before they go
        </h3>

        {plan.crew.length === 0 ? (
          <p className="panel-help">Pick a crew first.</p>
        ) : (
          <>
            <p>
              Away for {formatDuration(duration)}, back at {clockTime(now + duration)}. <span className="panel-help">{rationsNote(state, plan)}</span>
              {fromOutpost && <span className="panel-help"> {fromOutpost}</span>}
            </p>
            {problems.length > 0 && (
              <ul className="problems">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            )}
            {warnings.length > 0 && (
              <ul className="warnings">
                {warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {ready && <RiskLine risk={risk} />}
          </>
        )}
        {sendError && <p className="field-error">{sendError}</p>}
        <button type="button" className="btn btn-primary btn-send" disabled={!ready} onClick={send}>
          Send them
        </button>
      </section>
    </article>
  );
}

function RiskLine({ risk }: { risk: RiskEstimate | null }) {
  if (!risk) return <p className="risk-text">Weighing the odds&hellip;</p>;
  return (
    <p className="risk-text">
      <strong className={`risk-label risk-${risk.label.toLowerCase()}`}>{risk.label} risk.</strong> {riskText(risk)}
    </p>
  );
}

/**
 * The risk estimate simulates the run 50 times, which takes a moment on a
 * phone, so it waits until the plan stops changing.
 */
function useRisk(state: GameState, plan: RunPlan, ready: boolean): RiskEstimate | null {
  const key = useMemo(() => JSON.stringify(plan), [plan]);
  const [result, setResult] = useState<{ key: string; risk: RiskEstimate } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => setResult({ key, risk: estimateRisk(state, plan) }), 250);
    return () => window.clearTimeout(id);
    // The plan is captured through its key; state changes (another crew leaving) also matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state, ready]);
  return result && result.key === key ? result.risk : null;
}
