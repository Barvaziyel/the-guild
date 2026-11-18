/**
 * Where a fight happens, drawn behind the battle stage (§7.13): one backdrop
 * for each place in the Reach, in the yard's flat, muted style. The stage is
 * 400 x 250; the ground starts at `HORIZON` and the fighters stand below it.
 */
import { INK, circle, darken, ellipse, hash, line, mix, pathEl, poly, rect } from './draw.ts';

export const STAGE_W = 400;
export const STAGE_H = 250;
export const HORIZON = 158;

const NONE = 'stroke="none"';
const THIN = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
const W = STAGE_W;
const H = STAGE_H;

function sky(top: string, bottom: string): string {
  return (
    `<defs><linearGradient id="bt-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>` +
    `<rect x="0" y="0" width="${W}" height="${HORIZON + 2}" fill="url(#bt-sky)"/>`
  );
}

function ground(color: string, specks: string, seed: string): string {
  let out = rect(0, HORIZON, W, H - HORIZON, color, NONE);
  for (let k = 0; k < 14; k++) {
    const h = hash(`${seed}-${k}`);
    out += ellipse(h % W, HORIZON + 10 + ((h >>> 8) % (H - HORIZON - 14)), 10 + (h % 22), 2 + (h % 3), specks, 'stroke="none" opacity="0.55"');
  }
  return out + line(0, HORIZON, W, HORIZON, 1.2, darken(color, 0.25));
}

/** A ragged far skyline, for distance. */
function skyline(color: string, seed: string, base = HORIZON, tall = 30): string {
  let d = `M 0 ${base}`;
  for (let x = 0; x <= W; x += 16) {
    const h = hash(`${seed}-${x}`);
    const top = base - 6 - ((h >>> 6) % tall);
    d += ` L ${x} ${top} L ${x + 12} ${top}`;
  }
  return pathEl(`${d} L ${W} ${base} Z`, color, NONE);
}

function deadTree(x: number, y: number, s: number, color = '#4a3f36'): string {
  return (
    line(x, y, x, y - 46 * s, 4 * s, color) +
    line(x, y - 30 * s, x - 14 * s, y - 44 * s, 2.4 * s, color) +
    line(x, y - 36 * s, x + 12 * s, y - 52 * s, 2.2 * s, color) +
    line(x - 8 * s, y - 38 * s, x - 10 * s, y - 50 * s, 1.6 * s, color)
  );
}

function rails(y: number): string {
  let out = '';
  for (let x = -10; x < W; x += 22) out += rect(x, y - 2, 12, 5, '#6b5a48', NONE);
  return out + line(0, y - 2, W, y - 2, 2.2, '#5d6466') + line(0, y + 3, W, y + 3, 2.2, '#5d6466');
}

function car(x: number, y: number, color: string): string {
  return (
    pathEl(`M ${x} ${y} L ${x + 4} ${y - 12} L ${x + 16} ${y - 13} L ${x + 26} ${y - 22} L ${x + 50} ${y - 22} L ${x + 60} ${y - 12} L ${x + 70} ${y - 10} L ${x + 72} ${y} Z`, color, THIN) +
    rect(x + 30, y - 19, 16, 7, '#3d3a36', NONE) +
    circle(x + 16, y, 6, '#2b2420', THIN) +
    circle(x + 56, y, 6, '#2b2420', THIN)
  );
}

type Backdrop = () => string;

const RAIL_YARD: Backdrop = () => {
  let out = sky('#d9c7a2', '#e8d8b6') + skyline('#b3a283', 'ry') + ground('#b9a47d', '#a38e68', 'ry');
  // Boxcars on the far track, one rolled on its side.
  out += rect(18, 110, 92, 44, '#8e4b33', THIN) + rect(26, 118, 20, 26, '#7c4630', THIN) + rect(82, 118, 20, 26, '#7c4630', THIN);
  out += rect(118, 116, 84, 38, '#6b7272', THIN) + line(130, 122, 190, 122, 1, INK);
  out += pathEl('M 280 154 L 290 124 L 384 128 L 376 156 Z', '#8a5a3a', THIN);
  for (const x of [34, 96, 130, 190]) out += circle(x, 156, 5, '#2b2420', THIN);
  return out + rails(168);
};

