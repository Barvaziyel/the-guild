/**
 * An elite at a place (§7.15, 3.12.0): its picture, name, what it does as tags,
 * and its prize; or, once it's dead, who brought it down.
 */
import type { ReactNode } from 'react';
import type { EliteCardView } from '../elites-view.ts';
import { EnemyPicture, ItemIcon } from './Art.tsx';
import { Chips } from './Glyph.tsx';

export function EliteCard({ card, children, compact }: { card: EliteCardView; children?: ReactNode; compact?: boolean }) {
  const dead = card.state === 'dead';
  return (
    <div className={`elite-card${dead ? ' is-dead' : ''}`} data-tour="elite">
      <EnemyPicture kind={card.kind} type={card.type} label={card.name} />
      <div className="elite-body">
        <h4 className="elite-name">{card.name}</h4>
        {dead ? <p className="elite-line">{card.line}</p> : !compact && <p className="elite-desc">{card.description}</p>}
        {!dead && <Chips chips={card.chips} className="elite-chips" />}
        <p className="elite-prize">
          <ItemIcon defId={card.prize.item} quality="relic" label={card.prize.what} />
          <span>
            <span className="elite-prize-name">{card.prize.name}</span>
            <span className="elite-prize-what">{dead ? 'Taken' : card.prize.what}</span>
          </span>
        </p>
      </div>
      {children && <div className="elite-orders">{children}</div>}
    </div>
  );
}
