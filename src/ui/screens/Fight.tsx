import { useMemo, useRef, useState } from 'react';
import { commandRound, fightNow, fightPreview, getLocation, lastFought, ledFightNow, letThemFight, takeCommand, type FightMemberView, type FightView, type GameState, type MoveId, type RoundOrders, type Run } from '../../engine/index.ts';
import { stageHint, tapOnStage } from '../battle-view.ts';
import { Meter } from '../components/Bars.tsx';
import { BattleStage } from '../components/BattleStage.tsx';
import { BeatLog } from '../components/BeatLog.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { fightCard, fightEnd, livePicks, memberState, needsTarget, nerveLine, pickLabel, rankHelp, roundOrders, targetName, theirMoves, whatTheyAre, withRanks, type Picks, type Ranks } from '../fight-view.ts';
import { goBack, navigate, useAction, useNow } from '../hooks.ts';
import { formatDuration } from '../runs-view.ts';

/** A fight on a led run, under the player's command (§7.13). */
export function Fight({ state, id }: { state: GameState; id: string }) {
  const run = state.runs.find((r) => r.id === id);
  const fight = run?.lead?.fights.find((f) => f.ended === undefined);
  const now = useNow(15_000, fight ? (fight.took === undefined ? fight.at : fight.until) : undefined);
  const live = run ? ledFightNow(run, now) : undefined;
  const view = useMemo(() => (run && live?.took !== undefined ? fightNow(state, run.id, now) : undefined), [state, run, live, now]);
  // The fight as the player last saw it, so its end can play what came after.
  const lastSeen = useRef<FightView | undefined>(undefined);
  if (view) lastSeen.current = view;

  return (
    <article className="sheet fight-screen">
      <div className="sheet-nav">
        <button type="button" className="back" onClick={() => goBack({ screen: 'runs' })}>
          <span aria-hidden="true">&lsaquo;</span> Runs
        </button>
      </div>
      {!run ? (
        <p className="empty">That crew is back. Their report is on the Runs tab.</p>
      ) : view ? (
        <Command
          state={state}
          view={view}
          until={live!.until}
          now={now}
          place={run.plan.locationId}
          seed={run.id}
          title={`The fight at ${view.place}`}
          give={(s, orders) => void commandRound(s, run.id, orders, Date.now())}
          letThem={(s) => letThemFight(s, run.id, Date.now())}
        />
      ) : live ? (
        <NotYet state={state} runId={run.id} now={now} />
      ) : (
        <Over state={state} run={run} seen={lastSeen.current} />
      )}
    </article>
  );
}

function Over({ state, run, seen }: { state: GameState; run: Run; seen: FightView | undefined }) {
  const place = getLocation(run.plan.locationId).name;
  const led = [...(run.lead?.fights ?? [])].reverse().find((f) => f.took !== undefined && f.ended !== undefined);
  const end = useMemo(() => (led ? lastFought(state, run.id) : undefined), [state, run.id, led]);
  // The last round plays out on the stage when the player watched the round before it.
  const before = seen && end && seen.enemies.length === end.enemies.length && seen.acts.length <= end.acts.length ? seen : undefined;
  const [told, setTold] = useState<number | undefined>(undefined);
  const all = end?.lines ?? (led ? (run.beats[led.fromBeat]?.lines ?? []) : []);
  const lines = !led ? [] : told === undefined ? fightEnd(all, before?.lines.length ?? 0) : all.slice(before?.lines.length ?? 0, told);
  const more = (run.lead?.fights ?? []).some((f) => f.ended === undefined);
  const solo = run.plan.crew.length === 1;
  const who = solo ? (run.result.crew[0]?.firstName ?? 'They') : 'The crew';
  return (
    <section className="panel">
      <h2 className="plan-title">{led ? 'The fight is over' : 'No fight right now'}</h2>
      {end && <BattleStage state={state} place={run.plan.locationId} seed={run.id} view={end} before={before} onLine={setTold} caption={OVER[end.over ?? 'won']} />}
      {lines.length > 0 && (
        <ul className="fight-lines fight-end">
          {lines.map((l, k) => (
            <li key={k} className={l.tone ? `is-${l.tone}` : undefined}>
              {l.text}
            </li>
          ))}
        </ul>
      )}
      <p>
        {led ? `${who} goes on at ${place}.` : `${who} at ${place} isn\u2019t in a fight that needs you.`}{' '}
        {more ? 'At the next fight there\u2019s a notice and a card on the Depot.' : 'When they stop at a fight, there\u2019s a notice and a card on the Depot.'}
      </p>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => navigate({ screen: 'run', id: run.id })}>
          See the run
        </button>
      </div>
    </section>
  );
}

const OVER: Record<NonNullable<FightView['over']>, string> = {
  won: 'Won.',
  withdrew: 'They got away.',
  stalemate: 'Both sides pulled back.',
  routed: 'They were beaten.',
};

