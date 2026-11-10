/** Wall-clock times in the player's own format: "21:14" or "9:14 PM". */
const CLOCK = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });

export function clockTime(epochMs: number): string {
  return CLOCK.format(epochMs);
}