const MAPLE_STREET: Backdrop = () => {
  let out = sky('#cdd2c4', '#e3e1d0') + skyline('#aeb3a6', 'ms', HORIZON, 18) + ground('#a9a68e', '#8d8a72', 'ms');
  // Houses with broken roofs.
  out += rect(20, 96, 70, 60, '#c7b79a', THIN) + poly([[14, 98], [55, 66], [70, 78], [62, 84], [96, 98]], '#6b4f3f', THIN);
  out += rect(34, 116, 14, 16, '#3d3a36', THIN) + rect(62, 116, 14, 16, '#3d3a36', THIN) + rect(48, 132, 12, 24, '#5b4a3c', THIN);
  out += rect(250, 104, 80, 52, '#a8b0a2', THIN) + poly([[244, 106], [290, 74], [336, 106]], '#5b4a3c', THIN) + poly([[290, 74], [304, 84], [296, 92]], '#a8b0a2', THIN);
  out += rect(262, 120, 14, 14, '#3d3a36', THIN) + rect(302, 120, 14, 14, '#3d3a36', THIN);
  out += deadTree(180, 156, 1.1) + line(108, 156, 108, 120, 2, '#5d6466') + line(102, 122, 116, 122, 1.4, '#5d6466');
  return out + rect(0, 178, W, 12, '#8f8c7a', NONE) + line(0, 184, W, 184, 1, '#c9c2a4') + car(330, 176, '#8a5a3a');
};

const KESSLER_FARM: Backdrop = () => {
  let out = sky('#cfd7c4', '#e6e1c8') + skyline('#a7ae93', 'kf', HORIZON, 10) + ground('#b3a273', '#9a8a5c', 'kf');
  // The barn, a silo, the fence and the old field.
  out += rect(40, 92, 96, 64, '#9a5a3e', THIN) + poly([[34, 94], [88, 58], [142, 94]], '#5b4a3c', THIN);
  out += rect(70, 116, 36, 40, '#7c4630', THIN) + line(70, 116, 106, 156, 1.2, INK) + line(106, 116, 70, 156, 1.2, INK);
  out += rect(146, 74, 26, 82, '#a8a89c', THIN) + pathEl('M 146 74 A 13 10 0 0 1 172 74 Z', '#8d9494', THIN);
  for (let x = 196; x < W; x += 26) out += rect(x, 140, 3, 18, '#8a6844', THIN);
  out += line(190, 146, W, 146, 2, '#8a6844') + line(190, 153, W, 153, 2, '#8a6844');
  for (let y = 170; y < H; y += 14) out += line(0, y, W, y + 6, 1.2, '#9a8a5c');
  return out;
};

const OLD_METRO: Backdrop = () => {
  // Underground: no sky, a tiled wall, the tunnel mouth, the tracks.
  let out = rect(0, 0, W, H, '#3d443f', NONE);
  for (let y = 18; y < HORIZON; y += 14) for (let x = (y / 14) % 2 ? 0 : 12; x < W; x += 24) out += rect(x, y, 22, 12, '#58625a', 'stroke="#323833" stroke-width="1"');
  out += pathEl(`M 150 ${HORIZON} L 150 80 A 50 50 0 0 1 250 80 L 250 ${HORIZON} Z`, '#151916', THIN);
  out += rect(0, 30, W, 10, '#a8603f', NONE) + rect(40, 46, 60, 16, '#e3dcc6', THIN) + rect(300, 46, 60, 16, '#e3dcc6', THIN);
  out += line(56, 54, 84, 54, 2, INK) + line(316, 54, 344, 54, 2, INK);
  out += line(200, 0, 200, 20, 1.2, INK) + circle(200, 24, 5, '#f2c66d', THIN) + `<circle cx="200" cy="26" r="40" fill="#f2c66d" opacity="0.12"/>`;
  out += ground('#56514a', '#45413b', 'om');
  return out + rails(176) + rect(0, HORIZON, W, 6, '#6b6559', NONE);
};

