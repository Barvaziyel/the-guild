/**
 * Projects in the yard (§9.6), drawn by stages done. Each shows its work in
 * progress (stakes, scaffolding, a pile of materials) while a stage is under
 * way, and grows a piece with each stage finished.
 *   The Relay: a mast and a dish on the station house roof.
 *   The Clinic: an awning over the Infirmary's cots, and a flag.
 *   The Memorial Garden: a small plot between the Bunks and the fire.
 *   The Line: new track along the road, and a handcar on it.
 *   The Wall: drawn by `wallSections` in yard.ts, in place of the fence.
 */
import type { ProjectId } from '../engine/types.ts';
import { C, circle, ellipse, ink, line, pathEl, poly, rect } from './draw.ts';
import { H, W, Y } from './layout.ts';

export interface ProjectLook {
  /** Stages finished, 0 to 3. */
  done: number;
  /** A stage is under way. */
  working: boolean;
}

const FINE = ink(0.9);

/** A little scaffold: two poles and a crossbar, for a stage under way. */
function scaffold(x: number, base: number, h: number): string {
  return line(x, base, x, base - h, 1) + line(x + 10, base, x + 10, base - h, 1) + line(x - 2, base - h + 2, x + 12, base - h + 2, 1) + line(x, base - h / 2, x + 10, base - 4, 0.7);
}

/** A pile of planks or rails: what the next stage will be built from. */
function pile(x: number, base: number, color: string): string {
  return rect(x, base - 4, 22, 4, color, FINE) + rect(x + 3, base - 8, 18, 4, color, FINE) + rect(x + 6, base - 12, 12, 4, color, FINE);
}

export function relay({ done, working }: ProjectLook): string {
  if (done === 0 && !working) return '';
  const x = 72;
  const roof = 120;
  const heights = [0, 26, 44, 56];
  const top = roof - heights[done]!;
  let out = '';
  if (done > 0) {
    out += line(x - 6, roof, x, top, 1.4) + line(x + 6, roof, x, top, 1.4);
    for (let y = roof - 8; y > top + 2; y -= 8) out += line(x - 5 + ((roof - y) / (roof - top)) * 5, y, x + 5 - ((roof - y) / (roof - top)) * 5, y, 0.8);
  }
  if (done >= 2) out += ellipse(x + 9, top + 14, 7, 9, C.steel, `transform="rotate(-24 ${x + 9} ${top + 14})"`) + line(x + 9, top + 14, x + 3, top + 12, 1);
  if (done >= 3) out += line(x, top, x, top - 8, 1.2) + `<circle class="yard-blink" cx="${x}" cy="${top - 9}" r="1.8" fill="#d9544a"/>`;
  if (working) out += scaffold(x + 14, roof, 22 + done * 8);
  return out;
}

export function clinic({ done, working }: ProjectLook): string {
  if (done === 0 && !working) return '';
  const base = 338;
  let out = '';
  if (done >= 1 || working) for (const x of [306, 394]) out += line(x, base + 22, x, 324, 1.4);
  if (done >= 1) out += line(306, 324, 394, 324, 1.2);
  if (done >= 2) {
    // A striped awning over the cots.
    let d = 'M 302 322 L 398 322 L 398 330';
    for (let x = 398; x > 302; x -= 12) d += ` Q ${x - 6} 336 ${x - 12} 330`;
    out += pathEl(d + ' Z', C.canvas);
    for (let x = 314; x < 398; x += 24) out += rect(x, 322, 12, 8, '#b9a98a', 'stroke="none" opacity="0.7"');
  }
  if (done >= 3) out += line(394, 324, 394, 300, 1.2) + poly([[394, 300], [378, 305], [394, 310]], '#e9e2cf') + rect(385, 303.5, 5, 1.6, C.cross, 'stroke="none"') + rect(386.7, 301.8, 1.6, 5, C.cross, 'stroke="none"');
  if (working) out += pile(270, base + 2, '#c9c2b0');
  return out;
}

