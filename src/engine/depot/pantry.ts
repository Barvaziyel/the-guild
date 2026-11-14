/**
 * Rations spoil (§9.1, Aviel 2026-11-14): the stores keep them in batches by
 * the game day they came in, and the guild eats the oldest first. Each day,
 * half of whatever has been kept more than RATION_KEEP_DAYS goes off. A guild
 * that eats its food within that loses nothing; a hoard shrinks.
 *
 * Rations come and go all over the engine (runs, traders, raids, building),
 * so the batches follow the stores rather than every change: `settlePantry`
 * dates what came in since it last looked to the day, and takes what went out
 * off the oldest. The Garden's harvest and the day's meals are booked exactly.
 */
import { RATION_KEEP_DAYS, RATION_SPOIL_SHARE } from '../constants.ts';
import { Rng } from '../rng.ts';
import type { GameState, RationBatch } from '../types.ts';

function pantry(state: GameState): RationBatch[] {
  return (state.depot.pantry ??= []);
}

function kept(state: GameState): number {
  return pantry(state).reduce((n, b) => n + b.n, 0);
}

/** Rations in: a batch dated `day` (added to that day's if there is one). */
export function pantryIn(state: GameState, day: number, n: number): void {
  if (n <= 0) return;
  const p = pantry(state);
  const last = p.at(-1);
  if (last && last.day === day) last.n += n;
  else p.push({ day, n });
}

/** Rations out, oldest first. */
export function pantryOut(state: GameState, n: number): void {
  const p = pantry(state);
  let left = n;
  while (left > 0 && p.length > 0) {
    const b = p[0]!;
    const k = Math.min(b.n, left);
    b.n -= k;
    left -= k;
    if (b.n === 0) p.shift();
  }
}

/** Bring the batches in line with the stores: anything that came in since is dated `day`, anything that went out came off the oldest. */
export function settlePantry(state: GameState, day: number): void {
  const diff = state.resources.rations - kept(state);
  if (diff > 0) pantryIn(state, day, diff);
  else if (diff < 0) pantryOut(state, -diff);
}

/** How old the oldest rations are, in game days, on `day`. */
export function oldestRations(state: GameState, day: number): number {
  const first = pantry(state).find((b) => b.n > 0);
  return first ? day - first.day : 0;
}

/** Rations past their keep on `day` (more than RATION_KEEP_DAYS old), and those that will be by the next day. */
export function rationsGoingOff(state: GameState, day: number): { now: number; soon: number } {
  let now = 0;
  let soon = 0;
  for (const b of pantry(state)) {
    const age = day - b.day;
    if (age > RATION_KEEP_DAYS) now += b.n;
    else if (age === RATION_KEEP_DAYS) soon += b.n;
  }
  return { now, soon };
}

/**
 * The day's spoiling: half of each batch past its keep goes off (each ration
 * a coin flip, on dice of their own so the day's others don't change).
 * Returns how many went off.
 */
export function spoilRations(state: GameState, day: number): number {
  settlePantry(state, day);
  const rng = new Rng(`spoil:${state.seed}:${day}`);
  let lost = 0;
  for (const b of pantry(state)) {
    if (day - b.day <= RATION_KEEP_DAYS) continue;
    const exact = b.n * RATION_SPOIL_SHARE;
    const k = Math.min(b.n, Math.floor(exact) + (rng.chance(exact - Math.floor(exact)) ? 1 : 0));
    b.n -= k;
    lost += k;
  }
  state.depot.pantry = pantry(state).filter((b) => b.n > 0);
  state.resources.rations = Math.max(0, state.resources.rations - lost);
  return lost;
}
