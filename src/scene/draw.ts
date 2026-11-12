/**
 * Small SVG helpers and the yard's colors. Same look as the portraits: ink
 * outlines, flat muted fills.
 */
import { BONE, INK, darken, lighten, mix } from '../portrait/palette.ts';

export { BONE, INK, darken, lighten, mix };

export const C = {
  dirt: '#b9a47d',
  dirtDark: '#a38e68',
  road: '#9d8d70',
  brick: '#9a5a3e',
  brickDark: '#7c4630',
  roof: '#5b4a3c',
  window: '#3d3a36',
  lit: '#f2c66d',
  boxcar: '#8e4b33',
  steel: '#8d9494',
  steelDark: '#6b7272',
  canvas: '#ddd3bd',
  wood: '#8a6844',
  woodDark: '#6b4f33',
  plant: '#6f8a4f',
  plantDark: '#55703c',
  stone: '#9b9488',
  flame: '#ee9a45',
  flameCore: '#f7d36b',
  cross: '#a8402e',
  trousers: '#4a4541',
  boots: '#3a302a',
  rail: '#5d6466',
  tie: '#6b5a48',
  fence: '#767c76',
} as const;

const n = (v: number): string => String(Math.round(v * 10) / 10);

export const SW = 1.3;

/** Stroke attributes: ink, rounded joins. */
export function ink(width = SW): string {
  return `stroke="${INK}" stroke-width="${n(width)}" stroke-linejoin="round" stroke-linecap="round"`;
}

export function rect(x: number, y: number, w: number, h: number, fill: string, extra = ''): string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" ${extra || ink()}/>`;
}

export function poly(points: readonly (readonly [number, number])[], fill: string, extra = ''): string {
  return `<polygon points="${points.map(([x, y]) => `${n(x)},${n(y)}`).join(' ')}" fill="${fill}" ${extra || ink()}/>`;
}

export function pathEl(d: string, fill: string, extra = ''): string {
  return `<path d="${d}" fill="${fill}" ${extra || ink()}/>`;
}

export function circle(cx: number, cy: number, r: number, fill: string, extra = ''): string {
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${fill}" ${extra || ink()}/>`;
}

export function ellipse(cx: number, cy: number, rx: number, ry: number, fill: string, extra = ''): string {
  return `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" ${extra || ink()}/>`;
}

export function line(x1: number, y1: number, x2: number, y2: number, width = SW, color: string = INK): string {
  return `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="round"/>`;
}

/** A tap target over an area: invisible, but it catches the tap. */
export function hit(x: number, y: number, w: number, h: number): string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#000" fill-opacity="0"/>`;
}

/** A small stable number from a string, for picking colors and offsets. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function escapeAttr(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** An interactive group: what a tap selects, where it leads, and what it says. */
export function tappable(key: string, go: string, label: string, body: string): string {
  return `<g class="yard-tap" data-key="${escapeAttr(key)}" data-go="${escapeAttr(go)}" data-label="${escapeAttr(label)}" role="button" tabindex="0" aria-label="${escapeAttr(label)}">${body}</g>`;
}
