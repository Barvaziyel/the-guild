import { useState } from 'react';
import { assignPost, dayAt, joinProject, startStage, type GameState, type ProjectId } from '../../engine/index.ts';
import { navigate, useAction } from '../hooks.ts';
import { crewCandidates, projectRows, type ProjectRow } from '../projects-view.ts';
import { Portrait } from './Portrait.tsx';

const ORDER: Record<ProjectRow['state'], number> = { working: 0, waiting: 1, ready: 2, locked: 3, done: 4 };

/** The Depot's Projects tab: big works, one stage at a time (§9.6). */
export function Projects({ state }: { state: GameState }) {
  const rows = [...projectRows(state)].sort((a, b) => ORDER[a.state] - ORDER[b.state]);
  return (
    <>
      <div className="panel" data-tour="projects">
        <h3 className="panel-title">Projects</h3>
        <p className="panel-help">
          Big works that change the Depot for good. Each comes in three stages: pay for a stage, then put a crew on it, and they work it off day by day. One stage at a time, so the crew moves on with the work; they eat a ration more each while they work.
        </p>
      </div>
      {rows.map((r) => (
        <ProjectCard key={r.id} state={state} row={r} />
      ))}
    </>
  );
}

function ProjectCard({ state, row: r }: { state: GameState; row: ProjectRow }) {
  const { act, error } = useAction();
  const [adding, setAdding] = useState(false);
  return (
    <section className={`panel project project-${r.state}`} aria-labelledby={`project-${r.id}`}>
      <h3 id={`project-${r.id}`} className="panel-title project-title">
        {r.name}
        <span className="project-status">{r.status}</span>
      </h3>
      {r.state !== 'locked' && r.state !== 'ready' && (
        <div className="project-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r.progress * 100)} aria-label={`${r.name}: ${Math.round(r.progress * 100)}% done`}>
          <span style={{ width: `${Math.round(r.progress * 100)}%` }} />
          <i style={{ left: '33.333%' }} />
          <i style={{ left: '66.667%' }} />
        </div>
      )}
      <p className="project-text">{r.description}</p>
      <p className="project-effect">
        <strong>{r.state === 'done' ? 'Now:' : 'When finished:'}</strong> {r.effect}
      </p>
      {r.needs && <p className="panel-help">{r.needs}</p>}
      {r.eta && <p className="panel-help">{r.eta}</p>}

      {r.next && !r.needs && (
        <div className="project-next">
          <span className="project-cost">{r.next.cost}</span>
          <button type="button" className="btn btn-primary btn-small" disabled={r.next.problem !== undefined} onClick={() => act((st) => startStage(st, r.id, dayAt(st, Date.now())))}>
            {r.next.label}
          </button>
          {r.next.problem && <p className="panel-help project-problem">{r.next.problem}</p>}
        </div>
      )}

      {(r.crew.length > 0 || r.crewRoom > 0) && (
        <div className="project-crew">
          <h4 className="project-crew-title">
            Crew <span className="count">{r.crew.length} of {r.crew.length + r.crewRoom}</span>
            <span className="project-crew-stat"> works with {r.workStat}</span>
          </h4>
          <ul className="workers">
            {r.crew.map(({ survivor: s, line, away }) => (
              <li key={s.id} className="worker">
                <button type="button" className="worker-face" onClick={() => navigate({ screen: 'survivor', id: s.id, tab: 'stats' })}>
                  <Portrait survivor={s} size={48} decorative />
                </button>
                <span className="worker-body">
                  <span className="crew-name">
                    {s.firstName} {s.lastName}
                  </span>
                  <span className="crew-stats">{line}</span>
                  {away && <span className="crew-reason">{away}</span>}
                </span>
                <button type="button" className="btn btn-small btn-quiet" onClick={() => act((st) => assignPost(st, s.id, undefined))}>
                  Take off
                </button>
              </li>
            ))}
          </ul>
          {r.crewRoom > 0 &&
            (adding ? (
              <CrewPicker state={state} id={r.id} onDone={() => setAdding(false)} />
            ) : (
              <button type="button" className="btn" onClick={() => setAdding(true)}>
                Add to the crew
              </button>
            ))}
        </div>
      )}
      {error && <p className="field-error">{error}</p>}
    </section>
  );
}

function CrewPicker({ state, id, onDone }: { state: GameState; id: ProjectId; onDone: () => void }) {
  const { act, error } = useAction();
  return (
    <div className="picker">
      <ul>
        {crewCandidates(state, id).map((c) => (
          <li key={c.survivor.id}>
            <button
              type="button"
              className="pick pick-person"
              disabled={c.problem !== undefined}
              onClick={() => {
                if (act((st) => joinProject(st, c.survivor.id, id))) onDone();
              }}
            >
              <Portrait survivor={c.survivor} size={40} decorative />
              <span className="pick-text">
                <span className="item-name">
                  {c.survivor.firstName} {c.survivor.lastName}
                </span>
                <span className="item-stats">{[c.stat, c.current].filter(Boolean).join('. ')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="btn btn-small btn-quiet" onClick={onDone}>
        Cancel
      </button>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
