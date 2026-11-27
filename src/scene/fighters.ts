/**
 * The people and things in a fight (§7.13), drawn for the battle stage: the
 * crew in their portrait colors with what they carry, and every kind of enemy.
 * Everything is drawn facing right with the feet at (0, 0), about 62 units
 * tall; `fighterSvg` turns enemies around.
 */
import { WEAPON_LOOKS, type WeaponLook } from '../portrait/outfit.ts';
import { C, INK, circle, darken, ellipse, hash, line, mix, pathEl, poly, rect } from './draw.ts';
import type { FigureLook } from './model.ts';

const W = 1.6;
const STROKE = `stroke="${INK}" stroke-width="${W}" stroke-linejoin="round" stroke-linecap="round"`;
const THIN = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
const NONE = 'stroke="none"';
const STEEL = '#8d9494';
const STEEL_DARK = '#5f6767';
const WOOD = '#8a6844';

/** A limb: a thick line in its color with an ink edge. */
function limb(x1: number, y1: number, x2: number, y2: number, color: string, w = 5.4): string {
  return line(x1, y1, x2, y2, w + W * 2, INK) + line(x1, y1, x2, y2, w, color);
}

/** What a person holds, drawn from the hands. */
type Held = WeaponLook | 'maul' | 'spiked_bat' | 'claws' | 'saw' | 'hook' | 'bottle' | 'cleaver' | 'none';

/** How a person-shaped fighter is drawn. */
export interface Body {
  skin: string;
  hair: string;
  longHair: boolean;
  bald: boolean;
  cloth: string;
  accent: string;
  trousers: string;
  boots: string;
  /** A vest, plates or a suit over the clothes. */
  armor?: { kind: 'vest' | 'riot' | 'hazmat' | 'leather' | 'signs' | 'apron' | 'medic' | 'bandolier'; color: string };
  hat?: 'beanie' | 'bandana' | 'goggles' | 'helmet' | 'hood' | 'mask' | 'mohawk' | 'cap' | 'nurse';
  /** The Vultures' crest: this many long black feathers fanned up and back from the head; `tips` gives some of them bone-white ends. */
  crest?: { n: number; tips: boolean };
  /** A shaggy ruff of feathers around the neck and over the shoulders (the Vultures'). */
  ruff?: string;
  /** A band of paint across the eyes (the Vultures' red). */
  paint?: string;
  held: Held;
  /** Width: 1 for most, more for brutes. */
  build: number;
  /** How far the upper body leans forward, in degrees: the hollows' stoop. */
  stoop: number;
  eyes: 'plain' | 'hollow' | 'glow';
  /** Bandaged: hurt before the fight. */
  hurt: boolean;
  /** A green glow around them: the irradiated. */
  glow: boolean;
  /** The front hand in another color than the skin (the Red Hand's, 3.12.0). */
  hand?: string;
  /** More drawn over the upper body, after the head, leaning with it (an elite's own things, 3.12.0). */
  extra?: string;
}

/** How a long gun, pistol or blade is held: where the hands go. */
function hands(held: Held): { back: [number, number]; front: [number, number] } {
  switch (held) {
    case 'rifle':
    case 'shotgun':
    case 'crossbow':
      return { back: [4, -35], front: [15, -38] };
    case 'holster':
      return { back: [-3, -31], front: [17, -43] };
    case 'claws':
      return { back: [10, -30], front: [20, -33] };
    case 'none':
      return { back: [8, -42], front: [14, -45] };
    case 'bottle':
      // Raised to throw (3.8.0).
      return { back: [-2, -32], front: [8, -53] };
    default:
      return { back: [-2, -32], front: [10, -40] };
  }
}

function weapon(held: Held, front: [number, number], back: [number, number]): string {
  const [fx, fy] = front;
  switch (held) {
    case 'rifle':
      return (
        poly([[back[0] - 7, back[1] + 1], [back[0] + 2, back[1] - 3], [back[0] + 3, back[1] + 1], [back[0] - 6, back[1] + 5]], WOOD, THIN) +
        rect(back[0] + 1, back[1] - 4, 30, 3, STEEL_DARK, THIN) +
        rect(back[0] + 6, back[1] - 1.5, 8, 3, WOOD, THIN)
      );
    case 'shotgun':
      return (
        poly([[back[0] - 6, back[1] + 1], [back[0] + 2, back[1] - 3], [back[0] + 3, back[1] + 1], [back[0] - 5, back[1] + 5]], WOOD, THIN) +
        rect(back[0] + 1, back[1] - 5, 22, 4.4, STEEL_DARK, THIN) +
        rect(back[0] + 9, back[1] - 1, 7, 3, WOOD, THIN)
      );
    case 'crossbow':
      return (
        rect(back[0] - 4, back[1] - 3, 24, 3, WOOD, THIN) +
        pathEl(`M ${back[0] + 18} ${back[1] - 14} Q ${back[0] + 25} ${back[1] - 2} ${back[0] + 18} ${back[1] + 10}`, 'none', `stroke="${INK}" stroke-width="2.4"`) +
        line(back[0] + 18, back[1] - 14, back[0] + 10, back[1] - 1.5, 0.8, '#3a302a') +
        line(back[0] + 18, back[1] + 10, back[0] + 10, back[1] - 1.5, 0.8, '#3a302a')
      );
    case 'holster':
      return rect(fx - 1, fy - 3.6, 9, 3.6, STEEL_DARK, THIN) + rect(fx - 1, fy - 1, 3, 4, '#4a3a2c', THIN);
    case 'pipe':
      return limb(fx - 2, fy + 4, fx + 7, fy - 22, '#7d8382', 2.6);
    case 'blade':
      return limb(fx - 1, fy + 3, fx + 1, fy - 2, '#3a302a', 2.6) + poly([[fx, fy - 2], [fx + 3, fy - 2], [fx + 11, fy - 21], [fx + 6, fy - 21]], '#c7c9c2', THIN);
    case 'sledge':
    case 'maul':
      return limb(fx - 6, fy + 10, fx + 6, fy - 24, WOOD, 2.6) + rect(fx + 1, fy - 31, 11, 8, held === 'maul' ? '#6b7272' : STEEL_DARK, STROKE);
    case 'spiked_bat': {
      let out = limb(fx - 3, fy + 6, fx + 8, fy - 24, '#9b7a52', 4);
      for (const k of [0, 1, 2]) out += line(fx + 4 + k * 1.6, fy - 14 - k * 4, fx + 8 + k * 1.6, fy - 15 - k * 4, 1.2, '#c7c9c2');
      return out;
    }
    case 'baton':
      return limb(fx - 1, fy + 3, fx + 5, fy - 15, '#2f3437', 2.6) + circle(fx + 5.5, fy - 16, 1.6, '#8fd0e8', THIN);
    case 'claws':
      return line(fx + 1, fy, fx + 6, fy + 2, 1, INK) + line(fx + 1, fy + 1, fx + 5, fy + 4, 1, INK);
    case 'saw': {
      // A bone saw: a short handle and a wide toothed blade.
      let teeth = `M ${fx - 1} ${fy - 2}`;
      for (let k = 1; k <= 6; k++) teeth += ` L ${fx - 1 + k * 1.5 - 0.9} ${fy - 2 - k * 3 + 1.2} L ${fx - 1 + k * 1.5} ${fy - 2 - k * 3}`;
      return limb(fx - 1, fy + 3, fx + 1, fy - 2, '#3a302a', 2.6) + poly([[fx - 1, fy - 2], [fx + 5, fy - 3], [fx + 13, fy - 19], [fx + 8, fy - 20]], '#c7c9c2', THIN) + pathEl(teeth, 'none', `stroke="${INK}" stroke-width="0.8"`);
    }
    case 'hook':
      // A meat hook on a wooden grip.
      return (
        limb(fx - 1, fy + 3, fx + 1, fy - 4, WOOD, 2.6) +
        pathEl(`M ${fx + 1} ${fy - 4} L ${fx + 3} ${fy - 16} Q ${fx + 4} ${fy - 24} ${fx + 10} ${fy - 22} Q ${fx + 14} ${fy - 20} ${fx + 12} ${fy - 15}`, 'none', `stroke="${INK}" stroke-width="4" stroke-linecap="round"`) +
        pathEl(`M ${fx + 1} ${fy - 4} L ${fx + 3} ${fy - 16} Q ${fx + 4} ${fy - 24} ${fx + 10} ${fy - 22} Q ${fx + 14} ${fy - 20} ${fx + 12} ${fy - 15}`, 'none', `stroke="${STEEL}" stroke-width="1.8" stroke-linecap="round"`)
      );
    case 'cleaver':
      // The Butcher's (3.12.0): a broad blade with a hook on the back of it.
      return (
        limb(fx - 1, fy + 3, fx + 1, fy - 3, '#3a302a', 2.6) +
        poly([[fx - 1, fy - 3], [fx + 9, fy - 5], [fx + 11, fy - 18], [fx + 1, fy - 16]], '#c7c9c2', THIN) +
        pathEl(`M ${fx + 1} ${fy - 16} Q ${fx - 4} ${fy - 19} ${fx - 1} ${fy - 23}`, 'none', `stroke="${INK}" stroke-width="1.8" stroke-linecap="round"`)
      );
    case 'bottle':
      // A firebomb (3.8.0): a bottle with a burning rag.
      return (
        rect(fx - 2.2, fy - 9, 4.4, 9, '#5f7a52', THIN) +
        rect(fx - 1, fy - 12, 2, 3.2, '#5f7a52', THIN) +
        pathEl(`M ${fx} ${fy - 21} C ${fx + 4} ${fy - 16} ${fx + 3} ${fy - 12} ${fx} ${fy - 12} C ${fx - 3} ${fy - 12} ${fx - 3} ${fy - 16} ${fx} ${fy - 21} Z`, '#f0a060', 'stroke="#b5432f" stroke-width="0.9"')
      );
    case 'none':
      return '';
  }
}

