import { useCallback, useMemo, useRef, useState } from 'react';
import { commandRound, fightNow, fightPreview, getLocation, lastFought, ledFightNow, letThemFight, takeCommand, waitsForWord, type FightMemberView, type FightView, type GameState, type MoveId, type RoundOrders, type Run } from '../../engine/index.ts';
import { tapOnStage } from '../battle-view.ts';
import { Meter } from '../components/Bars.tsx';
import { BattleStage } from '../components/BattleStage.tsx';
import { SceneStage } from '../components/SceneStage.tsx';
import { gateScene } from '../gate-scene.ts';
import { Sheet } from '../components/Sheet.tsx';
import { crewChips, endFrom, endLines, fightCard, fightStatus, jobPanel, jobTakenBy, livePicks, needsTarget, nerveLine, orderHint, roundOrders, stagePlace, targetName, targetPrompt, theirMoves, tickerLines, whatTheyAre, withRanks, type Picks, type Ranks } from '../fight-view.ts';
import { goBack, navigate, useAction, useNow } from '../hooks.ts';

/** A fight on a led run, under the player's command (§7.13). */
export function Fight({ state, id }: { state: GameState; id: string }) {
  const run = state.runs.find((r) => r.id === id);
  const fight = run?.lead?.fights.find((f) => f.ended === undefined);
  // On the road east a fight never runs out of time (§9.12): only its start is worth waking for.
  const now = useNow(15_000, fight ? (fight.took === undefined ? fight.at : run && waitsForWord(run) ? undefined : fight.until) : undefined);
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
          until={waitsForWord(run) ? undefined : live!.until}
          now={now}
          place={stagePlace(run, view)}
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
  const before = endFrom(seen, end);
  const [told, setTold] = useState<number | undefined>(undefined);
  const all = end?.lines ?? (led ? (run.beats[led.fromBeat]?.lines ?? []) : []);
  const lines = led ? endLines(all, before, told) : [];
  const solo = run.plan.crew.length === 1;
  const who = solo ? (run.result.crew[0]?.firstName ?? 'They') : 'The crew';
  return (
    <section className="panel">
      <h2 className="plan-title">{led ? 'The fight is over' : 'No fight right now'}</h2>
      {end && <BattleStage state={state} place={stagePlace(run, end)} seed={run.id} view={end} before={before} onLine={setTold} caption={OVER[end.over ?? 'won']} />}
      {lines.length > 0 && (
        <ul className="fight-lines fight-end">
          {lines.map((l, k) => (
            <li key={k} className={l.tone ? `is-${l.tone}` : undefined}>
              {l.text}
            </li>
          ))}
        </ul>
      )}
      {/* After a fight, the screen is about the fight: where the next card shows up isn't part of it (Aviel, 2.8.4). */}
      {!led && <p>{`${who} at ${place.replace(/^The /, 'the ')} isn\u2019t in a fight that needs you.`}</p>}
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

/** Scenes already played this time the game is open, so coming back to the screen doesn't play one again. */
const scenesPlayed = new Set<string>();

function NotYet({ state, runId, now }: { state: GameState; runId: string; now: number }) {
  const { act, error } = useAction();
  const run = state.runs.find((r) => r.id === runId)!;
  const card = fightCard(state, run, now)!;
  // What they're up against, before anyone takes command; it changes nothing.
  const preview = useMemo(() => fightPreview(state, runId, now), [state, runId, now]);
  // At Haven's gate (§9.12), what happens there plays out first.
  const fight = ledFightNow(run, now);
  const sceneKey = `${runId}:${fight?.at}`;
  const scene = useMemo(() => (fight && preview ? gateScene(state, run, fight, preview) : undefined), [state, run, fight, preview]);
  const [playing, setPlaying] = useState(() => !scenesPlayed.has(sceneKey));
  const done = useCallback(() => {
    scenesPlayed.add(sceneKey);
    setPlaying(false);
  }, [sceneKey]);
  if (scene && playing) {
    return (
      <section className="panel fight-call">
        <p className="dilemma-kicker">At {card.place}</p>
        <SceneStage frames={scene} onDone={done} />
      </section>
    );
  }
  return (
    <section className="panel fight-call">
      <p className="dilemma-kicker">A fight at {card.place}</p>
      <h2 className="dilemma-title">Against {card.against}</h2>
      {preview && <BattleStage state={state} place={stagePlace(run, preview)} seed={run.id} view={preview} />}
      {scene && (
        <button type="button" className="btn btn-quiet btn-small scene-again" onClick={() => setPlaying(true)}>
          Watch the gate again
        </button>
      )}
      {preview?.goal && (
        <p>
          {preview.goal.intro} A job besides the fight: {preview.goal.title.toLowerCase()}.
        </p>
      )}
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
 * (§9.8), all on one screen (2.6.0; Aviel: scrolling up and down with things
 * opening and closing was clunky): the stage, a line of what just happened,
 * the crew, the open person's moves, and the orders button. The whole log and
 * what they are wait in sheets. `give` sends a round's orders; `letThem` has
 * them finish it alone.
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
  until: number | undefined;
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
  const [sheet, setSheet] = useState<'log' | 'them' | undefined>(undefined);
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
  const job = jobPanel(view, current);
  const chips = crewChips(view, picks);
  const m = view.crew.find((c) => c.id === open && c.moves.length > 0);

  const pick = (who: FightMemberView, move: MoveId | undefined, target?: number | string): void => {
    setPicks((p) => {
      const next = { ...p };
      if (move === undefined) delete next[who.id];
      else next[who.id] = { move, ...(target !== undefined ? { target } : {}) };
      return next;
    });
    // Picked in full: on to the next person who hasn't been given anything.
    if (move === undefined || !needsTarget(who, move) || target !== undefined) {
      const after = standing.slice(standing.indexOf(who) + 1).find((o) => current[o.id] === undefined);
      setOpen(after?.id);
    }
  };

  // A tap on the stage: an enemy is the open person's target, one of the crew opens their orders.
  const tapStage = (key: string): void => {
    const next = tapOnStage(view, { picks, ...(open ? { open } : {}) }, key);
    if (next.picks !== picks) {
      const who = view.crew.find((c) => c.id === open)!;
      const p = next.picks[who.id]!;
      pick(who, p.move, p.target);
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

  // The open person's move still waiting for a target: their targets take the place of their moves.
  const raw = m ? picks[m.id] : undefined;
  const choice = m && raw ? m.moves.find((c) => c.move === raw.move) : undefined;
  const choosing = m && choice && choice.target !== 'none' && current[m.id] === undefined ? choice : undefined;

  return (
    <div className="fight-one">
      <header className="fight-top">
        <h2 className="fight-title">{title}</h2>
        <p className="fight-status">{fightStatus(view, until, now, stores)}</p>
      </header>

      <div ref={stageRef} className="stage-anchor">
        <BattleStage state={state} place={place} seed={seed} view={view} orders={{ picks, ...(open ? { open } : {}) }} onTap={tapStage} onLine={setTold} />
      </div>

      <div className="fight-ticker">
        <ul className="fight-ticker-lines" aria-live="polite">
          {tickerLines(view, lastRound).map((l, k) => (
            <li key={k} className={l.tone ? `is-${l.tone}` : undefined}>
              {l.text}
            </li>
          ))}
        </ul>
        <div className="fight-ticker-more">
          <button type="button" className="btn btn-small" onClick={() => setSheet('log')}>
            Log
          </button>
          <button type="button" className="btn btn-small" onClick={() => setSheet('them')}>
            Them
          </button>
        </div>
      </div>

      <div className="fight-crewbar" role="group" aria-label="The crew: tap one to give their orders">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`crew-chip${open === c.id ? ' is-open' : ''}${c.canAct ? '' : ' is-out'}`}
            disabled={!c.canAct}
            aria-pressed={open === c.id}
            onClick={() => setOpen(c.id)}
          >
            <span className="crew-chip-name">{c.name}</span>
            <span className={`crew-chip-pick${c.own ? ' is-own' : ''}${c.pending ? ' is-pending' : ''}`}>{c.label}</span>
          </button>
        ))}
      </div>

      <div className="fight-orders">
        {m ? (
          <>
            {m.perch ? (
              <p className="fight-perch">{m.name} is up on the tower: out of reach of blows, shooting from there.</p>
            ) : (
              <div className="fight-rank" role="group" aria-label={`Where ${m.name} stands`}>
                {(['front', 'back'] as const).map((r) => (
                  <button key={r} type="button" className={`seg-option${m.rank === r ? ' is-on' : ''}`} aria-pressed={m.rank === r} onClick={() => setRanks((x) => ({ ...x, [m.id]: r }))}>
                    {r === 'front' ? 'In front' : 'At the back'}
                  </button>
                ))}
              </div>
            )}
            {/* The moves stay up while a target is picked, so another can be tapped instead (3.7.1). */}
            {
              <div className="fight-grid" role="group" aria-label={`${m.name}'s move`}>
                {m.moves.map((c) => {
                  // The job is one person's a round: whoever has it, nobody else.
                  const taken = c.move === 'job' ? jobTakenBy(view, picks, m.id) : undefined;
                  return (
                    <button
                      key={c.move}
                      type="button"
                      className={`chip${raw?.move === c.move ? ' is-on' : ''}${taken ? ' chip-taken' : ''}`}
                      aria-pressed={raw?.move === c.move}
                      disabled={taken !== undefined}
                      onClick={() => pick(m, c.move, c.target === 'none' ? undefined : c.targets.length === 1 ? c.targets[0] : undefined)}
                    >
                      {c.name}
                      {taken && <span className="chip-sub">{taken} is on it</span>}
                    </button>
                  );
                })}
                <button type="button" className={`chip${raw ? '' : ' is-on'}`} aria-pressed={!raw} onClick={() => pick(m, undefined)}>
                  On their own
                </button>
              </div>
            }
            <p className="fight-hint">{orderHint(view, m, picks, ranks[m.id] !== undefined && ranks[m.id] !== fight.crew.find((c) => c.id === m.id)?.rank)}</p>
            {choosing && (
              <div className="fight-targets" role="group" aria-label={`${choosing.name}: ${targetPrompt(choosing)}`}>
                <p className="fight-who">{targetPrompt(choosing)}</p>
                <div className="fight-grid">
                  {choosing.targets.map((t) => (
                    <button key={String(t)} type="button" className="chip chip-target" onClick={() => pick(m, choosing.move, t)}>
                      {targetName(view, t)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="fight-hint">{standing.length > 0 ? 'Everyone has orders. Tap someone to change theirs, or give the orders.' : 'Nobody can take orders this round.'}</p>
        )}
      </div>

      <div className="fight-dock">
        <button type="button" className={`btn fight-pullout${pullOut ? ' is-on' : ''}`} aria-pressed={pullOut} title="After this round the whole crew tries to break away." onClick={() => setPullOut(!pullOut)}>
          {pullOut ? 'Pulling out' : 'Pull out'}
        </button>
        <button type="button" className="btn" onClick={() => act((s) => letThem(s))}>
          Let them finish
        </button>
        <button type="button" className="btn btn-primary" onClick={give}>
          Give the orders
        </button>
      </div>
      {error && <p className="field-error fight-error">{error}</p>}

      <Sheet open={sheet === 'log'} title="The fight so far" onClose={() => setSheet(undefined)}>
        <ul className="fight-lines">
          {view.lines.map((l, k) => (
            <li key={k} className={l.tone ? `is-${l.tone}` : undefined}>
              {l.text}
            </li>
          ))}
        </ul>
      </Sheet>
      <Sheet open={sheet === 'them'} title="Them" onClose={() => setSheet(undefined)}>
        {job && (
          <section className={`fight-job is-${job.state}`} aria-labelledby="job-title">
            <h4 id="job-title" className="their-kinds-title">
              {job.title}
            </h4>
            {job.state === 'open' && <Meter label="Work done" value={job.progress} max={job.needed} reading={`${job.progress} of ${job.needed}`} kind="practice" />}
            {job.lines.map((line) => (
              <p key={line} className="fight-job-line">
                {line}
              </p>
            ))}
          </section>
        )}
        <h4 className="their-kinds-title">Their moves</h4>
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
      </Sheet>
    </div>
  );
}
