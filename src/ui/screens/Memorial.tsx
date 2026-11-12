import type { GameState } from '../../engine/index.ts';
import { Portrait } from '../components/Portrait.tsx';
import { navigate } from '../hooks.ts';
import { daysSurvived, memorialOrder, nameWithNickname } from '../view.ts';

export function Memorial({ state, day }: { state: GameState; day: number }) {
  const fallen = memorialOrder(state);
  return (
    <section aria-labelledby="memorial-title">
      <div className="screen-head">
        <h2 id="memorial-title" className="screen-title">
          Memorial Wall
        </h2>
        <p className="screen-sub">{fallen.length === 0 ? 'No names yet.' : `${fallen.length} ${fallen.length === 1 ? 'name' : 'names'} on the wall`}</p>
      </div>
      {fallen.length === 0 ? (
        <p className="empty">Survivors who die out in the Reach are remembered here, with the story of their life.</p>
      ) : (
        <ul className="wall">
          {fallen.map((s) => (
            <li key={s.id}>
              <button type="button" className="plaque" onClick={() => navigate({ screen: 'survivor', id: s.id, tab: 'story' })}>
                <Portrait survivor={s} size={96} memorial decorative />
                <span className="plaque-name">
                  {nameWithNickname(s)}
                </span>
                <span className="plaque-line">Day {s.diedDay}</span>
                {s.causeOfDeath && <span className="plaque-line">{s.causeOfDeath}</span>}
                <span className="plaque-line">
                  {daysSurvived(s, day)} days, {s.counters.runs} {s.counters.runs === 1 ? 'run' : 'runs'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {state.departed.length > 0 && (
        <div className="panel departed">
          <h3 className="panel-title">Gone their own way</h3>
          <p className="panel-help">People who walked out of the guild. Wherever they are, they took their stories with them.</p>
          <ul className="out-list">
            {[...state.departed].reverse().map((s) => (
              <li key={s.id}>
                <button type="button" className="link-row departed-row" onClick={() => navigate({ screen: 'survivor', id: s.id, tab: 'story' })}>
                  <Portrait survivor={s} size={44} decorative />
                  <span>
                    {nameWithNickname(s)}: left on day {s.leftDay}, after {daysSurvived(s, day)} days.
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