/** A feather from (x0, y0) to its tip at (x1, y1), `w` wide: a leaf with its quill, and maybe a pale end. */
function feather(x0: number, y0: number, x1: number, y1: number, w: number, fill: string, tip?: string): string {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * w;
  const ny = (dx / len) * w;
  const mx = x0 + dx * 0.55;
  const my = y0 + dy * 0.55;
  let out = pathEl(`M ${x0} ${y0} Q ${mx + nx} ${my + ny} ${x1} ${y1} Q ${mx - nx} ${my - ny} ${x0} ${y0} Z`, fill, THIN);
  if (tip) {
    const tx = x0 + dx * 0.74;
    const ty = y0 + dy * 0.74;
    const mx2 = x0 + dx * 0.87;
    const my2 = y0 + dy * 0.87;
    out += pathEl(`M ${tx + nx * 0.62} ${ty + ny * 0.62} Q ${mx2 + nx * 0.7} ${my2 + ny * 0.7} ${x1} ${y1} Q ${mx2 - nx * 0.7} ${my2 - ny * 0.7} ${tx - nx * 0.62} ${ty - ny * 0.62} Z`, tip, THIN);
  }
  return out + line(x0, y0, x0 + dx * 0.9, y0 + dy * 0.9, 0.6, '#5b524a');
}

/** Tips of a crest of up to five, fanned up and back (the figure faces right): the tallest in the middle. */
const CREST: [number, number][] = [
  [-13, -77],
  [-3, -80],
  [-19, -68],
  [5, -77],
  [-21, -59],
];

/** A shaggy ruff over the shoulders: a dark collar with a fringe hanging down. */
function ruff(color: string): string {
  // Across the top, then back along a jagged lower edge.
  let d = 'M -11.5 -48.5 Q 1 -53 12.5 -48.5';
  for (let k = 0; k <= 8; k++) d += ` L ${(11.5 - k * 2.85).toFixed(2)} ${k % 2 === 0 ? -40.5 : -44.5}`;
  let out = pathEl(`${d} Z`, color, THIN);
  for (const x of [-7, -2, 3, 8]) out += line(x, -49.5, x + 0.6, -44, 0.7, darken(color, 0.3));
  return out;
}

function head(b: Body): string {
  const cx = 2;
  const cy = -55;
  const r = 7.6;
  let out = '';
  // The crest stands behind the head.
  if (b.crest) {
    for (let k = 0; k < Math.min(b.crest.n, CREST.length); k++) {
      const [tx, ty] = CREST[k]!;
      out += feather(cx - 2, cy - 4, cx + tx, ty, 3.1, k % 2 === 0 ? '#1d1b1a' : '#2e2824', b.crest.tips && k < 3 ? '#e8e0cc' : undefined);
    }
  }
  if (b.hat === 'hood') out += pathEl(`M ${cx - 10} ${cy + 9} Q ${cx - 11} ${cy - 11} ${cx + 1} ${cy - 11} Q ${cx + 11} ${cy - 10} ${cx + 9} ${cy + 3} L ${cx + 4} ${cy + 9} Z`, b.accent, STROKE);
  if (b.longHair && !b.bald && b.hat !== 'hood') out += rect(cx - 9, cy - 3, 9, 13, b.hair, THIN);
  out += rect(cx - 2.5, cy + 5, 5, 5, b.skin, THIN);
  if (b.ruff) out += ruff(b.ruff);
  out += circle(cx, cy, r, b.skin, STROKE);
  // Hair: a cap over the back of the head.
  if (!b.bald && b.hat !== 'hood' && b.hat !== 'helmet' && b.hat !== 'mohawk') {
    out += pathEl(`M ${cx - r} ${cy + 2} A ${r} ${r} 0 0 1 ${cx + r - 0.5} ${cy - 2.5} Q ${cx + 1} ${cy - 5} ${cx - 3} ${cy - 1} Q ${cx - 4} ${cy + 3} ${cx - r} ${cy + 2} Z`, b.hair, THIN);
  }
  // Paint across the eyes, under them.
  if (b.paint) out += pathEl(`M ${cx - 2} ${cy - 2.6} L ${cx + r - 0.3} ${cy - 2.6} L ${cx + r - 0.6} ${cy + 1.6} L ${cx - 2} ${cy + 1.8} Z`, b.paint, NONE);
  // Eyes, looking ahead.
  if (b.eyes === 'hollow') {
    out += ellipse(cx + 2.4, cy - 0.5, 1.5, 2, '#1d1915', NONE) + ellipse(cx + 6, cy - 0.5, 1.3, 1.9, '#1d1915', NONE) + line(cx + 2.5, cy + 4, cx + 6.5, cy + 4, 1, INK);
  } else if (b.eyes === 'glow') {
    out += circle(cx + 2.6, cy - 0.5, 1.4, '#c7f27a', NONE) + circle(cx + 6.2, cy - 0.5, 1.3, '#c7f27a', NONE);
  } else {
    out += circle(cx + 2.6, cy - 0.3, 0.95, INK, NONE) + circle(cx + 6.1, cy - 0.3, 0.9, INK, NONE) + line(cx + 3.4, cy + 3.8, cx + 6, cy + 3.6, 0.9, INK);
  }
  switch (b.hat) {
    case 'beanie':
      out += pathEl(`M ${cx - r - 0.4} ${cy - 1.5} A ${r + 0.4} ${r + 1} 0 0 1 ${cx + r + 0.4} ${cy - 1.5} Z`, b.accent, THIN);
      break;
    case 'bandana':
      out += pathEl(`M ${cx - r} ${cy - 3} L ${cx + r} ${cy - 3} L ${cx + r} ${cy - 5.5} L ${cx - r} ${cy - 5.5} Z M ${cx - r} ${cy - 4} L ${cx - r - 5} ${cy - 1} L ${cx - r - 3} ${cy - 5} Z`, b.accent, THIN);
      break;
    case 'goggles':
      out += rect(cx - r, cy - 5.5, r * 2, 2, '#3a302a', NONE) + circle(cx + 2.4, cy - 4.6, 2.2, '#9fb7b0', THIN) + circle(cx + 6.4, cy - 4.6, 2, '#9fb7b0', THIN);
      break;
    case 'helmet':
      out += pathEl(`M ${cx - r - 1.4} ${cy - 0.5} A ${r + 1.4} ${r + 1.6} 0 0 1 ${cx + r + 1.4} ${cy - 0.5} Z`, b.accent, STROKE) + rect(cx - r - 2.5, cy - 1.4, (r + 2.5) * 2, 2, darken(b.accent, 0.25), THIN);
      break;
    case 'mask':
      out += pathEl(`M ${cx - 2} ${cy + 1} L ${cx + r + 0.2} ${cy + 0.5} L ${cx + r - 1} ${cy + 6} L ${cx} ${cy + 7.5} Z`, b.accent, THIN);
      break;
    case 'mohawk':
      out += poly([[cx - 5, cy - 5], [cx - 3, cy - 13], [cx - 1, cy - 7], [cx + 1, cy - 14], [cx + 3, cy - 7], [cx + 5, cy - 12], [cx + 5, cy - 6]], b.hair, THIN);
      break;
    case 'cap':
      // A transit conductor's peaked cap, with its badge (3.12.0).
      out += pathEl(`M ${cx - r} ${cy - 2} Q ${cx - r} ${cy - 11} ${cx + 1} ${cy - 11} Q ${cx + r + 1} ${cy - 11} ${cx + r} ${cy - 3} Z`, b.cloth, THIN);
      out += pathEl(`M ${cx + 1} ${cy - 3.5} L ${cx + r + 5} ${cy - 2.5} L ${cx + r + 4} ${cy - 0.5} L ${cx} ${cy - 1.5} Z`, '#1d1b1a', THIN) + rect(cx - 1, cy - 8, 3.4, 2.4, b.accent, NONE);
      break;
    case 'nurse':
      // A starched nurse's cap, with a red cross (3.12.0).
      out += pathEl(`M ${cx - 6} ${cy - 6} L ${cx - 5} ${cy - 12} L ${cx + 5} ${cy - 12} L ${cx + 6} ${cy - 6} Z`, '#efe8da', THIN) + rect(cx - 0.6, cy - 11, 1.2, 3.6, '#b5432f', NONE) + rect(cx - 1.8, cy - 9.8, 3.6, 1.2, '#b5432f', NONE);
      break;
    default:
      break;
  }
  if (b.hurt) out += rect(cx - r + 0.5, cy - 3.6, r * 2 - 1, 2.4, '#efe8da', THIN);
  return out;
}

