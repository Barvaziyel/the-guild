/**
 * Vehicles parked in the yard, side on, with their wheels on the ground at y = 0.
 * A broken-down one sits on bricks with a wheel off.
 */
import { C, circle, darken, hash, ink, line, pathEl, rect } from './draw.ts';

const FINE = ink(0.9);
const PAINT = ['#5f7f78', '#a8603f', '#7d6c4f', '#4f5b66', '#868b63', '#8c6f56'] as const;

function wheel(x: number, r: number, broken: boolean): string {
  if (broken) return rect(x - r, -r * 1.2, r * 2, r * 1.2, '#8d6a54', FINE) + line(x - r, -r * 0.6, x + r, -r * 0.6, 0.6);
  return circle(x, -r, r, '#34312e') + circle(x, -r, r * 0.4, '#8d9494', FINE);
}

function motorcycle(paint: string, broken: boolean): string {
  return (
    wheel(-13, 6.5, false) +
    wheel(13, 6.5, broken) +
    pathEl('M -13 -7 L -2 -14 L 9 -14 L 13 -7', 'none', ink(1.6)) +
    pathEl('M -6 -14 L 7 -14 L 6 -18 L -4 -18 Z', paint) +
    rect(-10, -17, 9, 3, '#3a302a', FINE) +
    line(9, -14, 12, -22, 1.4) +
    line(10, -22, 15, -22, 1.4)
  );
}

function car(paint: string, broken: boolean): string {
  return (
    pathEl('M -36 -8 L -36 -18 L -26 -20 L -16 -32 L 14 -32 L 26 -20 L 36 -18 L 36 -8 Z', paint) +
    pathEl('M -13 -29 L -2 -29 L -2 -21 L -21 -21 Z', '#9fb7b0', FINE) +
    pathEl('M 1 -29 L 12 -29 L 21 -21 L 1 -21 Z', '#9fb7b0', FINE) +
    line(-36, -13, 36, -13, 0.6) +
    wheel(-22, 7, false) +
    wheel(22, 7, broken)
  );
}

function pickup(paint: string, broken: boolean): string {
  return (
    rect(-40, -20, 46, 12, darken(paint, 0.15)) +
    line(-40, -16, 6, -16, 0.6) +
    pathEl('M 6 -8 L 6 -32 L 24 -32 L 32 -20 L 40 -18 L 40 -8 Z', paint) +
    pathEl('M 10 -29 L 22 -29 L 28 -21 L 10 -21 Z', '#9fb7b0', FINE) +
    rect(-36, -26, 8, 6, '#8a6844', FINE) +
    rect(-26, -24, 10, 4, '#7d8382', FINE) +
    wheel(-26, 7.5, false) +
    wheel(26, 7.5, broken)
  );
}

function van(paint: string, broken: boolean): string {
  return (
    pathEl('M -42 -8 L -42 -40 L 22 -40 L 32 -28 L 42 -24 L 42 -8 Z', paint) +
    pathEl('M 24 -36 L 30 -28 L 22 -28 L 22 -36 Z', '#9fb7b0', FINE) +
    line(-10, -40, -10, -8, 0.6) +
    rect(-34, -34, 16, 8, '#9fb7b0', FINE) +
    wheel(-28, 7.5, false) +
    wheel(28, 7.5, broken)
  );
}

const SHAPES: Record<string, (paint: string, broken: boolean) => string> = { motorcycle, car, pickup, van };

/** A vehicle parked with its middle at x, wheels on the ground at y. */
export function vehicle(defId: string, id: string, x: number, y: number, broken: boolean): string {
  const shape = SHAPES[defId] ?? car;
  const paint = PAINT[hash(id) % PAINT.length]!;
  const body = shape(broken ? darken(paint, 0.2) : paint, broken);
  const shadow = `<ellipse cx="0" cy="0.5" rx="${defId === 'motorcycle' ? 18 : 40}" ry="2.5" fill="${C.dirtDark}" stroke="none"/>`;
  return `<g transform="translate(${x} ${y})">${shadow}${body}</g>`;
}
