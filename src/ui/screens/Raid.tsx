import { useMemo, useRef, useState } from 'react';
import {
  commandRaidRound,
  hideStores,
  lastRaidFight,
  letRaidFight,
  payRaiders,
  raidAtGate,
  raidFightNow,
  raidPreview,
  raidersName,
  recallCrew,
  regroupRaid,
  setRaidTeam,
  shoreUpFence,
  stareDown,
  takeRaidCommand,
  type FightView,
  type GameState,
} from '../../engine/index.ts';
import { BattleStage } from '../components/BattleStage.tsx';
import { fightEnd } from '../fight-view.ts';
import { goBack, useAction, useNow } from '../hooks.ts';
import { gateView, raidCard, readyView, regroupView, type RegroupView } from '../raid-view.ts';
import { Command } from './Fight.tsx';

const OVER: Record<'held' | 'broken' | 'paid' | 'stared', string> = {
  held: 'Held. They drove them off.',
  broken: 'They broke in.',
  paid: 'Paid off. They went away.',
  stared: 'Stared down. They went away.',
};

/** Raiders at the Depot (§9.8): on the road, at the gate, under command, or just over. */
export function Raid({ state }: { state: GameState }) {
  const raid = state.depot.raid;
  const open = raid && raid.ended === undefined ? raid : undefined;
  const now = useNow(15_000, open ? (open.defenders === undefined ? open.arrive : open.until) : undefined);
  const gate = raidAtGate(state);
  const view = useMemo(() => (gate?.took !== undefined ? raidFightNow(state, now) : undefined), [state, gate, now]);
  const between = useMemo(() => (gate?.took !== undefined && !view ? regroupView(state, now) : undefined), [state, gate, view, now]);
  // The fight as the player last saw it, so its end can play what came after.
  const lastSeen = useRef<FightView | undefined>(undefined);
  if (view) lastSeen.current = view;

  return (
    <article className="sheet fight-screen">
      <div className="sheet-nav">
        <button type="button" className="back" onClick={() => goBack({ screen: 'depot' })}>
          <span aria-hidden="true">&lsaquo;</span> Depot
        </button>
      </div>
      {view && gate ? (
        <Command
          state={state}
          view={view}
          until={gate.until}
          now={now}
          place="depot"
          seed={gate.id}
          title={gate.rounds2 !== undefined ? 'The second band' : 'The fight at the gate'}
          stores="in the stores"
          give={(s, orders) => void commandRaidRound(s, orders, Date.now())}
          letThem={(s) => letRaidFight(s, Date.now())}
        />
      ) : gate && between ? (
        <Regroup key={gate.id} state={state} now={now} view={between} />
      ) : gate ? (
        <AtGate state={state} now={now} />
      ) : open ? (
        <OnTheRoad state={state} now={now} />
      ) : raid?.ended !== undefined ? (
        <Over state={state} seen={lastSeen.current} />
      ) : (
        <p className="empty">No raiders at the gate.</p>
      )}
    </article>
  );
}

