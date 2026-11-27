import type { ResourceId } from '../engine/index.ts';

/**
 * Small line pictures for the UI (3.6.0): the supplies, and what a choice does,
 * so a screen can show it instead of explaining it (Aviel: "remove helper text
 * that already exists and replace it with some visual explanation").
 * Each is a path on a 24 x 24 grid, drawn as a 2-unit line in the text's color.
 */
export const GLYPHS = {
  // The supplies.
  scrap: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  rations: 'M6 7v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7 M6 7c0-2.2 12-2.2 12 0 0 2.2-12 2.2-12 0Z M6 12h12',
  meds: 'M5 8a3 3 0 0 1 3-3h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3Z M12 8.5v7 M8.5 12h7',
  ammo: 'M7 21v-9c0-3 1-5 2-6 1 1 2 3 2 6v9Z M13 21v-9c0-3 1-5 2-6 1 1 2 3 2 6v9Z M7 17h4 M13 17h4',
  tech: 'M7 7h10v10H7Z M10 3v4 M14 3v4 M10 17v4 M14 17v4 M3 10h4 M3 14h4 M17 10h4 M17 14h4',
  gas: 'M6 5h9l4 4v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z M9 10l6 7 M15 10l-6 7',
  // What a choice does.
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  swords: 'M4 4l11 11 M20 4 9 15 M13 17l4-4 M11 17l-4-4 M16 16l4 4 M8 16l-4 4',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M12 7v5l3 3',
  slip: 'M8 3c1.7 0 2.5 1.8 2.5 3.8S9.7 11 8 11 5.5 8.8 5.5 6.8 6.3 3 8 3Z M6 14h4 M16 9c1.7 0 2.5 1.8 2.5 3.8S17.7 17 16 17s-2.5-2.2-2.5-4.2S14.3 9 16 9Z M14 20h4',
  crate: 'M3 8l9-5 9 5v8l-9 5-9-5Z M3 8l9 5 9-5 M12 13v8',
  compass: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z M15.5 8.5l-2 5-5 2 2-5Z',
  scales: 'M12 4v15 M7 20h10 M5 7h14 M5 7l-3 6a3 3 0 0 0 6 0Z M19 7l-3 6a3 3 0 0 0 6 0Z',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z',
  hearts: 'M9.5 20s-6-4-6-9a3.5 3.5 0 0 1 6-2.4 3.5 3.5 0 0 1 6 2.4c0 5-6 9-6 9Z M16 5a2.8 2.8 0 0 1 5 1.8c0 2.8-3.5 5.2-3.5 5.2',
  bolt: 'M13 2 4 14h7l-1 8 9-12h-7Z',
  ring: 'M12 10a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z M9 3h6l-3 5Z',
  seat: 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z M5 21a7 7 0 0 1 14 0',
  cargo: 'M4 8h16v12H4Z M4 12h16 M10 8v4h4V8 M7 8l2-4h6l2 4',
  noise: 'M4 10h4l5-4v12l-5-4H4Z M16 9a4 4 0 0 1 0 6 M18.5 6.5a8 8 0 0 1 0 11',
  stress: 'M7 18a4 4 0 0 1-.4-8 5 5 0 0 1 9.6-1.4A3.6 3.6 0 0 1 17 18Z M11 13l-1.5 3h3L11 19',
  dice: 'M5 5h14v14H5Z M9 9h.01 M15 15h.01 M15 9h.01 M9 15h.01 M12 12h.01',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6Z',
  home: 'M3 11l9-7 9 7 M5 10v10h14V10 M10 20v-5h4v5',
  tear: 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11Z',
  hurt: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10Z M12 7.5v12.5',
  down: 'M3 18h18 M5 15h9l3-2 M14 13a2 2 0 1 0 4 0 2 2 0 0 0-4 0Z',
  skull: 'M5 11a7 7 0 0 1 14 0v4h-2v4H7v-4H5Z M9 12h.01 M15 12h.01 M10 19v-2 M14 19v-2',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  pin: 'M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11Z M12 7.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z',
  rise: 'M3 17l6-6 4 4 8-8 M15 7h6v6',
  war: 'M5 21V4 M5 4h12l-3 4 3 4H5',
  wrench: 'M14.5 3.5a5 5 0 0 0-4.6 6.9L3.5 16.8 7.2 20.5l6.4-6.4a5 5 0 0 0 6.9-4.6l-3 3-3.2-.8-.8-3.2Z',
  // Elites (3.12.0): one of a kind, a sweep at a rank, going under water, plates.
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z',
  sweep: 'M20 6C10 6 4 9 4 12s6 6 16 6 M20 18l-4-3 M20 18l-3 3',
  wave: 'M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0 M3 19c2-2 4-2 6 0s4 2 6 0 4-2 6 0 M12 3v8 M9 8l3 3 3-3',
  plates: 'M4 5h7v6H4Z M13 5h7v6h-7Z M4 13h16v6H4Z',
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** A picture and a few words (or a number), for showing what something does. */
export interface Chip {
  glyph: GlyphName;
  text: string;
  /** Good for the guild, or bad. */
  tone?: 'good' | 'bad';
  /** Read out instead of the short text. */
  label?: string;
}

const SUPPLY_NAMES: Record<ResourceId, string> = { scrap: 'scrap', rations: 'rations', meds: 'meds', ammo: 'ammo', tech: 'tech', gas: 'gas' };

/**
 * Supplies as pictures and numbers, in the header's order: a cost, a haul, a trade.
 * With what the guild has, any it's short of is marked; `sign` puts a + or − in front.
 */
export function supplyChips(amounts: Partial<Record<ResourceId, number>>, opts: { have?: Partial<Record<ResourceId, number>>; sign?: boolean; tone?: 'good' | 'bad' } = {}): Chip[] {
  const out: Chip[] = [];
  for (const id of SUPPLY_ORDER) {
    const n = amounts[id];
    if (!n) continue;
    const short = opts.have !== undefined && (opts.have[id] ?? 0) < n;
    const text = opts.sign ? `${n > 0 ? '+' : '−'}${Math.abs(n)}` : String(n);
    const tone = short ? 'bad' : opts.tone ?? (opts.sign ? (n > 0 ? 'good' : 'bad') : undefined);
    out.push({ glyph: id, text, ...(tone ? { tone } : {}), label: `${opts.sign && n > 0 ? 'plus ' : opts.sign ? 'minus ' : ''}${Math.abs(n)} ${SUPPLY_NAMES[id]}${short ? `, only ${opts.have![id] ?? 0} at the Depot` : ''}` });
  }
  return out;
}

const SUPPLY_ORDER: readonly ResourceId[] = ['scrap', 'rations', 'meds', 'ammo', 'tech', 'gas'];

/** A problem worth saying in words: being short of something is already marked on the cost (3.6.0). */
export function problemNote(problem: string | undefined): string | undefined {
  return problem === undefined || /^Needs \d/.test(problem) || /^Not enough /.test(problem) ? undefined : problem;
}

/**
 * Where a tag's meaning shows when it's tapped (3.7.1; Aviel: "symbols are not clear, like what does the
 * dice symbol mean?"): above the tag, or under it near the top of the screen; centred on it, but kept
 * inside the screen.
 */
export function tipPlacement(tag: { left: number; top: number; width: number; height: number }, screen: { width: number; height: number }, tipWidth: number): { left: number; top: number; below: boolean } {
  const margin = 8;
  const below = tag.top < 72;
  const left = Math.max(margin, Math.min(screen.width - tipWidth - margin, tag.left + tag.width / 2 - tipWidth / 2));
  return { left: Math.round(left), top: Math.round(below ? tag.top + tag.height + 6 : tag.top - 6), below };
}
