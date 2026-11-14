/**
 * Who can reach whom in a fight (§7.4, 2.3.0). Each side has a front and a back.
 * Blows reach only the front rank while anyone stands in it; shots reach anyone;
 * nothing reaches what flies but a shot.
 */
import type { Rank } from '../types.ts';
import type { Enemy } from './combat.ts';
import type { Member } from './context.ts';

/** Where an enemy stands: those that shoot at the back, flyers in the air, everyone else in front. */
export type EnemyRank = Rank | 'air';

export function enemyRank(e: Enemy): EnemyRank {
  return e.def.flies ? 'air' : e.def.ranged ? 'back' : 'front';
}

const up = (e: Enemy): boolean => !e.dead && !e.fled;

/** Whether one of the crew reaches this enemy: with a shot, anything; with a blow from the front, its front rank (or its back, once nobody stands in front), never a flyer. */
export function reaches(shot: boolean, from: Rank, e: Enemy, enemies: readonly Enemy[]): boolean {
  if (shot) return true;
  if (from === 'back') return false;
  const rank = enemyRank(e);
  if (rank === 'air') return false;
  if (rank === 'front') return true;
  return !enemies.some((o) => up(o) && enemyRank(o) === 'front');
}

/** Whether an enemy reaches one of the crew: shots and flyers reach anyone; a blow, the front rank (or the back, once nobody stands in front). */
export function enemyReaches(e: Enemy, m: Member, crew: readonly Member[]): boolean {
  if (e.def.ranged || e.def.flies) return true;
  if ((m.rank ?? 'front') === 'front') return true;
  return !crew.some((o) => (o.rank ?? 'front') === 'front');
}
