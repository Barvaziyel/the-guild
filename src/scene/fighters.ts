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
type Held = WeaponLook | 'maul' | 'spiked_bat' | 'claws' | 'none';

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
  armor?: { kind: 'vest' | 'riot' | 'hazmat' | 'leather' | 'signs' | 'feathers'; color: string };
  hat?: 'beanie' | 'bandana' | 'goggles' | 'helmet' | 'hood' | 'mask' | 'mohawk';
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
    case 'none':
      return '';
  }
}

function head(b: Body): string {
  const cx = 2;
  const cy = -55;
  const r = 7.6;
  let out = '';
  if (b.hat === 'hood') out += pathEl(`M ${cx - 10} ${cy + 9} Q ${cx - 11} ${cy - 11} ${cx + 1} ${cy - 11} Q ${cx + 11} ${cy - 10} ${cx + 9} ${cy + 3} L ${cx + 4} ${cy + 9} Z`, b.accent, STROKE);
  if (b.longHair && !b.bald && b.hat !== 'hood') out += rect(cx - 9, cy - 3, 9, 13, b.hair, THIN);
  out += rect(cx - 2.5, cy + 5, 5, 5, b.skin, THIN);
  out += circle(cx, cy, r, b.skin, STROKE);
  // Hair: a cap over the back of the head.
  if (!b.bald && b.hat !== 'hood' && b.hat !== 'helmet' && b.hat !== 'mohawk') {
    out += pathEl(`M ${cx - r} ${cy + 2} A ${r} ${r} 0 0 1 ${cx + r - 0.5} ${cy - 2.5} Q ${cx + 1} ${cy - 5} ${cx - 3} ${cy - 1} Q ${cx - 4} ${cy + 3} ${cx - r} ${cy + 2} Z`, b.hair, THIN);
  }
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
    if (a.kind === 'feathers') {
      for (let k = 0; k < 6; k++) out += poly([[-w + 1 + k * 3.4, -46], [-w + 3.4 + k * 3.4, -46], [-w + 1.2 + k * 3.4, -40 + (k % 2) * 2]], '#1d1b1a', THIN);
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
  if (!long) upper += weapon(b.held, front, back);
  upper += limb(5 * b.build, -45, front[0], front[1], b.cloth) + circle(front[0], front[1], 2.6, b.skin, THIN);
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
    case 'raider_enforcer':
      return { body: { ...base, hat: 'helmet', accent: '#6b7272', held: 'maul', cloth: '#4a3f36', build: 1.35, armor: { kind: 'signs', color: '#e0b13a' } }, scale: 1.22 };
    case 'vulture_shot':
      return { body: { ...base, hat: 'hood', accent: '#25221f', cloth: '#2f2b28', held: 'rifle', armor: { kind: 'feathers', color: '#1d1b1a' } }, scale: 1 };
    case 'vulture_lieutenant':
      return { body: { ...base, hat: 'hood', accent: '#3a1f1a', cloth: '#2a2522', held: 'blade', build: 1.15, armor: { kind: 'feathers', color: '#1d1b1a' } }, scale: 1.1 };
    default:
      // vulture_scav, and any raider without a drawing of its own.
      return kind.startsWith('vulture_')
        ? { body: { ...base, cloth: '#33302c', accent: '#25221f', held: 'blade', hat: 'bandana', armor: { kind: 'feathers', color: '#1d1b1a' } }, scale: 1 }
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

/** Every enemy with a drawing of its own; a test fails when one in the game has none. */
export const DRAWN_ENEMIES: readonly string[] = [
  'raider_scav',
  'raider_gunner',
  'raider_brute',
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
  return 64;
}

/** An enemy, facing right like everyone else here, and how big it's drawn. */
export function enemyBody(kind: string, type: string, seed: string): { svg: string; scale: number; held: string } {
  if (kind === 'rad_hound') return { svg: radHound(seed), scale: 0.86, held: 'none' };
  if (kind === 'mire_stalker') return { svg: mireStalker(), scale: 0.8, held: 'none' };
  if (kind === 'scrap_drone') return { svg: scrapDrone(), scale: 1, held: 'zapper' };
  if (kind === 'scrapbot_sentry') return { svg: sentryBot(), scale: 1.08, held: 'turret' };
  const made = type === 'hollow' ? hollow(kind, seed) : raider(kind, seed);
  return { svg: personSvg(made.body), scale: made.scale, held: made.body.held };
}

/** Where an enemy's shot comes from, facing right. */
export function enemyMuzzle(kind: string, held: string): [number, number] {
  if (kind === 'scrap_drone') return [7, -23];
  if (kind === 'scrapbot_sentry') return [26, -36];
  return muzzle(held);
}