const DROWNED_MALL: Backdrop = () => {
  let out = rect(0, 0, W, H, '#5f6c68', NONE);
  // Shopfronts with dead signs, an escalator, a skylight.
  out += rect(0, 0, W, 22, '#4a5552', NONE);
  for (const x of [130, 190, 250]) out += rect(x, 4, 40, 14, '#a9c0bd', THIN);
  const fronts: [number, string, string][] = [
    [8, '#8e4b33', '#e0b13a'],
    [108, '#4f6a7a', '#efe8da'],
    [292, '#6b5a6e', '#d9a8a0'],
  ];
  for (const [x, wall, sign] of fronts) {
    out += rect(x, 44, 100, 112, mix(wall, '#5f6c68', 0.35), THIN) + rect(x + 10, 50, 80, 14, sign, THIN) + rect(x + 12, 72, 76, 84, '#2e3533', THIN);
    out += line(x + 50, 72, x + 50, 156, 1.2, '#55605d');
  }
  out += poly([[208, 156], [262, 70], [276, 70], [222, 156]], '#7d8382', THIN);
  out += rect(0, HORIZON, W, H - HORIZON, '#4e6461', NONE);
  for (let k = 0; k < 9; k++) {
    const h = hash(`dm-${k}`);
    out += ellipse(h % W, HORIZON + 12 + ((h >>> 8) % 74), 26 + (h % 30), 3 + (h % 3), '#6f8c8a', 'stroke="none" opacity="0.6"');
  }
  return out + line(0, HORIZON, W, HORIZON, 1.2, '#2e3533');
};

const RADIO_STATION: Backdrop = () => {
  let out = sky('#c7cfc6', '#e2dfcf') + skyline('#a6ad9f', 'rs', HORIZON, 14) + ground('#a89f84', '#8f876c', 'rs');
  // The mast, guy wires, the station house and a dish.
  out += line(300, HORIZON, 300, 14, 3, '#7d3a2c');
  for (let y = 20; y < HORIZON; y += 16) out += line(294, y + 8, 306, y, 1, '#7d3a2c') + line(294, y, 306, y + 8, 1, '#7d3a2c');
  out += line(300, 30, 240, HORIZON, 0.8, INK) + line(300, 30, 370, HORIZON, 0.8, INK) + circle(300, 12, 3, '#d9493a', THIN);
  out += rect(40, 110, 110, 46, '#c7b79a', THIN) + rect(36, 104, 118, 8, '#5b4a3c', THIN) + rect(58, 122, 20, 16, '#3d3a36', THIN) + rect(100, 126, 18, 30, '#5b4a3c', THIN);
  return out + pathEl('M 168 120 A 22 22 0 0 1 204 150 Z', '#d6d1c2', THIN) + line(186, 135, 196, 128, 1.4, INK) + line(186, 140, 186, 156, 2, '#6b7272');
};

const ST_JUDES: Backdrop = () => {
  let out = sky('#d2d6cf', '#e8e4d6') + ground('#a3a191', '#8b897a', 'sj');
  out += rect(20, 42, 230, 114, '#d6cfbf', THIN);
  for (let y = 54; y < 140; y += 24) for (let x = 34; x < 240; x += 26) out += rect(x, y, 14, 14, (hash(`${x}-${y}`) % 4 === 0 ? '#5b5a52' : '#3d3a36'), THIN);
  out += rect(110, 18, 50, 30, '#d6cfbf', THIN) + rect(128, 22, 14, 22, '#a8402e', NONE) + rect(124, 26, 22, 14, '#a8402e', NONE);
  out += rect(118, 128, 34, 28, '#4a4541', THIN);
  // The ambulance, nosed into the curb.
  out += pathEl('M 280 158 L 280 112 L 350 112 L 368 132 L 374 158 Z', '#e3dcc6', THIN) + rect(296, 122, 22, 10, '#a8402e', NONE) + rect(302, 117, 10, 20, '#a8402e', NONE);
  return out + rect(350, 120, 14, 12, '#3d3a36', THIN) + circle(298, 158, 7, '#2b2420', THIN) + circle(354, 158, 7, '#2b2420', THIN);
};

