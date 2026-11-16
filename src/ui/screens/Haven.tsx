import { useEffect, useMemo, useState } from 'react';
import { havenNew, seenHaven, workOutClue, type GameState } from '../../engine/index.ts';
import { Sheet } from '../components/Sheet.tsx';
import { HEARD_SHOWN, havenView, roadPoints, roadView, smoothPath, type HavenFoundView, type HavenLeadView, type RoadView } from '../haven-view.ts';
import { navigate, useAction } from '../hooks.ts';
import { HAVEN_TABS, type HavenTab } from '../route.ts';

const TAB_LABELS: Record<HavenTab, string> = { leads: 'Leads', found: 'Found', heard: 'Heard' };

/**
 * Haven (§9.11), a tab of its own once the broadcast is heard: the guild's
 * notebook on it (Aviel, 2026-11-16: organized, and looking like handwriting).
 * The road from the Depot fills in as clues are found; under it, the leads
 * with what they know, the clues found as scraps of paper, and what was heard.
 */
export function Haven({ state, tab }: { state: GameState; tab: HavenTab }) {
  const { act, error } = useAction();
  // What the player had seen on opening it: anything after shows as new while they're here.
  const [seen] = useState(() => state.haven?.seen ?? { found: 0, heard: 0 });
  const view = useMemo(() => havenView(state, seen), [state, seen]);
  const road = useMemo(() => roadView(state), [state]);
  const [reading, setReading] = useState<HavenFoundView | undefined>(undefined);
  const [older, setOlder] = useState(false);
  const fresh = havenNew(state);
  useEffect(() => {
    if (fresh > 0) act((s) => seenHaven(s));
  }, [fresh, act]);
  if (!view || !road) return <p className="empty">Nobody here has heard of Haven yet.</p>;
  const newFound = view.found.filter((f) => f.isNew).length;
  const newHeard = view.heard.filter((h) => h.isNew).length;
  const counts: Record<HavenTab, number> = { leads: view.leads.length, found: view.found.length, heard: view.heard.length };
  const heard = older ? view.heard : view.heard.slice(0, HEARD_SHOWN);

  return (
    <section aria-labelledby="haven-title" className="haven">
      <div className="screen-head">
        <h2 id="haven-title" className="screen-title">
          Haven
        </h2>
        <p className="screen-sub">{view.since}</p>
      </div>

      <Road road={road} />
      <p className="haven-radio">
        <span>On the radio, every hour:</span> “{view.broadcast}”
      </p>

      <div className="sheet-tabs" role="tablist" aria-label="Haven">
        {HAVEN_TABS.map((t) => {
          const isNew = (t === 'found' && newFound > 0) || (t === 'heard' && newHeard > 0);
          return (
            <button
              key={t}
              type="button"
              role="tab"
              id={`haven-tab-${t}`}
              aria-selected={t === tab}
              aria-controls="haven-panel"
              className="sheet-tab"
              onClick={() => navigate(t === 'leads' ? { screen: 'haven' } : { screen: 'haven', tab: t }, { replace: true, keepScroll: true })}
            >
              {TAB_LABELS[t]} <span className="haven-count">{counts[t]}</span>
              {isNew && <span className="haven-dot" aria-label=", something new" />}
            </button>
          );
        })}
      </div>

      <div id="haven-panel" role="tabpanel" aria-labelledby={`haven-tab-${tab}`}>
        {tab === 'leads' && (
          <>
            <section className="haven-page" aria-labelledby="haven-known">
              <h3 id="haven-known" className="haven-hand-title">
                What we know
              </h3>
              {view.known.length === 0 ? (
                <p className="haven-hand">Only the broadcast so far. The leads are where to start.</p>
              ) : (
                <ul className="haven-known">
                  {view.known.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              )}
              {view.road && <p className="haven-road-open">{view.road}</p>}
            </section>
            {view.leads.length === 0 ? (
              <p className="empty">Every lead has been followed.</p>
            ) : (
              <ul className="haven-cards" aria-label="Leads">
                {view.leads.map((l) => (
                  <Lead key={l.id} lead={l} onWorkOut={() => act((s) => void workOutClue(s, l.id, Date.now()))} />
                ))}
              </ul>
            )}
            {error && <p className="field-error">{error}</p>}
          </>
        )}

        {tab === 'found' &&
          (view.found.length === 0 ? (
            <p className="empty">Nothing found yet. Follow a lead: any run there might turn it up.</p>
          ) : (
            <ul className="haven-scraps">
              {view.found.map((f) => (
                <li key={f.id}>
                  <button type="button" className="haven-scrap" onClick={() => setReading(f)}>
                    {f.isNew && <span className="haven-scrap-new">new</span>}
                    <span className="haven-scrap-title">{f.title}</span>
                    <span className="haven-scrap-line">{f.line}</span>
                  </button>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'heard' &&
          (view.heard.length === 0 ? (
            <p className="empty">Nothing heard yet. Word comes from all over: crews on the road, people at the gate, traders, the radio.</p>
          ) : (
            <section className="haven-page" aria-label="Heard">
              <ul className="haven-heard-list">
                {heard.map((h, k) => (
                  <li key={k} className="haven-heard">
                    <p className="haven-hand">{h.text}</p>
                    <p className="haven-heard-line">
                      {h.isNew && <span className="haven-new">New</span>}
                      {h.line}
                    </p>
                  </li>
                ))}
              </ul>
              {view.heard.length > HEARD_SHOWN && (
                <button type="button" className="btn-paper" onClick={() => setOlder(!older)}>
                  {older ? 'Fewer' : `Older (${view.heard.length - HEARD_SHOWN})`}
                </button>
              )}
            </section>
          ))}
      </div>

      <Sheet open={!!reading} title={reading?.title ?? ''} onClose={() => setReading(undefined)}>
        {reading && (
          <div className="haven-note">
            <p className="haven-hand">{reading.text}</p>
            <p className="haven-note-line">{reading.line}</p>
          </div>
        )}
      </Sheet>
    </section>
  );
}

/** The road from the Depot to Haven, drawn by hand: inked as far as the clues go, pencilled after. */
function Road({ road }: { road: RoadView }) {
  const pts = roadPoints(road.total);
  const done = pts.slice(0, road.found + 1);
  const ahead = pts.slice(road.found);
  const end = pts[pts.length - 1]!;
  const start = pts[0]!;
  return (
    <figure className="haven-map">
      <svg viewBox="0 0 340 120" role="img" aria-label={`The road from the Depot to ${road.end.replace('?', '')}: ${road.line}`}>
        <path className="haven-map-ahead" d={smoothPath(ahead)} />
        {road.found > 0 && <path className="haven-map-done" d={smoothPath(done)} />}
        {road.stops.map((s, i) => {
          const p = pts[i + 1]!;
          return s === 'found' ? (
            <circle key={i} className="haven-stop is-found" cx={p.x} cy={p.y} r={4.5} />
          ) : s === 'open' ? (
            <circle key={i} className="haven-stop is-open" cx={p.x} cy={p.y} r={5} />
          ) : (
            <circle key={i} className="haven-stop is-unknown" cx={p.x} cy={p.y} r={2.2} />
          );
        })}
        <rect className="haven-map-depot" x={start.x - 7} y={start.y - 7} width={14} height={14} />
        <text className="haven-map-label" x={start.x - 10} y={start.y + 24}>
          the Depot
        </text>
        <circle className={`haven-map-end${road.roadOpen ? ' is-open' : ''}`} cx={end.x} cy={end.y} r={9} />
        <text className="haven-map-label is-end" x={end.x + 12} y={end.y - 14} textAnchor="end">
          {road.end}
        </text>
      </svg>
      <figcaption className="haven-map-foot">
        <span className="haven-map-key" aria-hidden="true">
          <span>
            <i className="is-found" />
            found
          </span>
          <span>
            <i className="is-open" />a lead
          </span>
        </span>
        <span className="haven-map-line">{road.line}</span>
      </figcaption>
    </figure>
  );
}

function Lead({ lead, onWorkOut }: { lead: HavenLeadView; onWorkOut: () => void }) {
  return (
    <li className={`haven-card${lead.action ? ' is-ready' : ''}`}>
      <p className="haven-card-where">{lead.where}</p>
      <h4 className="haven-card-title">{lead.title}</h4>
      <p className="haven-card-lead">{lead.lead}</p>
      {lead.note && <p className="haven-card-note">{lead.note}</p>}
      {lead.action ? (
        <button type="button" className="btn-paper is-primary" onClick={onWorkOut}>
          {lead.action}
        </button>
      ) : lead.go ? (
        <button type="button" className="btn-paper" onClick={() => navigate(lead.go!.to)}>
          {lead.go.label}
        </button>
      ) : null}
    </li>
  );
}