function OnTheRoad({ state, now }: { state: GameState; now: number }) {
  const { act, error } = useAction();
  const card = raidCard(state, now);
  const ready = useMemo(() => readyView(state, now), [state, now]);
  if (!card || !ready) return <p className="empty">No raiders at the gate.</p>;
  return (
    <>
      <section className="panel fight-call raid-call">
        <p className="dilemma-kicker">Seen from the Watchtower</p>
        <h2 className="dilemma-title">{card.title}</h2>
        <p>{ready.when}</p>
        {ready.secondBand && <p>{ready.secondBand}</p>}
        <p>{ready.home}</p>
        <p className="panel-help">{card.lines.at(-1)}</p>
      </section>
      {ready.crews.length > 0 && (
        <section className="panel" aria-labelledby="raid-crews">
          <h3 id="raid-crews" className="panel-title">
            Crews out
          </h3>
          <ul className="raid-list">
            {ready.crews.map((c) => (
              <li key={c.runId} className="raid-item">
                <p className="raid-item-title">{c.who}</p>
                <p className={c.inTime ? 'is-good' : 'is-bad'}>{c.back}</p>
                {c.call && (
                  <>
                    <button type="button" className="btn" onClick={() => act((s) => recallCrew(s, c.runId, Date.now()))}>
                      Call them home
                    </button>
                    <p className="panel-help">{c.call.label}</p>
                  </>
                )}
                {c.note && <p className="panel-help">{c.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="panel" aria-labelledby="raid-ready">
        <h3 id="raid-ready" className="panel-title">
          Get ready
        </h3>
        <ul className="raid-list">
          <li className="raid-item">
            <p className="raid-item-title">Shore up the fence</p>
            <p>{ready.shore.text}</p>
            {!ready.shore.done && (
              <button type="button" className="btn" disabled={ready.shore.problem !== undefined} onClick={() => act((s) => shoreUpFence(s, Date.now()))}>
                {ready.shore.label}
              </button>
            )}
            {ready.shore.problem && <p className="panel-help">{ready.shore.problem}</p>}
          </li>
          <li className="raid-item">
            <p className="raid-item-title">Hide some stores</p>
            <p>{ready.hide.text}</p>
            {!ready.hide.done && (
              <button type="button" className="btn" disabled={ready.hide.problem !== undefined} onClick={() => act((s) => hideStores(s, Date.now()))}>
                Hide them
              </button>
            )}
            {ready.hide.problem && <p className="panel-help">{ready.hide.problem}</p>}
          </li>
        </ul>
        {error && <p className="field-error">{error}</p>}
      </section>
    </>
  );
}

function AtGate({ state, now }: { state: GameState; now: number }) {
  const { act, error } = useAction();
  const raid = raidAtGate(state)!;
  const card = raidCard(state, now)!;
  const gate = gateView(state, now)!;
  // Who's up against whom, before anyone takes command; it changes nothing.
  const preview = useMemo(() => raidPreview(state, now), [state, now]);
  const toggle = (id: string) =>
    act((s) =>
      setRaidTeam(
        s,
        gate.team.filter((p) => (p.id === id ? !p.in : p.in)).map((p) => p.id),
        Date.now(),
      ),
    );
  return (
    <>
      <section className="panel fight-call raid-call">
        <p className="dilemma-kicker">At the Depot</p>
        <h2 className="dilemma-title">{card.title}</h2>
        {card.against && <p className="fight-sub">{card.against}</p>}
        {gate.secondBand && <p>{gate.secondBand}</p>}
        {preview && <BattleStage state={state} place="depot" seed={raid.id} view={preview} />}
        {gate.said && <p className="is-bad">{gate.said}</p>}
      </section>
      {gate.talk && (
        <section className="panel" aria-labelledby="raid-talk">
          <h3 id="raid-talk" className="panel-title">
            Talk first
          </h3>
          <ul className="raid-list">
            <li className="raid-item">
              <p>{gate.talk.pay}</p>
              <button type="button" className="btn" disabled={gate.talk.payProblem !== undefined} onClick={() => act((s) => payRaiders(s, Date.now()))}>
                Pay them off
              </button>
              {gate.talk.payProblem && <p className="panel-help">{gate.talk.payProblem}</p>}
            </li>
            <li className="raid-item">
              <p>{gate.talk.stare}</p>
              <button type="button" className="btn" onClick={() => act((s) => void stareDown(s, Date.now()))}>
                Stare them down
              </button>
            </li>
          </ul>
        </section>
      )}
      <section className="panel" aria-labelledby="raid-team">
        <h3 id="raid-team" className="panel-title">
          Who holds the gate
        </h3>
        <div className="fight-chips" role="group" aria-label="Who holds the gate">
          {gate.team.map((p) => (
            <button key={p.id} type="button" className={`chip${p.in ? ' is-on' : ''}`} aria-pressed={p.in} onClick={() => toggle(p.id)}>
              {p.name}
            </button>
          ))}
        </div>
        <p className="panel-help">{gate.teamHint}</p>
        <p>{card.wait}</p>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={() => act((s) => void takeRaidCommand(s, Date.now()))}>
            Take command
          </button>
          <button type="button" className="btn" onClick={() => act((s) => letRaidFight(s, Date.now()))}>
            Let them fight
          </button>
        </div>
        {error && <p className="field-error">{error}</p>}
      </section>
    </>
  );
}

/** The first band beaten under command, the second coming: the player picks who meets it. */
function Regroup({ state, now, view }: { state: GameState; now: number; view: RegroupView }) {
  const { act, error } = useAction();
  const card = raidCard(state, now)!;
  const [back, setBack] = useState<ReadonlySet<string>>(new Set());
  const team = view.people.filter((p) => p.can && !back.has(p.id)).map((p) => p.id);
  const flip = (id: string) =>
    setBack((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <section className="panel fight-call raid-call">
      <p className="dilemma-kicker">At the Depot</p>
      <h2 className="dilemma-title">The first band is beaten</h2>
      <p className="fight-sub">{view.against}</p>
      {view.lines.length > 0 && (
        <ul className="fight-lines">
          {view.lines.map((l, k) => (
            <li key={k}>{l}</li>
          ))}
        </ul>
      )}
      <h3 className="panel-title raid-sub">Who meets the second band</h3>
      <div className="fight-chips" role="group" aria-label="Who meets the second band">
        {view.people.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`chip${p.can && !back.has(p.id) ? ' is-on' : ''}`}
            aria-pressed={p.can && !back.has(p.id)}
            disabled={!p.can}
            onClick={() => flip(p.id)}
          >
            {p.name}, {p.state}
          </button>
        ))}
      </div>
      <p className="panel-help">Tap to keep someone back.</p>
      <p>{card.wait}</p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" disabled={team.length === 0} onClick={() => act((s) => void regroupRaid(s, team, true, Date.now()))}>
          Take command
        </button>
        <button type="button" className="btn" disabled={team.length === 0} onClick={() => act((s) => void regroupRaid(s, team, false, Date.now()))}>
          Let them fight
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}

function Over({ state, seen }: { state: GameState; seen: FightView | undefined }) {
  const raid = state.depot.raid!;
  const end = useMemo(() => lastRaidFight(state), [state]);
  const before = seen && end && seen.enemies.length === end.enemies.length && seen.acts.length <= end.acts.length ? seen : undefined;
  const [told, setTold] = useState<number | undefined>(undefined);
  const lines = !end ? [] : told === undefined ? fightEnd(end.lines, before?.lines.length ?? 0) : end.lines.slice(before?.lines.length ?? 0, told);
  const news = state.log.filter((l) => l.tags?.includes('raid')).at(-1);
  const { name } = raidersName(state, raid);
  return (
    <section className="panel">
      <h2 className="plan-title">The raid is over</h2>
      {end && <BattleStage state={state} place="depot" seed={raid.id} view={end} before={before} onLine={setTold} caption={OVER[raid.end ?? 'held']} />}
      {lines.length > 0 && (
        <ul className="fight-lines fight-end">
          {lines.map((l, k) => (
            <li key={k} className={l.tone ? `is-${l.tone}` : undefined}>
              {l.text}
            </li>
          ))}
        </ul>
      )}
      <p>{news?.text ?? `${name.replace(/,$/, '')} came and went.`}</p>
    </section>
  );
}