const WATER_PLANT: Backdrop = () => {
  let out = sky('#c9d4cf', '#e0e2d4') + skyline('#a9b2ab', 'wp', HORIZON, 12) + ground('#9d9b88', '#868471', 'wp');
  // Tanks, a pipe run, and a settling pool.
  out += rect(24, 76, 70, 80, '#a8b0aa', THIN) + ellipse(59, 76, 35, 8, '#c4cbc5', THIN) + line(24, 100, 94, 100, 1, INK) + line(24, 124, 94, 124, 1, INK);
  out += rect(110, 96, 54, 60, '#9aa39d', THIN) + ellipse(137, 96, 27, 6, '#b8bfb9', THIN);
  out += rect(164, 120, 150, 9, '#6b7272', THIN) + rect(300, 88, 9, 40, '#6b7272', THIN) + circle(232, 124, 6, '#8d9494', THIN);
  out += rect(320, 110, 70, 46, '#c7b79a', THIN) + rect(334, 124, 14, 14, '#3d3a36', THIN);
  return out + ellipse(110, 226, 80, 12, '#6f8c7a', 'stroke="#55605d" stroke-width="1.2"');
};

const BLACKWATER: Backdrop = () => {
  let out = sky('#9fae8f', '#c3c9a2') + skyline('#7d8a6c', 'bw', HORIZON, 16) + rect(0, HORIZON, W, H - HORIZON, '#5e6b4b', NONE);
  // Glowing water between hummocks, dead trees, haze.
  for (let k = 0; k < 8; k++) {
    const h = hash(`bw-${k}`);
    out += ellipse(h % W, HORIZON + 14 + ((h >>> 7) % 70), 34 + (h % 30), 5 + (h % 4), '#7fa06a', 'stroke="none" opacity="0.7"');
  }
  out += deadTree(40, 160, 1.3, '#3a3631') + deadTree(150, 158, 0.9, '#3a3631') + deadTree(352, 162, 1.4, '#3a3631');
  return out + `<rect x="0" y="120" width="${W}" height="60" fill="#c7f27a" opacity="0.12"/>` + line(0, HORIZON, W, HORIZON, 1.2, '#4a5539');
};

const CHECKPOINT: Backdrop = () => {
  let out = sky('#cfcfbf', '#e4dcc4') + skyline('#a9a690', 'cb', HORIZON, 10) + ground('#a89a78', '#908262', 'cb');
  // A watchtower, concrete blocks, wire, sandbags.
  out += line(60, HORIZON, 66, 64, 2.4, '#6b5a48') + line(108, HORIZON, 102, 64, 2.4, '#6b5a48') + line(62, 120, 106, 90, 1.4, '#6b5a48') + line(106, 120, 62, 90, 1.4, '#6b5a48');
  out += rect(56, 50, 56, 18, '#7a7058', THIN) + poly([[52, 50], [84, 36], [116, 50]], '#5b4a3c', THIN);
  for (const x of [150, 196, 242]) out += poly([[x, 156], [x + 6, 128], [x + 34, 128], [x + 40, 156]], '#b9b4a6', THIN);
  out += line(290, 132, W, 132, 1, INK);
  for (let x = 292; x < W; x += 10) out += line(x, 128, x + 5, 136, 1, INK) + line(x + 5, 128, x, 136, 1, INK);
  for (let x = 290; x < W; x += 20) out += line(x, 128, x, 158, 2, '#6b5a48');
  return out + pathEl('M 20 160 Q 30 150 44 152 Q 56 148 66 156 L 66 162 L 20 162 Z', '#9a8f6a', THIN);
};

const RED_HAND: Backdrop = () => {
  let out = sky('#d6b796', '#e8cfae') + ground('#a89070', '#8f775a', 'rh');
  // The palisade of sharpened poles, tents, the painted hand, a fire barrel.
  for (let x = 0; x < W; x += 13) {
    const h = hash(`rh-${x}`);
    const top = 96 + (h % 14);
    out += poly([[x, HORIZON], [x, top + 6], [x + 5.5, top], [x + 11, top + 6], [x + 11, HORIZON]], '#7a5a3c', THIN);
  }
  out += poly([[60, 156], [96, 112], [132, 156]], '#8a7a5a', THIN) + poly([[250, 156], [292, 104], [334, 156]], '#6b5f4a', THIN);
  out += rect(170, 96, 48, 42, '#c9b48a', THIN) + pathEl('M 186 130 L 184 108 Q 186 104 188 108 L 189 116 L 190 104 Q 192 100 194 104 L 194 116 L 196 106 Q 198 102 200 106 L 199 118 L 202 112 Q 205 110 205 114 L 200 130 Z', '#a8402e', NONE);
  out += line(194, 138, 194, 156, 2.2, '#6b5a48') + rect(356, 140, 18, 22, '#6b7272', THIN);
  return out + `<g class="bt-flame">${pathEl('M 358 140 Q 360 128 365 132 Q 368 122 372 134 Q 374 128 372 140 Z', '#ee9a45', 'stroke="none"')}</g>`;
};

