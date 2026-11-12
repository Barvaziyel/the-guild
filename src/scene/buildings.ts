/**
 * The Depot's buildings, each drawn by level. Level 0 is an empty lot with a
 * peg and a string. The water tower and the signal gantry are always there:
 * the Radio Tower and the Watchtower are what the guild adds to them.
 */
import type { BuildingId } from '../engine/types.ts';
import { C, INK, circle, ellipse, ink, line, pathEl, poly, rect } from './draw.ts';
import { BUILDING_AREAS, Y } from './layout.ts';

const FINE = ink(0.9);

/** An empty lot: pegs and string marking where it would go. */
function emptyLot(id: BuildingId, base: number, depth = 14): string {
  const a = BUILDING_AREAS[id];
  const x1 = a.x + 8;
  const x2 = a.x + a.w - 8;
  const y1 = base - depth;
  const dash = `stroke="${INK}" stroke-width="0.8" stroke-dasharray="3 3" fill="none"`;
  return (
    `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${depth}" ${dash}/>` +
    [x1, x2].flatMap((x) => [line(x, y1 - 3, x, y1 + 1, 1.2), line(x, base - 3, x, base + 1, 1.2)]).join('')
  );
}

// ---------------------------------------------------------------- the back row

/** The old station house the guild lives in, behind everything. Not tappable. */
export function stationHouse(): string {
  const base = Y.back;
  let out = rect(22, 128, 216, base - 128, C.brick);
  out += rect(18, 120, 224, 9, C.roof);
  // Arched windows, and the big doorway in the middle.
  for (const x of [36, 64, 92, 156, 184, 212]) {
    out += pathEl(`M ${x} ${base - 18} L ${x} ${base - 40} A 6 6 0 0 1 ${x + 12} ${base - 40} L ${x + 12} ${base - 18} Z`, C.window, `class="yard-window" ${ink()}`);
  }
  out += pathEl(`M 116 ${base} L 116 ${base - 40} A 14 14 0 0 1 144 ${base - 40} L 144 ${base} Z`, C.window);
  // A sign over the door.
  out += rect(104, 104, 52, 14, '#d9cdb2');
  out += `<text x="130" y="115" text-anchor="middle" font-family="'Big Shoulders Stencil Variable', 'Arial Narrow', sans-serif" font-weight="700" font-size="11" fill="${INK}">Depot</text>`;
  return out;
}

export function radioTower(level: number): string {
  // The water tower.
  let out = '';
  for (const [x1, x2] of [
    [328, 334],
    [368, 362],
  ] as const) {
    out += line(x1, Y.back, x2, 130, 2.2);
  }
  out += line(331, 160, 365, 160, 1.2) + line(332, 145, 364, 145, 1.2);
  out += rect(322, 98, 52, 34, C.steel);
  out += poly([[318, 99], [348, 80], [378, 99]], C.steelDark);
  if (level >= 1) {
    const top = 80 - 14 - level * 12;
    out += line(348, 80, 348, top, 1.8);
    for (let y = top + 6; y < 78; y += 9) out += line(344, y, 352, y, 1);
    out += `<circle class="yard-blink" cx="348" cy="${top}" r="2" fill="#d9544a"/>`;
  }
  if (level >= 2) out += pathEl('M 374 104 Q 386 110 382 122 Q 372 118 374 104 Z', '#c9c4b5') + line(378, 113, 386, 110, 1);
  if (level >= 3) out += line(330, 98, 318, 74, 1.4) + line(366, 98, 372, 70, 1.4) + line(318, 74, 348, 66, 0.6) + line(372, 70, 348, 66, 0.6);
  return out;
}

export function watchtower(level: number): string {
  const base = Y.back;
  let out = line(254, base, 254, 112, 2.6) + line(302, base, 302, 112, 2.6);
  out += rect(248, 110, 60, 6, C.steelDark);
  for (const x of [266, 288]) out += line(x, 116, x, 122, 1) + circle(x, 125, 3, '#4b4f4e', FINE);
  if (level >= 1) {
    out += rect(248, 140, 60, 4, C.wood);
    out += line(250, 140, 250, 130, 1) + line(306, 140, 306, 130, 1) + line(250, 130, 306, 130, 1);
    for (let y = base - 6; y > 144; y -= 8) out += line(258, y, 264, y, 1);
    out += line(258, base, 258, 144, 1) + line(264, base, 264, 144, 1);
  }
  if (level >= 2) for (const x of [252, 260, 300]) out += ellipse(x, 138, 4, 2.4, '#b39d73', FINE);
  if (level >= 3) out += pathEl('M 302 104 L 312 100 L 312 108 Z', '#c9c4b5') + `<path class="yard-beam" d="M 312 104 L 396 70 L 396 120 Z" fill="${C.lit}" opacity="0"/>`;
  return out;
}