export function memorialGarden({ done, working }: ProjectLook): string {
  if (done === 0 && !working) return '';
  const cx = 170;
  const base = 336;
  let out = '';
  if (done >= 1) {
    out += ellipse(cx, base - 4, 30, 7, C.dirtDark, 'stroke="none" opacity="0.8"');
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      out += ellipse(cx + Math.cos(a) * 30, base - 4 + Math.sin(a) * 7, 3, 2, '#9c968a', FINE);
    }
  }
  if (done >= 2) {
    out += line(cx - 12, base - 4, cx - 12, base - 22, 2);
    out += circle(cx - 12, base - 28, 9, C.plant, FINE) + circle(cx - 18, base - 22, 6, C.plantDark, FINE) + circle(cx - 6, base - 22, 6, C.plant, FINE);
  }
  if (done >= 3) {
    out += pathEl(`M ${cx + 6} ${base - 2} L ${cx + 6} ${base - 18} Q ${cx + 13} ${base - 25} ${cx + 20} ${base - 18} L ${cx + 20} ${base - 2} Z`, '#a8a397');
    for (let i = 0; i < 3; i++) out += line(cx + 9, base - 16 + i * 4, cx + 17, base - 16 + i * 4, 0.6);
    for (const [x, c] of [
      [cx - 22, '#e0b04a'],
      [cx + 26, '#c9584a'],
      [cx - 2, '#e8e2d0'],
    ] as const) out += circle(x, base - 3, 2, c, 'stroke="none"');
  }
  if (working) out += line(cx - 28, base, cx - 28, base - 10, 1) + line(cx + 30, base, cx + 30, base - 10, 1) + line(cx - 28, base - 8, cx + 30, base - 8, 0.6);
  return out;
}

/** New track along the road: a third of it per stage, and the handcar when it's done. */
export function theLine({ done, working }: ProjectLook): string {
  if (done === 0 && !working) return '';
  const y = H - 8;
  const laid = (W * done) / 3;
  let out = '';
  for (let x = 2; x < laid; x += 12) out += rect(x, y - 3, 5, 7, C.tie, 'stroke="none"');
  if (laid > 0) out += line(0, y - 1, laid, y - 1, 1.6, C.rail) + line(0, y + 3, laid, y + 3, 1.6, C.rail);
  if (working) out += pile(Math.min(W - 26, laid + 6), y + 2, C.rail);
  if (done >= 3) {
    // The handcar: a flatbed on four wheels and a seesaw pump.
    const x = 352;
    out += rect(x - 20, y - 12, 40, 6, C.wood) + circle(x - 12, y - 3, 4, '#4a3d33') + circle(x + 12, y - 3, 4, '#4a3d33');
    out += line(x, y - 12, x, y - 24, 1.4) + line(x - 12, y - 28, x + 12, y - 20, 1.6) + rect(x - 14, y - 30, 4, 3, C.steelDark, FINE) + rect(x + 10, y - 22, 4, 3, C.steelDark, FINE);
  }
  return out;
}

/** The share of the fence the Wall has replaced, left to right: a third a stage. */
export function wallShare(look: ProjectLook): number {
  return look.done / 3;
}

/** A run of corrugated wall from x1 to x2 along the fence line, sandbags at its foot. */
export function wallRun(x1: number, x2: number): string {
  if (x2 <= x1) return '';
  const top = Y.fence - 28;
  let out = rect(x1, top, x2 - x1, 28, '#8f8475');
  for (let x = x1 + 4; x < x2; x += 5) out += line(x, top + 1, x, Y.fence - 1, 0.6, '#6f655a');
  for (let x = x1; x < x2 - 8; x += 22) out += rect(x, top + 6 + ((x / 22) % 2) * 9, Math.min(14, x2 - x), 6, '#a0582f', 'stroke="none" opacity="0.45"');
  for (let x = x1 + 2; x < x2 - 6; x += 12) out += ellipse(x + 5, Y.fence - 2, 6, 3, '#b8a57e', FINE);
  return out;
}

export const PROJECT_DRAWINGS: Partial<Record<ProjectId, (look: ProjectLook) => string>> = {
  the_relay: relay,
  the_clinic: clinic,
  memorial_garden: memorialGarden,
  the_line: theLine,
};

/** Where each drawing sits in the back-to-front order. */
export const PROJECT_BASE: Partial<Record<ProjectId, number>> = {
  the_relay: Y.back - 1,
  the_clinic: 338,
  memorial_garden: 336,
  the_line: H - 4,
};
