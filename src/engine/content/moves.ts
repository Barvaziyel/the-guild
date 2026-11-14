import type { MoveId } from '../types.ts';

/**
 * Moves in a fight the player commands (§7.13). Everyone has attack, cover,
 * patch and aim (when they can); traits and gear add the rest through their
 * `moves` hooks. What each move does is in expedition/command.ts.
 */
export interface MoveDef {
  id: MoveId;
  name: string;
  /** One line for the move picker. */
  detail: string;
  /** What it's aimed at. */
  target: 'enemy' | 'ally' | 'none';
}

export const MOVES: Record<MoveId, MoveDef> = {
  attack: { id: 'attack', name: 'Attack', detail: 'Go for one of them.', target: 'enemy' },
  job: { id: 'job', name: 'Work the job', detail: 'No attack: work at the job this fight came with.', target: 'none' },
  finish: { id: 'finish', name: 'Finish it', detail: 'Make sure one on the ground stays down. It can’t miss.', target: 'enemy' },
  cover: { id: 'cover', name: 'Take cover', detail: 'No attack, and harder to hit this round.', target: 'none' },
  patch: { id: 'patch', name: 'Patch up', detail: 'Use a med. Someone down gets back up.', target: 'ally' },
  aim: { id: 'aim', name: 'Aim', detail: 'No shot now; the next one is better.', target: 'none' },
  called_shot: { id: 'called_shot', name: 'Called shot', detail: 'Harder to hit, double damage.', target: 'enemy' },
  spray: { id: 'spray', name: 'Spray', detail: 'Two of them at once, a little wilder. Two shots.', target: 'enemy' },
  smash: { id: 'smash', name: 'Smash', detail: 'A heavy swing through any armor. Harder to land.', target: 'enemy' },
  stun: { id: 'stun', name: 'Stun', detail: 'A hit costs it its next attack.', target: 'enemy' },
  charge: { id: 'charge', name: 'Charge', detail: 'Hit harder, and be easier to hit.', target: 'enemy' },
  draw_fire: { id: 'draw_fire', name: 'Draw fire', detail: 'They all go for this one, who is harder to hit.', target: 'none' },
  guard: { id: 'guard', name: 'Guard', detail: 'Take the blows meant for someone else.', target: 'ally' },
  spot: { id: 'spot', name: 'Spot', detail: 'No attack; the others hit this one more easily.', target: 'enemy' },
  intimidate: { id: 'intimidate', name: 'Intimidate', detail: 'Stare one of them into running.', target: 'enemy' },
  soothe: { id: 'soothe', name: 'Soothe', detail: 'Calm an animal until it slinks off.', target: 'enemy' },
  short_out: { id: 'short_out', name: 'Short out', detail: 'Shut a machine down.', target: 'enemy' },
};