// ---------------------------------------------------------------- the middle row

/** Freight cars on the rails: one per level. */
export function bunks(level: number): string {
  const colors = [C.boxcar, '#5f7f78', '#a07a45'];
  let out = '';
  for (let i = 0; i < Math.max(1, Math.min(3, level)); i++) {
    const x = 10 + i * 64;
    const top = Y.rails - 40;
    out += rect(x, top, 58, 32, colors[i]!);
    out += rect(x - 1, top - 3, 60, 4, '#5b4a3c');
    out += rect(x + 20, top + 6, 18, 26, colors[i]!, FINE) + line(x + 29, top + 6, x + 29, top + 32, 0.8);
    out += rect(x + 6, top + 8, 8, 6, C.window, `class="yard-window" ${FINE}`);
    out += circle(x + 11, Y.rails - 3, 5, '#3a3a38') + circle(x + 47, Y.rails - 3, 5, '#3a3a38');
  }
  return out;
}

export function workshop(level: number): string {
  const base = Y.middle;
  if (level === 0) return emptyLot('workshop', base, 18);
  let out = '';
  if (level >= 3) out += rect(204, 278, 18, base - 278, '#7d8382') + rect(207, 284, 10, 8, C.window, `class="yard-window" ${FINE}`);
  out += rect(220, 268, 74, base - 268, '#8b9190');
  for (let x = 226; x < 292; x += 6) out += line(x, 270, x, base - 1, 0.5, '#6b7272');
  out += poly([[216, 270], [298, 258], [298, 264], [216, 274]], C.roof);
  out += rect(238, 280, 38, base - 280, C.window);
  out += rect(242, 298, 30, 4, C.wood, FINE) + line(246, 302, 246, base, 1) + line(268, 302, 268, base, 1);
  // The chimney smokes while the Workshop is working.
  out += rect(282, 240, 8, 22, '#6b5a48');
  out += `<g class="yard-smoke">${circle(286, 234, 4, '#cfc8bb', 'stroke="none"')}${circle(288, 228, 3, '#cfc8bb', 'stroke="none"')}${circle(286, 222, 2.4, '#cfc8bb', 'stroke="none"')}</g>`;
  if (level >= 2) out += line(214, base, 214, 248, 2) + line(214, 248, 232, 248, 2) + line(230, 248, 230, 258, 0.8) + pathEl('M 228 258 Q 230 262 232 258', 'none');
  return out;
}

export function infirmary(level: number): string {
  const base = Y.middle;
  if (level === 0) return emptyLot('infirmary', base, 18);
  let out = '';
  if (level >= 3) {
    out += rect(312, 270, 76, base - 270, '#d8cfba') + poly([[308, 272], [350, 252], [392, 272]], C.roof);
    out += rect(342, 288, 16, base - 288, C.window);
    out += rect(316, 280, 14, 10, C.window, `class="yard-window" ${FINE}`) + rect(370, 280, 14, 10, C.window, `class="yard-window" ${FINE}`);
  } else {
    out += poly([[312, base], [350, 262], [388, base]], C.canvas);
    out += poly([[343, base], [350, 286], [357, base]], C.window);
    if (level >= 2) out += rect(300, 286, 14, 4, C.canvas, FINE) + line(301, 290, 301, base, 1) + rect(386, 286, 12, 4, C.canvas, FINE) + line(397, 290, 397, base, 1);
  }
  // The red cross.
  out += rect(346, 266 + (level >= 3 ? -14 : 6), 8, 3, C.cross, 'stroke="none"') + rect(348.5, 263.5 + (level >= 3 ? -14 : 6), 3, 8, C.cross, 'stroke="none"');
  return out;
}

// ---------------------------------------------------------------- the front row

/** Raised beds: two per level. */
export function garden(level: number): string {
  const base = Y.front;
  let out = '';
  const rows = Math.max(1, Math.min(3, level));
  for (let r = rows - 1; r >= 0; r--) {
    const y = base - 26 - r * 22;
    for (const x of [16, 82]) {
      out += rect(x, y, 60, 10, C.wood);
      for (let i = 0; i < 6; i++) out += circle(x + 6 + i * 9.6, y - 1, 4 + ((i + r) % 3), i % 2 ? C.plant : C.plantDark, FINE);
    }
  }
  if (level >= 3) out += rect(146, base - 40, 10, 16, '#6b7d86') + ellipse(151, base - 40, 5, 1.6, '#55666e', FINE);
  return out;
}

