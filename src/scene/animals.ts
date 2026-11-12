/**
 * The guild's animals in the yard (§9.7), small, in the same ink-and-flat-fill
 * look as the people. The dog keeps close to whoever looks after it, or waits
 * by the gate while they're away; the cat sleeps on the Bunks, the goat
 * grazes by the Garden, and the crow sits on a fence post.
 */
import { C, circle, ellipse, ink, line, pathEl, poly } from './draw.ts';
import { Y } from './layout.ts';

const FINE = ink(0.9);

/** A dog sitting up, feet at (x, y), facing right (1) or left (-1). */
export function dog(x: number, y: number, facing: 1 | -1, coat = '#8a6a48'): string {
  const f = (dx: number): number => x + dx * facing;
  const dark = '#5e4630';
  return (
    // Tail, haunch, chest and front legs.
    pathEl(`M ${f(-8)} ${y - 4} Q ${f(-13)} ${y - 10} ${f(-11)} ${y - 13}`, 'none', `stroke="${dark}" stroke-width="1.6" stroke-linecap="round"`) +
    ellipse(f(-4), y - 5, 6, 5, coat, FINE) +
    poly(
      [
        [f(-1), y - 12],
        [f(5), y - 13],
        [f(5), y],
        [f(1), y],
      ],
      coat,
      FINE,
    ) +
    line(f(3), y - 3, f(3), y, 1) +
    // Head, muzzle, ear and eye.
    circle(f(6), y - 16, 4.2, coat, FINE) +
    ellipse(f(10), y - 15, 3, 2, coat, FINE) +
    circle(f(12.6), y - 15.4, 0.9, '#2b2420', 'stroke="none"') +
    poly(
      [
        [f(3.5), y - 18.5],
        [f(5), y - 22],
        [f(7), y - 19],
      ],
      dark,
      FINE,
    ) +
    circle(f(7), y - 17, 0.7, '#2b2420', 'stroke="none"')
  );
}

/** A cat curled up asleep, sitting on y. */
export function cat(x: number, y: number, coat = '#6e6a66'): string {
  return (
    ellipse(x, y - 3.2, 7, 3.6, coat, FINE) +
    pathEl(`M ${x - 6} ${y - 1} Q ${x - 9} ${y + 0.5} ${x - 4} ${y + 0.2}`, 'none', `stroke="${coat}" stroke-width="1.4" stroke-linecap="round"`) +
    circle(x + 5.5, y - 4.4, 2.8, coat, FINE) +
    poly(
      [
        [x + 3.8, y - 6.4],
        [x + 4.4, y - 9],
        [x + 6, y - 7],
      ],
      coat,
      FINE,
    ) +
    poly(
      [
        [x + 6.2, y - 7],
        [x + 7.6, y - 9],
        [x + 8, y - 6.2],
      ],
      coat,
      FINE,
    ) +
    line(x + 5, y - 4.4, x + 6.4, y - 4.4, 0.7)
  );
}

/** A goat standing with its head up, feet at (x, y), facing right (1) or left (-1). */
export function goat(x: number, y: number, facing: 1 | -1): string {
  const f = (dx: number): number => x + dx * facing;
  const coat = '#e6dccb';
  const horn = '#7a6a58';
  return (
    // Legs, body and the little tail turned up.
    line(f(-6), y - 6, f(-6), y, 1.5) +
    line(f(-3), y - 6, f(-3), y, 1.5) +
    line(f(4), y - 6, f(4), y, 1.5) +
    line(f(7), y - 6, f(7), y, 1.5) +
    pathEl(`M ${f(-8)} ${y - 10} l ${-2 * facing} -4`, 'none', `stroke="${coat}" stroke-width="2.2" stroke-linecap="round"`) +
    ellipse(f(0), y - 9, 9, 5, coat, FINE) +
    // Neck up to the head, with horns curving back, an ear, an eye and a beard.
    poly(
      [
        [f(5), y - 12],
        [f(8), y - 20],
        [f(12), y - 19],
        [f(9), y - 9],
      ],
      coat,
      FINE,
    ) +
    pathEl(`M ${f(9)} ${y - 22} q ${-1 * facing} -5 ${-5 * facing} -6`, 'none', `stroke="${horn}" stroke-width="1.6" stroke-linecap="round"`) +
    ellipse(f(11), y - 20, 3.6, 2.4, coat, FINE) +
    pathEl(`M ${f(7.6)} ${y - 20.6} l ${-3.4 * facing} 1.4`, 'none', `stroke="#2b2420" stroke-width="1"`) +
    circle(f(11.4), y - 20.8, 0.6, '#2b2420', 'stroke="none"') +
    pathEl(`M ${f(12.6)} ${y - 18} l ${0.4 * facing} 3.4 l ${0.8 * facing} -3`, '#c9bfa8', FINE)
  );
}

/** A crow perched with its feet at (x, y). */
export function crow(x: number, y: number): string {
  const black = '#2f2c33';
  return (
    pathEl(`M ${x - 5} ${y - 4} L ${x - 10} ${y - 1} L ${x - 4} ${y - 2} Z`, black, FINE) +
    ellipse(x, y - 5, 5, 3.4, black, FINE) +
    circle(x + 4, y - 8.4, 2.6, black, FINE) +
    poly(
      [
        [x + 6.2, y - 9],
        [x + 9.6, y - 8],
        [x + 6.2, y - 7.4],
      ],
      '#4a4650',
      FINE,
    ) +
    circle(x + 4.8, y - 9, 0.6, C.lit, 'stroke="none"') +
    line(x - 0.5, y - 2, x - 0.5, y, 0.8) +
    line(x + 1.5, y - 2, x + 1.5, y, 0.8)
  );
}

/** Where the animals that don't follow anyone about spend the day. */
export const ANIMAL_SPOTS = {
  /** On the roof of the first Bunks car. */
  cat: { x: 34, y: Y.rails - 43 },
  /** Grazing in front of the Garden. */
  goat: { x: 148, y: 448 },
  /** On a fence post by the gate. */
  crow: { x: 268, y: Y.fence - 27 },
  /** By the gate, waiting for its keeper to come home. */
  dogWaiting: { x: 240, y: Y.fence - 8 },
} as const;