function torso(b: Body): string {
  const w = 9 * b.build;
  let out = pathEl(`M ${-w} -27 L ${-w + 0.5} -44 Q ${-w + 1} -48 ${-w + 5} -48 L ${w - 4} -48 Q ${w} -48 ${w} -44 L ${w + 0.5} -27 Z`, b.cloth, STROKE);
  const a = b.armor;
  if (a) {
    if (a.kind === 'vest' || a.kind === 'leather') out += rect(-w + 1.5, -46, w * 2 - 3, 16, a.color, THIN) + (a.kind === 'vest' ? line(-w + 3, -38, w - 3, -38, 0.9, INK) : '');
    if (a.kind === 'riot') out += rect(-w + 1, -47, w * 2 - 2, 18, a.color, THIN) + circle(w - 1, -45, 4.6, darken(a.color, 0.15), THIN) + circle(-w + 1, -45, 4.6, darken(a.color, 0.15), THIN);
    if (a.kind === 'hazmat') out += rect(-w + 0.5, -47.5, w * 2 - 1, 20, a.color, THIN) + rect(-2, -45, 6, 4, '#3a302a', THIN);
    if (a.kind === 'signs') {
      out += poly([[2, -47], [10, -39], [2, -31], [-6, -39]], '#e0b13a', THIN) + line(-1, -39, 5, -39, 1.2, INK);
      out += poly([[-w - 2, -48], [-w + 3, -51], [-w + 7, -48], [-w + 7, -43], [-w + 3, -40], [-w - 2, -43]], '#b5432f', THIN);
    }
    if (a.kind === 'medic') {
      // A patcher (3.8.0): a white cross on the chest, and a bag at the hip.
      out += rect(-3.6, -45, 7.2, 7.2, '#efe8da', THIN) + rect(-0.9, -44, 1.8, 5.2, '#b5432f', NONE) + rect(-2.6, -42.3, 5.2, 1.8, '#b5432f', NONE);
      out += line(-w + 1, -47, w - 1, -29, 1.4, '#3a302a') + rect(w - 5, -33, 8, 6.5, a.color, THIN);
    }
    if (a.kind === 'bandolier') {
      // A firebug (3.8.0): a strap of bottles across the chest.
      out += line(-w + 1, -47, w - 1, -30, 2.6, '#3a302a');
      for (const k of [0, 1, 2]) out += rect(-w + 3 + k * 4.6, -45 + k * 4.6, 3, 5.2, a.color, THIN);
    }
    if (a.kind === 'apron') {
      // A rubber apron down over the thighs, stained.
      out += pathEl(`M ${-w + 2} -46 L ${w - 2} -46 L ${w + 1.5} -15 L ${-w - 1.5} -15 Z`, a.color, THIN);
      out += ellipse(3, -22, 3.4, 2, '#8e3b2c', 'stroke="none" opacity="0.75"') + ellipse(-3, -35, 2, 1.4, '#8e3b2c', 'stroke="none" opacity="0.6"') + ellipse(5, -18, 1.4, 1, '#8e3b2c', 'stroke="none" opacity="0.6"');
    }
  }
  out += rect(-w, -30, w * 2 + 0.5, 3, '#3a302a', THIN);
  return out;
}

function glow(): string {
  return `<ellipse cx="2" cy="-32" rx="20" ry="36" fill="#b8f06a" opacity="0.22" stroke="none" class="bt-glow"/>`;
}

/** A person-shaped fighter, facing right, feet at (0, 0). */
export function personSvg(b: Body): string {
  const { back, front } = hands(b.held);
  const long = b.held === 'rifle' || b.held === 'shotgun' || b.held === 'crossbow';
  let out = b.glow ? glow() : '';
  out += ellipse(0, 0, 15 * b.build, 3.2, '#1d1915', 'stroke="none" opacity="0.28"');
  // Legs in a fighting stance, back leg first.
  out += limb(-3, -27, -8, -4, b.trousers, 6) + rect(-13, -5, 9, 5, b.boots, THIN);
  out += limb(3, -27, 7, -4, b.trousers, 6) + rect(4, -5, 10, 5, b.boots, THIN);
  // The upper body leans with the stoop, around the hips.
  let upper = '';
  // The back arm first, then the body, then the weapon and the front arm.
  upper += limb(-5 * b.build, -45, back[0], back[1], b.cloth) + circle(back[0], back[1], 2.6, b.skin, THIN);
  upper += torso(b);
  if (long) upper += weapon(b.held, front, back);
  upper += head(b);
  if (b.extra) upper += b.extra;
  if (!long) upper += weapon(b.held, front, back);
  upper += limb(5 * b.build, -45, front[0], front[1], b.cloth) + circle(front[0], front[1], 2.6, b.hand ?? b.skin, THIN);
  out += b.stoop ? `<g transform="rotate(${b.stoop} 0 -27)">${upper}</g>` : upper;
  return out;
}

/** The muzzle of what they hold, for the flash of a shot: where it is, relative to the feet, facing right. */
export function muzzle(held: string): [number, number] {
  switch (held) {
    case 'rifle':
      return [37, -40];
    case 'shotgun':
      return [29, -39];
    case 'crossbow':
      return [25, -37];
    case 'holster':
      return [27, -45];
    default:
      return [22, -40];
  }
}

// ---------------------------------------------------------------- the crew

const ARMOR: Record<string, Body['armor']> = {
  leather_jacket: { kind: 'leather', color: '#6b4a32' },
  scrap_vest: { kind: 'vest', color: '#7d8382' },
  riot_gear: { kind: 'riot', color: '#3f4a52' },
  hazmat_suit: { kind: 'hazmat', color: '#c9a83e' },
};

/** One of the crew: their portrait's colors, their armor, and the weapon they carry. */
export function crewBody(look: FigureLook, weaponId: string | undefined): Body {
  const held: Held = weaponId ? (WEAPON_LOOKS[weaponId] ?? 'pipe') : 'none';
  const armor = look.armor ? ARMOR[look.armor] : undefined;
  return {
    skin: look.skin,
    hair: look.hair,
    longHair: look.longHair,
    bald: look.bald,
    cloth: look.cloth,
    accent: look.accent,
    trousers: C.trousers,
    boots: C.boots,
    ...(armor ? { armor } : {}),
    ...(look.hat ? { hat: look.hat } : {}),
    held,
    build: 1,
    stoop: 0,
    eyes: 'plain',
    hurt: look.hurt,
    glow: false,
  };
}

