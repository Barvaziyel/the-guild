import { useState } from 'react';
import { seenSearch, startSearch, type GameState } from '../../engine/index.ts';
import { cornerRows, cornersHelp, cornersSummary, resultCard, searchedLine, searcherChoices } from '../corners-view.ts';
import { useAction } from '../hooks.ts';
import { Sheet } from './Sheet.tsx';

/**
 * The Depot's corners (§9.9, 2.7.0), under the yard: what the last search
 * found, the search under way, and the corners still to search. Picking one
 * opens a sheet to choose who goes.
 */
export function Corners({ state, now }: { state: GameState; now: number }) {
  const { act, error } = useAction();
  const [picked, setPicked] = useState<string | undefined>(undefined);
  const [who, setWho] = useState<string | undefined>(undefined);
  const result = resultCard(state);
  const summary = cornersSummary(state);
  if (!result && !summary) return null;
  const rows = cornerRows(state);
  const row = rows.find((r) => r.id === picked);
  const choices = picked ? searcherChoices(state, picked) : [];
  const chosen = who && choices.some((c) => c.id === who) ? who : choices[0]?.id;
  const busy = state.corners.search !== undefined;

  return (
    <section className="panel corners" id="corners" data-tour="corners" aria-labelledby="corners-title">
      <div className="corners-head">
        <h3 id="corners-title" className="panel-title">
          The Depot’s corners
        </h3>
        {summary && <span className="corners-count">{summary}</span>}
      </div>

      {result && (
        <div className="corner-result" role="status">
          <p className="corner-result-title">{result.title}</p>
          <p className="corner-result-who">{result.who}</p>
          <p>{result.text}</p>
          {result.supplies && <p className="dilemma-supplies">{result.supplies}</p>}
          {result.gear && <p className="dilemma-supplies">{result.gear}</p>}
          <button type="button" className="btn btn-small" onClick={() => act((s) => seenSearch(s))}>
            Done
          </button>
        </div>
      )}

      {summary && (
        <>
          <p className="panel-help">{cornersHelp(state, now)}</p>
          <ul className="corner-list">
            {rows
              .filter((r) => r.status !== 'searched')
              .map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className={`corner-row is-${r.status}`}
                    disabled={r.status !== 'open' || busy}
                    onClick={() => {
                      setPicked(r.id);
                      setWho(undefined);
                    }}
                  >
                    <span className="corner-name">{r.name}</span>
                    <span className="corner-meta">{r.status === 'searching' ? 'Being searched' : r.status === 'locked' ? r.locked : r.meta}</span>
                  </button>
                </li>
              ))}
          </ul>
          {searchedLine(state) && <p className="panel-help corners-done">{searchedLine(state)}</p>}
        </>
      )}
      {error && <p className="field-error">{error}</p>}

      <Sheet open={row !== undefined} title={row?.name ?? ''} onClose={() => setPicked(undefined)}>
        {row && (
          <>
            <p>{row.intro}</p>
            <p className="panel-help">{row.meta}.</p>
            {choices.length > 0 ? (
              <>
                <h4 className="their-kinds-title">Who goes</h4>
                <div className="fight-chips" role="group" aria-label="Who searches">
                  {choices.map((c) => (
                    <button key={c.id} type="button" className={`chip${chosen === c.id ? ' is-on' : ''}`} aria-pressed={chosen === c.id} onClick={() => setWho(c.id)}>
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => {
                      if (chosen && act((s) => void startSearch(s, row.id, chosen, Date.now()))) setPicked(undefined);
                    }}
                  >
                    Search it
                  </button>
                </div>
              </>
            ) : (
              <p>Nobody at home can go right now.</p>
            )}
          </>
        )}
      </Sheet>
    </section>
  );
}
