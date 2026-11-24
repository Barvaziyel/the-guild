import type { GameState, Survivor } from '../../engine/index.ts';
import { slotViews } from '../gear-view.ts';
import { ItemIcon } from './Art.tsx';

const SLOT_NAMES = { weapon: 'Weapon', armor: 'Armor', tool: 'Tool', trinket: 'Trinket' } as const;

/**
 * What someone carries, as four small pictures (3.5.0): an empty slot is a dashed box, and an empty
 * weapon or armor slot the stash could fill is red, so nobody goes out with nothing on unnoticed.
 */
export function GearSlots({ state, survivor }: { state: GameState; survivor: Survivor }) {
  const slots = slotViews(state, survivor);
  const label = slots.map((s) => (s.item ? `${SLOT_NAMES[s.slot]}: ${s.item.name}` : `No ${s.slot}${s.wanting ? ', and the stash has one' : ''}`)).join('. ');
  return (
    <span className="gear-slots" role="img" aria-label={label}>
      {slots.map((s) =>
        s.item ? (
          <span key={s.slot} className="gear-slot-pic">
            <ItemIcon defId={s.item.defId} quality={s.item.quality} />
          </span>
        ) : (
          <span key={s.slot} className={`gear-slot-pic is-empty${s.wanting ? ' is-wanting' : ''}`}>
            <ItemIcon />
          </span>
        ),
      )}
    </span>
  );
}
