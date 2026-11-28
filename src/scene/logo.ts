/**
 * The game's mark (3.15.1, when the game became *The Depot*, Aviel 2026-11-28): a rust ring, a roof's
 * gable under its top, and a stencilled D, bone on the depot's steel. The app icon, the splash, the title
 * before the opening and Settings all use it (`tools/brand/make.mjs` draws the icon and splash from it).
 * Zero dependencies.
 */

export const LOGO_COLORS = { steel: '#24332f', rust: '#a64d27', bone: '#efe6d2' } as const;

/** The game's name, and the chapter this is (Chapter 2 comes with the time skip, DESIGN §15). */
export const GAME_NAME = 'The Depot';
export const CHAPTER = { number: 'one', name: 'Haven' } as const;

/** "Chapter one: Haven". */
export function chapterLine(): string {
  return `Chapter ${CHAPTER.number}: ${CHAPTER.name}`;
}

/**
 * The mark on a 1024 square. `font` is the stencil face as the page knows it; `background` fills the
 * square (the icon), or leaves it clear (over the game's own background).
 */
export function logoMarkSvg(opts: { font?: string; background?: boolean; size?: number; label?: string } = {}): string {
  const font = opts.font ?? "'Big Shoulders Stencil Variable', 'Arial Narrow', sans-serif";
  const size = opts.size ? ` width="${opts.size}" height="${opts.size}"` : '';
  const label = opts.label ?? GAME_NAME;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"${size} role="img" aria-label="${label}">` +
    (opts.background ? `<rect width="1024" height="1024" fill="${LOGO_COLORS.steel}"/>` : '') +
    `<circle class="logo-ring" cx="512" cy="512" r="338" fill="none" stroke="${LOGO_COLORS.rust}" stroke-width="40"/>` +
    // The roof runs out to the ring, so the two read as one.
    `<clipPath id="logo-in"><circle cx="512" cy="512" r="326"/></clipPath>` +
    `<path class="logo-roof" clip-path="url(#logo-in)" d="M140 538 L512 300 L884 538" fill="none" stroke="${LOGO_COLORS.rust}" stroke-width="38" stroke-linejoin="miter"/>` +
    `<text class="logo-d" x="512" y="752" text-anchor="middle" font-family="${font.replace(/"/g, "'")}" font-weight="900" font-size="440" fill="${LOGO_COLORS.bone}">D</text>` +
    `</svg>`
  );
}