const THE_GLOW: Backdrop = () => {
  let out = sky('#a9b98c', '#d3dba8') + rect(0, HORIZON, W, H - HORIZON, '#8a8a68', NONE);
  // The crater's lip, twisted girders, cracks, the glow at the bottom.
  out += pathEl(`M 0 ${HORIZON} Q 120 120 200 128 Q 290 122 ${W} ${HORIZON} Z`, '#6f7058', NONE);
  out += `<ellipse cx="200" cy="140" rx="120" ry="20" fill="#d8ff8a" opacity="0.3" class="bt-glow"/>`;
  out += line(70, 156, 92, 96, 4, '#5d6466') + line(92, 96, 110, 104, 3, '#5d6466') + line(318, 158, 300, 104, 4, '#5d6466') + line(300, 104, 330, 92, 3, '#5d6466');
  for (let k = 0; k < 7; k++) {
    const h = hash(`gl-${k}`);
    const x = h % W;
    const y = HORIZON + 10 + ((h >>> 6) % 70);
    out += pathEl(`M ${x} ${y} l 10 4 l 6 -3 l 12 5`, 'none', `stroke="#c7f27a" stroke-width="1.4" opacity="0.8"`);
  }
  return out + line(0, HORIZON, W, HORIZON, 1.2, '#5d5e48');
};

// ---------------------------------------------------------------- the road east (§9.12)

/** The highway running away east, toward the horizon: a road in perspective, its middle line dashed. */
function highway(asphalt: string, paint: string, cracked: boolean): string {
  const vx = 214;
  let out = pathEl(`M ${vx - 14} ${HORIZON} L ${vx + 14} ${HORIZON} L ${W + 80} ${H} L -80 ${H} Z`, asphalt, NONE);
  out += pathEl(`M ${vx - 14} ${HORIZON} L -80 ${H}`, 'none', `stroke="${darken(asphalt, 0.2)}" stroke-width="1.4"`);
  out += pathEl(`M ${vx + 14} ${HORIZON} L ${W + 80} ${H}`, 'none', `stroke="${darken(asphalt, 0.2)}" stroke-width="1.4"`);
  // Dashes, longer and wider as they come nearer.
  for (let k = 0; k < 6; k++) {
    const t0 = (k * 2 + 0.4) / 12;
    const t1 = t0 + (k + 2) / 40;
    const y0 = HORIZON + (H - HORIZON) * t0 * t0;
    const y1 = HORIZON + (H - HORIZON) * Math.min(1, t1 * t1);
    out += poly([[vx - 0.6 - t0 * 2, y0], [vx + 0.6 + t0 * 2, y0], [vx + 0.6 + t1 * 3, y1], [vx - 0.6 - t1 * 3, y1]], paint, NONE);
  }
  if (cracked) {
    for (let k = 0; k < 6; k++) {
      const h = hash(`hw-${k}`);
      const x = 40 + (h % 320);
      const y = HORIZON + 16 + ((h >>> 7) % 70);
      out += pathEl(`M ${x} ${y} l 9 3 l 4 -4 l 11 6`, 'none', `stroke="${darken(asphalt, 0.3)}" stroke-width="1.2"`);
    }
  }
  return out;
}

