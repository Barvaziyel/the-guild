import type { GameState } from '../../engine/index.ts';
import { urgentItems, type UrgentItem } from '../attention-view.ts';
import { navigate } from '../hooks.ts';
import type { Route } from '../route.ts';

/** A little picture for each kind of thing that can't wait. */
function Icon({ kind }: { kind: UrgentItem['icon'] }) {
  if (kind === 'radio')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 13v8M8 21h8M12 13l-5-9M12 13l5-9" />
        <path d="M5 8a9 9 0 0 1 0 6M19 8a9 9 0 0 0 0 6" />
      </svg>
    );
  if (kind === 'raid')
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 21V9l8-6 8 6v12M9 21v-6h6v6" />
        <path d="M2 11l10-8 10 8" />
      </svg>
    );
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20 16 8M14 4h6v6M20 20 8 8M10 4H4v6" />
    </svg>
  );
}

/**
 * What can't wait (3.5.0), on every screen under the header: a fight or a raid waiting for orders, a crew on
 * the radio. Not on the screen it opens.
 */
export function UrgentStrip({ state, now, route }: { state: GameState; now: number; route: Route }) {
  const here = (to: Route): boolean => to.screen === route.screen && ('id' in to ? 'id' in route && to.id === route.id : true);
  const items = urgentItems(state, now).filter((u) => !here(u.to));
  if (items.length === 0) return null;
  return (
    <div className="urgent-strip" role="status">
      {items.map((u) => (
        <button key={u.id} type="button" className={`urgent urgent-${u.icon}`} onClick={() => navigate(u.to)}>
          <Icon kind={u.icon} />
          <span className="urgent-text">{u.text}</span>
          <span className="urgent-go" aria-hidden="true">
            &rsaquo;
          </span>
        </button>
      ))}
    </div>
  );
}
