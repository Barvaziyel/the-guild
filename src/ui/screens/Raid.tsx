import { useMemo, useRef, useState } from 'react';
import {
  commandRaidRound,
  lastRaidFight,
  letRaidFight,
  raidAtGate,
  raidFightNow,
  raidPreview,
  raidersName,
  takeRaidCommand,
  type FightView,
  type GameState,
} from '../../engine/index.ts';
import { BattleStage } from '../components/BattleStage.tsx';
import { fightEnd } from '../fight-view.ts';
import { goBack, useAction, useNow } from '../hooks.ts';
import { raidCard } from '../raid-view.ts';
import { Command } from './Fight.tsx';

const OVER: Record<'held' | 'broken', string> = {
  held: 'Held. They drove them off.',
  broken: 'They broke in.',
};

/** Raiders at the Depot (§9.8): on the road, at the gate, under command, or just over. */
export function Raid({ state }: { state: GameState }) {
  const raid = state.depot.raid;
  const open = raid && raid.ended === undefined ? raid : undefined;
  const now = useNow(15_000, open ? (open.defenders === undefined ? open.arrive : open.until) : undefined);
  const gate = raidAtGate(state);
  const view = useMemo(() => (gate?.took !== undefined ? raidFightNow(state, now) : undefined), [state, gate, now]);
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
          title="The fight at the gate"
          stores="in the stores"
          give={(s, orders) => void commandRaidRound(s, orders, Date.now())}
          letThem={(s) => letRaidFight(s, Date.now())}
        />
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
  const card = raidCard(state, now);
  if (!card) return <p className="empty">No raiders at the gate.</p>;
  return (
    <section className="panel fight-call raid-call">
      <p className="dilemma-kicker">Seen from the Watchtower</p>
      <h2 className="dilemma-title">{card.title}</h2>
      {card.lines.map((l, k) => (
        <p key={k}>{l}</p>
      ))}
    </section>
  );
}

function AtGate({ state, now }: { state: GameState; now: number }) {
  const { act, error } = useAction();
  const raid = raidAtGate(state)!;
  const card = raidCard(state, now)!;
  // Who's up against whom, before anyone takes command; it changes nothing.
  const preview = useMemo(() => raidPreview(state, now), [state, now]);
  return (
    <section className="panel fight-call raid-call">
      <p className="dilemma-kicker">At the Depot</p>
      <h2 className="dilemma-title">{card.title}</h2>
      {card.against && <p className="fight-sub">{card.against}</p>}
      {preview && <BattleStage state={state} place="depot" seed={raid.id} view={preview} />}
      {card.lines.map((l, k) => (
        <p key={k}>{l}</p>
      ))}
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
