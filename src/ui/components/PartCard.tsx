/**
 * A place's best part on the level a plan goes to (§7.16, 3.13.0): its name once known, and its
 * needs as pictures, lit with whoever in the crew covers each one.
 */
import type { PartCardView } from '../needs-view.ts';
import { Chips } from './Glyph.tsx';

export function PartCard({ card }: { card: PartCardView }) {
  return (
    <div className={`part-card${card.open ? ' is-open' : ''}`} data-tour="part">
      <p className="part-head">
        <span className="part-label">Best part</span>
        {card.title && <span className="part-title">{card.title}</span>}
      </p>
      <Chips chips={card.chips} className="part-chips" />
    </div>
  );
}