/** The fire itself, also drawn again over the dark so it still burns bright. */
export function flame(): string {
  const base = Y.front;
  return (
    `<g class="yard-flame">` +
    pathEl(`M 203 ${base - 22} Q 202 ${base - 34} 209 ${base - 44} Q 211 ${base - 34} 214 ${base - 38} Q 220 ${base - 30} 219 ${base - 22} Z`, C.flame, FINE) +
    pathEl(`M 207 ${base - 22} Q 207 ${base - 30} 211 ${base - 35} Q 215 ${base - 28} 215 ${base - 22} Z`, C.flameCore, 'stroke="none"') +
    '</g>'
  );
}

/** The Bar and Stage's string of lights. */
export function bulbs(): string {
  let out = '';
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    const x = 162 + 100 * t;
    const y = 328 + 32 * t * (1 - t) - 1;
    out += `<circle class="yard-bulb" style="animation-delay:-${((i * 0.37) % 1.5).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${(y + 2.5).toFixed(1)}" r="1.6" fill="${C.lit}" stroke="${INK}" stroke-width="0.5"/>`;
  }
  return out;
}

/** The Firepit: a stone ring and logs; a bar of crates at level 2; a stage and lights at 3. */
export function firepit(level: number): string {
  const base = Y.front;
  let out = '';
  if (level >= 3) {
    out += line(162, 372, 162, 326, 1.4) + line(262, 372, 262, 326, 1.4);
    out += pathEl('M 162 328 Q 212 344 262 328', 'none', `stroke="${INK}" stroke-width="0.7"`);
    out += bulbs();
  }
  if (level >= 2) {
    out += rect(180, 358, 62, 16, C.wood);
    out += line(201, 358, 201, 374, 0.8) + line(221, 358, 221, 374, 0.8);
    for (const [x, c] of [
      [186, '#5f7f78'],
      [192, '#a8603f'],
      [228, '#7d6c4f'],
      [234, '#5f7f78'],
    ] as const) {
      out += rect(x, 351, 3.5, 7, c, FINE);
    }
  }
  // Logs to sit on.
  out += rect(154, base - 12, 34, 7, C.woodDark) + ellipse(154, base - 8.5, 2, 3.5, C.wood, FINE);
  out += rect(234, base - 12, 34, 7, C.woodDark) + ellipse(268, base - 8.5, 2, 3.5, C.wood, FINE);
  out += rect(194, base + 4, 34, 7, C.woodDark) + ellipse(228, base + 7.5, 2, 3.5, C.wood, FINE);
  // The fire.
  out += ellipse(211, base - 22, 18, 6, '#6f6a62');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    out += ellipse(211 + Math.cos(a) * 17, base - 22 + Math.sin(a) * 5.5, 3.6, 2.4, C.stone, FINE);
  }
  out += flame();
  out += `<g class="yard-smoke">${circle(212, base - 52, 3.5, '#cfc8bb', 'stroke="none"')}${circle(214, base - 60, 2.8, '#cfc8bb', 'stroke="none"')}</g>`;
  return out;
}

export function trainingYard(level: number): string {
  const base = Y.front;
  if (level === 0) return emptyLot('training_yard', base, 22);
  let out = '';
  // A target on a stand.
  out += line(368, base - 4, 376, base - 34, 1.2) + line(388, base - 4, 380, base - 34, 1.2);
  out += circle(378, base - 32, 11, '#e6dcc4') + circle(378, base - 32, 7, '#c4573e', FINE) + circle(378, base - 32, 3, '#e6dcc4', FINE);
  if (level >= 2) {
    out += line(286, base - 2, 286, base - 50, 2) + line(286, base - 50, 302, base - 50, 2) + line(300, base - 50, 300, base - 42, 0.8);
    out += rect(295, base - 42, 10, 22, '#6b4a32');
  }
  if (level >= 3) {
    out += line(322, base - 2, 334, base - 56, 2) + line(346, base - 2, 334, base - 56, 2);
    out += pathEl(`M 334 ${base - 54} Q 336 ${base - 30} 332 ${base - 10}`, 'none', `stroke="#b39d73" stroke-width="1.6"`);
  }
  return out;
}

export const BUILDING_DRAWINGS: Record<BuildingId, (level: number) => string> = {
  radio_tower: radioTower,
  watchtower,
  bunks,
  workshop,
  infirmary,
  garden,
  firepit,
  training_yard: trainingYard,
};

/** Where each building stands, for drawing in depth order (and for its workers, just after). */
export const BUILDING_BASE: Record<BuildingId, number> = {
  radio_tower: Y.back - 1,
  watchtower: Y.back,
  bunks: Y.rails,
  workshop: Y.middle,
  infirmary: Y.middle,
  garden: Y.front - 2,
  // Before the people sitting on its logs.
  firepit: Y.front - 16,
  training_yard: Y.front,
};
