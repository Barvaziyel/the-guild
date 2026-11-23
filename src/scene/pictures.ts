/**
 * Pictures for the screens (3.3.0): a place as a wide banner (its battle
 * backdrop, cropped), a building up close (its yard drawing at its level),
 * and a small stamp for each kind of moment in a run's log.
 */
import type { BeatKind, BuildingId } from '../engine/types.ts';
import { BACKDROP_PLACES, HORIZON, STAGE_W, backdropSvg } from './backdrops.ts';
import { BUILDING_BASE, BUILDING_DRAWINGS, flame } from './buildings.ts';
import { C, INK, circle, ellipse, ink, line, pathEl, poly, rect } from './draw.ts';
import { BUILDING_AREAS } from './layout.ts';

/** How much of a backdrop a place's banner shows: a band across the horizon. */
export const BANNER = { y: HORIZON - 112, h: 160 } as const;

/** A place's picture as a wide banner, for the Reach, the planner and a run. */
export function placePictureSvg(placeId: string, name = ''): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${BANNER.y} ${STAGE_W} ${BANNER.h}" class="place-picture" preserveAspectRatio="xMidYMid slice"${name ? ` role="img" aria-label="${name.replace(/"/g, '&quot;')}"` : ' aria-hidden="true"'}>` +
    backdropSvg(placeId) +
    '</svg>'
  );
}

/** Whether a place has a picture of its own (anywhere else gets open wasteland). */
export function hasPlacePicture(placeId: string): boolean {
  return BACKDROP_PLACES.includes(placeId);
}

/** The shape of a building's picture, wide to high. */
export const BUILDING_ASPECT = { min: 1.9, max: 2.8 } as const;

/**
 * A building up close at its level (level 0 is its empty lot), cropped from
 * the yard with a little sky and ground around it. The Firepit has its fire.
 * Drawn with the yard's class, so its flames and smoke move as they do there.
 */
