import type { Beat } from '../../engine/index.ts';
import { beatTime, checkLine } from '../runs-view.ts';

/** A run's log, beat by beat, with the dice shown under the lines they decided. */
export function BeatLog({ beats, names, more }: { beats: readonly Beat[]; names: Record<string, string>; more?: boolean }) {
  return (
    <ol className="beats">
      {beats.map((b, i) => (
        <li key={i} className={`beat beat-${b.kind}`}>
          <div className="beat-head">
            <h4 className="beat-title">{b.title}</h4>
            {beatTime(b) && <span className="beat-time">{beatTime(b)}</span>}
          </div>
          <ul className="beat-lines">
            {b.lines.map((line, j) => (
              <li key={j} className={line.tone ? `tone-${line.tone}` : undefined}>
                {line.text}
                {line.check && <span className="beat-check">{checkLine(line.check, names)}</span>}
              </li>
            ))}
          </ul>
        </li>
      ))}
      {more && (
        <li className="beat beat-more">
          <p>More to come. The rest of the log fills in as they go.</p>
        </li>
      )}
    </ol>
  );
}