function NotYet({ state, runId, now }: { state: GameState; runId: string; now: number }) {
  const { act, error } = useAction();
  const run = state.runs.find((r) => r.id === runId)!;
  const card = fightCard(state, run, now)!;
  // What they're up against, before anyone takes command; it changes nothing.
  const preview = useMemo(() => fightPreview(state, runId, now), [state, runId, now]);
  return (
    <section className="panel fight-call">
      <p className="dilemma-kicker">A fight at {card.place}</p>
      <h2 className="dilemma-title">Against {card.against}</h2>
      {preview && <BattleStage state={state} place={run.plan.locationId} seed={run.id} view={preview} />}
      <p>{card.wait}</p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => act((s) => void takeCommand(s, runId, Date.now()))}>
          Take command
        </button>
        <button type="button" className="btn" onClick={() => act((s) => letThemFight(s, runId, Date.now()))}>
          Let them fight
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}

/**
 * Giving orders in a fight under command (§7.13), on a run or at the gate
 * (§9.8): the stage, the last round, a row of moves for each person, and the
 * buttons. `give` sends a round's orders; `letThem` has them finish it alone.
 */
export function Command({
  state,
  view: fight,
  until,
  now,
  place,
  seed,
  title,
  give: send,
  letThem,
  stores = 'in the packs',
}: {
  state: GameState;
  view: FightView;
  until: number;
  now: number;
  place: string;
  seed: string;
  title: string;
  give: (s: GameState, orders: RoundOrders) => void;
  letThem: (s: GameState) => void;
  /** Where the meds and ammo are: in the packs on a run, in the stores at the gate. */
  stores?: string;
}) {
  const { act, error } = useAction();
  const [picks, setPicks] = useState<Picks>({});
  const [pullOut, setPullOut] = useState(false);
  // Where the player has put people this round (2.3.0); the fight as they'd have it is what everything below shows.
  const [ranks, setRanks] = useState<Ranks>({});
  const view = useMemo(() => withRanks(fight, ranks), [fight, ranks]);
  const standing = view.crew.filter((m) => m.moves.length > 0);
  const [open, setOpen] = useState<string | undefined>(standing[0]?.id);
  // What the last round brought: the lines since the fight was last shown.
  const seen = useRef<{ round: number; lines: number }>({ round: view.round, lines: view.lines.length });
  // While the stage plays the round, its lines come in step with it.
  const [told, setTold] = useState<number | undefined>(undefined);
  const lastRound = seen.current.round < view.round ? view.lines.slice(seen.current.lines, told ?? view.lines.length) : [];
  if (seen.current.round !== view.round && view.lines.length <= seen.current.lines) seen.current = { round: view.round, lines: view.lines.length };
  const current = livePicks(view, picks);

  const pick = (m: FightMemberView, move: MoveId | undefined, target?: number | string): void => {
    setPicks((p) => {
      const next = { ...p };
      if (move === undefined) delete next[m.id];
      else next[m.id] = { move, ...(target !== undefined ? { target } : {}) };
      return next;
    });
    // Picked in full: on to the next person who hasn't been given anything.
    if (move === undefined || !needsTarget(m, move) || target !== undefined) {
      const after = standing.slice(standing.indexOf(m) + 1).find((o) => current[o.id] === undefined);
      setOpen(after?.id);
    }
  };

  // A tap on the stage: an enemy is the open person's target, one of the crew opens their orders.
  const tapStage = (key: string): void => {
    const next = tapOnStage(view, { picks, ...(open ? { open } : {}) }, key);
    if (next.picks !== picks) {
      const m = view.crew.find((c) => c.id === open)!;
      const p = next.picks[m.id]!;
      pick(m, p.move, p.target);
    } else if (next.open !== open) setOpen(next.open);
  };

  // The stage, to bring back into view when the orders go out: the round plays there.
  const stageRef = useRef<HTMLDivElement>(null);
  const give = (): void => {
    const orders = roundOrders(view, picks, pullOut, ranks, fight);
    seen.current = { round: view.round, lines: view.lines.length };
    if (act((s) => send(s, orders))) {
      setPullOut(false);
      setRanks({});
      setOpen(standing[0]?.id);
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      stageRef.current?.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' });
    }
  };

  return (
    <>
      <header className="sheet-head fight-head">
        <p className="place-biome">Under your command</p>
        <h2 className="plan-title">{title}</h2>
        <p className="fight-sub">
          Round {view.round} of {view.maxRounds}. {formatDuration(Math.max(60_000, until - now))} left to finish it.
        </p>
        <p className="fight-sub">
          {view.meds === 1 ? '1 med' : `${view.meds} meds`} and {view.ammo} ammo {stores}.
        </p>
      </header>

      <div ref={stageRef} className="stage-anchor">
        <BattleStage state={state} place={place} seed={seed} view={view} orders={{ picks, ...(open ? { open } : {}) }} onTap={tapStage} onLine={setTold} caption={stageHint(view, open, picks)} />
      </div>

      {lastRound.length > 0 && (
        <section className="panel" aria-labelledby="last-title">
          <h3 id="last-title" className="panel-title">
            Last round
          </h3>
          <ul className="fight-lines">
            {lastRound.map((l, k) => (
              <li key={k} className={l.tone ? `is-${l.tone}` : undefined}>
                {l.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="panel their-moves" aria-labelledby="their-title">
        <h3 id="their-title" className="panel-title">
          Their moves
        </h3>
        <ul className="fight-lines">
          {theirMoves(view).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="panel-help">{nerveLine(view)}</p>
        {whatTheyAre(view).length > 0 && (
          <>
            <h4 className="their-kinds-title">What they are</h4>
            <ul className="fight-lines their-kinds">
              {whatTheyAre(view).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel" aria-labelledby="orders-title">
        <h3 id="orders-title" className="panel-title">
          Orders
        </h3>
        <ul className="fight-crew">
          {view.crew.map((m) => {
            const survivor = state.survivors.find((s) => s.id === m.id);
            const chosen = current[m.id];
            // A move picked and its target not yet: kept, so the targets show.
            const raw = picks[m.id];
            const canAct = m.moves.length > 0;
            const isOpen = canAct && open === m.id;
            const choice = raw ? m.moves.find((c) => c.move === raw.move) : undefined;
            return (
              <li key={m.id} className={`fight-member${isOpen ? ' is-open' : ''}${canAct ? '' : ' is-out'}`}>
                <button type="button" className="fight-member-row" disabled={!canAct} aria-expanded={isOpen} onClick={() => setOpen(isOpen ? undefined : m.id)}>
                  {survivor && <Portrait survivor={survivor} size={44} decorative />}
                  <span className="fight-member-text">
                    <span className="fight-member-name">{m.name}</span>
                    {m.state === 'up' ? <Meter label={memberState(m)} value={m.hp} max={m.maxHp} reading={m.aimed ? 'Aiming' : ''} kind="hp" /> : <span className="fight-member-state">{memberState(m)}</span>}
                    {canAct && <span className={`fight-pick${chosen ? '' : ' is-own'}`}>{!chosen && choice ? `${choice.name}: who?` : pickLabel(view, m, chosen)}</span>}
                  </span>
                </button>
                {isOpen && (
                  <div className="fight-picker">
                    {!m.perch && (
                      <>
                        <div className="fight-rank" role="group" aria-label={`Where ${m.name} stands`}>
                          {(['front', 'back'] as const).map((r) => (
                            <button key={r} type="button" className={`chip${m.rank === r ? ' is-on' : ''}`} aria-pressed={m.rank === r} onClick={() => setRanks((x) => ({ ...x, [m.id]: r }))}>
                              {r === 'front' ? 'In front' : 'At the back'}
                            </button>
                          ))}
                        </div>
                        <p className="fight-detail">{rankHelp(m, m.rank)}</p>
                      </>
                    )}
                    <div className="fight-chips" role="group" aria-label={`${m.name}'s move`}>
                      {m.moves.map((c) => (
                        <button
                          key={c.move}
                          type="button"
                          className={`chip${raw?.move === c.move ? ' is-on' : ''}`}
                          aria-pressed={raw?.move === c.move}
                          onClick={() => pick(m, c.move, c.target === 'none' ? undefined : c.targets.length === 1 ? c.targets[0] : undefined)}
                        >
                          {c.name}
                        </button>
                      ))}
                      <button type="button" className={`chip${raw ? '' : ' is-on'}`} aria-pressed={!raw} onClick={() => pick(m, undefined)}>
                        On their own
                      </button>
                    </div>
                    {choice && <p className="fight-detail">{choice.detail}</p>}
                    {choice && choice.target !== 'none' && (
                      <div className="fight-chips" role="group" aria-label={`${choice.name}: who`}>
                        {choice.targets.map((t) => (
                          <button
                            key={String(t)}
                            type="button"
                            className={`chip chip-target${raw?.target === t ? ' is-on' : ''}`}
                            aria-pressed={raw?.target === t}
                            onClick={() => pick(m, choice.move, t)}
                          >
                            {targetName(view, t)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <label className="toggle fight-pull">
          <span className="toggle-text">
            <span className="toggle-label">Pull out</span>
            <span className="toggle-help">After this round the whole crew tries to break away.</span>
          </span>
          <input type="checkbox" role="switch" checked={pullOut} onChange={(e) => setPullOut(e.target.checked)} />
        </label>
        <div className="fight-actions">
          <button type="button" className="btn btn-primary" onClick={give}>
            Give the orders
          </button>
          <button type="button" className="btn btn-quiet" onClick={() => act((s) => letThem(s))}>
            Let them finish it
          </button>
        </div>
        <p className="panel-help">Anyone you don&rsquo;t give an order to fights as they would on their own.</p>
        {error && <p className="field-error">{error}</p>}
      </section>

      <details className="panel fight-log">
        <summary>Everything so far</summary>
        <BeatLog beats={[{ kind: 'combat', title: 'The fight', at: 0, lines: view.lines }]} names={Object.fromEntries(view.crew.map((m) => [m.id, m.name]))} more={false} />
      </details>
    </>
  );
}
