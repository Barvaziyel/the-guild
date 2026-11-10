import { useEffect, useMemo, useState } from 'react';
import {
  MAX_CREW,
  estimateRisk,
  findLocation,
  locationState,
  planWarnings,
  rationsNeeded,
  runDuration,
  startRun,
  validatePlan,
  type GameState,
  type ResourceId,
  type RiskEstimate,
  type RunPlan,
} from '../../engine/index.ts';
import { Vitals } from '../components/Bars.tsx';
import { ChoiceList, Stepper } from '../components/Choices.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { goBack, navigate, useNow, useServices } from '../hooks.ts';
import {
  APPROACHES,
  JOBS,
  LOOT_PRIORITIES,
  RETREATS,
  crewOptions,
  dangerText,
  defaultPlan,
  formatDuration,
  radiationText,
  riskText,
  suggestedAmmo,
  toggleCrew,
} from '../runs-view.ts';
import { errorMessage } from '../persist.ts';
import { clockTime } from '../time.ts';

export function Planner({ state, locationId }: { state: GameState; locationId: string }) {
  const loc = findLocation(locationId);
  if (!loc || !locationState(state, locationId).discovered) {
    return (
      <div className="sheet">
        <PlannerNav />
        <p className="empty">The guild doesn&rsquo;t know the way there yet.</p>
      </div>
    );
  }
  return <PlannerForm state={state} locationId={locationId} />;
}

function PlannerNav() {
  return (
    <div className="sheet-nav">
      <button type="button" className="back" onClick={() => goBack({ screen: 'reach' })}>
        <span aria-hidden="true">&lsaquo;</span> The Reach
      </button>
    </div>
  );
}

function PlannerForm({ state, locationId }: { state: GameState; locationId: string }) {
  const { store } = useServices();
  const now = useNow(30_000);
  const [plan, setPlan] = useState<RunPlan>(() => defaultPlan(state, locationId));
  const [ammoTouched, setAmmoTouched] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const loc = findLocation(locationId)!;
  const options = crewOptions(state);

  const change = (patch: Partial<RunPlan>): void => {
    setPlan((p) => ({ ...p, ...patch }));
    setSendError(null);
  };
  const toggle = (id: string): void => {
    const crew = toggleCrew(plan.crew, id);
    change(ammoTouched ? { crew } : { crew, ammo: suggestedAmmo(state, crew) });
  };

  const problems = plan.crew.length === 0 ? [] : validatePlan(state, plan);
  const warnings = plan.crew.length === 0 ? [] : planWarnings(state, plan);
  const duration = runDuration(state, plan);
  const rations = plan.crew.length === 0 ? 0 : rationsNeeded(state, plan);
  const ready = plan.crew.length > 0 && problems.length === 0;
  const risk = useRisk(state, plan, ready);

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

  return (
    <article className="sheet planner" aria-labelledby="plan-title">
      <PlannerNav />
      <header className="sheet-head">
        <p className="place-biome">Plan a run</p>
        <h2 id="plan-title" className="plan-title">
          {loc.name}
        </h2>
        <p className="place-facts">
          {dangerText(loc.danger)}, {radiationText(loc.radiation).toLowerCase()}, about {formatDuration(loc.durationMin * 60_000)}.
        </p>
      </header>

      <section className="panel" aria-labelledby="crew-title">
        <h3 id="crew-title" className="panel-title">
          Crew <span className="count">{plan.crew.length} of {MAX_CREW}</span>
        </h3>
        <ul className="crew-pick">
          {options.map(({ survivor: s, reason, stats }) => {
            const picked = plan.crew.includes(s.id);
            const full = !picked && plan.crew.length >= MAX_CREW;
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

      <section className="panel">
        <ChoiceList legend="Job" name="job" choices={JOBS} value={plan.job} onChange={(job) => change({ job })} />
      </section>

      <section className="panel" aria-labelledby="supplies-title">
        <h3 id="supplies-title" className="panel-title">
          Supplies
        </h3>
        <Stepper label="Meds" value={plan.meds} min={0} max={state.resources.meds} note={`${state.resources.meds} at the Depot. Patch people up on the road.`} onChange={(meds) => change({ meds })} />
        <Stepper
          label="Ammo"
          value={plan.ammo}
          min={0}
          max={state.resources.ammo}
          step={5}
          note={`${state.resources.ammo} at the Depot. Guns need it; what's left comes back.`}
          onChange={(ammo) => {
            setAmmoTouched(true);
            change({ ammo });
          }}
        />
        <p className="panel-help rations-note">
          {plan.crew.length === 0
            ? 'Rations are packed for each person automatically.'
            : `${rations} ${rations === 1 ? 'ration' : 'rations'} packed automatically, of ${state.resources.rations} at the Depot.`}
        </p>
      </section>

      <section className="panel">
        <ChoiceList legend="Approach" name="approach" choices={APPROACHES} value={plan.approach} onChange={(approach) => change({ approach })} />
        <ChoiceList legend="Pull out when" name="retreat" choices={RETREATS} value={plan.retreat} onChange={(retreat) => change({ retreat })} />
        <label className="field select-field">
          Keep first when there&rsquo;s too much to carry
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

      <section className="panel" aria-labelledby="check-title">
        <h3 id="check-title" className="panel-title">
          Before they go
        </h3>
        {plan.crew.length === 0 ? (
          <p className="panel-help">Pick a crew to see how long it takes and how risky it is.</p>
        ) : (
          <>
            <p>
              Away for {formatDuration(duration)}, back at {clockTime(now + duration)}.
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
      </section>

      <div className="action-bar">
        <div className="action-summary">
          {ready ? (
            <>
              <span className={`risk-label risk-${risk?.label.toLowerCase() ?? 'pending'}`}>{risk ? `${risk.label} risk` : 'Weighing the odds'}</span>
              <span className="action-sub">Back at {clockTime(now + duration)}</span>
            </>
          ) : (
            <span className="action-sub">{plan.crew.length === 0 ? 'Pick at least one survivor.' : 'Fix the problems above first.'}</span>
          )}
        </div>
        <button type="button" className="btn btn-primary" disabled={!ready} onClick={send}>
          Send the crew
        </button>
      </div>
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
