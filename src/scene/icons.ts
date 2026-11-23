/**
 * An icon for every piece of gear (3.3.0), in the field journal's ink: a
 * 40 x 40 drawing on a paper tile, with the item's quality marked (rust on a
 * rusty one, a star for each step above common, a gold edge on a relic).
 * Pure SVG strings, like the portraits and the yard.
 */
import type { Quality } from '../engine/types.ts';
import { C, INK, circle, ellipse, ink, line, pathEl, poly, rect } from './draw.ts';

const FINE = ink(1);
const BOLD = ink(1.4);
const METAL = '#9aa2a2';
const METAL_DARK = '#6b7272';
const LEATHER = '#7a5236';
const PAPER = '#eadfc8';
const PAPER_EDGE = '#cdbf9f';

/** Each item's drawing, inside a 40 x 40 box with a margin. */
export const ITEM_DRAWINGS: Record<string, () => string> = {
  // ---------------------------------------------------------------- melee
  pipe: () =>
    pathEl('M 9 31 L 25 15 L 25 11 L 31 11', 'none', `stroke="${INK}" stroke-width="6.4" stroke-linecap="round" stroke-linejoin="round"`) +
    pathEl('M 9 31 L 25 15 L 25 11 L 31 11', 'none', `stroke="${METAL}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"`) +
    rect(22.6, 12, 5, 5, METAL_DARK, FINE) +
    line(12, 29, 14, 27, 1, '#c9cfcf'),
  machete: () =>
    pathEl('M 15 25 L 30 8 Q 34 6 33 11 L 18 28 Z', '#c9cfcf', BOLD) +
    line(18, 25, 30.5, 10.5, 0.8, METAL_DARK) +
    rect(6, 27, 11, 4.4, C.woodDark, BOLD).replace('<rect', '<rect transform="rotate(-48 11.5 29.2)"') +
    line(13.5, 23.5, 19.5, 29.5, 1.8, INK),
  sledge: () =>
    line(10, 32, 25, 14, 3.4, INK) +
    line(10, 32, 25, 14, 2, C.wood) +
    poly(
      [
        [19, 8],
        [30, 17],
        [34, 13],
        [23, 4],
      ],
      METAL_DARK,
      BOLD,
    ) +
    line(23, 6, 31, 14, 1, METAL),
  shock_baton: () =>
    line(10, 31, 28, 13, 5.2, INK) +
    line(10, 31, 28, 13, 3.4, '#3f4a52') +
    line(13, 26, 16, 29, 2, '#c07a3c') +
    line(17, 22, 20, 25, 2, '#c07a3c') +
    line(21, 18, 24, 21, 2, '#c07a3c') +
    pathEl('M 30 6 L 27 11 L 31 11 L 28 16', 'none', `stroke="#f2c66d" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"`),
  // ---------------------------------------------------------------- guns
  pipe_pistol: () =>
    rect(9, 13, 23, 6, METAL, BOLD) +
    line(11, 16, 30, 16, 0.8, METAL_DARK) +
    pathEl('M 11 19 L 18 19 L 16 31 L 9 31 Z', C.wood, BOLD) +
    pathEl('M 17 19 Q 19 25 22 19', 'none', FINE) +
    rect(29, 11, 2, 3, INK, 'stroke="none"'),
  hunting_rifle: () =>
    pathEl('M 4 26 L 13 22 L 16 24 L 36 13 L 37 15 L 17 27 L 9 31 Z', C.wood, BOLD) +
    line(16, 23.5, 37, 12, 2.4, INK) +
    rect(19, 14.5, 9, 3.4, '#3f4a52', FINE).replace('<rect', '<rect transform="rotate(-28 23.5 16.2)"') +
    line(17, 27, 18, 30, 1.2),
  crossbow: () =>
    line(20, 34, 20, 9, 4.4, INK) +
    line(20, 34, 20, 9, 2.8, C.wood) +
    pathEl('M 6 14 Q 20 4 34 14', 'none', `stroke="${INK}" stroke-width="3.4" stroke-linecap="round"`) +
    pathEl('M 6 14 Q 20 4 34 14', 'none', `stroke="${METAL}" stroke-width="1.8" stroke-linecap="round"`) +
    pathEl('M 6 14 L 20 21 L 34 14', 'none', 'stroke="#d8cfb8" stroke-width="0.9"') +
    line(20, 21, 20, 5, 1.2, '#5b3d2a') +
    poly(
      [
        [18.4, 6],
        [20, 2.5],
        [21.6, 6],
      ],
      METAL_DARK,
      FINE,
    ),
  scattergun: () =>
    rect(13, 11, 22, 4, METAL, BOLD) +
    rect(13, 15, 22, 4, METAL, BOLD) +
    pathEl('M 5 25 L 14 11 L 17 11 L 17 21 L 11 31 L 5 31 Z', C.wood, BOLD) +
    line(15, 20, 18, 25, 1.2),
  // ---------------------------------------------------------------- armor
  leather_jacket: () =>
    pathEl('M 12 8 L 17 6 L 20 10 L 23 6 L 28 8 L 33 14 L 31 30 L 27 30 L 27 33 L 13 33 L 13 30 L 9 30 L 7 14 Z', LEATHER, BOLD) +
    pathEl('M 17 6 L 20 16 L 23 6', 'none', FINE) +
    line(20, 16, 20, 33, 1, '#c9a46a') +
    line(13, 18, 13, 29, 0.8, '#5a3a24') +
    line(27, 18, 27, 29, 0.8, '#5a3a24'),
  scrap_vest: () =>
    pathEl('M 12 7 L 17 7 L 20 12 L 23 7 L 28 7 L 31 13 L 30 33 L 10 33 L 9 13 Z', '#6f6a60', BOLD) +
    rect(12, 15, 7, 7, '#a2a6a2', FINE) +
    rect(21, 14, 7, 8, '#8d9494', FINE) +
    rect(12, 24, 16, 7, '#b0896a', FINE) +
    circle(13.5, 16.5, 0.6, INK, 'stroke="none"') +
    circle(26.5, 15.5, 0.6, INK, 'stroke="none"') +
    circle(13.5, 29.5, 0.6, INK, 'stroke="none"') +
    circle(26.5, 29.5, 0.6, INK, 'stroke="none"'),
  riot_gear: () =>
    pathEl('M 8 21 Q 8 6 20 6 Q 32 6 32 21 L 32 25 L 8 25 Z', '#3f4a52', BOLD) +
    pathEl('M 10 16 L 30 16 L 30 26 Q 20 30 10 26 Z', '#9fb7b0', BOLD) +
    line(12, 18, 17, 24, 1, '#d9e6e2') +
    rect(15, 29, 10, 4, '#3f4a52', FINE),
  hazmat_suit: () =>
    pathEl('M 8 34 L 8 20 Q 8 5 20 5 Q 32 5 32 20 L 32 34 Z', '#c9a83e', BOLD) +
    ellipse(20, 17, 8, 7, '#9fb7b0', BOLD) +
    circle(20, 28, 4, '#3a302a', FINE) +
    circle(20, 28, 1.6, METAL, FINE) +
    line(15, 14, 18, 12, 1, '#d9e6e2'),
  // ---------------------------------------------------------------- tools
  crowbar: () =>
    pathEl('M 9 33 L 27 10 Q 30 5 34 8 Q 35 11 32 12', 'none', `stroke="${INK}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`) +
    pathEl('M 9 33 L 27 10 Q 30 5 34 8 Q 35 11 32 12', 'none', `stroke="#b2453a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`) +
    line(8, 34, 6, 32, 2.4, INK),
  geiger_counter: () =>
    rect(7, 13, 19, 18, '#c9a83e', BOLD) +
    circle(16.5, 21, 5, PAPER, FINE) +
    line(16.5, 21, 19.5, 18, 1.2, '#b2453a') +
    line(13, 21, 20, 21, 0.6, INK) +
    rect(10, 28, 4, 1.6, INK, 'stroke="none"') +
    pathEl('M 26 22 Q 32 22 33 14', 'none', FINE) +
    rect(30, 6, 5, 9, METAL_DARK, FINE),
  medkit: () =>
    rect(6, 11, 28, 21, '#efe8da', BOLD) +
    pathEl('M 15 11 L 15 8 L 25 8 L 25 11', 'none', BOLD) +
    rect(17.5, 15, 5, 13, '#b2453a', 'stroke="none"') +
    rect(13.5, 19, 13, 5, '#b2453a', 'stroke="none"'),
  binoculars: () =>
    rect(7, 14, 10, 17, '#3f4a52', BOLD) +
    rect(23, 14, 10, 17, '#3f4a52', BOLD) +
    rect(16, 17, 8, 6, METAL_DARK, FINE) +
    rect(8, 9, 8, 6, '#5b6670', FINE) +
    rect(24, 9, 8, 6, '#5b6670', FINE) +
    circle(12, 31, 3.4, '#9fb7b0', FINE) +
    circle(28, 31, 3.4, '#9fb7b0', FINE),
  lockpicks: () =>
    rect(6, 18, 28, 13, LEATHER, BOLD) +
    line(11, 18, 11, 6, 1.4, METAL) +
    pathEl('M 11 6 L 13 7', 'none', `stroke="${METAL}" stroke-width="1.4"`) +
    line(16, 18, 16, 8, 1.4, METAL) +
    pathEl('M 16 8 L 17.5 6.5 L 18.5 8', 'none', `stroke="${METAL}" stroke-width="1.2"`) +
    line(21, 18, 21, 5, 1.4, METAL) +
    line(26, 18, 26, 9, 1.4, METAL) +
    pathEl('M 26 9 Q 28 9 27 11', 'none', `stroke="${METAL}" stroke-width="1.2"`) +
    line(6, 25, 34, 25, 0.8, '#5a3a24'),
  multitool: () =>
    line(20, 20, 9, 7, 2.4, METAL) +
    line(20, 20, 20, 5, 2.4, METAL) +
    line(20, 20, 31, 8, 2.4, METAL) +
    rect(12, 19, 16, 14, '#b2453a', BOLD) +
    circle(20, 23, 1.2, '#efe8da', 'stroke="none"') +
    rect(19.4, 25, 1.2, 4, '#efe8da', 'stroke="none"') +
    rect(17, 27, 6, 1.2, '#efe8da', 'stroke="none"'),
  // ---------------------------------------------------------------- trinkets
  lucky_coin: () =>
    circle(20, 20, 12, '#d8b66c', BOLD) +
    circle(20, 20, 9, 'none', FINE) +
    poly(
      [
        [20, 13.5],
        [21.8, 18.4],
        [26.8, 18.4],
        [22.8, 21.5],
        [24.3, 26.4],
        [20, 23.4],
        [15.7, 26.4],
        [17.2, 21.5],
        [13.2, 18.4],
        [18.2, 18.4],
      ],
      '#b0893e',
      FINE,
    ),
  old_photo: () =>
    `<g transform="rotate(-6 20 20)">` +
    rect(8, 9, 24, 22, '#f3ecdc', BOLD) +
    rect(11, 12, 18, 13, '#b7a98a', FINE) +
    circle(17, 17, 2.2, '#8b7b61', 'stroke="none"') +
    rect(15, 19.5, 4, 5.5, '#8b7b61', 'stroke="none"') +
    circle(23, 17.5, 2, '#8b7b61', 'stroke="none"') +
    rect(21.2, 19.6, 3.6, 5.4, '#8b7b61', 'stroke="none"') +
    rect(15, 7, 10, 4, 'rgba(230,220,180,0.75)', 'stroke="none"') +
    '</g>',
  dog_tags: () =>
    pathEl('M 10 6 Q 20 22 30 6', 'none', `stroke="${METAL_DARK}" stroke-width="1" stroke-dasharray="1.2 1"`) +
    `<g transform="rotate(-12 16 24)">${rect(11, 17, 10, 15, METAL, BOLD)}${line(13, 22, 19, 22, 0.7)}${line(13, 25, 18, 25, 0.7)}${circle(16, 19.2, 0.9, PAPER, FINE)}</g>` +
    `<g transform="rotate(10 24 25)">${rect(19, 18, 10, 15, '#b6bcbc', BOLD)}${line(21, 23, 27, 23, 0.7)}${line(21, 26, 26, 26, 0.7)}${circle(24, 20.2, 0.9, PAPER, FINE)}</g>`,
  music_box: () =>
    rect(8, 15, 22, 15, C.wood, BOLD) +
    pathEl('M 8 15 L 12 10 L 34 10 L 30 15 Z', '#a07a52', BOLD) +
    pathEl('M 30 15 L 34 10 L 34 25 L 30 30 Z', C.woodDark, BOLD) +
    line(12, 21, 26, 21, 0.8, '#d8b66c') +
    line(32, 18, 36, 18, 1.2) +
    line(36, 18, 36, 22, 1.2) +
    circle(36, 22.5, 1.2, '#d8b66c', FINE),
  rabbits_foot: () =>
    pathEl('M 20 4 L 20 10', 'none', `stroke="${METAL_DARK}" stroke-width="1.2"`) +
    circle(20, 11, 1.6, 'none', `stroke="${METAL}" stroke-width="1.2"`) +
    pathEl('M 15 14 Q 20 11 25 14 L 26 26 Q 27 33 20 34 Q 13 33 14 26 Z', '#ddd3bd', BOLD) +
    pathEl('M 16 27 Q 20 30 24 27', 'none', FINE) +
    ellipse(16.5, 32.2, 2, 1.4, '#cfc4ab', FINE) +
    ellipse(20, 33.2, 2, 1.4, '#cfc4ab', FINE) +
    ellipse(23.5, 32.2, 2, 1.4, '#cfc4ab', FINE) +
    line(17, 18, 18, 23, 0.7, '#b7a98a') +
    line(23, 18, 22, 23, 0.7, '#b7a98a'),
};

