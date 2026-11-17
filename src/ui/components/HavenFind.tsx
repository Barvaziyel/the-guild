import type { HavenFoundView } from '../haven-view.ts';

/**
 * A find for Haven as the guild's notebook keeps it (2.9.1): who found it and
 * where, what it says, what it tells, and where it points on to. Aviel: "it
 * should be very clear... what the clue says... where was found and then...
 * what's the next clue that it leads to". The Found tab's sheet, a run's
 * report and a building's clue worked out all show it this way.
 */
export function HavenFindNote({ find, title = false }: { find: HavenFoundView; title?: boolean }) {
  return (
    <div className="haven-note">
      {title && <h4 className="haven-note-title">{find.title}</h4>}
      <p className="haven-note-line is-top">{find.line}</p>
      <p className="haven-hand">{find.text}</p>
      {find.learned && (
        <p className="haven-note-learned">
          <span>What it tells us:</span> {find.learned}
        </p>
      )}
      {find.next.length > 0 && (
        <div className="haven-note-next">
          <p className="haven-note-next-title">Where it points</p>
          <ul>
            {find.next.map((n) => (
              <li key={n.title} className={`is-${n.status}`}>
                <span className="haven-note-next-name">{n.title}</span>
                <span className="haven-note-next-line">{n.line}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