/** A road sign on two posts, shot full of holes. */
function roadSign(x: number, y: number): string {
  return (
    rect(x + 6, y + 24, 3, HORIZON - y - 24, '#6b6559', THIN) +
    rect(x + 45, y + 24, 3, HORIZON - y - 24, '#6b6559', THIN) +
    rect(x, y, 54, 26, '#4f6a52', THIN) +
    rect(x + 3, y + 3, 48, 20, 'none', 'stroke="#d8d4c6" stroke-width="1.2"') +
    line(x + 10, y + 10, x + 32, y + 10, 2.2, '#d8d4c6') +
    line(x + 10, y + 17, x + 26, y + 17, 2.2, '#d8d4c6') +
    pathEl(`M ${x + 37} ${y + 13} h 9 m -4 -4 l 4 4 l -4 4`, 'none', 'stroke="#d8d4c6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"') +
    circle(x + 20, y + 6, 1.1, '#2b2420', NONE) +
    circle(x + 41, y + 21, 1.1, '#2b2420', NONE) +
    circle(x + 8, y + 20, 0.9, '#2b2420', NONE)
  );
}

/** Red Hand's painted hand (see their camp), at any spot and size. */
function redHand(x: number, y: number, s: number): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">${pathEl('M 0 26 L -2 4 Q 0 0 2 4 L 3 12 L 4 0 Q 6 -4 8 0 L 8 12 L 10 2 Q 12 -2 14 2 L 13 14 L 16 8 Q 19 6 19 10 L 14 26 Z', '#a8402e', NONE)}</g>`;
}

const HAVEN_TOLL: Backdrop = () => {
  let out = sky('#d8c1a0', '#ead7b4') + skyline('#b9a585', 'ht', HORIZON, 8) + ground('#b6a27c', '#9f8b66', 'ht');
  out += highway('#8f8a80', '#d9cfa8', false);
  out += roadSign(300, 58);
  // Cars dragged across the road, nose to tail, Red Hand's mark on one.
  out += car(116, 160, '#7a5a42') + car(186, 158, '#6b7272') + car(254, 161, '#8e4b33');
  out += redHand(212, 130, 0.7);
  // Burning tires by the barricade.
  out += ellipse(70, 160, 13, 4, '#2b2420', THIN) + ellipse(70, 154, 12, 4, '#2b2420', THIN) + ellipse(70, 148, 11, 3.6, '#2b2420', THIN);
  out += `<g class="bt-flame">${pathEl('M 60 146 Q 62 130 68 136 Q 71 122 75 136 Q 79 130 80 146 Z', '#ee9a45', 'stroke="none"')}</g>`;
  return out + `<path d="M 66 126 Q 58 104 70 86 Q 80 70 72 50" fill="none" stroke="#5b5a52" stroke-width="7" stroke-linecap="round" opacity="0.25"/>`;
};

const HAVEN_GLOW: Backdrop = () => {
  let out = sky('#a7b88a', '#d2dba6') + skyline('#869471', 'hg', HORIZON, 12) + rect(0, HORIZON, W, H - HORIZON, '#7d8160', NONE);
  for (let k = 0; k < 6; k++) {
    const h = hash(`hg-${k}`);
    const left = k % 2 === 0;
    out += ellipse(left ? 20 + (h % 90) : 300 + (h % 90), HORIZON + 12 + ((h >>> 6) % 60), 26 + (h % 20), 5 + (h % 3), '#c7f27a', 'stroke="none" opacity="0.45" class="bt-glow"');
  }
  out += highway('#6f6f62', '#a9a98a', true);
  // A pylon down across the verge, a burned-out bus, dead trees.
  out += line(16, 154, 104, 96, 3, '#5d6466') + line(30, 158, 112, 104, 3, '#5d6466');
  for (let k = 0; k < 5; k++) out += line(24 + k * 17, 152 - k * 11, 36 + k * 17, 156 - k * 11, 1.4, '#5d6466');
  out += rect(286, 118, 96, 38, '#6b5f4a', THIN) + rect(292, 124, 14, 12, '#2b2420', NONE) + rect(312, 124, 14, 12, '#2b2420', NONE) + rect(332, 124, 14, 12, '#2b2420', NONE) + rect(352, 124, 14, 12, '#2b2420', NONE);
  out += circle(304, 158, 6, '#2b2420', THIN) + circle(364, 158, 6, '#2b2420', THIN);
  out += deadTree(150, 156, 0.9, '#3a3631') + deadTree(262, 156, 1.1, '#3a3631');
  return out + `<rect x="0" y="110" width="${W}" height="70" fill="#c7f27a" opacity="0.1"/>`;
};