// ---------------------------------------------------------------- enemies

const SKINS = ['#c08e66', '#8d5a3b', '#e2b48f', '#a8724f', '#d29c76', '#6e4630'];
const HAIRS = ['#2b2420', '#4a3527', '#7a5232', '#3a2f28', '#8a8580'];

/** What every Vulture wears: the ruff and the paint (the crest goes by rank). */
const VULTURE = { ruff: '#d9cfb6', paint: '#a8402e', accent: '#25221f' } as const;

/** A raider or a Vulture of the given kind; `seed` varies skin and hair between them. */
function raider(kind: string, seed: string): { body: Body; scale: number } {
  const h = hash(seed);
  const base: Body = {
    skin: SKINS[h % SKINS.length]!,
    hair: HAIRS[(h >>> 4) % HAIRS.length]!,
    longHair: false,
    bald: false,
    cloth: '#5a4a3c',
    accent: '#8e3b2c',
    trousers: '#3d3833',
    boots: '#2a221d',
    held: 'pipe',
    build: 1,
    stoop: 0,
    eyes: 'plain',
    hurt: false,
    glow: false,
  };
  switch (kind) {
    case 'raider_scav':
      return { body: { ...base, hat: 'mask', held: (h >>> 8) % 2 === 0 ? 'pipe' : 'blade', cloth: '#6b5a44', armor: { kind: 'leather', color: '#4f3a2a' } }, scale: 1 };
    case 'raider_gunner':
      return { body: { ...base, hat: 'goggles', held: 'rifle', cloth: '#4f5446', accent: '#7b3a2a', armor: { kind: 'vest', color: '#6f665a' } }, scale: 1 };
    case 'raider_brute':
      return { body: { ...base, bald: true, hat: 'mohawk', hair: '#8e3b2c', held: 'spiked_bat', cloth: '#5e4636', build: 1.3 }, scale: 1.12 };
    case 'raider_patcher':
      return { body: { ...base, hat: 'bandana', accent: '#efe8da', held: 'holster', cloth: '#6e6a58', armor: { kind: 'medic', color: '#7a5a3c' } }, scale: 0.96 };
    case 'raider_firebug':
      return { body: { ...base, hat: 'goggles', held: 'bottle', cloth: '#3e3833', accent: '#d0703c', armor: { kind: 'bandolier', color: '#5f7a52' } }, scale: 0.96 };
    case 'raider_enforcer':
      return { body: { ...base, hat: 'helmet', accent: '#6b7272', held: 'maul', cloth: '#4a3f36', build: 1.35, armor: { kind: 'signs', color: '#e0b13a' } }, scale: 1.22 };
    case 'haven_orderly':
      // White, clean, masked, with a saw or a hook (§9.12).
      return {
        body: { ...base, cloth: '#e6e3d8', trousers: '#cfcbbd', boots: '#3a3631', hat: 'mask', accent: '#bccbc4', held: (h >>> 8) % 2 === 0 ? 'saw' : 'hook', armor: { kind: 'apron', color: '#b9b2a0' } },
        scale: 1,
      };
    case 'haven_marksman':
      return { body: { ...base, cloth: '#e6e3d8', trousers: '#cfcbbd', boots: '#3a3631', hat: 'goggles', held: 'rifle', armor: { kind: 'vest', color: '#c9c4b4' } }, scale: 1 };
    // The Vultures (§7.11): black feathers fanned up from the head, a ruff over the shoulders, red paint across the eyes.
    case 'vulture_shot':
      return { body: { ...base, ...VULTURE, crest: { n: 3, tips: false }, hat: 'goggles', cloth: '#2f2b28', held: 'rifle' }, scale: 1 };
    case 'vulture_lieutenant':
      return { body: { ...base, ...VULTURE, crest: { n: 5, tips: true }, cloth: '#2a2522', trousers: '#2b2724', held: 'blade', build: 1.15 }, scale: 1.1 };
    default:
      // vulture_scav, and any raider without a drawing of its own.
      return kind.startsWith('vulture_')
        ? { body: { ...base, ...VULTURE, crest: { n: 3, tips: false }, cloth: '#33302c', held: 'blade' }, scale: 1 }
        : { body: { ...base, hat: 'bandana' }, scale: 1 };
  }
}

function hollow(kind: string, seed: string): { body: Body; scale: number } {
  const h = hash(seed);
  const skin = ['#9ea594', '#8f9886', '#a7a99a'][h % 3]!;
  const base: Body = {
    skin,
    hair: '#5b5a52',
    longHair: (h >>> 3) % 2 === 0,
    bald: (h >>> 5) % 3 === 0,
    cloth: '#6f6a5c',
    accent: '#58554b',
    trousers: '#4c4a42',
    boots: '#3a3631',
    held: 'claws',
    build: 0.85,
    stoop: 16,
    eyes: 'hollow',
    hurt: false,
    glow: false,
  };
  if (kind === 'glowing_hollow') return { body: { ...base, skin: '#a9bf8a', eyes: 'glow', glow: true }, scale: 1 };
  if (kind === 'hollow_hulk') return { body: { ...base, build: 1.6, stoop: 10, skin: '#8b937f', cloth: '#5b574c', bald: true }, scale: 1.35 };
  return { body: base, scale: 1 };
}

function radHound(seed: string): string {
  const h = hash(seed);
  const fur = ['#8a6a4a', '#7a6650', '#6b5a48'][h % 3]!;
  const mange = mix(fur, '#c9a07d', 0.45);
  return (
    ellipse(2, 0, 20, 3, '#1d1915', 'stroke="none" opacity="0.28"') +
    // Tail, back legs, body, front legs, head.
    pathEl('M -16 -20 Q -24 -26 -26 -18', 'none', `stroke="${INK}" stroke-width="3.4" stroke-linecap="round"`) +
    limb(-11, -16, -14, -1, darken(fur, 0.15), 4) +
    limb(-6, -16, -6, -1, fur, 4) +
    ellipse(-1, -19, 17, 8, fur, STROKE) +
    ellipse(-6, -22, 5, 2.4, mange, NONE) +
    ellipse(4, -16, 4, 2, mange, NONE) +
    limb(8, -15, 9, -1, darken(fur, 0.15), 4) +
    limb(12, -16, 14, -1, fur, 4) +
    poly([[13, -30], [16, -38], [19, -30]], fur, THIN) +
    ellipse(18, -25, 7.5, 6, fur, STROKE) +
    pathEl('M 22 -26 L 31 -23 L 30 -19 L 21 -19 Z', mix(fur, '#c9a07d', 0.2), STROKE) +
    poly([[24, -19], [25, -16], [26, -19], [27, -16], [28, -19]], '#efe8da', THIN) +
    circle(20.5, -27, 1.6, '#c7f27a', NONE)
  );
}

function mireStalker(): string {
  const skin = '#5b6b47';
  const belly = '#8a9466';
  let spines = '';
  for (let k = 0; k < 6; k++) spines += poly([[-14 + k * 6, -18], [-11 + k * 6, -25 + (k % 2) * 2], [-8 + k * 6, -18]], darken(skin, 0.2), THIN);
  return (
    ellipse(0, 0, 30, 3.4, '#1d1915', 'stroke="none" opacity="0.28"') +
    pathEl('M -20 -12 Q -34 -14 -42 -4 Q -32 -9 -20 -6 Z', skin, STROKE) +
    spines +
    limb(-12, -9, -16, -1, darken(skin, 0.15), 5) +
    pathEl('M -22 -8 Q -20 -20 0 -19 Q 18 -19 24 -12 L 22 -5 Q 0 -2 -20 -4 Z', skin, STROKE) +
    pathEl('M -14 -5 Q 0 -3 18 -6', 'none', `stroke="${belly}" stroke-width="2.4"`) +
    limb(12, -9, 15, -1, darken(skin, 0.15), 5) +
    // Jaws open.
    pathEl('M 20 -16 L 40 -16 L 38 -12 L 22 -11 Z', skin, STROKE) +
    pathEl('M 21 -10 L 37 -7 L 36 -4 L 21 -6 Z', darken(skin, 0.1), STROKE) +
    poly([[25, -12], [26, -10], [27, -12], [29, -11.5], [30, -9.5], [31, -11.5], [33, -11], [34, -9], [35, -11]], '#efe8da', THIN) +
    circle(24, -17.5, 1.7, '#e0b13a', THIN)
  );
}

