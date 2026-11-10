/**
 * Colors for the "scavenger's field journal" look: ink lines, flat muted
 * fills, and a rust / teal / bone palette.
 */

export const INK = '#2b2420';
export const PAPER = '#eadfc8';
export const BONE = '#efe6d2';
export const STEEL = '#8d9494';
export const LEATHER = '#5b3d2a';
export const BLOOD = '#9c3b2c';

/** Watercolor wash behind the figure. */
export const WASHES = ['#7fa39a', '#c98a5e', '#cfae6a', '#9aa886', '#b9a590', '#8fa7b3', '#b4877a'] as const;

export interface SkinTone {
  base: string;
  shade: string;
  lip: string;
}

export const SKIN: readonly SkinTone[] = [
  { base: '#f0d5bc', shade: '#d9b596', lip: '#c98a78' },
  { base: '#e6c3a0', shade: '#cba27c', lip: '#bd7f6a' },
  { base: '#d6a981', shade: '#b98a62', lip: '#a96a55' },
  { base: '#c08e66', shade: '#a2734d', lip: '#96594a' },
  { base: '#a67650', shade: '#895c3b', lip: '#834a3e' },
  { base: '#8a5d3f', shade: '#6f482e', lip: '#6d3d33' },
  { base: '#6d4630', shade: '#553422', lip: '#56302a' },
  { base: '#523425', shade: '#3f2619', lip: '#472722' },
];

export interface HairColor {
  base: string;
  dark: string;
}

export const HAIR: readonly HairColor[] = [
  { base: '#2f2925', dark: '#1c1815' },
  { base: '#4a3527', dark: '#33231a' },
  { base: '#6b4a30', dark: '#4d3421' },
  { base: '#8a5a34', dark: '#684126' },
  { base: '#9c4f2e', dark: '#763822' },
  { base: '#b9975c', dark: '#957641' },
  { base: '#d2bf8c', dark: '#ad9967' },
  { base: '#3a2a22', dark: '#251a15' },
];

/** Hair goes grey with age. */
export const GREY_HAIR: readonly HairColor[] = [
  { base: '#8e8a82', dark: '#6c6861' },
  { base: '#b3aea3', dark: '#8f8a80' },
  { base: '#d6d0c2', dark: '#b0aa9c' },
];

export const CLOTH = ['#5f7f78', '#a8603f', '#7d6c4f', '#4f5b66', '#868b63', '#6c505c', '#b89a60', '#454d4c', '#8c6f56', '#55705a'] as const;

export const IRIS = ['#4f3423', '#2e241d', '#75653a', '#55704a', '#5f7f8c', '#6e5a3c'] as const;

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function parse(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
}

/** Blend two colors: t = 0 gives a, t = 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function darken(hex: string, t: number): string {
  return mix(hex, INK, t);
}

export function lighten(hex: string, t: number): string {
  return mix(hex, BONE, t);
}