/** The dam's north gate (§9.12): open for the fight, or shut, with a small door in the wall, before it. */
function havenGate(open: boolean): string {
  let out = sky('#c9d0cb', '#e3e1d4') + skyline('#a8afa6', 'hd', 60, 18);
  // The dam: one great wall of concrete across the valley, seams down it.
  out += pathEl(`M 0 36 Q 200 24 ${W} 36 L ${W} ${HORIZON} L 0 ${HORIZON} Z`, '#a9a596', THIN);
  for (let x = 30; x < W; x += 46) out += line(x, 32, x, HORIZON, 0.8, '#8f8b7d');
  out += pathEl(`M 0 36 Q 200 24 ${W} 36`, 'none', 'stroke="#7d7a6e" stroke-width="3"');
  // Life on top: washing on a line, a chimney's smoke, a garden.
  out += line(260, 22, 260, 32, 1.4, INK) + line(330, 24, 330, 33, 1.4, INK) + line(260, 23, 330, 25, 0.8, INK);
  for (const [x, c] of [[272, '#efe8da'], [288, '#c9d3cf'], [304, '#efe8da'], [318, '#d8c7a6']] as const) out += rect(x, 24, 8, 9, c, THIN);
  out += rect(80, 16, 8, 14, '#8f8b7d', THIN) + `<path d="M 84 14 Q 78 2 88 -6" fill="none" stroke="#efe8da" stroke-width="5" stroke-linecap="round" opacity="0.6"/>`;
  for (let k = 0; k < 6; k++) out += ellipse(130 + k * 14, 29, 6, 3, k % 2 ? '#6f9a52' : '#86a85e', THIN);
  // The marksman's post on the wall.
  out += rect(24, 40, 30, 16, '#7d7a6e', THIN) + rect(30, 44, 18, 6, '#2b2420', NONE);
  // HAVEN, painted over the gate in letters taller than a man.
  out += `<text x="200" y="84" text-anchor="middle" font-family="'Big Shoulders Stencil', sans-serif" font-size="44" font-weight="800" fill="#efe8da" opacity="0.92" letter-spacing="6">HAVEN</text>`;
  out += line(160, 86, 160, 94, 1.4, '#efe8da') + line(229, 86, 229, 98, 1.4, '#efe8da');
  if (open) {
    // The north gate, swung open on the dark inside.
    out += rect(172, 100, 56, 58, '#1d1b1a', THIN);
    out += poly([[172, 100], [154, 106], [154, 160], [172, 158]], '#6b7272', THIN) + poly([[228, 100], [246, 106], [246, 160], [228, 158]], '#6b7272', THIN);
    out += line(163, 112, 163, 152, 0.8, INK) + line(237, 112, 237, 152, 0.8, INK);
  } else {
    // Shut, riveted; and a small door in the wall beside it, banged open.
    out += rect(172, 100, 56, 58, '#6b7272', THIN) + line(200, 100, 200, 158, 1.2, INK);
    for (const y of [108, 128, 148]) out += line(174, y, 226, y, 0.7, '#4f5555');
    out += rect(244, 132, 12, 26, '#1d1b1a', THIN) + poly([[256, 132], [263, 135], [263, 160], [256, 158]], '#7d7a6e', THIN);
  }
  // A white truck parked by the gate, its back shut.
  out += rect(300, 118, 62, 40, '#e6e3d8', THIN) + pathEl('M 362 158 L 362 128 L 380 128 L 390 142 L 390 158 Z', '#e6e3d8', THIN) + rect(368, 132, 12, 9, '#4f5a5a', THIN);
  out += line(330, 120, 330, 156, 0.8, INK) + circle(316, 159, 6, '#2b2420', THIN) + circle(376, 159, 6, '#2b2420', THIN);
  // The concrete apron in front of the dam.
  out += rect(0, HORIZON, W, H - HORIZON, '#a8a393', NONE);
  for (let k = 0; k < 7; k++) {
    const h = hash(`hd-${k}`);
    out += pathEl(`M ${h % W} ${HORIZON + 14 + ((h >>> 6) % 70)} l 12 2 l 5 -4 l 14 3`, 'none', 'stroke="#8a8576" stroke-width="1.1"');
  }
  return out + line(0, HORIZON, W, HORIZON, 1.2, '#7d7a6e');
}
const HAVEN_GATE: Backdrop = () => havenGate(true);
const HAVEN_GATE_SHUT: Backdrop = () => havenGate(false);