function scrapDrone(): string {
  // Hovers: its shadow on the ground, the drone well above it.
  return (
    ellipse(0, 0, 13, 2.6, '#1d1915', 'stroke="none" opacity="0.22"') +
    `<g class="bt-hover">` +
    line(-14, -42, 14, -42, 2.2, INK) +
    ellipse(-15, -44, 7, 1.6, '#b9bdb8', THIN) +
    ellipse(15, -44, 7, 1.6, '#b9bdb8', THIN) +
    rect(-9, -42, 18, 11, '#9a8f72', STROKE) +
    rect(-9, -38, 18, 3, '#6b5a48', THIN) +
    circle(7, -36.5, 2.6, '#d9493a', THIN) +
    limb(-2, -31, 6, -24, STEEL_DARK, 1.8) +
    circle(6.5, -23.5, 1.6, '#8fd0e8', THIN) +
    '</g>'
  );
}

function sentryBot(): string {
  return (
    ellipse(0, 0, 18, 3.2, '#1d1915', 'stroke="none" opacity="0.28"') +
    // Treads, body, head with its eye and a gun.
    rect(-17, -10, 34, 10, '#3a3631', STROKE) +
    circle(-12, -5, 3, STEEL_DARK, THIN) +
    circle(0, -5, 3, STEEL_DARK, THIN) +
    circle(12, -5, 3, STEEL_DARK, THIN) +
    rect(-11, -32, 22, 22, '#8f8a6e', STROKE) +
    rect(-11, -26, 22, 3, '#c0a43c', NONE) +
    rect(-11, -20, 22, 3, '#1d1b1a', NONE) +
    rect(-7, -44, 15, 12, '#9a9579', STROKE) +
    circle(4, -38, 3, '#d9493a', THIN) +
    circle(4, -38, 1.2, '#f7d36b', NONE) +
    rect(8, -38, 18, 4, STEEL_DARK, THIN) +
    line(-5, -44, -7, -51, 1.4, INK) +
    circle(-7, -52, 1.4, '#d9493a', THIN)
  );
}

/** A seam: a line with cross-stitches along it. */
function seam(x1: number, y1: number, x2: number, y2: number, n: number): string {
  let out = line(x1, y1, x2, y2, 0.9, INK);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * 1.8;
  const ny = (dx / len) * 1.8;
  for (let k = 1; k <= n; k++) {
    const x = x1 + (dx * k) / (n + 1);
    const y = y1 + (dy * k) / (n + 1);
    out += line(x - nx, y - ny, x + nx, y + ny, 0.8, INK);
  }
  return out;
}

/** Spread fingers with nails, at the end of an arm reaching toward (dx, dy). */
function talons(x: number, y: number, dx: number, dy: number): string {
  const a = Math.atan2(dy, dx);
  let out = '';
  for (const t of [-0.5, 0, 0.5]) out += line(x, y, x + Math.cos(a + t) * 5.5, y + Math.sin(a + t) * 5.5, 1.3, INK);
  return out;
}

/** An eye looking somewhere of its own: a white with a pupil pushed toward (lx, ly). */
function lookingEye(x: number, y: number, r: number, lx: number, ly: number): string {
  return ellipse(x, y, r * 1.35, r * 1.2, '#3a3631', NONE) + circle(x, y, r * 0.8, '#d6cdb0', NONE) + circle(x + lx * r * 0.4, y + ly * r * 0.4, r * 0.38, INK, NONE);
}

/**
 * The Shepherd (§9.12): Haven's best work, sewn together out of many people.
 * Four arms, two heads, three legs, every face still looking around; it leans
 * on a crook of bent rebar. About 94 units tall, feet at (0, 0), facing right.
 */
function shepherd(): string {
  const skin = '#9ea594';
  const pink = '#b9a08c';
  const grey = '#8b937f';
  const pale = '#c4b49c';
  let out = ellipse(-2, 0, 30, 3.8, '#1d1915', 'stroke="none" opacity="0.3"');
  // The crook, planted behind it.
  out += limb(-27, -1, -26, -90, '#6b6559', 2.4);
  out += pathEl('M -26 -90 Q -26 -101 -17 -101 Q -9 -101 -9 -93', 'none', `stroke="${INK}" stroke-width="5" stroke-linecap="round"`);
  out += pathEl('M -26 -90 Q -26 -101 -17 -101 Q -9 -101 -9 -93', 'none', 'stroke="#6b6559" stroke-width="2.4" stroke-linecap="round"');
  // The upper back arm, raised behind it.
  out += limb(-11, -70, -17, -98, grey, 6) + talons(-17, -98, -0.2, -1);
  // Three legs: back, middle, front.
  out += limb(-8, -36, -15, -4, darken(skin, 0.12), 7.5) + rect(-21, -5, 11, 5, '#5b574c', THIN);
  out += limb(1, -36, 0, -4, pink, 7) + rect(-4, -5, 10, 5, '#4a4740', THIN);
  out += limb(10, -36, 15, -4, skin, 7.5) + rect(10, -5, 12, 5, '#5b574c', THIN);
  out += seam(-12, -22, -8, -19, 2) + seam(-3, -18, 4, -17, 2);
  // The lower back arm, holding the crook.
  out += limb(-12, -52, -24, -46, pale, 6) + circle(-25.5, -46, 3, pale, THIN);
  // The body: hunched, lumpy, patched from different skins and sewn up.
  out += pathEl('M -18 -34 Q -23 -56 -15 -71 Q -5 -80 9 -77 Q 21 -73 20 -56 Q 20 -44 17 -34 Z', skin, STROKE);
  out += pathEl('M -15 -66 Q -6 -71 0 -69 L 1 -54 Q -8 -51 -17 -52 Z', pink, THIN);
  out += pathEl('M 4 -51 L 18 -54 Q 19 -44 17 -36 L 5 -36 Z', grey, THIN);
  out += seam(-15, -66, 0, -69, 3) + seam(1, -69, 1, -54, 3) + seam(4, -51, 18, -54, 3) + seam(5, -50, 5, -36, 2);
  // What's left of a hospital gown, and a strap across it.
  out += pathEl('M -18 -40 Q 0 -36 17 -40 L 17 -33 Q 0 -30 -18 -33 Z', '#d8d4c6', THIN);
  out += line(-13, -69, 13, -40, 3, '#4a3a2c') + rect(-2, -57, 4.5, 4.5, '#8d9494', THIN);
  // The second head, slumped on its left shoulder, looking up and back.
  out += rect(-13, -76, 5, 5, pink, THIN) + circle(-12, -80, 6.6, pink, STROKE);
  out += lookingEye(-14.5, -81, 1.7, -0.8, -0.6) + lookingEye(-10.5, -81.5, 1.6, -0.6, -0.8) + seam(-17, -85, -8, -86, 2);
  // The main head, looking ahead.
  out += rect(5, -80, 6, 6, skin, THIN) + circle(9, -85, 8.4, skin, STROKE);
  out += pathEl('M 1 -86 A 8.4 8.4 0 0 1 16 -90 Q 9 -91 5 -88 Z', '#5b5a52', THIN);
  out += lookingEye(10.5, -85.5, 1.8, 0.9, 0) + lookingEye(14.6, -85.5, 1.6, 0.9, 0.2) + seam(9, -80.5, 15, -80.5, 3) + seam(4, -92, 12, -93, 2);
  // Two arms in front: the upper reaching, the lower low and forward.
  out += limb(12, -70, 30, -63, skin, 6) + talons(30, -63, 1, 0.2) + seam(19, -68.5, 21, -64, 1);
  out += limb(14, -52, 27, -41, grey, 6) + talons(27, -41, 1, 0.6);
  return out;
}

// ---------------------------------------------------------------- elites (§7.15, 3.12.0)

/** Rivets along a plate. */
function rivets(points: readonly [number, number][]): string {
  return points.map(([x, y]) => circle(x, y, 0.8, '#3a3631', NONE)).join('');
}

