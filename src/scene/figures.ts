/**
 * Small people for the yard, about 26 units tall, in the colors of their
 * portraits. Drawn with the feet at (0, 0); `figure` moves them into place.
 */
import { C, INK, circle, darken, hash, ink, line, pathEl, rect } from './draw.ts';
import type { Pose, Spot } from './layout.ts';
import type { FigureLook } from './model.ts';

const ARMOR_COLORS: Record<string, string> = {
  leather_jacket: '#6b4a32',
  scrap_vest: '#7d8382',
  riot_gear: '#3f4a52',
  hazmat_suit: '#c9a83e',
};

const FINE = ink(0.9);

function head(look: FigureLook, cx: number, cy: number, facing: number): string {
  const r = 4.3;
  let out = '';
  // Long hair falls behind the shoulders.
  if (look.longHair && !look.bald) out += rect(cx - 5, cy - 1, 10, 8, look.hair, FINE);
  out += circle(cx, cy, r, look.skin, FINE);
  // Eyes look the way the figure faces.
  const ex = facing * 0.7;
  out += circle(cx - 1.5 + ex, cy + 0.2, 0.5, INK, 'stroke="none"') + circle(cx + 1.5 + ex, cy + 0.2, 0.5, INK, 'stroke="none"');
  if (!look.bald && look.hat !== 'beanie') {
    out += pathEl(`M ${cx - r} ${cy - 0.5} A ${r} ${r} 0 0 1 ${cx + r} ${cy - 0.5} Q ${cx + facing} ${cy - 2.6} ${cx - r} ${cy - 0.5} Z`, look.hair, FINE);
  }
  if (look.hat === 'beanie') out += pathEl(`M ${cx - r - 0.3} ${cy - 0.8} A ${r + 0.3} ${r + 0.6} 0 0 1 ${cx + r + 0.3} ${cy - 0.8} Z`, look.accent, FINE);
  if (look.hat === 'bandana') out += rect(cx - r, cy - 2.4, r * 2, 1.6, look.accent, FINE);
  if (look.hat === 'goggles') out += circle(cx - 1.6, cy - 2.2, 1.1, '#9fb7b0', FINE) + circle(cx + 1.6, cy - 2.2, 1.1, '#9fb7b0', FINE);
  if (look.hurt) out += rect(cx - r, cy - 1.6, r * 2, 1.4, '#efe8da', FINE);
  return out;
}

function torso(look: FigureLook, x: number, y: number, h: number): string {
  let out = rect(x - 5, y, 10, h, look.cloth, FINE);
  if (look.armor) out += rect(x - 4.2, y + 0.8, 8.4, h - 2.5, ARMOR_COLORS[look.armor] ?? darken(look.cloth, 0.3), FINE);
  return out;
}

/** What someone at a post is doing with their hands (3.2.0), as a class that moves the front arm. */
export type Work = 'hoe' | 'hammer' | 'poke' | 'spar' | 'tend' | 'watch';

/** A tool in the front hand, hanging from it: drawn with the arm so it swings with it. */
function tool(work: Work | undefined, hx: number, hy: number, facing: number): string {
  if (work === 'hammer') return line(hx, hy, hx + 4.5 * facing, hy + 1.5, 1, C.woodDark) + rect(hx + 3.2 * facing - 1.2, hy + 0.2, 2.4, 3, '#7d8382', FINE);
  if (work === 'poke') return line(hx, hy, hx + 7 * facing, hy + 5, 1, C.woodDark);
  return '';
}

function arms(look: FigureLook, x: number, y: number, reach: number, facing: number, work?: Work, swing?: boolean): string {
  // Reach > 0 swings the front arm forward (working, gesturing).
  const back = rect(x - 6.6, y + 0.5, 2.2, 8, look.cloth, FINE) + circle(x - 5.5, y + 9, 1.2, look.skin, FINE);
  const fx = x + 4.4 + facing * reach;
  let front = rect(fx, y + 0.5, 2.2, 8 - reach, look.cloth, FINE) + circle(fx + 1.1, y + 9 - reach, 1.2, look.skin, FINE) + tool(work, fx + 1.1, y + 9 - reach, facing);
  let backArm = back;
  // Arms that move turn about the shoulder: the top middle of their own box.
  if (work === 'hammer' || work === 'poke' || work === 'tend') front = `<g class="yard-arm yard-${work}" style="--f:${facing}">${front}</g>`;
  if (swing) {
    front = `<g class="yard-swing" style="--f:${facing}">${front}</g>`;
    backArm = `<g class="yard-swing yard-swing-b" style="--f:${facing}">${back}</g>`;
  }
  return facing > 0 ? backArm + front : front + backArm;
}

function standing(look: FigureLook, facing: number, work?: Work): string {
  return (
    rect(-3.6, -10, 3, 9, C.trousers, FINE) +
    rect(0.6, -10, 3, 9, C.trousers, FINE) +
    rect(-4, -1.6, 3.6, 1.8, C.boots, FINE) +
    rect(0.4, -1.6, 3.6, 1.8, C.boots, FINE) +
    torso(look, 0, -20, 11) +
    arms(look, 0, -20, work === 'tend' ? 1.5 : 0, facing, work) +
    head(look, 0, -24.5, facing)
  );
}

