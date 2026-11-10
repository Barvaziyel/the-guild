/**
 * The head and its features. Everything is drawn on a 256 x 256 canvas with
 * the face centered on x = 128. Each function returns an SVG fragment.
 */
import { BONE, INK, darken, type HairColor, type SkinTone } from './palette.ts';

export const CX = 128;
/** Eye line. */
export const EYE_Y = 110;

export interface FaceShape {
  name: string;
  /** Half-width at the temples. */
  w: number;
  /** Half-width at the jaw. */
  jaw: number;
  /** Half-width of the chin. */
  chin: number;
  chinY: number;
  /** Top of the skull. */
  top: number;
}

export const FACES: readonly FaceShape[] = [
  { name: 'oval', w: 42, jaw: 34, chin: 14, chinY: 168, top: 54 },
  { name: 'round', w: 45, jaw: 40, chin: 18, chinY: 164, top: 56 },
  { name: 'square', w: 43, jaw: 41, chin: 22, chinY: 166, top: 55 },
  { name: 'long', w: 39, jaw: 32, chin: 13, chinY: 174, top: 52 },
  { name: 'heart', w: 44, jaw: 31, chin: 10, chinY: 168, top: 54 },
  { name: 'strong', w: 42, jaw: 40, chin: 18, chinY: 171, top: 54 },
  { name: 'narrow', w: 38, jaw: 30, chin: 12, chinY: 168, top: 54 },
  { name: 'soft', w: 46, jaw: 38, chin: 16, chinY: 165, top: 56 },
];