/** The Switchman: a tall rail robot on jointed legs, plated, a lamp for a head, a track bar in its hand. About 74 tall. */
function switchman(): string {
  const hull = '#b8743a';
  const plate = '#8d9494';
  let out = ellipse(0, 0, 18, 3.2, '#1d1915', 'stroke="none" opacity="0.28"');
  // The lamp's beam, ahead of it.
  out += poly([[8, -68], [46, -80], [46, -52]], '#f7d36b', 'stroke="none" opacity="0.18"');
  out += limb(-5, -31, -11, -16, STEEL_DARK, 5) + limb(-11, -16, -8, -3, STEEL_DARK, 5) + rect(-14, -4, 11, 4, '#3a3631', THIN);
  out += limb(-15, -58, -18, -40, STEEL_DARK, 3.6) + circle(-18, -40, 2.4, STEEL_DARK, THIN);
  out += rect(-9, -36, 18, 7, '#5f6767', STROKE);
  out += rect(-11, -64, 22, 30, hull, STROKE);
  out += rect(-10, -38, 20, 3, '#1d1b1a', NONE) + rect(-6, -38, 3, 3, '#e0b13a', NONE) + rect(2, -38, 3, 3, '#e0b13a', NONE);
  out += rect(-9, -61, 8.5, 12, plate, THIN) + rect(0.5, -61, 8.5, 12, plate, THIN) + rect(-9, -47, 18, 8, plate, THIN);
  out += rivets([[-8, -60], [-2, -60], [1.5, -60], [8, -60], [-8, -50], [-2, -50], [1.5, -50], [8, -50], [-8, -46], [8, -46], [-8, -40], [8, -40]]);
  out += rect(-5, -72, 10, 8, '#5f6767', STROKE) + circle(5, -68, 3.8, '#f7d36b', THIN) + circle(5, -68, 1.6, '#fff4c2', NONE);
  out += line(-3, -72, -4, -78, 1.2, INK) + circle(-4, -79, 1.2, '#d9493a', THIN);
  out += limb(5, -31, 10, -16, STEEL, 5) + limb(10, -16, 8, -3, STEEL, 5) + rect(3, -4, 12, 4, '#3a3631', THIN);
  // The track bar, gripped in front.
  out += limb(13, -26, 21, -66, '#7d8382', 2.8) + pathEl('M 21 -66 Q 22 -71 26 -70', 'none', `stroke="${INK}" stroke-width="2.6" stroke-linecap="round"`);
  out += limb(10, -59, 17, -45, STEEL, 3.6) + circle(17, -45, 2.6, STEEL_DARK, THIN);
  return out;
}

/** Old Mother: a big grey rad-hound with a torn ear and a chain round her neck, the tags on it. */
function oldMother(): string {
  const fur = '#77716a';
  const grey = '#c4bdb0';
  return (
    ellipse(2, 0, 21, 3.2, '#1d1915', 'stroke="none" opacity="0.3"') +
    pathEl('M -16 -20 Q -25 -24 -27 -15', 'none', `stroke="${INK}" stroke-width="3.6" stroke-linecap="round"`) +
    limb(-11, -16, -14, -1, darken(fur, 0.15), 4.4) +
    limb(-6, -16, -6, -1, fur, 4.4) +
    ellipse(-1, -19, 17.5, 8.5, fur, STROKE) +
    line(-9, -23, -4, -17, 1, '#e8dccb') + line(-6, -24, -1, -18, 1, '#e8dccb') +
    ellipse(6, -15, 4.5, 2, grey, NONE) +
    limb(8, -15, 9, -1, darken(fur, 0.15), 4.4) +
    limb(12, -16, 14, -1, fur, 4.4) +
    poly([[13, -30], [15, -38], [17, -33], [19, -30]], fur, THIN) +
    ellipse(18, -25, 8, 6.4, fur, STROKE) +
    pathEl('M 22 -26 L 32 -23 L 31 -19 L 21 -19 Z', grey, STROKE) +
    poly([[24, -19], [25, -16], [26, -19], [27, -16], [28, -19]], '#efe8da', THIN) +
    ellipse(19, -24, 3, 2, grey, NONE) +
    circle(20.5, -27, 1.7, '#c7f27a', NONE) +
    // The chain, and the tags hanging off it.
    pathEl('M 11 -27 Q 13 -19 17 -19', 'none', `stroke="#9a9a92" stroke-width="1.6" stroke-dasharray="1.6 0.8"`) +
    rect(14.5, -18.5, 3, 4.2, '#d6d3c4', THIN) +
    rect(16.5, -17.5, 3, 4.2, '#b9b6a8', THIN)
  );
}

/** The Snapper: a snapping turtle as big as a car, its shell grown over with weed. About 40 tall. */
function snapper(): string {
  const skin = '#6e7a55';
  const shell = '#4f5a3c';
  let out = ellipse(0, 0, 32, 3.8, '#1d1915', 'stroke="none" opacity="0.3"');
  out += limb(-18, -8, -24, -1, darken(skin, 0.15), 7) + limb(-6, -8, -8, -1, darken(skin, 0.15), 7);
  out += pathEl('M -30 -6 L -38 -3 L -30 -10 Z', skin, THIN);
  out += pathEl('M -28 -7 Q -28 -36 0 -38 Q 26 -36 27 -7 Z', shell, STROKE);
  // The scutes, and the ridge down the middle.
  out += pathEl('M -18 -10 L -14 -27 L 0 -32 L 14 -27 L 18 -10', 'none', `stroke="${INK}" stroke-width="1"`);
  out += pathEl('M -14 -27 L -22 -14 M 14 -27 L 21 -14 M 0 -32 L 0 -10 M -7 -30 L -8 -18 M 7 -30 L 8 -18', 'none', `stroke="${INK}" stroke-width="0.9"`);
  for (const [x, y] of [[-7, -34], [0, -36], [7, -34]] as const) out += poly([[x - 2, y + 1], [x, y - 3], [x + 2, y + 1]], darken(shell, 0.2), THIN);
  // Weed hanging off it.
  for (const [x, len] of [[-24, 9], [-12, 12], [3, 8], [16, 11], [23, 7]] as const) out += pathEl(`M ${x} -8 q 2 ${len / 2} -1 ${len}`, 'none', 'stroke="#5f7a52" stroke-width="1.6" stroke-linecap="round"');
  out += ellipse(-10, -24, 4, 2.4, '#5f7a52', 'stroke="none" opacity="0.8"') + ellipse(9, -29, 3.4, 1.8, '#5f7a52', 'stroke="none" opacity="0.8"');
  out += pathEl('M -27 -7 Q 0 -3 26 -7 L 25 -4 Q 0 0 -26 -4 Z', '#a39a6e', THIN);
  out += limb(13, -8, 17, -1, skin, 7) + limb(22, -8, 26, -1, skin, 7);
  // Neck and head, the beak hooked down.
  out += limb(22, -14, 31, -19, skin, 8);
  out += ellipse(35, -20, 8, 6.4, skin, STROKE);
  out += pathEl('M 40 -23 L 46 -19 L 41 -14 L 39 -18 Z', '#3a3631', THIN);
  out += line(33, -16, 40, -16, 1, INK);
  out += circle(35, -23, 1.5, '#e0b13a', THIN);
  return out;
}