/** A placeholder for an empty slot: the slot's outline, dashed. */
const EMPTY = rect(8, 8, 24, 24, 'none', `stroke="${INK}" stroke-width="1" stroke-dasharray="2 2" opacity="0.4"`);

/** The marks of an item's quality, over its drawing. */
function qualityMarks(quality: Quality | undefined): string {
  if (quality === 'rusty') {
    let out = '';
    for (const [x, y, r] of [
      [13, 23, 2.4],
      [24, 14, 1.8],
      [27, 27, 2],
      [17, 11, 1.2],
      [9, 15, 1.4],
    ] as const) out += circle(x, y, r, '#a8603f', 'stroke="none" opacity="0.55"');
    return out;
  }
  const stars = quality === 'solid' ? 1 : quality === 'prime' ? 2 : quality === 'relic' ? 3 : 0;
  let out = '';
  for (let i = 0; i < stars; i++) {
    const cx = 34 - i * 5.4;
    const cy = 5.5;
    out += poly(
      Array.from({ length: 10 }, (_, k): [number, number] => {
        const a = (Math.PI / 5) * k - Math.PI / 2;
        const r = k % 2 === 0 ? 2.6 : 1.1;
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      }),
      quality === 'relic' ? '#f2c66d' : '#a64d27',
      'stroke="#2b2420" stroke-width="0.6" stroke-linejoin="round"',
    );
  }
  return out;
}

/** An item's icon as an SVG document: the paper tile, the drawing, its quality. An unknown id draws an empty slot. */
export function itemIconSvg(defId: string | undefined, quality?: Quality, label = ''): string {
  const draw = defId ? ITEM_DRAWINGS[defId] : undefined;
  const relic = quality === 'relic';
  const tile = `<rect x="0.75" y="0.75" width="38.5" height="38.5" rx="5" fill="${PAPER}" stroke="${relic ? '#c9a43e' : PAPER_EDGE}" stroke-width="${relic ? 1.8 : 1}"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" class="item-icon"${label ? ` role="img" aria-label="${label.replace(/"/g, '&quot;')}"` : ' aria-hidden="true"'}>` +
    tile +
    (draw ? draw() : EMPTY) +
    (draw ? qualityMarks(quality) : '') +
    '</svg>'
  );
}