/** Round to one decimal to keep the SVG small. */
export function n(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** Build a path string from a template; numbers are rounded. */
export function d(strings: TemplateStringsArray, ...values: number[]): string {
  let out = '';
  strings.forEach((s, i) => {
    out += s;
    if (i < values.length) out += n(values[i]!);
  });
  return out;
}

export function path(dAttr: string, attrs: string): string {
  return `<path d="${dAttr}" ${attrs}/>`;
}

export const INK_LINE = `fill="none" stroke="${INK}"`;

export function mouthY(f: FaceShape): number {
  return f.chinY - 21;
}

export function eyeDx(f: FaceShape): number {
  return f.w * 0.42;
}

/** Outline of the head, used for the fill and for clipping overlays to the face. */
export function facePath(f: FaceShape): string {
  const { w, jaw, chin, chinY, top } = f;
  const ty = 102;
  return d`M${CX - w},${ty} C${CX - w},${top + 14} ${CX - w * 0.62},${top} ${CX},${top} C${CX + w * 0.62},${top} ${CX + w},${top + 14} ${CX + w},${ty} C${CX + w},${ty + 22} ${CX + jaw + 3},${ty + 34} ${CX + jaw},${ty + 42} C${CX + jaw - 5},${chinY - 8} ${CX + chin + 8},${chinY} ${CX + chin},${chinY} Q${CX},${chinY + 4} ${CX - chin},${chinY} C${CX - chin - 8},${chinY} ${CX - jaw + 5},${chinY - 8} ${CX - jaw},${ty + 42} C${CX - jaw - 3},${ty + 34} ${CX - w},${ty + 22} ${CX - w},${ty} Z`;
}

export function ears(f: FaceShape, skin: SkinTone): string {
  let out = '';
  for (const s of [-1, 1]) {
    const x = CX + s * (f.w + 1);
    out += `<ellipse cx="${n(x)}" cy="114" rx="7" ry="11" fill="${skin.base}" stroke="${INK}" stroke-width="2.5"/>`;
    out += path(d`M${x + s * 2},108 Q${x + s * 5},114 ${x + s * 1},119`, `${INK_LINE} stroke-width="1.4" opacity="0.6"`);
  }
  return out;
}

export function neck(f: FaceShape, skin: SkinTone, width: number): string {
  const hw = width / 2;
  const topY = f.chinY - 22;
  let out = path(
    d`M${CX - hw},${topY} L${CX - hw - 2},198 Q${CX},216 ${CX + hw + 2},198 L${CX + hw},${topY} Z`,
    `fill="${skin.shade}" stroke="${INK}" stroke-width="2.5"`,
  );
  // Shadow under the chin.
  out += path(
    d`M${CX - hw + 1},${f.chinY - 4} Q${CX},${f.chinY + 20} ${CX + hw - 1},${f.chinY - 4} Z`,
    `fill="${INK}" opacity="0.18"`,
  );
  return out;
}

export function head(f: FaceShape, skin: SkinTone): string {
  let out = path(facePath(f), `fill="${skin.base}" stroke="${INK}" stroke-width="3"`);
  // A soft shadow down one side of the face, journal-sketch style.
  out += path(
    d`M${CX + f.w - 2},92 C${CX + f.w - 12},116 ${CX + f.jaw - 10},140 ${CX + f.chin + 4},${f.chinY - 3} C${CX + f.jaw - 2},${f.chinY - 10} ${CX + f.jaw + 1},146 ${CX + f.w - 1},116 Z`,
    `fill="${skin.shade}" opacity="0.75"`,
  );
  return out;
}

// ---------------------------------------------------------------- eyes

export const EYE_COUNT = 6;

function oneEye(x: number, side: number, variant: number, iris: string): string {
  const y = EYE_Y;
  const white = `fill="${BONE}" stroke="${INK}" stroke-width="1.6"`;
  const lid = `${INK_LINE} stroke-width="2.6"`;
  const pupil = (r: number, dy = 0): string =>
    `<circle cx="${n(x)}" cy="${n(y + dy)}" r="${r}" fill="${iris}"/><circle cx="${n(x)}" cy="${n(y + dy)}" r="${n(r * 0.45)}" fill="${INK}"/>`;
  switch (variant) {
    case 1: // round
      return `<ellipse cx="${n(x)}" cy="${y}" rx="7" ry="5.6" ${white}/>${pupil(3.4)}` + path(d`M${x - 8},${y - 2} Q${x},${y - 9} ${x + 8},${y - 2}`, lid);
    case 2: // narrow
      return path(d`M${x - 9},${y} Q${x},${y - 5} ${x + 9},${y} Q${x},${y + 3.5} ${x - 9},${y} Z`, white) + pupil(2.6, -0.3) + path(d`M${x - 10},${y} Q${x},${y - 6} ${x + 10},${y}`, lid);
    case 3: // heavy-lidded, tired
      return (
        path(d`M${x - 8},${y} Q${x},${y - 5} ${x + 8},${y} Q${x},${y + 5} ${x - 8},${y} Z`, white) +
        pupil(3, 0.4) +
        path(d`M${x - 9.5},${y - 1} Q${x},${y - 4.5} ${x + 9.5},${y - 1}`, `${INK_LINE} stroke-width="3.2"`) +
        path(d`M${x - 7},${y + 7} Q${x},${y + 10} ${x + 7},${y + 7}`, `${INK_LINE} stroke-width="1.3" opacity="0.55"`)
      );
    case 4: // lashes
      return (
        path(d`M${x - 8.5},${y} Q${x},${y - 7.5} ${x + 8.5},${y} Q${x},${y + 5} ${x - 8.5},${y} Z`, white) +
        pupil(3.3) +
        path(d`M${x - 9.5},${y} Q${x},${y - 9} ${x + 9.5},${y}`, lid) +
        path(d`M${x + side * 9},${y - 1} L${x + side * 13},${y - 4} M${x + side * 7},${y - 4} L${x + side * 10},${y - 8}`, `${INK_LINE} stroke-width="1.6"`)
      );
    case 5: // simple ink dots
      return `<ellipse cx="${n(x)}" cy="${y}" rx="3.2" ry="4.4" fill="${INK}"/><circle cx="${n(x - 1)}" cy="${y - 1.4}" r="1" fill="${BONE}"/>` + path(d`M${x - 7},${y - 6} Q${x},${y - 9} ${x + 7},${y - 6}`, `${INK_LINE} stroke-width="1.4" opacity="0.6"`);
    default: // almond
      return path(d`M${x - 8.5},${y} Q${x},${y - 7} ${x + 8.5},${y} Q${x},${y + 5} ${x - 8.5},${y} Z`, white) + pupil(3.2, -0.3) + path(d`M${x - 9.5},${y} Q${x},${y - 8.5} ${x + 9.5},${y}`, lid);
  }
}

/** Both eyes. `skip` leaves one out (-1 left, 1 right) for an eyepatch. */
export function eyes(f: FaceShape, variant: number, iris: string, skip = 0): string {
  let out = '';
  for (const s of [-1, 1]) {
    if (s === skip) continue;
    out += oneEye(CX + s * eyeDx(f), s, variant, iris);
  }
  return out;
}

// ---------------------------------------------------------------- brows

export const BROW_COUNT = 6;

export function brows(f: FaceShape, variant: number, hair: HairColor, skip = 0): string {
  const color = darken(hair.dark, 0.25);
  let out = '';
  for (const s of [-1, 1]) {
    if (s === skip) continue;
    const x = CX + s * eyeDx(f);
    const inner = x - s * 9;
    const outer = x + s * 10.5;
    const line = (dAttr: string, width: number): string =>
      path(dAttr, `fill="none" stroke="${color}" stroke-width="${width}"`);
    switch (variant) {
      case 1:
        out += line(d`M${inner},99 Q${x},91 ${outer},98`, 3.4);
        break;
      case 2:
        out += line(d`M${inner},101.5 L${outer},95`, 3.8);
        break;
      case 3:
        out += line(d`M${inner},95 Q${x},95 ${outer},100`, 3.4);
        break;
      case 4:
        out += line(d`M${inner},98.5 L${outer},96.5`, 5.4);
        break;
      case 5:
        out += line(d`M${inner},98 Q${x},89.5 ${outer},97`, 2);
        break;
      default:
        out += line(d`M${inner},98.5 Q${x},95.5 ${outer},97.5`, 3.4);
    }
  }
  return out;
}

// ---------------------------------------------------------------- nose

export const NOSE_COUNT = 5;

export function nose(variant: number): string {
  const line = `${INK_LINE} stroke-width="2.2"`;
  const soft = `${INK_LINE} stroke-width="1.4" opacity="0.5"`;
  switch (variant) {
    case 1:
      return path('M122.5,128 Q128,134.5 133.5,128', line);
    case 2:
      return path('M129,107 L123.5,131 Q128,136.5 134,131.5', line);
    case 3:
      return path('M120.5,128 Q123.5,134.5 128,131.5 Q132.5,134.5 135.5,128', line) + path('M129,112 L127.5,123', soft);
    case 4:
      return path('M127,109 Q135,121 126,131 Q130,135.5 134.5,131', line);
    default:
      return path('M128.5,112 L124,130 Q128,134.5 133,130.5', line);
  }
}

// ---------------------------------------------------------------- mouth

export const MOUTH_COUNT = 6;

export function mouth(f: FaceShape, variant: number, skin: SkinTone): string {
  const y = mouthY(f);
  const line = `${INK_LINE} stroke-width="2.4"`;
  switch (variant) {
    case 1:
      return path(d`M116,${y - 1} Q128,${y + 7} 140,${y - 1}`, line);
    case 2:
      return path(d`M117,${y + 3} Q128,${y - 3} 139,${y + 3}`, line);
    case 3:
      return path(d`M118,${y + 1} Q131,${y + 4} 140,${y - 3}`, line);
    case 4:
      return (
        path(d`M116.5,${y} Q123,${y - 4.5} 128,${y - 2} Q133,${y - 4.5} 139.5,${y} Q128,${y + 8} 116.5,${y} Z`, `fill="${skin.lip}" stroke="${INK}" stroke-width="1.6"`) +
        path(d`M118,${y} Q128,${y + 2} 138,${y}`, `${INK_LINE} stroke-width="1.4"`)
      );
    case 5:
      return (
        path(d`M118,${y - 2.5} Q128,${y - 4} 138,${y - 2.5} L137,${y + 3} Q128,${y + 4.5} 119,${y + 3} Z`, `fill="${BONE}" stroke="${INK}" stroke-width="1.8"`) +
        path(d`M123,${y - 3} L123,${y + 3.5} M128,${y - 3.5} L128,${y + 4} M133,${y - 3} L133,${y + 3.5}`, `${INK_LINE} stroke-width="1"`)
      );
    default:
      return path(d`M118,${y} Q128,${y + 2} 138,${y}`, line) + path(d`M123,${y + 6} Q128,${y + 7.5} 133,${y + 6}`, `${INK_LINE} stroke-width="1.2" opacity="0.45"`);
  }
}

// ---------------------------------------------------------------- facial hair

export const FACIAL_HAIR_COUNT = 7;

/** 0 none, 1 stubble, 2 mustache, 3 goatee, 4 full beard, 5 long beard, 6 chops. */
export function facialHair(f: FaceShape, variant: number, hair: HairColor): string {
  const y = mouthY(f);
  const { w, jaw, chin, chinY } = f;
  const fill = `fill="${hair.base}" stroke="${INK}" stroke-width="2.2"`;
  const mustache = path(
    d`M111,${y - 4.5} Q119,${y - 10.5} 128,${y - 6.5} Q137,${y - 10.5} 145,${y - 4.5} Q137,${y - 0.5} 128,${y - 3} Q119,${y - 0.5} 111,${y - 4.5} Z`,
    fill,
  );
  const beard = (drop: number): string =>
    path(
      d`M${CX - w + 1},116 L${CX - w + 9},121 Q${CX - jaw + 9},${y - 8} ${CX - 13},${y - 7} Q${CX},${y - 10.5} ${CX + 13},${y - 7} Q${CX + jaw - 9},${y - 8} ${CX + w - 9},121 L${CX + w - 1},116 C${CX + w},142 ${CX + jaw + 3},${chinY} ${CX + chin + 7},${chinY + 8 + drop * 0.5} Q${CX},${chinY + 13 + drop} ${CX - chin - 7},${chinY + 8 + drop * 0.5} C${CX - jaw - 3},${chinY} ${CX - w},142 ${CX - w + 1},116 Z`,
      fill,
    ) +
    path(
      d`M${CX - 12},${chinY - 2} Q${CX - 9},${chinY + 6 + drop * 0.6} ${CX - 6},${chinY + 9 + drop * 0.8} M${CX + 4},${chinY} Q${CX + 6},${chinY + 6 + drop * 0.6} ${CX + 5},${chinY + 10 + drop * 0.8} M${CX + 16},${chinY - 4} Q${CX + 15},${chinY + 2} ${CX + 12},${chinY + 6 + drop * 0.4}`,
      `fill="none" stroke="${hair.dark}" stroke-width="1.4" opacity="0.7"`,
    );
  switch (variant) {
    case 1:
      // Stubble: a shadow along the jaw. Clipped to the face by the composer.
      return path(
        d`M${CX - w - 2},128 Q${CX - jaw + 6},${y - 4} ${CX - 14},${y - 8} Q${CX},${y - 11} ${CX + 14},${y - 8} Q${CX + jaw - 6},${y - 4} ${CX + w + 2},128 L${CX + w + 2},${chinY + 8} L${CX - w - 2},${chinY + 8} Z`,
        `fill="${INK}" opacity="0.17"`,
      );
    case 2:
      return mustache;
    case 3:
      return (
        mustache +
        path(d`M119,${y + 6} Q128,${y + 3.5} 137,${y + 6} L135,${chinY + 3} Q128,${chinY + 8} 121,${chinY + 3} Z`, fill)
      );
    case 4:
      return beard(0);
    case 5:
      return beard(24);
    case 6: {
      let out = '';
      for (const s of [-1, 1]) {
        out += path(
          d`M${CX + s * (w - 1)},114 L${CX + s * (w - 10)},120 Q${CX + s * (jaw - 12)},${y - 2} ${CX + s * (jaw - 14)},${y + 8} Q${CX + s * (jaw - 4)},${chinY - 6} ${CX + s * (jaw + 1)},146 Q${CX + s * (w + 1)},132 ${CX + s * (w - 1)},114 Z`,
          fill,
        );
      }
      return out;
    }
    default:
      return '';
  }
}

/** Lines that come with age. */
export function wrinkles(f: FaceShape): string {
  const y = mouthY(f);
  const soft = `${INK_LINE} stroke-width="1.2" opacity="0.4"`;
  return (
    path(d`M${CX - 16},80 Q${CX},77 ${CX + 16},80 M${CX - 12},86 Q${CX},84 ${CX + 12},86`, soft) +
    path(d`M${CX - 11},${y - 12} Q${CX - 16},${y - 4} ${CX - 14},${y + 3} M${CX + 11},${y - 12} Q${CX + 16},${y - 4} ${CX + 14},${y + 3}`, soft) +
    path(d`M${CX - eyeDx(f) - 11},${EYE_Y + 3} l-4,3 M${CX + eyeDx(f) + 11},${EYE_Y + 3} l4,3`, soft)
  );
}