/** Walking (3.2.0): legs and arms swing, each leg from the hip. */
function walking(look: FigureLook, facing: number): string {
  const leg = (x: number, b: boolean): string => `<g class="yard-step${b ? ' yard-step-b' : ''}">${rect(x, -10, 3, 9, C.trousers, FINE)}${rect(x - 0.4, -1.6, 3.6, 1.8, C.boots, FINE)}</g>`;
  return leg(-3.2, false) + leg(0.2, true) + torso(look, 0, -20, 11) + arms(look, 0, -20, 0, facing, undefined, true) + head(look, 0, -24.5, facing);
}

function sitting(look: FigureLook, facing: number): string {
  const f = facing;
  // Thighs forward along the seat, shins down to the ground.
  const thighs = pathEl(`M -3 -7 L ${6 * f} -7 L ${6 * f} -4 L -3 -4 Z`, C.trousers, FINE);
  const shins = rect(f > 0 ? 3.5 : -6.5, -6, 3, 6, C.trousers, FINE);
  return thighs + shins + torso(look, 0, -17, 10.5) + arms(look, 0, -17, 1.5, f) + head(look, 0, -21.5, f);
}

/** Working the soil with a hoe; at a post, the hoe rises and chops (3.2.0). */
function kneeling(look: FigureLook, facing: number, work?: Work): string {
  const f = facing;
  const hoe = line(5 * f, -11, 13 * f, -1, 1.1, C.woodDark) + rect(f > 0 ? 11.5 : -15, -1.5, 3.5, 1.8, '#7d8382', FINE);
  const upper = torso(look, 0.6 * f, -20, 11) + arms(look, 0.6 * f, -20, 3, f) + hoe + head(look, 1.4 * f, -24.2, f);
  return (
    rect(-3.6, -10, 3, 9, C.trousers, FINE) +
    rect(0.6, -10, 3, 9, C.trousers, FINE) +
    rect(-4, -1.6, 3.6, 1.8, C.boots, FINE) +
    rect(0.4, -1.6, 3.6, 1.8, C.boots, FINE) +
    (work === 'hoe' ? `<g class="yard-chop" style="--f:${f}">${upper}</g>` : upper)
  );
}

function lying(look: FigureLook, facing: number): string {
  const f = facing;
  // A cot, then the figure along it under a blanket, head at the far end.
  const cot = rect(-13, -6, 26, 3, '#b7ad97', FINE) + rect(-12, -3, 1.5, 3, C.woodDark, FINE) + rect(10.5, -3, 1.5, 3, C.woodDark, FINE);
  const blanket = pathEl(`M ${-6 * f} -6 L ${12 * f} -6 L ${12 * f} -9 Q ${3 * f} -11.5 ${-6 * f} -9.5 Z`, look.accent, FINE);
  return cot + blanket + head(look, -9.5 * f, -9.5, -f);
}

const POSES: Record<Pose, (look: FigureLook, facing: number, work?: Work) => string> = {
  stand: standing,
  sit: sitting,
  kneel: kneeling,
  lie: lying,
};

/** The scale a figure is drawn at. */
export function figureScale(look: FigureLook): number {
  return +(1.12 * (look.size ?? 1)).toFixed(3);
}

/**
 * A person at a spot, with an idle bob that starts at a different moment for
 * everyone, and what they're doing at their post (3.2.0): a sparring partner
 * lunges, a lookout turns to look the other way.
 */
export function figure(look: FigureLook, spot: Spot, seedKey: string, work?: Work): string {
  const delay = (hash(seedKey) % 2000) / 1000;
  const anim = spot.pose === 'lie' ? 'yard-breathe' : 'yard-bob';
  let body = POSES[spot.pose](look, spot.facing, work);
  if (work === 'spar' || work === 'watch') body = `<g class="yard-${work}" style="animation-delay:-${delay * 2}s;--f:${spot.facing}">${body}</g>`;
  return (
    `<g transform="translate(${spot.x} ${spot.y}) scale(${figureScale(look)})">` +
    `<g class="${anim}" style="animation-delay:-${delay}s">${body}</g>` +
    '</g>'
  );
}

/** Someone on the move (3.2.0), drawn at the origin facing right: the walk is placed and turned by whoever draws it. */
export function walker(look: FigureLook): string {
  return walking(look, 1);
}

/** The trader: a generic figure in a long coat and a wide hat. */
export function trader(x: number, y: number): string {
  const look: FigureLook = { skin: '#c08e66', skinShade: '#a2734d', hair: '#4a3527', hairDark: '#33231a', longHair: false, bald: false, cloth: '#7d6c4f', accent: '#a8603f', hurt: false };
  const hat = pathEl('M -7 -27.5 L 7 -27.5 L 4 -29 L 3 -32 L -3 -32 L -4 -29 Z', '#5b3d2a', FINE);
  const coat = pathEl('M -5.5 -20 L 5.5 -20 L 7 -4 L -7 -4 Z', '#6c5a44', FINE);
  return `<g transform="translate(${x} ${y})"><g class="yard-bob">${standing(look, -1)}${coat}${hat}</g></g>`;
}