export function buildingPictureSvg(id: BuildingId, level: number, name = ''): string {
  const a = BUILDING_AREAS[id];
  const pad = 14;
  let x = a.x - pad;
  let w = a.w + pad * 2;
  let top = a.y - pad - 6;
  const base = BUILDING_BASE[id];
  const bottom = Math.max(a.y + a.h, base) + 12;
  let h = bottom - top;
  // Every picture is a landscape between 1.9 and 2.8 wide to 1 high: tall buildings get more ground either side, long ones more sky.
  if (w / h < BUILDING_ASPECT.min) {
    const wider = h * BUILDING_ASPECT.min;
    x -= (wider - w) / 2;
    w = wider;
  } else if (w / h > BUILDING_ASPECT.max) {
    const taller = w / BUILDING_ASPECT.max;
    top -= taller - h;
    h = taller;
  }
  const sky = rect(x, top, w, base - top, '#cdd8cd', 'stroke="none"');
  const ground = rect(x, base - 2, w, bottom - base + 2, C.dirt, 'stroke="none"') + line(x, base - 2, x + w, base - 2, 0.8, C.dirtDark);
  const extra = id === 'firepit' && level > 0 ? flame() : '';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${top} ${w} ${h}" class="yard building-picture"${name ? ` role="img" aria-label="${name.replace(/"/g, '&quot;')}"` : ' aria-hidden="true"'}>` +
    sky +
    ground +
    BUILDING_DRAWINGS[id](level) +
    extra +
    '</svg>'
  );
}

// ---------------------------------------------------------------- the log's stamps

const STAMP = '#a64d27';
const FINE = ink(1.1);

/** Each kind of moment in a run, drawn inside a 32 x 32 stamp. */
const BEAT_DRAWINGS: Record<BeatKind, () => string> = {
  // Setting out: the gate, open.
  depart:
    () =>
      line(7, 24, 7, 9, 1.6) +
      line(25, 24, 25, 9, 1.6) +
      pathEl('M 8 10 L 13 12 L 13 23 L 8 23 Z', 'none', FINE) +
      pathEl('M 24 10 L 19 12 L 19 23 L 24 23 Z', 'none', FINE) +
      line(4, 25, 28, 25, 1.1),
  // On the road: footprints.
  travel: () =>
    ellipse(11, 22, 2.4, 3.6, INK, 'stroke="none"') +
    ellipse(16, 15, 2.4, 3.6, INK, 'stroke="none"') +
    ellipse(21, 9, 2.4, 3.6, INK, 'stroke="none"') +
    circle(11, 17.4, 0.9, INK, 'stroke="none"') +
    circle(16, 10.4, 0.9, INK, 'stroke="none"') +
    circle(21, 4.6, 0.9, INK, 'stroke="none"'),
  // Scavenging: a crate pried open.
  scavenge: () =>
    rect(7, 13, 18, 12, C.wood, FINE) +
    line(7, 19, 25, 19, 0.8) +
    pathEl('M 7 13 L 10 7 L 27 9 L 25 13', C.woodDark, FINE) +
    line(22, 5, 15, 15, 1.6, '#b2453a'),
  // A hazard: the warning sign.
  hazard: () =>
    poly(
      [
        [16, 5],
        [28, 26],
        [4, 26],
      ],
      '#d8b66c',
      FINE,
    ) +
    line(16, 12, 16, 19, 2) +
    circle(16, 22.6, 1.1, INK, 'stroke="none"'),
  // A fight: two blades crossed.
  combat: () =>
    line(7, 25, 24, 7, 2.2, '#9aa2a2') +
    line(25, 25, 8, 7, 2.2, '#9aa2a2') +
    line(7, 25, 10, 22, 2.8, INK) +
    line(25, 25, 22, 22, 2.8, INK) +
    line(8, 19, 13, 24, 1.2) +
    line(24, 19, 19, 24, 1.2),
  // The crew among themselves: a fire.
  social: () =>
    line(8, 26, 24, 22, 2.2, C.woodDark) +
    line(8, 22, 24, 26, 2.2, C.woodDark) +
    pathEl('M 16 22 Q 9 17 14 10 Q 15 14 17 12 Q 17 7 20 5 Q 23 13 21 16 Q 25 17 16 22 Z', '#ee9a45', FINE),
  // Something found: a spyglass.
  discovery: () =>
    `<g transform="rotate(-30 16 16)">${rect(5, 13, 10, 6, '#6b7272', FINE)}${rect(15, 12, 8, 8, '#8d9494', FINE)}${rect(23, 11, 5, 10, '#6b7272', FINE)}</g>`,
  // Getting someone out: a hand reaching for a hand.
  rescue: () =>
    pathEl('M 4 20 L 13 18 L 16 15 Q 18 14 17 17 L 15 19', 'none', `stroke="${INK}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`) +
    pathEl('M 28 12 L 19 14 L 16 17 Q 14 18 15 15 L 17 13', 'none', `stroke="${STAMP}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`),
  // The Vultures: a black feather.
  vultures: () => pathEl('M 8 26 Q 10 12 24 6 Q 22 18 8 26 Z', '#2b2420', FINE) + line(8, 26, 20, 11, 0.8, '#7d7d7d'),
  // The market at the Drive-In (3.4.0): a pair of scales.
  trade: () =>
    line(16, 6, 16, 25, 1.6) +
    line(10, 26, 22, 26, 1.8) +
    line(6, 10, 26, 10, 1.6) +
    line(7, 10, 4, 18, 0.8) +
    line(7, 10, 10, 18, 0.8) +
    line(25, 10, 22, 16, 0.8) +
    line(25, 10, 28, 16, 0.8) +
    pathEl('M 3 18 Q 7 22 11 18 Z', '#d8b66c', FINE) +
    pathEl('M 21 16 Q 25 20 29 16 Z', '#d8b66c', FINE),
  // Home: the Depot's roof.
  return: () => pathEl('M 5 17 L 16 7 L 27 17', 'none', ink(1.8)) + rect(9, 16, 14, 10, '#efe6d2', FINE) + rect(14, 19, 4, 7, INK, 'stroke="none"'),
};

/** A run's moment as a small round stamp in red ink on paper. */
export function beatIconSvg(kind: BeatKind): string {
  const draw = BEAT_DRAWINGS[kind] ?? BEAT_DRAWINGS.travel;
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" class="beat-icon" aria-hidden="true">' +
    `<circle cx="16" cy="16" r="15" fill="#eadfc8" stroke="${STAMP}" stroke-width="1.4"/>` +
    `<circle cx="16" cy="16" r="12.8" fill="none" stroke="${STAMP}" stroke-width="0.6" stroke-dasharray="1.2 1.4" opacity="0.7"/>` +
    `<g transform="translate(3.2 3.2) scale(0.8)">${draw()}</g>` +
    '</svg>'
  );
}

export const BEAT_KINDS = Object.keys(BEAT_DRAWINGS) as BeatKind[];
