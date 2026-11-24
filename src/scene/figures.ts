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

/** What someone on the road carries on their back (3.7.0): a small pack for a short run, a big one with a bedroll for a long one. */
export type Pack = 'day' | 'big';

/**
 * Walking, side-on (3.7.0; Aviel: "walking is still weird"). Seen from the side, as they move: both
 * legs from the same hip, the far one darker, swinging against each other; the near arm swinging
 * against the near leg and the far arm behind the body; the head in profile, looking where they go.
 * Facing right; whoever draws them turns them.
 */
function walking(look: FigureLook, pack?: Pack, full?: boolean): string {
  const farTrousers = darken(C.trousers, 0.25);
  const leg = (far: boolean): string =>
    `<g class="yard-step${far ? ' yard-step-b' : ''}">${rect(-1.6, -10, 3.2, 9, far ? farTrousers : C.trousers, FINE)}${rect(-1.8, -1.6, 4.4, 1.8, far ? darken(C.boots, 0.25) : C.boots, FINE)}</g>`;
  const arm = (far: boolean): string =>
    `<g class="yard-pump${far ? ' yard-pump-b' : ''}">${rect(-1.1, -19.5, 2.2, 8, far ? darken(look.cloth, 0.25) : look.cloth, FINE)}${circle(0, -11, 1.2, far ? darken(look.skin, 0.15) : look.skin, FINE)}</g>`;
  let body = rect(-3.6, -20, 7.2, 11, look.cloth, FINE);
  if (look.armor) body += rect(-3, -19.2, 6, 8.5, ARMOR_COLORS[look.armor] ?? darken(look.cloth, 0.3), FINE);
  return arm(true) + leg(true) + (pack ? backpack(pack, full === true) : '') + leg(false) + body + profileHead(look, 0.4, -24.5) + arm(false);
}

/** A pack on the back (facing right, so it hangs on the left), with its strap over the shoulder. */
function backpack(pack: Pack, full: boolean): string {
  const canvas = '#7a6a4c';
  const w = pack === 'big' ? 5.2 : 3.8;
  const h = pack === 'big' ? 10 : 6.5;
  const bulge = full ? 0.8 : 0;
  const x = -3.6 - w + 0.6 - bulge;
  const top = pack === 'big' ? -21.5 : -19.5;
  let out = rect(x, top, w + bulge, h, canvas, FINE) + rect(x + 0.6, top + h * 0.55, w + bulge - 1.2, 1.4, darken(canvas, 0.25), FINE);
  if (pack === 'big') out += `<rect x="${(x - 0.4).toFixed(1)}" y="${(top - 2.4).toFixed(1)}" width="${(w + bulge + 0.8).toFixed(1)}" height="2.6" rx="1.3" fill="#8f7d62" ${FINE}/>`;
  return out + line(-3.2, -19.6, 0.6, -14.5, 0.9, darken(canvas, 0.35));
}

/**
 * Someone riding (3.7.2), facing right with the hip at 0, 0: sitting on a motorcycle's seat, leaning
 * into it, hands on the bars ahead, a knee bent down to the peg. A passenger holds on instead.
 */
export function rider(look: FigureLook, passenger = false): string {
  const reach = passenger ? 5 : 9;
  return (
    rect(-1.5, -1.6, 7.5, 3.2, C.trousers, FINE) +
    rect(4.6, -1, 2.8, 7, C.trousers, FINE) +
    rect(4.2, 5, 4.6, 1.8, C.boots, FINE) +
    `<g transform="rotate(12)">${rect(-3.4, -11, 6.8, 10.5, look.cloth, FINE)}${look.armor ? rect(-2.8, -10.2, 5.6, 8, ARMOR_COLORS[look.armor] ?? darken(look.cloth, 0.3), FINE) : ''}</g>` +
    profileHead(look, 2.4, -15) +
    line(1.6, -9, 1.6 + reach, -6.5, 2.2, look.cloth) +
    circle(1.6 + reach, -6.5, 1.2, look.skin, FINE)
  );
}

/** A head and shoulders seen through a window (3.7.2), facing right, small enough for one: 8 tall, from y = -5.5 to 2.5. */
export function inWindow(look: FigureLook): string {
  return `<g transform="scale(0.62)">${rect(-3.4, -1, 6.8, 5, look.cloth, FINE)}${profileHead(look, 0.4, -4.6)}</g>`;
}

/** A head seen from the side: one eye ahead, the hair swept back. */
function profileHead(look: FigureLook, cx: number, cy: number): string {
  const r = 4.3;
  let out = '';
  if (look.longHair && !look.bald) out += rect(cx - 5, cy - 1, 6, 8, look.hair, FINE);
  out += circle(cx, cy, r, look.skin, FINE);
  out += circle(cx + 2.2, cy + 0.1, 0.55, INK, 'stroke="none"');
  if (!look.bald && look.hat !== 'beanie') out += pathEl(`M ${cx + r * 0.7} ${cy - 2.6} A ${r} ${r} 0 0 0 ${cx - r} ${cy + 0.6} L ${cx - r + 0.4} ${cy + 1.8} Q ${cx - 1} ${cy - 1.2} ${cx + r * 0.7} ${cy - 2.6} Z`, look.hair, FINE);
  if (look.hat === 'beanie') out += pathEl(`M ${cx - r - 0.3} ${cy - 0.8} A ${r + 0.3} ${r + 0.6} 0 0 1 ${cx + r + 0.3} ${cy - 0.8} Z`, look.accent, FINE);
  if (look.hat === 'bandana') out += rect(cx - r, cy - 2.4, r * 2, 1.6, look.accent, FINE);
  if (look.hat === 'goggles') out += circle(cx + 2, cy - 2.2, 1.1, '#9fb7b0', FINE);
  if (look.hurt) out += rect(cx - r, cy - 1.6, r * 2, 1.4, '#efe8da', FINE);
  return out;
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
/**
 * Someone walking, facing right. `gait` sets how long a step takes and where in it they start, so the
 * feet keep up with the pace and nobody marches in step with anyone else (3.4.1); the body rises a
 * little with each step.
 */
export function walker(look: FigureLook, gait?: { step: number; phase: number }, pack?: Pack, full?: boolean): string {
  const style = gait ? ` style="--sd:${gait.step}s;--ph:${-gait.phase}s"` : '';
  return `<g class="yard-gait"${style}><g class="yard-walkbob">${walking(look, pack, full)}</g></g>`;
}

/** The trader: a generic figure in a long coat and a wide hat. */
export function trader(x: number, y: number): string {
  const look: FigureLook = { skin: '#c08e66', skinShade: '#a2734d', hair: '#4a3527', hairDark: '#33231a', longHair: false, bald: false, cloth: '#7d6c4f', accent: '#a8603f', hurt: false };
  const hat = pathEl('M -7 -27.5 L 7 -27.5 L 4 -29 L 3 -32 L -3 -32 L -4 -29 Z', '#5b3d2a', FINE);
  const coat = pathEl('M -5.5 -20 L 5.5 -20 L 7 -4 L -7 -4 Z', '#6c5a44', FINE);
  return `<g transform="translate(${x} ${y})"><g class="yard-bob">${standing(look, -1)}${coat}${hat}</g></g>`;
}
