/**
 * Hair styles. Each style is split into three layers:
 *   back  - behind the head and body (long hair, ponytails)
 *   top   - on the skull, over the forehead (hidden by hats and hoods)
 *   front - locks and braids that fall in front of the shoulders
 */
import { CX, d, path, type FaceShape } from './face.ts';
import { INK, type HairColor } from './palette.ts';

export interface HairLayers {
  back: string;
  top: string;
  front: string;
}

export const HAIR_STYLES = [
  'bald',
  'buzz',
  'messy',
  'side part',
  'mohawk',
  'long',
  'ponytail',
  'bun',
  'braids',
  'afro',
  'locks',
  'undercut',
  'bob',
  'wild',
] as const;

export const HAIR_COUNT = HAIR_STYLES.length;

type Rand = () => number;
type Hairline = 'round' | 'high' | 'part' | 'bangs' | 'center';

/** The smooth outer edge of hair over the skull, from the left temple over the top to the right. */
function capOuter(f: FaceShape, grow = 4, lift = 7): string {
  const W = f.w + grow;
  const T = f.top - lift;
  return d`M${CX - W},102 C${CX - W},${T + 12} ${CX - W * 0.62},${T} ${CX},${T} C${CX + W * 0.62},${T} ${CX + W},${T + 12} ${CX + W},102`;
}

/** A jagged outer edge, for messy hair. */
function spikyOuter(f: FaceShape, rnd: Rand, grow: number, lift: number, amp: number, points = 13): string {
  const rx = f.w + grow;
  const ry = 100 - (f.top - lift);
  let out = d`M${CX - rx},102`;
  for (let i = 0; i <= points; i++) {
    const a = Math.PI + (Math.PI * i) / points;
    const k = i % 2 === 0 ? 1 : 1 + amp * (0.6 + rnd() * 0.8);
    out += d` L${CX + Math.cos(a) * rx * k},${100 + Math.sin(a) * ry * k}`;
  }
  return out + d` L${CX + rx},102`;
}

/** A bumpy outer edge, for curls. */
function scallopOuter(cx: number, cy: number, r: number, from: number, to: number, bumps: number): string {
  let out = '';
  for (let i = 0; i <= bumps; i++) {
    const a = from + ((to - from) * i) / bumps;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) {
      out += d`M${x},${y}`;
    } else {
      const mid = from + ((to - from) * (i - 0.5)) / bumps;
      out += d` Q${cx + Math.cos(mid) * (r + 9)},${cy + Math.sin(mid) * (r + 9)} ${x},${y}`;
    }
  }
  return out;
}

/** The edge of the hair across the forehead, drawn right to left, closing the shape. */
function hairline(f: FaceShape, kind: Hairline): string {
  const r = CX + f.w - 2;
  const l = CX - f.w + 2;
  switch (kind) {
    case 'high':
      return d` L${r},98 Q${r - 4},76 ${CX + 16},69 Q${CX},64 ${CX - 16},69 Q${l + 4},76 ${l},98 Z`;
    case 'part':
      return d` L${r},100 Q${r - 1},84 ${CX + 17},73 Q${CX - 4},76 ${l + 7},93 L${l},100 Z`;
    case 'bangs':
      return d` L${r},100 L${r - 1},90 Q${CX + 12},85 ${CX},88 Q${CX - 12},85 ${l + 1},90 L${l},100 Z`;
    case 'center':
      return d` L${r},100 Q${r - 3},82 ${CX + 1},69 Q${l + 3},82 ${l},100 Z`;
    default:
      return d` L${r},100 Q${r - 2},82 ${CX + 18},76 Q${CX},71 ${CX - 18},76 Q${l + 2},82 ${l},100 Z`;
  }
}

/** A few darker strokes so the hair doesn't look like a flat helmet. */
function strands(f: FaceShape, hair: HairColor, sweep: number): string {
  const T = f.top - 7;
  return path(
    d`M${CX - 16},${T + 5} Q${CX - 24 + sweep},${T + 13} ${CX - 28 + sweep},${T + 24} M${CX + 2},${T + 3} Q${CX + 2 + sweep},${T + 10} ${CX + 4 + sweep},${T + 17} M${CX + 18},${T + 6} Q${CX + 26 + sweep},${T + 14} ${CX + 30 + sweep},${T + 26}`,
    `fill="none" stroke="${hair.dark}" stroke-width="1.6" opacity="0.7"`,
  );
}