/** The Warden: the Water Plant's security unit, twice a sentry's size, plated, with drones docked on its back. About 60 tall. */
function warden(): string {
  const body = '#6f7f86';
  const plate = '#8d9494';
  let out = ellipse(0, 0, 23, 3.4, '#1d1915', 'stroke="none" opacity="0.3"');
  // Docked drones, behind.
  for (const [x, y] of [[-21, -52], [-24, -40]] as const) {
    out += line(x - 6, y - 2, x + 6, y - 2, 1.4, INK) + rect(x - 4, y - 2, 8, 5, '#9a8f72', THIN) + circle(x + 2.5, y + 0.5, 1.2, '#d9493a', NONE);
  }
  out += rect(-20, -48, 7, 22, '#4a5357', THIN);
  out += rect(-21, -11, 42, 11, '#3a3631', STROKE);
  for (const x of [-15, -5, 5, 15]) out += circle(x, -5.5, 3.2, STEEL_DARK, THIN);
  out += rect(-15, -42, 30, 31, body, STROKE);
  out += rect(-13, -39, 12.5, 13, plate, THIN) + rect(0.5, -39, 12.5, 13, plate, THIN) + rect(-13, -24, 26, 10, plate, THIN);
  out += rivets([[-12, -38], [-2, -38], [1.5, -38], [12, -38], [-12, -27], [12, -27], [-12, -23], [12, -23], [-12, -15], [12, -15]]);
  out += rect(-15, -30, 30, 2.4, '#e0b13a', NONE);
  out += rect(-9, -55, 18, 13, '#7a8a90', STROKE) + rect(-1, -51, 9, 2.6, '#d9493a', NONE) + rect(-1, -51, 9, 2.6, 'none', THIN);
  out += circle(-5, -57, 1.9, '#d9493a', THIN);
  // Its gun arm.
  out += rect(12, -49, 20, 4.6, STEEL_DARK, THIN) + rect(29, -50, 4, 6.6, '#3a3631', THIN);
  return out;
}

/** The Bog King: the biggest mire stalker there is, old, with weed and bones on its back and the swamp's glow on its hide. */
function bogKing(): string {
  const skin = '#3f4d36';
  const belly = '#6f7a56';
  let spines = '';
  for (let k = 0; k < 8; k++) spines += poly([[-20 + k * 6, -19], [-17 + k * 6, -28 + (k % 2) * 3], [-14 + k * 6, -19]], darken(skin, 0.2), THIN);
  return (
    ellipse(0, 0, 34, 3.6, '#1d1915', 'stroke="none" opacity="0.3"') +
    pathEl('M -22 -12 Q -38 -15 -48 -3 Q -36 -9 -22 -5 Z', skin, STROKE) +
    spines +
    limb(-14, -9, -18, -1, darken(skin, 0.15), 6) +
    pathEl('M -25 -8 Q -23 -22 0 -21 Q 20 -21 26 -13 L 24 -5 Q 0 -1 -23 -4 Z', skin, STROKE) +
    pathEl('M -16 -5 Q 0 -2 20 -6', 'none', `stroke="${belly}" stroke-width="2.6"`) +
    // Weed and old bones hanging off its back; the swamp's glow on its hide.
    pathEl('M -10 -21 q 1 5 -2 9 M -2 -22 q 2 6 0 10 M 8 -21 q 1 4 -1 8', 'none', 'stroke="#5f7a52" stroke-width="1.8" stroke-linecap="round"') +
    rect(-15, -16, 6, 1.8, '#e8dccb', THIN) + rect(4, -14, 5, 1.6, '#e8dccb', THIN) +
    circle(-6, -12, 1.2, '#b8f06a', 'stroke="none" opacity="0.8"') + circle(12, -11, 1, '#b8f06a', 'stroke="none" opacity="0.8"') + circle(-18, -9, 1, '#b8f06a', 'stroke="none" opacity="0.8"') +
    limb(14, -9, 17, -1, darken(skin, 0.15), 6) +
    pathEl('M 22 -18 L 46 -19 L 44 -13 L 24 -12 Z', skin, STROKE) +
    pathEl('M 23 -11 L 42 -7 L 41 -3 L 23 -6 Z', darken(skin, 0.1), STROKE) +
    poly([[27, -13], [28, -10], [29, -13], [31, -12.5], [32, -9.5], [33, -12.5], [35, -12], [36, -9], [37, -12], [39, -11.5], [40, -8.5], [41, -11.5]], '#efe8da', THIN) +
    circle(27, -19.5, 2, '#e0b13a', THIN) + circle(27, -19.5, 0.8, INK, NONE)
  );
}

/** Bravo Six: an army walker on four legs, plated, with a long gun. About 56 tall. */
function bravoSix(): string {
  const olive = '#5f6a46';
  const plate = '#76815a';
  let out = ellipse(0, 0, 28, 3.6, '#1d1915', 'stroke="none" opacity="0.3"');
  out += limb(-14, -26, -22, -13, STEEL_DARK, 4.4) + limb(-22, -13, -20, -2, STEEL_DARK, 4.4) + rect(-25, -4, 9, 4, '#3a3631', THIN);
  out += limb(8, -26, 14, -13, STEEL_DARK, 4.4) + limb(14, -13, 12, -2, STEEL_DARK, 4.4) + rect(8, -4, 9, 4, '#3a3631', THIN);
  out += pathEl('M -22 -26 L -17 -45 L 18 -45 L 25 -26 Z', olive, STROKE);
  out += rect(-15, -43, 10, 9, plate, THIN) + rect(-3, -43, 10, 9, plate, THIN) + rect(9, -43, 8, 9, plate, THIN) + rect(-18, -32, 38, 5, plate, THIN);
  out += rivets([[-14, -42], [-6, -42], [-2, -42], [6, -42], [10, -42], [16, -42], [-16, -30], [18, -30]]);
  // Its stencil: a chevron and a bar.
  out += poly([[-12, -38], [-9, -36], [-6, -38], [-6, -36.5], [-9, -34.5], [-12, -36.5]], '#e0d8b8', NONE) + rect(-2, -38, 7, 2.2, '#e0d8b8', NONE);
  out += rect(-5, -53, 13, 8, olive, STROKE) + circle(5, -49, 2.2, '#d9493a', THIN) + line(-3, -53, -5, -60, 1.2, INK) + circle(-5, -61, 1.2, '#e0b13a', THIN);
  out += rect(14, -42, 27, 4.6, STEEL_DARK, THIN) + rect(37, -43, 6, 6.6, '#3a3631', THIN) + rect(18, -44, 6, 3, '#3a3631', THIN);
  out += limb(-6, -26, -10, -13, STEEL, 4.4) + limb(-10, -13, -8, -2, STEEL, 4.4) + rect(-13, -4, 9, 4, '#3a3631', THIN);
  out += limb(17, -26, 24, -13, STEEL, 4.4) + limb(24, -13, 24, -2, STEEL, 4.4) + rect(20, -4, 9, 4, '#3a3631', THIN);
  return out;
}

/** The mast the Lookout shoots from, and how high she stands on it. */
const MAST = 31;

function mast(): string {
  let out = ellipse(0, 0, 14, 2.8, '#1d1915', 'stroke="none" opacity="0.28"');
  out += line(-10, 0, -6, -MAST, 1.8, '#5f6767') + line(10, 0, 6, -MAST, 1.8, '#5f6767');
  for (let k = 0; k < 3; k++) {
    const y0 = -k * 10;
    const y1 = -(k + 1) * 10;
    out += line(-10 + k * 1.3, y0, 9 - (k + 1) * 1.3, y1, 1, '#7d8382') + line(10 - k * 1.3, y0, -9 + (k + 1) * 1.3, y1, 1, '#7d8382');
  }
  return out + rect(-13, -MAST - 2, 26, 3, '#6b5a48', THIN);
}

