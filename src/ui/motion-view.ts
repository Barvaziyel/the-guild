/**
 * Small numbers for screen motion (3.2.0): a supply counting up or down to
 * its new amount, eased, and what changed since the last look. Plain, tested.
 */

/** How long a supply takes to count to its new amount, in ms. */
export const COUNT_MS = 700;

/** Ease out: quick at first, settling at the end. */
export function easeOut(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - (1 - c) ** 3;
}

/** The number shown `elapsed` ms into counting from `from` to `to`: whole numbers, landing exactly on `to`. */
export function countAt(from: number, to: number, elapsed: number): number {
  if (elapsed >= COUNT_MS) return to;
  return Math.round(from + (to - from) * easeOut(elapsed / COUNT_MS));
}

/** "+12" or "−3" for a change worth showing, nothing for no change. */
export function changeText(from: number, to: number): string | undefined {
  const d = to - from;
  if (d === 0) return undefined;
  return d > 0 ? `+${d}` : `−${-d}`;
}

/** Which screen a route is, for its entrance: the same screen on another tab doesn't count as a new one. */
export function screenKey(route: { screen: string; id?: string; locationId?: string }): string {
  return [route.screen, route.id ?? route.locationId ?? ''].join(':');
}
