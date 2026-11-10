/**
 * What a survivor's history looks like on their face: scars, wounds,
 * sickness and strain.
 */
import { CX, EYE_Y, d, eyeDx, facePath, path, type FaceShape } from './face.ts';
import { BLOOD, BONE, INK, lighten, type SkinTone } from './palette.ts';

const line = (width: number, color = INK, extra = ''): string => `fill="none" stroke="${color}" stroke-width="${width}" ${extra}`;

/** Over one eye, with straps. `side` is -1 (left of the picture) or 1. */
export function eyepatch(f: FaceShape, side: number): string {
  const x = CX + side * eyeDx(f);
  return (
    path(d`M${x - side * 8},${EYE_Y - 8} L${CX - side * (f.w - 6)},${f.top + 22} M${x + side * 10},${EYE_Y - 3} L${CX + side * (f.w + 1)},${EYE_Y - 8}`, line(2.8)) +
    path(
      d`M${x - 11.5},${EYE_Y - 7} Q${x},${EYE_Y - 12} ${x + 11.5},${EYE_Y - 7} L${x + 9.5},${EYE_Y + 7} Q${x},${EYE_Y + 13} ${x - 9.5},${EYE_Y + 7} Z`,
      `fill="#2f2a27" stroke="${INK}" stroke-width="2.2"`,
    )
  );
}

/** A long healed cut down one cheek. */
export function faceScar(f: FaceShape, skin: SkinTone, side: number): string {
  const x0 = CX + side * (eyeDx(f) + 2);
  const y0 = EYE_Y + 10;
  const x1 = x0 + side * 9;
  const y1 = y0 + 27;
  let stitches = '';
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    stitches += d`M${x - side * 4},${y + 1.5} L${x + side * 4},${y - 1.5} `;
  }
  return (
    path(d`M${x0},${y0} L${x1},${y1}`, line(4, lighten(skin.lip, 0.25))) +
    path(d`M${x0},${y0} L${x1},${y1}`, line(1.3)) +
    path(stitches.trim(), line(1.2))
  );
}

/** Burned skin over one side of the face. Clip this to the face. */
export function burns(f: FaceShape, side: number): string {
  const s = side;
  return (
    path(
      d`M${CX + s * (f.w + 4)},92 Q${CX + s * 22},98 ${CX + s * 25},122 Q${CX + s * 13},140 ${CX + s * (f.jaw - 12)},${f.chinY - 2} L${CX + s * (f.w + 6)},${f.chinY} Z`,
      `fill="#a4523c" opacity="0.4"`,
    ) +
    path(
      d`M${CX + s * (f.w - 6)},104 q${-s * 6},6 ${-s * 1},12 M${CX + s * (f.w - 12)},128 q${-s * 7},5 ${-s * 3},12 M${CX + s * (f.jaw - 4)},146 q${-s * 6},3 ${-s * 5},9`,
      line(1.3, '#6e2f22', 'opacity="0.7"'),
    )
  );
}

/** Crossed plasters on a cheek: hurt, but walking. */
export function plaster(f: FaceShape, side: number): string {
  const x = CX - side * (eyeDx(f) + 3);
  const y = EYE_Y + 21;
  const strip = (angle: number): string =>
    `<rect x="${x - 9}" y="${y - 3}" width="18" height="6" rx="2" transform="rotate(${angle} ${x} ${y})" fill="${BONE}" stroke="${INK}" stroke-width="1.4"/>`;
  return strip(28) + strip(-28);
}

/** A bandage wound round the head, with blood showing through. */
export function headBandage(f: FaceShape, side: number): string {
  const top = f.top + 20;
  return (
    path(
      d`M${CX - f.w - 3},${top + 12} Q${CX},${top - 4} ${CX + f.w + 3},${top + 12} L${CX + f.w + 3},${top + 26} Q${CX},${top + 10} ${CX - f.w - 3},${top + 26} Z`,
      `fill="${BONE}" stroke="${INK}" stroke-width="2.4"`,
    ) +
    path(d`M${CX - f.w + 4},${top + 16} Q${CX},${top + 3} ${CX + f.w - 6},${top + 19}`, line(1.2, INK, 'opacity="0.45"')) +
    `<ellipse cx="${CX + side * 22}" cy="${top + 11}" rx="8" ry="5.5" fill="${BLOOD}" opacity="0.75"/>`
  );
}

/** A sickly tint. Clip this to the face. */
export function sickTint(f: FaceShape): string {
  return path(facePath(f), `fill="#8aa04e" opacity="0.2"`);
}

/** Dark hollows round the eyes: the look of someone who has seen too much. */
export function sockets(f: FaceShape): string {
  let out = '';
  for (const s of [-1, 1]) {
    out += `<ellipse cx="${CX + s * eyeDx(f)}" cy="${EYE_Y + 1}" rx="13" ry="10" fill="${INK}" opacity="0.17"/>`;
  }
  return out;
}

/** Bags under the eyes: tired, grieving or strained. */
export function eyeBags(f: FaceShape, skip = 0): string {
  let out = '';
  for (const s of [-1, 1]) {
    if (s === skip) continue;
    const x = CX + s * eyeDx(f);
    out += path(d`M${x - 8},${EYE_Y + 6.5} Q${x},${EYE_Y + 12} ${x + 8},${EYE_Y + 6.5}`, line(1.5, INK, 'opacity="0.55"'));
    out += path(d`M${x - 8},${EYE_Y + 6.5} Q${x},${EYE_Y + 12} ${x + 8},${EYE_Y + 6.5} Q${x},${EYE_Y + 7} ${x - 8},${EYE_Y + 6.5} Z`, `fill="${INK}" opacity="0.14"`);
  }
  return out;
}

/** Sweat and a knotted brow: close to breaking. */
export function strain(f: FaceShape, side: number): string {
  const drop = (x: number, y: number): string =>
    path(d`M${x},${y} q-4.5,8 0,11.5 q4.5,-3.5 0,-11.5 Z`, `fill="#c4d9db" stroke="${INK}" stroke-width="1.2"`);
  return (
    path(d`M${CX - 3},93 l-1.5,6.5 M${CX + 3},93 l1.5,6.5`, line(1.4, INK, 'opacity="0.6"')) +
    drop(CX + side * (f.w - 9), f.top + 30) +
    drop(CX - side * (f.w - 13), EYE_Y + 16)
  );
}
