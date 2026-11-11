import {
  acceptOffer,
  dayAt,
  declineOffer,
  offerProblem,
  offerText,
  type DepotSummary,
  type GameState,
} from '../../engine/index.ts';
import { Portrait } from '../components/Portrait.tsx';
import { navigate, useAction } from '../hooks.ts';
import { activeRuns, backIn, joinNames, runCrewNames } from '../runs-view.ts';
import { buildingRows, depotNews, foodWarning, homeCounts, summaryLines, type BuildingRow } from '../depot-view.ts';
import { stashLine } from '../gear-view.ts';

interface Props {
  state: GameState;
  now: number;
  away: DepotSummary | null;
  onDismissAway: () => void;
}

export function Depot({ state, now, away, onDismissAway }: Props) {
  const counts = homeCounts(state);
  const rows = buildingRows(state);
  const built = rows.filter((r) => r.built);
  const unbuilt = rows.filter((r) => !r.built);
  const out = activeRuns(state);
  const atGate = state.depot.recruits.length;
  const food = foodWarning(state);

  return (
    <section aria-labelledby="depot-title">
      <div className="screen-head">
        <h2 id="depot-title" className="screen-title">
          The Depot
        </h2>
        <p className="screen-sub">
          {counts.home} at home{counts.out > 0 ? `, ${counts.out} out` : ''}. {counts.beds} of {counts.cap} beds taken.
          {state.depot.hungry ? ' The rations have run out.' : ''}
        </p>
      </div>

      {away && away.days > 0 && <AwayNote summary={away} onDismiss={onDismissAway} />}

      {food && (
        <div className="panel food-warning" role="status">
          <h3 className="panel-title">Food</h3>
          <p>{food}</p>
        </div>
      )}

      {state.depot.offers.length > 0 && <Offers state={state} />}

      {out.length > 0 && (
        <div className="panel">
          <h3 className="panel-title">Out in the Reach</h3>
          <ul className="out-list">
            {out.map((run) => (
              <li key={run.id}>
                <button type="button" className="link-row" onClick={() => navigate({ screen: 'run', id: run.id })}>
                  {joinNames(runCrewNames(run))}: {backIn(run, now)}.
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel" data-tour="buildings">
        <h3 className="panel-title">Buildings</h3>
        <ul className="buildings">
          {built.map((r) => (
            <BuildingCard key={r.id} row={r} />
          ))}
        </ul>
      </div>

      <div className="panel">
        <h3 className="panel-title">At the gate</h3>
        <p className="panel-help">
          {atGate === 0
            ? 'Nobody is waiting. New people answer the radio each day.'
            : `${atGate} ${atGate === 1 ? 'person is' : 'people are'} asking to join.`}
          {counts.beds >= counts.cap && atGate > 0 ? ' Every bed is taken, so improve the Bunks to make room.' : ''}
        </p>
        {atGate > 0 && (
          <button type="button" className="btn" onClick={() => navigate({ screen: 'recruits' })}>
            See who&rsquo;s at the gate
          </button>
        )}
      </div>

      <div className="panel" data-tour="gear">
        <h3 className="panel-title">Gear</h3>
        <p className="panel-help">{stashLine(state)} Hand it out, or see who carries what.</p>
        <button type="button" className="btn" onClick={() => navigate({ screen: 'gear' })}>
          See the gear
        </button>
      </div>

      {unbuilt.length > 0 && (
        <div className="panel" data-tour="to-build">
          <h3 className="panel-title">Still to build</h3>
          <ul className="buildings">
            {unbuilt.map((r) => (
              <BuildingCard key={r.id} row={r} />
            ))}
          </ul>
        </div>
      )}

      <News state={state} />
    </section>
  );
}

function BuildingCard({ row: r }: { row: BuildingRow }) {
  return (
    <li>
      <button type="button" className={`building-card${r.built ? '' : ' is-unbuilt'}`} onClick={() => navigate({ screen: 'building', id: r.id })}>
        <span className="building-head">
          <span className="building-name">{r.name}</span>
          <span className="building-level">{r.built ? `Level ${r.level}` : r.next?.cost}</span>
        </span>
        <span className="building-status">{r.built ? r.status : r.description}</span>
        {r.slots > 0 && (
          <span className="building-workers">
            {r.workers.map((s) => (
              <Portrait key={s.id} survivor={s} size={32} decorative />
            ))}
            <span className="building-slots">
              {r.workers.length} of {r.slots} {r.slots === 1 ? 'post' : 'posts'} filled
            </span>
          </span>
        )}
      </button>
    </li>
  );
}

function AwayNote({ summary, onDismiss }: { summary: DepotSummary; onDismiss: () => void }) {
  const news = summary.news.filter((n) => !n.tags?.includes('run'));
  return (
    <div className="panel away-note" role="status">
      <h3 className="panel-title">Since you last looked</h3>
      {summaryLines(summary).map((line) => (
        <p key={line}>{line}</p>
      ))}
      {news.length > 0 && (
        <ul className="away-news">
          {news.slice(-6).map((n, i) => (
            <li key={i}>
              <span className="news-day">Day {n.day}</span> {n.text}
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="btn btn-small" onClick={onDismiss}>
        Got it
      </button>
    </div>
  );
}

function Offers({ state }: { state: GameState }) {
  const { act, error } = useAction();
  const day = dayAt(state, Date.now());
  return (
    <div className="panel offers">
      <h3 className="panel-title">A trader at the gate</h3>
      {state.depot.offers.map((o) => {
        const problem = offerProblem(state, o.id);
        return (
          <div key={o.id} className="offer">
            <p>
              They&rsquo;ll trade {offerText(o)}. They leave {o.expiresDay - 1 <= day ? 'at the end of today' : `after day ${o.expiresDay - 1}`}.
            </p>
            {problem && <p className="field-error">{problem}</p>}
            <div className="btn-row">
              <button type="button" className="btn btn-primary btn-small" disabled={problem !== undefined} onClick={() => act((s) => acceptOffer(s, o.id, dayAt(s, Date.now())))}>
                Trade
              </button>
              <button type="button" className="btn btn-quiet btn-small" onClick={() => act((s) => declineOffer(s, o.id))}>
                Send them on
              </button>
            </div>
          </div>
        );
      })}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

function News({ state }: { state: GameState }) {
  const news = depotNews(state);
  if (news.length === 0) return null;
  return (
    <div className="panel">
      <h3 className="panel-title">Depot news</h3>
      <ul className="news">
        {news.map((n, i) => (
          <li key={i}>
            <span className="news-day">Day {n.day}</span> {n.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
