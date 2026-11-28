/**
 * The opening scene's own shots (§9.10, 3.14.0): the rail line at dusk, the smoke of the camp they lost
 * standing in the sky behind them, and the founders walking. Drawn like the yard (400 x 600, the yard's
 * walking figures and their step), so the shots that follow in the yard itself match. Everything moves:
 * the smoke rises, the sun sinks, the founders walk, and up close the ground slides past.
 */
import { walker } from './figures.ts';
import { H, W } from './layout.ts';
import type { FigureLook } from './model.ts';

/** How long each shot's motion runs, seconds: the scene shows it about that long. */
export const RAIL_SECONDS = { far: 7, near: 6 } as const;

const HORIZON = 352;

function sky(): string {
  return (
    `<defs><linearGradient id="op-sky" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#231c33"/><stop offset="0.45" stop-color="#5a3248"/><stop offset="0.78" stop-color="#b0573f"/><stop offset="1" stop-color="#e89a52"/></linearGradient>` +
    `<linearGradient id="op-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3326"/><stop offset="1" stop-color="#1d1b16"/></linearGradient>` +
    `<radialGradient id="op-glow"><stop offset="0" stop-color="#ffb35c" stop-opacity="0.9"/><stop offset="1" stop-color="#ff7a2e" stop-opacity="0"/></radialGradient>` +
    `<filter id="op-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter></defs>` +
    `<rect width="${W}" height="${HORIZON + 2}" fill="url(#op-sky)"/>`
  );
}

/** The sun going down behind the hills while you watch. */
function sun(): string {
  const y = HORIZON - 58;
  return `<g class="op-sun"><circle cx="300" cy="${y}" r="80" fill="url(#op-glow)" opacity="0.6"/><circle cx="300" cy="${y}" r="22" fill="#f6c06a"/></g>`;
}

function hills(): string {
  return (
    `<path d="M0 ${HORIZON - 30} Q 60 ${HORIZON - 62} 120 ${HORIZON - 34} T 250 ${HORIZON - 40} T 400 ${HORIZON - 52} V ${HORIZON + 2} H 0 Z" fill="#3a2c3d"/>` +
    `<path d="M0 ${HORIZON - 8} Q 90 ${HORIZON - 30} 180 ${HORIZON - 12} T 400 ${HORIZON - 18} V ${HORIZON + 2} H 0 Z" fill="#2c2430"/>`
  );
}

/** The camp they lost, far off to the left: a glow on the horizon and smoke rolling up out of it. */
function smoke(x: number, scale: number): string {
  let puffs = '';
  for (let i = 0; i < 16; i++) {
    const r = (11 + (i % 4) * 4) * scale;
    puffs += `<circle class="op-puff" cx="${x + ((i * 7) % 13) - 6}" cy="${HORIZON - 14}" r="${r.toFixed(1)}" fill="${i % 2 ? '#463c44' : '#5a4f55'}" style="animation-delay:-${(i * 0.48).toFixed(2)}s"/>`;
  }
  return `<ellipse class="op-ember" cx="${x}" cy="${HORIZON - 4}" rx="${34 * scale}" ry="${10 * scale}" fill="url(#op-glow)"/><g filter="url(#op-soft)">${puffs}</g>`;
}

/** Rails across the frame, side on, and their sleepers; up close the sleepers slide past. */
function rails(y: number, scale: number, sliding: boolean): string {
  const gap = 14 * scale;
  let ties = '';
  for (let x = -gap * 2; x < W + gap * 2; x += gap) ties += `<rect x="${x.toFixed(1)}" y="${(y - 2 * scale).toFixed(1)}" width="${(5 * scale).toFixed(1)}" height="${(7 * scale).toFixed(1)}" fill="#4b3a2a"/>`;
  const rail = (dy: number): string => `<rect x="0" y="${(y + dy * scale).toFixed(1)}" width="${W}" height="${(1.6 * scale).toFixed(1)}" fill="#8b8172"/>`;
  return `<g${sliding ? ` class="op-slide" style="--gap:${gap.toFixed(1)}px"` : ''}>${ties}</g>${rail(-1)}${rail(3)}`;
}

/** Tufts of dead grass in front, passing faster than the rails up close. */
function tufts(y: number, sliding: boolean): string {
  let out = '';
  for (let i = 0; i < 12; i++) {
    const x = i * 46 + ((i * 17) % 23);
    out += `<path d="M${x} ${y} l4 -22 l3 22 l4 -16 l3 16 l4 -12 l2 12 Z" fill="#4d4632"/>`;
  }
  return `<g${sliding ? ' class="op-slide op-slide-fast" style="--gap:46px"' : ''}>${out}</g>`;
}

/**
 * The rail line at dusk. `far`: the founders small, crossing the whole frame, the smoke big behind them.
 * `near`: up close, packs on their backs, the ground sliding past while they hold the middle.
 */
export function railLineSvg(looks: readonly FigureLook[], shot: 'far' | 'near'): string {
  const far = shot === 'far';
  const scale = far ? 1.9 : 4.2;
  const ground = far ? 452 : 470;
  const seconds = RAIL_SECONDS[shot];
  let people = '';
  looks.forEach((look, i) => {
    const gait = { step: 0.5 + (i % 3) * 0.04, phase: i * 0.21 };
    const spacing = far ? 26 : 74;
    const x0 = far ? -40 - i * spacing : 250 - i * spacing;
    const body = walker(look, gait, 'big', true);
    people += `<g class="op-walk op-walk-${shot}" style="--x0:${x0}px;--sec:${seconds}s"><g transform="translate(0 ${ground}) scale(${scale})">${body}</g></g>`;
  });
  const extra = far ? '' : tufts(H - 40, true);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="yard opening-shot op-${shot}" role="img" aria-label="${far ? 'The rail line at dusk, smoke behind' : 'The founders walking, packs on their backs'}">` +
    sky() +
    sun() +
    smoke(far ? 64 : 36, far ? 1.6 : 1.1) +
    hills() +
    `<rect y="${HORIZON}" width="${W}" height="${H - HORIZON}" fill="url(#op-ground)"/>` +
    rails(ground + (far ? 1 : 2), far ? 1.2 : 2.6, !far) +
    people +
    extra +
    `<rect width="${W}" height="${H}" fill="#140c18" opacity="0.12" pointer-events="none"/>` +
    `</svg>`
  );
}
