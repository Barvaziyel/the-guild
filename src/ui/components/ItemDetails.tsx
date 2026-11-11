import type { ItemView } from '../view.ts';

/** An item's name, what it does, and for a named weapon, what it is and its story. */
export function ItemDetails({ view }: { view: ItemView }) {
  return (
    <>
      <span className="item-name">
        {view.name}
        {view.cherished && <span className="cherished"> Cherished</span>}
      </span>
      {view.kind && <span className="item-kind">{view.kind}</span>}
      {view.stats && <span className="item-stats">{view.stats}</span>}
      <span className="item-desc">{view.description}</span>
      {view.story.length > 0 && (
        <ul className="item-story" aria-label={`The story of ${view.name}`}>
          {view.story.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      )}
    </>
  );
}