/** Where lookouts stand on the Watchtower in a raid (§9.8): the platform's floor, and its left and right ends. */
export const TOWER_DECK = { y: 104, x0: 14, x1: 70 } as const;

const DEPOT: Backdrop = () => {
  let out = sky('#cdd8cd', '#e4e0cc') + skyline('#aeb5a8', 'dp', HORIZON - 26, 16);
  // The station house and the water tower beyond the yard.
  out += rect(170, 70, 150, 64, '#b49a7a', THIN) + poly([[160, 72], [245, 46], [330, 72]], '#6b4f3f', THIN);
  for (const x of [186, 222, 262, 296]) out += rect(x, 88, 16, 22, '#3d3a36', THIN);
  out += rect(242, 108, 24, 26, '#5b4a3c', THIN);
  out += line(338, 134, 344, 60, 2.4, '#5d6466') + line(372, 134, 366, 60, 2.4, '#5d6466') + rect(332, 34, 46, 30, '#8a7a5a', THIN);
  out += ground('#a99a78', '#8f8262', 'dp');
  // The fence and its gate, which the raiders come through.
  for (let x = 96; x < W; x += 18) out += rect(x, 126, 4, 36, '#6b5a48', THIN);
  out += line(96, 134, W, 134, 2, '#6b5a48') + line(96, 150, W, 150, 2, '#6b5a48');
  out += rect(250, 120, 60, 42, '#7a6a52', THIN) + line(280, 120, 280, 162, 1.4, INK);
  // The Watchtower on the left: legs, braces, the deck lookouts stand on.
  const { y, x0, x1 } = TOWER_DECK;
  out += line(x0 + 6, H - 40, x0 + 10, y, 3, '#6b5a48') + line(x1 - 6, H - 40, x1 - 10, y, 3, '#6b5a48');
  out += line(x0 + 8, y + 40, x1 - 8, y + 80, 1.6, '#6b5a48') + line(x1 - 8, y + 40, x0 + 8, y + 80, 1.6, '#6b5a48');
  out += rect(x0, y, x1 - x0, 6, '#7a6a52', THIN) + line(x0, y - 14, x1, y - 14, 1.6, '#6b5a48') + line(x0, y - 14, x0, y, 1.6, '#6b5a48') + line(x1, y - 14, x1, y, 1.6, '#6b5a48');
  return out;
};

const BACKDROPS: Record<string, Backdrop> = {
  depot: DEPOT,
  rail_yard: RAIL_YARD,
  maple_street: MAPLE_STREET,
  kessler_farm: KESSLER_FARM,
  old_metro: OLD_METRO,
  drowned_mall: DROWNED_MALL,
  radio_station: RADIO_STATION,
  st_judes: ST_JUDES,
  water_plant: WATER_PLANT,
  blackwater: BLACKWATER,
  checkpoint_bravo: CHECKPOINT,
  red_hand_camp: RED_HAND,
  the_glow: THE_GLOW,
  haven_toll: HAVEN_TOLL,
  haven_glow: HAVEN_GLOW,
  haven_gate: HAVEN_GATE,
  haven_gate_shut: HAVEN_GATE_SHUT,
  corwin_dam: HAVEN_GATE,
};

/** Every place with a backdrop of its own; anywhere else gets open wasteland. */
export const BACKDROP_PLACES: readonly string[] = Object.keys(BACKDROPS).filter((id) => id !== 'depot');

/** The backdrop for a place in the Reach. */
export function backdropSvg(placeId: string): string {
  const draw = BACKDROPS[placeId];
  if (draw) return draw();
  return sky('#d9c7a2', '#e8d8b6') + skyline('#b3a283', placeId) + ground('#b9a47d', '#a38e68', placeId) + deadTree(330, 158, 1);
}
