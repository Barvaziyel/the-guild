/**
 * The game's mark (3.15.1, when the game became *The Depot*, Aviel 2026-11-28; the plate, the third of six he
 * was shown): a stencilled D on a riveted rust plate, like the number plate on a freight car, bone on the
 * depot's steel. The app icon, the splash, the title before the opening and Settings all use it
 * (`tools/brand/make.mjs` draws the icon and splash from it). Zero dependencies.
 */

export const LOGO_COLORS = { steel: '#24332f', rust: '#a64d27', bone: '#efe6d2', edge: '#7d3519', rivet: '#c98a62', rivetEdge: '#5c2810' } as const;

/** The game's name, and the chapter this is (Chapter 2 comes with the time skip, DESIGN §15). */
export const GAME_NAME = 'The Depot';
export const CHAPTER = { number: 'one', name: 'Haven' } as const;

/** "Chapter one: Haven". */
export function chapterLine(): string {
  return `Chapter ${CHAPTER.number}: ${CHAPTER.name}`;
}

/** Where the plate's rivets are, one in each corner. */
export const RIVETS: readonly (readonly [number, number])[] = [
  [262, 262],
  [762, 262],
  [262, 762],
  [762, 762],
];

/**
 * The mark on a 1024 square. `font` is the stencil face as the page knows it; `background` fills the
 * square with the depot's steel (the icon), or leaves it clear (over the game's own background).
 */
export function logoMarkSvg(opts: { font?: string; background?: boolean; size?: number; label?: string } = {}): string {
  const font = opts.font ?? "'Big Shoulders Stencil Variable', 'Arial Narrow', sans-serif";
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const label = opts.label ?? GAME_NAME;
  const c = LOGO_COLORS;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"${size} role="img" aria-label="${label}">` +
    (opts.background ? `<rect width="1024" height="1024" fill="${c.steel}"/>` : '') +
    `<g class="logo-plate"><rect x="188" y="188" width="648" height="648" rx="64" fill="${c.rust}"/>` +
    `<rect x="226" y="226" width="572" height="572" rx="40" fill="none" stroke="${c.edge}" stroke-width="12"/></g>` +
    RIVETS.map(([x, y], i) => `<circle class="logo-rivet" style="--i:${i}" cx="${x}" cy="${y}" r="20" fill="${c.rivet}" stroke="${c.rivetEdge}" stroke-width="5"/>`).join('') +
    `<text class="logo-d" x="512" y="712" text-anchor="middle" font-family="${font.replace(/"/g, "'")}" font-weight="900" font-size="500" fill="${c.bone}">D</text>` +
    `</svg>`
  );
}
