import {
  acceptOffer,
  dayAt,
  declineOffer,
  offerProblem,
  offerText,
  type DepotSummary,
  type GameState,
} from '../../engine/index.ts';
import { DilemmaCard } from '../components/DilemmaCard.tsx';
import { Portrait } from '../components/Portrait.tsx';
import { navigate, useAction } from '../hooks.ts';
import { DEPOT_TABS, type DepotTab } from '../route.ts';
import { Yard } from '../components/Yard.tsx';
import { activeRuns, backIn, joinNames, runCrewNames } from '../runs-view.ts';
import { outpostRows } from '../outposts-view.ts';
import { buildingRows, depotNews, foodWarning, homeCounts, summaryLines, type BuildingRow } from '../depot-view.ts';
import { stashLine } from '../gear-view.ts';
import { vehiclesLine } from '../vehicles-view.ts';

interface Props {
  state: GameState;
  now: number;
  tab: DepotTab;
  away: DepotSummary | null;
  onDismissAway: () => void;
}

const TAB_LABELS: Record<DepotTab, string> = { today: 'Today', yard: 'Yard', buildings: 'Buildings', news: 'News' };

export function Depot({ state, now, tab, away, onDismissAway }: Props) {
  const counts = homeCounts(state);

  return (
    <section aria-labelledby="depot-title">
      <div className="screen-head">
        <h2 id="depot-title" className="screen-title">
          The Depot
        </h2>
        <p className="screen-sub">
          {counts.home} at home{counts.out > 0 ? `, ${counts.out} out` : ''}
          {counts.outposts > 0 ? `, ${counts.outposts} at ${state.outposts.length === 1 ? 'the outpost' : 'outposts'}` : ''}. {counts.beds} of {counts.cap} beds taken.
          {state.depot.hungry ? ' The rations have run out.' : ''}
        </p>
      </div>

      <div className="sheet-tabs depot-tabs" role="tablist" aria-label="Depot">
        {DEPOT_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`depot-tab-${t}`}
            aria-selected={t === tab}
            aria-controls="depot-panel"
            className="sheet-tab"
            onClick={() => navigate(t === 'today' ? { screen: 'depot' } : { screen: 'depot', tab: t }, { replace: true })}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div id="depot-panel" role="tabpanel" aria-labelledby={`depot-tab-${tab}`}>
        {tab === 'today' && <Today state={state} now={now} away={away} onDismissAway={onDismissAway} />}
        {tab === 'yard' && <Yard state={state} now={now} />}
        {tab === 'buildings' && <Buildings state={state} />}
        {tab === 'news' && <News state={state} limit={60} />}
      </div>
    </section>
  );
}

/** What needs a look: the note from while you were away, food, traders, crews out, the gate, the gear. */
function Today({ state, now, away, onDismissAway }: Omit<Props, 'tab'>) {
  const counts = homeCounts(state);
  const out = activeRuns(state);
  const outposts = outpostRows(state);
  const atGate = state.depot.recruits.length;
  const food = foodWarning(state);

  return (
    <>
      <DilemmaCard state={state} now={now} />
      {away && away.days > 0 && <AwayNote state={state} summary={away} onDismiss={onDismissAway} />}

      {food && (
        <div className="panel food-warning" role="status">
          <h3 className="panel-title">Food</h3>
          <p>{food}</p>
        </div>
      )}

      {state.depot.offers.length > 0 && <Offers state={state} />}

      {(out.length > 0 || outposts.length > 0) && (
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
            {outposts.map((o) => (
              <li key={o.id}>
                <button type="button" className={`link-row${o.damaged ? ' is-warning' : ''}`} onClick={() => navigate({ screen: 'reach', id: o.id, tab: 'outpost' })}>
                  {o.text}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

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

      <div className="panel" data-tour="vehicles-panel">
        <h3 className="panel-title">Vehicles</h3>
        <p className="panel-help">
          {vehiclesLine(state)} Gas: {state.resources.gas}.
        </p>
        <button type="button" className="btn" onClick={() => navigate({ screen: 'vehicles' })}>
          {state.vehicles.length === 0 ? 'About vehicles' : 'See the vehicles'}
        </button>
      </div>

      <News state={state} limit={3} more />
    </>
  );
}

function Buildings({ state }: { state: GameState }) {
  const rows = buildingRows(state);
  const built = rows.filter((r) => r.built);
  const unbuilt = rows.filter((r) => !r.built);
  return (
    <>
      <div className="panel" data-tour="buildings">
        <h3 className="panel-title">Built</h3>
        <ul className="buildings">
          {built.map((r) => (
            <BuildingCard key={r.id} row={r} />
          ))}
        </ul>
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
    </>
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

function AwayNote({ state, summary, onDismiss }: { state: GameState; summary: DepotSummary; onDismiss: () => void }) {
  const news = summary.news.filter((n) => !n.tags?.includes('run'));
  return (
    <div className="panel away-note" role="status">
      <h3 className="panel-title">Since you last looked</h3>
      {summaryLines(summary, state).map((line) => (
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

/** The latest Depot news; `more` adds a way to the News tab. */
function News({ state, limit, more = false }: { state: GameState; limit: number; more?: boolean }) {
  const news = depotNews(state, limit);
  if (news.length === 0) {
    return more ? null : <p className="empty">Nothing has happened at the Depot yet.</p>;
  }
  return (
    <div className="panel">
      <h3 className="panel-title">{more ? 'Latest news' : 'Depot news'}</h3>
      <ul className="news">
        {news.map((n, i) => (
          <li key={i}>
            <span className="news-day">Day {n.day}</span> {n.text}
          </li>
        ))}
      </ul>
      {more && (
        <button type="button" className="btn btn-small btn-quiet" onClick={() => navigate({ screen: 'depot', tab: 'news' }, { replace: true })}>
          All the news
        </button>
      )}
    </div>
  );
}