export function hair(style: number, f: FaceShape, color: HairColor, rnd: Rand): HairLayers {
  const fill = `fill="${color.base}" stroke="${INK}" stroke-width="2.6"`;
  const W = f.w + 4;
  const T = f.top - 7;
  const none: HairLayers = { back: '', top: '', front: '' };
  const shade = (opacity: number): string =>
    path(capOuter(f, 1.5, 2.5) + hairline(f, 'round'), `fill="${color.base}" opacity="${opacity}"`);
  const longBack = (bottom: number, flare: number): string =>
    path(
      d`M${CX - W - 3},100 C${CX - W - 6},${T + 2} ${CX + W + 6},${T + 2} ${CX + W + 3},100 L${CX + W + flare},${bottom} Q${CX + W - 4},${bottom + 12} ${CX + W - 16},${bottom + 2} L${CX - W + 16},${bottom + 2} Q${CX - W + 4},${bottom + 12} ${CX - W - flare},${bottom} Z`,
      fill,
    );
  const sideLocks = (bottom: number): string => {
    let out = '';
    for (const s of [-1, 1]) {
      const x = CX + s * f.w;
      out += path(
        d`M${x - s * 7},98 Q${x + s * 12},132 ${x + s * 9},${bottom - 6} Q${x + s * 4},${bottom + 6} ${x - s * 6},${bottom - 2} Q${x - s * 1},150 ${x - s * 6},116 Z`,
        fill,
      );
    }
    return out;
  };

  switch (HAIR_STYLES[style % HAIR_COUNT]) {
    case 'bald':
      return none;

    case 'buzz':
      return { ...none, top: shade(0.55) };

    case 'messy':
      return { ...none, top: path(spikyOuter(f, rnd, 4, 8, 0.12) + hairline(f, 'round'), fill) + strands(f, color, 0) };

    case 'side part':
      return { ...none, top: path(capOuter(f) + hairline(f, 'part'), fill) + strands(f, color, -6) };

    case 'mohawk':
      return {
        ...none,
        top:
          shade(0.3) +
          path(
            d`M${CX - 11},82 L${CX - 13},${T + 2} L${CX - 8},${T + 8} L${CX - 6},${T - 13} L${CX - 1},${T + 1} L${CX + 2},${T - 17} L${CX + 6},${T + 1} L${CX + 10},${T - 10} L${CX + 11},${T + 8} L${CX + 14},${T + 3} L${CX + 11},82 Q${CX},77 ${CX - 11},82 Z`,
            fill,
          ),
      };

    case 'long':
      return {
        back: longBack(196, 9),
        top: path(capOuter(f) + hairline(f, 'center'), fill) + strands(f, color, 0),
        front: sideLocks(186),
      };

    case 'ponytail':
      return {
        back: path(
          d`M${CX + W - 8},${T + 16} Q${CX + W + 24},${T + 14} ${CX + W + 21},108 Q${CX + W + 24},142 ${CX + W + 8},164 Q${CX + W + 11},124 ${CX + W - 6},102 Z`,
          fill,
        ),
        top: path(capOuter(f) + hairline(f, 'high'), fill) + strands(f, color, 5),
        front: '',
      };

    case 'bun':
      return {
        back: `<circle cx="${CX}" cy="${T - 5}" r="13.5" ${fill}/>` + path(d`M${CX - 7},${T - 9} Q${CX},${T - 14} ${CX + 7},${T - 9}`, `fill="none" stroke="${color.dark}" stroke-width="1.6" opacity="0.7"`),
        top: path(capOuter(f) + hairline(f, 'high'), fill) + strands(f, color, 0),
        front: '',
      };

    case 'braids': {
      let braids = '';
      for (const s of [-1, 1]) {
        const x = CX + s * (f.w + 2);
        for (let i = 0; i < 6; i++) {
          braids += `<ellipse cx="${x + (i % 2 === 0 ? -1.5 : 1.5) * s}" cy="${120 + i * 13}" rx="6.5" ry="8" ${fill}/>`;
        }
        braids += `<rect x="${x - 5}" y="${120 + 6 * 13 - 6}" width="10" height="5" rx="2" fill="#a8603f" stroke="${INK}" stroke-width="1.6"/>`;
      }
      return { back: '', top: path(capOuter(f) + hairline(f, 'center'), fill) + strands(f, color, 0), front: braids };
    }

    case 'afro':
      return {
        back: path(scallopOuter(CX, 90, W + 15, 0, Math.PI * 2, 16) + ' Z', fill),
        top: path(scallopOuter(CX, 100, W + 1, Math.PI, Math.PI * 2, 8) + hairline(f, 'round'), `fill="${color.base}"`),
        front: '',
      };

    case 'locks': {
      let locks = '';
      for (const s of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          const x = CX + s * (f.w - 5 + i * 7);
          const bottom = 168 + rnd() * 26 - i * 6;
          locks += path(d`M${x - 3.5},${96 + i * 3} L${x - 3.5 + s * 2},${bottom} Q${x + s * 2},${bottom + 5} ${x + 3.5 + s * 2},${bottom} L${x + 3.5},${96 + i * 3} Z`, fill);
        }
      }
      return { back: longBack(180, 6), top: path(capOuter(f, 5, 8) + hairline(f, 'round'), fill) + strands(f, color, 0), front: locks };
    }

    case 'undercut':
      return {
        ...none,
        top:
          shade(0.3) +
          path(
            d`M${CX - W + 6},86 C${CX - W + 4},${T + 6} ${CX - 10},${T - 2} ${CX + 8},${T} C${CX + W - 10},${T + 2} ${CX + W - 2},${T + 16} ${CX + W - 5},88 Q${CX + 10},70 ${CX - 8},80 Q${CX - 22},92 ${CX - f.w + 7},107 Q${CX - W},97 ${CX - W + 6},86 Z`,
            fill,
          ) +
          strands(f, color, -8),
      };

    case 'bob':
      return {
        back: longBack(f.chinY - 6, 10),
        top: path(capOuter(f) + hairline(f, 'bangs'), fill) + strands(f, color, 0),
        front: sideLocks(f.chinY - 8),
      };

    default: // wild
      return {
        back: path(
          d`M${CX - W - 4},98 L${CX - W - 16},120 L${CX - W - 7},128 L${CX - W - 19},152 L${CX - W - 6},156 L${CX - W - 14},182 L${CX - W + 8},176 L${CX + W - 8},176 L${CX + W + 14},182 L${CX + W + 6},156 L${CX + W + 19},152 L${CX + W + 7},128 L${CX + W + 16},120 L${CX + W + 4},98 Z`,
          fill,
        ),
        top: path(spikyOuter(f, rnd, 6, 10, 0.2, 15) + hairline(f, 'round'), fill) + strands(f, color, 3),
        front: '',
      };
  }
}
