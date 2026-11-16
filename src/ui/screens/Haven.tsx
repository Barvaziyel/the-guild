import { useEffect, useMemo, useState } from 'react';
import { havenNew, seenHaven, workOutClue, type GameState } from '../../engine/index.ts';
import { havenView, type HavenLeadView } from '../haven-view.ts';
import { navigate, useAction } from '../hooks.ts';
import { HAVEN_TABS, type HavenTab } from '../route.ts';

const TAB_LABELS: Record<HavenTab, string> = { leads: 'Leads', found: 'Found', heard: 'Heard' };

/**
 * Haven (§9.11), a tab of its own once the broadcast is heard (Aviel,
 * 2026-11-16: everything the guild knows about it lives here). Leads with
 * what they know so far, what crews found, and what was heard.
 */
export function Haven({ state, tab }: { state: GameState; tab: HavenTab }) {
  const { act, error } = useAction();
  // What the player had seen on opening it: anything after shows as new while they're here.
  const [seen] = useState(() => state.haven?.seen ?? { found: 0, heard: 0 });
  const view = useMemo(() => havenView(state, seen), [state, seen]);
  const fresh = havenNew(state);
  useEffect(() => {
    if (fresh > 0) act((s) => seenHaven(s));
  }, [fresh, act]);
  if (!view) return <p className="empty">Nobody here has heard of Haven yet.</p>;
  const newFound = view.found.filter((f) => f.isNew).length;
  const newHeard = view.heard.filter((h) => h.isNew).length;

  return (
    <section aria-labelledby="haven-title">
      <div className="screen-head">
        <h2 id="haven-title" className="screen-title">
          Haven
        </h2>
        <p className="screen-sub">{view.since}</p>
      </div>
      <figure className="haven-broadcast">
        <blockquote>{view.broadcast}</blockquote>
        <figcaption>On the radio, every hour</figcaption>
      </figure>

      <div className="sheet-tabs" role="tablist" aria-label="Haven">
        {HAVEN_TABS.map((t) => {
          const count = t === 'found' ? newFound : t === 'heard' ? newHeard : 0;
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
              {TAB_LABELS[t]}
              {count > 0 && <span className="haven-new-count"> {count} new</span>}
            </button>
          );
        })}
      </div>

      <div id="haven-panel" role="tabpanel" aria-labelledby={`haven-tab-${tab}`}>
        {tab === 'leads' && (
          <>
            <section className="panel" aria-labelledby="haven-known">
              <h3 id="haven-known" className="panel-title">
                What we know
              </h3>
              {view.known.length === 0 ? (
                <p className="panel-help">Only the broadcast so far. The leads below are where to start.</p>
              ) : (
                <ul className="haven-known">
                  {view.known.map((k) => (
                    <li key={k}>{k}</li>
                  ))}
                </ul>
              )}
              {view.road && <p className="haven-road">{view.road}</p>}
            </section>
            <section className="panel" aria-labelledby="haven-leads">
              <h3 id="haven-leads" className="panel-title">
                Leads
              </h3>
              {view.leads.length === 0 ? (
                <p className="panel-help">Every lead has been followed.</p>
              ) : (
                <ul className="haven-leads">
                  {view.leads.map((l) => (
                    <Lead key={l.id} lead={l} onWorkOut={() => act((s) => void workOutClue(s, l.id, Date.now()))} />
                  ))}
                </ul>
              )}
              {error && <p className="field-error">{error}</p>}
            </section>
          </>
        )}

        {tab === 'found' &&
          (view.found.length === 0 ? (
            <p className="empty">Nothing found yet. Follow a lead: any run there might turn it up.</p>
          ) : (
            <ul className="haven-found-list">
              {view.found.map((f) => (
                <li key={f.id} className="haven-found">
                  {f.isNew && <p className="haven-new">New</p>}
                  <h3 className="haven-found-title">{f.title}</h3>
                  <p>{f.text}</p>
                  <p className="haven-found-line">{f.line}</p>
                </li>
              ))}
            </ul>
          ))}

        {tab === 'heard' &&
          (view.heard.length === 0 ? (
            <p className="empty">Nothing heard yet. Word comes from all over: crews on the road, people at the gate, traders, the radio.</p>
          ) : (
            <ul className="haven-heard-list">
              {view.heard.map((h, k) => (
                <li key={k} className={`haven-heard${h.isNew ? ' is-new' : ''}`}>
                  <p>{h.text}</p>
                  <p className="haven-heard-line">
                    {h.isNew && <span className="haven-new">New</span>}
                    {h.line}
                  </p>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </section>
  );
}

function Lead({ lead, onWorkOut }: { lead: HavenLeadView; onWorkOut: () => void }) {
  return (
    <li className={`haven-lead${lead.action ? ' is-ready' : ''}`}>
      <p className="haven-lead-where">{lead.where}</p>
      <h4 className="haven-lead-title">{lead.title}</h4>
      <p>{lead.lead}</p>
      {lead.note && <p className="panel-help">{lead.note}</p>}
      {lead.action ? (
        <button type="button" className="btn btn-primary" onClick={onWorkOut}>
          {lead.action}
        </button>
      ) : lead.go ? (
        <button type="button" className="btn" onClick={() => navigate(lead.go!.to)}>
          {lead.go.label}
        </button>
      ) : null}
    </li>
  );
}