/** One of the elites drawn as a person: a raider or a hollow made into someone of their own. */
function elitePerson(kind: string, seed: string): { body: Body; scale: number } | undefined {
  const h = hash(seed);
  const raider: Body = { skin: SKINS[h % SKINS.length]!, hair: HAIRS[(h >>> 4) % HAIRS.length]!, longHair: false, bald: false, cloth: '#5a4a3c', accent: '#8e3b2c', trousers: '#3d3833', boots: '#2a221d', held: 'pipe', build: 1, stoop: 0, eyes: 'plain', hurt: false, glow: false };
  const hollowBase: Body = { skin: '#9ea594', hair: '#5b5a52', longHair: false, bald: false, cloth: '#6f6a5c', accent: '#58554b', trousers: '#4c4a42', boots: '#3a3631', held: 'claws', build: 0.9, stoop: 12, eyes: 'hollow', hurt: false, glow: false };
  switch (kind) {
    case 'the_butcher':
      return { body: { ...raider, skin: '#c08e66', bald: true, cloth: '#6b5a44', trousers: '#3d3833', held: 'cleaver', build: 1.4, armor: { kind: 'apron', color: '#8a7a62' } }, scale: 1.2 };
    case 'the_lookout':
      return { body: { ...raider, skin: '#d29c76', hair: '#7a5232', longHair: true, hat: 'goggles', held: 'rifle', cloth: '#4f5446', accent: '#7b3a2a', armor: { kind: 'vest', color: '#6f665a' } }, scale: 1 };
    case 'the_red_hand':
      return {
        body: {
          ...raider,
          skin: '#a8724f',
          hat: 'mohawk',
          hair: '#8e3b2c',
          paint: '#a8402e',
          held: 'sledge',
          cloth: '#3e3833',
          build: 1.35,
          armor: { kind: 'riot', color: '#4a3f36' },
          hand: '#b5432f',
          // A red hand printed on his chest.
          extra: ellipse(-1, -38, 3, 3.4, '#b5432f', NONE) + [-3.6, -1.6, 0.4, 2.4].map((x) => rect(x - 0.7, -46, 1.4, 5, '#b5432f', NONE)).join('') + rect(2.6, -40, 3.4, 1.4, '#b5432f', NONE),
        },
        scale: 1.24,
      };
    case 'the_conductor':
      return {
        body: {
          ...hollowBase,
          cloth: '#2f3a4f',
          trousers: '#2a3040',
          accent: '#c9a640',
          hat: 'cap',
          // Brass buttons down the coat, and the bell on the belt.
          extra:
            [-44, -39, -34].map((y) => circle(3, y, 0.9, '#c9a640', NONE)).join('') +
            line(-6, -28, -6, -24, 0.9, INK) +
            pathEl('M -9 -18 Q -9 -24 -6 -24 Q -3 -24 -3 -18 Z', '#c9a640', THIN) +
            circle(-6, -17.4, 0.9, INK, NONE),
        },
        scale: 1.05,
      };
    case 'the_matron':
      return { body: { ...hollowBase, skin: '#a9bf8a', eyes: 'glow', glow: true, longHair: true, hair: '#8a8580', cloth: '#d8d4c6', trousers: '#bdb8a8', boots: '#d8d4c6', hat: 'nurse', stoop: 8, armor: { kind: 'apron', color: '#e6e3d8' } }, scale: 1.02 };
    case 'the_glass_man': {
      const shard = (pts: [number, number][]): string => poly(pts, '#cfeee0', 'stroke="#5d9f80" stroke-width="0.9" opacity="0.92"');
      return {
        body: {
          ...hollowBase,
          skin: '#8b937f',
          cloth: '#5b574c',
          bald: true,
          build: 1.6,
          stoop: 10,
          eyes: 'glow',
          glow: true,
          // Glass grown up through it.
          extra:
            shard([[-6, -48], [-10, -62], [-3, -50]]) +
            shard([[-11, -44], [-21, -53], [-10, -40]]) +
            shard([[7, -49], [10, -63], [12, -48]]) +
            shard([[0, -61], [-2, -73], [4, -62]]) +
            shard([[-13, -36], [-23, -39], [-12, -32]]) +
            shard([[10, -38], [17, -44], [11, -34]]),
        },
        scale: 1.45,
      };
    }
    default:
      return undefined;
  }
}

/** Every enemy with a drawing of its own; a test fails when one in the game has none. */
export const DRAWN_ENEMIES: readonly string[] = [
  'raider_scav',
  'raider_gunner',
  'raider_brute',
  'raider_patcher',
  'raider_firebug',
  'raider_enforcer',
  'vulture_scav',
  'vulture_shot',
  'vulture_lieutenant',
  'rad_hound',
  'mire_stalker',
  'hollow',
  'glowing_hollow',
  'hollow_hulk',
  'scrap_drone',
  'scrapbot_sentry',
  'haven_orderly',
  'haven_marksman',
  'the_shepherd',
  'the_switchman',
  'old_mother',
  'the_butcher',
  'the_conductor',
  'the_snapper',
  'the_lookout',
  'the_matron',
  'the_warden',
  'the_bog_king',
  'bravo_six',
  'the_red_hand',
  'the_glass_man',
];

/** The guild's dog at the gate (§9.8), facing right like the people. */
export function dogSvg(): string {
  const fur = '#9a6a3c';
  const light = '#d9b98a';
  return (
    ellipse(2, 0, 18, 3, '#1d1915', 'stroke="none" opacity="0.28"') +
    pathEl('M -14 -18 Q -22 -26 -18 -32', 'none', `stroke="${INK}" stroke-width="3.4" stroke-linecap="round"`) +
    limb(-10, -14, -12, -1, darken(fur, 0.15), 4) +
    limb(-5, -14, -5, -1, fur, 4) +
    ellipse(-1, -17, 15, 7, fur, STROKE) +
    ellipse(0, -14, 8, 3, light, NONE) +
    limb(7, -13, 8, -1, darken(fur, 0.15), 4) +
    limb(11, -14, 12, -1, fur, 4) +
    ellipse(16, -24, 7, 6, fur, STROKE) +
    pathEl('M 11 -29 Q 9 -22 13 -20 Z', darken(fur, 0.3), THIN) +
    pathEl('M 20 -25 L 27 -23 L 26 -19 L 20 -19 Z', light, STROKE) +
    circle(26.5, -23, 1.3, INK, NONE) +
    circle(18, -26, 1.2, INK, NONE) +
    rect(6, -21, 5, 2.4, '#b5432f', THIN)
  );
}

/** How tall an enemy stands at scale 1, for where its bar goes. */
export function enemyHeight(kind: string): number {
  if (kind === 'rad_hound') return 40;
  if (kind === 'mire_stalker') return 28;
  if (kind === 'scrap_drone') return 52;
  if (kind === 'scrapbot_sentry') return 54;
  if (kind === 'the_shepherd') return 92;
  if (kind === 'the_switchman') return 76;
  if (kind === 'old_mother') return 40;
  if (kind === 'the_snapper') return 40;
  if (kind === 'the_lookout') return 64 + MAST;
  if (kind === 'the_warden') return 60;
  if (kind === 'the_bog_king') return 30;
  if (kind === 'bravo_six') return 62;
  return 64;
}

/** An enemy, facing right like everyone else here, and how big it's drawn. */
export function enemyBody(kind: string, type: string, seed: string): { svg: string; scale: number; held: string } {
  if (kind === 'rad_hound') return { svg: radHound(seed), scale: 0.86, held: 'none' };
  if (kind === 'mire_stalker') return { svg: mireStalker(), scale: 0.8, held: 'none' };
  if (kind === 'scrap_drone') return { svg: scrapDrone(), scale: 1, held: 'zapper' };
  if (kind === 'scrapbot_sentry') return { svg: sentryBot(), scale: 1.08, held: 'turret' };
  if (kind === 'the_shepherd') return { svg: shepherd(), scale: 1.12, held: 'claws' };
  // The elites (3.12.0).
  if (kind === 'the_switchman') return { svg: switchman(), scale: 1.05, held: 'pipe' };
  if (kind === 'old_mother') return { svg: oldMother(), scale: 1.28, held: 'none' };
  if (kind === 'the_snapper') return { svg: snapper(), scale: 1.15, held: 'none' };
  if (kind === 'the_warden') return { svg: warden(), scale: 1.12, held: 'turret' };
  if (kind === 'the_bog_king') return { svg: bogKing(), scale: 1.2, held: 'none' };
  if (kind === 'bravo_six') return { svg: bravoSix(), scale: 1.1, held: 'turret' };
  const elite = elitePerson(kind, seed);
  if (elite) {
    const person = personSvg(elite.body);
    if (kind === 'the_lookout') return { svg: mast() + `<g transform="translate(0 -${MAST})">${person}</g>`, scale: elite.scale, held: elite.body.held };
    return { svg: person, scale: elite.scale, held: elite.body.held };
  }
  const made = type === 'hollow' ? hollow(kind, seed) : raider(kind, seed);
  return { svg: personSvg(made.body), scale: made.scale, held: made.body.held };
}

/** Where an enemy's shot comes from, facing right. */
export function enemyMuzzle(kind: string, held: string): [number, number] {
  if (kind === 'scrap_drone') return [7, -23];
  if (kind === 'scrapbot_sentry') return [26, -36];
  if (kind === 'the_warden') return [33, -47];
  if (kind === 'bravo_six') return [43, -40];
  if (kind === 'the_lookout') {
    const [x, y] = muzzle(held);
    return [x, y - MAST];
  }
  return muzzle(held);
}

