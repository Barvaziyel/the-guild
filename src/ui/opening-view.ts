/**
 * The opening scene (§9.10, 3.14.0), for a new guild before anything else: the camp they lost burning
 * behind them, the founders on the rail line, the old depot, the first fire, and the guild's name. Each
 * shot moves (see `scene/opening.ts` and the yard's own motion) and holds long enough to read its line.
 * Plain TypeScript, tested in Node.
 */
import { STARTING_SURVIVORS, type GameState, type Survivor } from '../engine/index.ts';
import { portraitSvg } from '../portrait/portrait.ts';
import { RAIL_SECONDS, gateTimes, railLineSvg, yardSvg, type FigureLook } from '../scene/index.ts';
import { readingTime } from './scene-view.ts';
import type { ShotSound } from './sound-view.ts';
import { figureLook, yardModel } from './yard-view.ts';

export interface OpeningShot {
  /** The picture; missing for the title at the end. */
  svg?: string;
  caption: string;
  ms: number;
  /** A slow push in, toward this point (percent of the width and height). */
  push?: { x: number; y: number };
  /** The last shot: the guild's name, stamped. */
  title?: { name: string; day: string };
  /** The fire catches as the shot comes in. */
  catches?: boolean;
  /** Its line is something said, alone and big (“We stay.”). */
  quote?: boolean;
  /** The camera pans across, ending on whoever is about to speak. */
  pan?: boolean;
  sound: ShotSound;
}



const NUMBERS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

/** The fire and the logs round it, up close: a part of the yard's drawing, in its own shape. */
const FIRESIDE = { x: 151, y: 316, w: 120, h: 180 };

/** A yard drawing cropped to a part of it, shown up close. */
export function closeUp(svg: string, box: { x: number; y: number; w: number; h: number }): string {
  // Night closes in round the fire: dark at the edges, so up close it isn't washed out by the fire's glow.
  const vignette =
    `<defs><radialGradient id="op-vig" cx="50%" cy="44%" r="58%"><stop offset="0.25" stop-color="#05040a" stop-opacity="0"/><stop offset="1" stop-color="#05040a" stop-opacity="0.92"/></radialGradient>` +
    `<radialGradient id="op-warmth" cx="50%" cy="44%" r="42%"><stop offset="0" stop-color="#ffb25a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffb25a" stop-opacity="0"/></radialGradient></defs>` +
    `<rect class="op-warmth" x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#op-warmth)" style="mix-blend-mode:soft-light" pointer-events="none"/>` +
    `<rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" fill="url(#op-vig)" pointer-events="none"/>`;
  return svg.replace(/viewBox="[^"]*"/, `viewBox="${box.x} ${box.y} ${box.w} ${box.h}"`).replace('class="yard', 'class="op-close yard').replace(/<\/svg>$/, `${vignette}</svg>`);
}

/** Someone's face in the dark, lit from below by a fire just out of the frame: warm, flickering, embers rising. */
export function firelitFace(s: Survivor): string {
  const portrait = portraitSvg(s, { background: false }).replace('<svg ', '<svg x="10" y="120" width="380" height="380" ');
  let embers = '';
  for (let i = 0; i < 9; i++) {
    const x = 60 + ((i * 137) % 290);
    embers += `<circle class="op-fly" cx="${x}" cy="610" r="${1.6 + (i % 3) * 0.7}" fill="#ffb25a" style="animation-delay:${((i * 0.53) % 3.2).toFixed(2)}s;--drift:${(((i * 29) % 40) - 20).toFixed(0)}px"/>`;
  }
  const flames = [150, 200, 250]
    .map((x, i) => `<path class="op-tongue" style="animation-delay:${i * 0.17}s" d="M${x} 640 C ${x - 34} 600 ${x - 20} 566 ${x} 520 C ${x + 20} 566 ${x + 34} 600 ${x} 640 Z" fill="${i === 1 ? '#ffb25a' : '#e2722e'}"/>`)
    .join('');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600" class="yard opening-shot op-face" role="img" aria-label="${s.firstName}, by the fire">` +
    `<defs><radialGradient id="op-firelight" cx="50%" cy="108%" r="78%"><stop offset="0" stop-color="#ffb25a" stop-opacity="0.95"/><stop offset="0.45" stop-color="#c4561f" stop-opacity="0.45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="op-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#07060a" stop-opacity="0.92"/><stop offset="0.55" stop-color="#07060a" stop-opacity="0.25"/><stop offset="1" stop-color="#07060a" stop-opacity="0"/></linearGradient>` +
    `<filter id="op-warm"><feColorMatrix type="matrix" values="0.95 0.12 0 0 0.02  0.1 0.62 0 0 0  0 0.08 0.38 0 0  0 0 0 1 0"/></filter></defs>` +
    `<rect width="400" height="600" fill="#0b0a0f"/>` +
    `<g filter="url(#op-warm)">${portrait}</g>` +
    `<rect class="op-light" width="400" height="600" fill="url(#op-firelight)" style="mix-blend-mode:screen"/>` +
    `<rect width="400" height="600" fill="url(#op-dark)"/>` +
    flames +
    embers +
    `</svg>`
  );
}

/** Each shot stays its motion's length, or longer if its line needs it. */
const hold = (caption: string, seconds: number): number => Math.max(seconds * 1000, readingTime(caption) + 800);

export function openingShots(state: GameState): OpeningShot[] {
  const founders = state.survivors.slice(0, STARTING_SURVIVORS);
  const looks: FigureLook[] = founders.map(figureLook);
  const count = NUMBERS[founders.length] ?? String(founders.length);
  const lines = [
    'The camp burned at noon. By dusk they were walking the rail line, and the smoke still stood in the sky behind them.',
    `${count} of them, carrying what they could save. Nobody talked much.`,
    'Where the line ran out, an old rail depot: doors hanging off, a fence still standing, and nobody home.',
    'They lit a fire in the yard. Someone said it first.',
  ];
  // The old depot at dusk, the gate shut, the founders coming up the road with everything they own; the first
  // of them gets to the gate about four seconds in and swings it open (Aviel, 2026-11-28).
  const trips = founders.map((s, order) => ({ id: s.id, look: figureLook(s), way: 'in' as const, pack: 'big' as const, at: -4500, order }));
  const dusk = { ...yardModel(state, 19), bare: 'empty' as const, people: [], trips };
  const gateOpens = trips[0] ? gateTimes(trips[0]).reach - 4.5 - 0.4 : 4;
  // That night, round the fire: the only thing in the yard that's theirs yet.
  const night = { ...yardModel(state, 22), bare: 'fire' as const, people: founders.map((s, i) => ({ id: s.id, look: figureLook(s), place: { kind: 'idle' as const, slot: i }, go: '', label: s.firstName })) };
  // Under the night music: wind on the open line, the gravel under them, the old gate as the first of them reaches
  // it, the match and the fire, the stamp (3.15.0: real ones). No voice: words are heard only over the radio
  // (Aviel, 2026-11-28); “We stay.” is on the screen.
  const far = hold(lines[0]!, RAIL_SECONDS.far);
  const near = hold(lines[1]!, RAIL_SECONDS.near);
  return [
    {
      svg: railLineSvg(looks, 'far', far / 1000),
      caption: lines[0]!,
      ms: far,
      sound: { ambience: { wind: 0.9, fire: 0, crickets: 0.15, birds: 0.1 }, cues: [{ id: 'gale', gain: 0.7, delay: 0 }, { id: 'gravel_walk', gain: 0.35, delay: 0.6 }, { id: 'gravel_walk', gain: 0.4, rate: 0.97, delay: 4.4 }] },
    },
    {
      svg: railLineSvg(looks, 'near', near / 1000),
      caption: lines[1]!,
      ms: near,
      sound: { ambience: { wind: 0.75, fire: 0, crickets: 0.3, birds: 0 }, cues: [{ id: 'gale', gain: 0.5, rate: 0.96, delay: 2.5 }, { id: 'gravel_walk', gain: 0.95, delay: 0.1 }, { id: 'gravel_walk', gain: 0.9, rate: 1.03, delay: 4.0 }] },
    },
    {
      svg: yardSvg(dusk, 0),
      caption: lines[2]!,
      ms: hold(lines[2]!, 9),
      push: { x: 50, y: 88 },
      sound: { ambience: { wind: 0.6, fire: 0, crickets: 0.55, birds: 0.15 }, cues: [{ id: 'gravel_walk', gain: 0.5, delay: 0.2 }, { id: 'creak', gain: 0.8, delay: gateOpens }, { id: 'gravel_walk', gain: 0.4, rate: 0.95, delay: 4.6 }] },
    },
    {
      svg: yardSvg(night, 0),
      caption: lines[3]!,
      ms: hold(lines[3]!, 7),
      push: { x: 53, y: 64 },
      catches: true,
      // A real fire (3.15.0) from the match on, through to the end, not the yard's everyday one.
      sound: { ambience: { wind: 0.35, fire: 0, crickets: 0.8, birds: 0 }, cues: [{ id: 'match', delay: 0.2 }, { id: 'campfire', delay: 0.9 }] },
    },
    // In close on them round the fire, panning across to the one who says it; then their face, lit by the fire, and
    // what was said (Aviel, 2026-11-28, the third of three ways shown him).
    {
      svg: closeUp(yardSvg(night, 0), FIRESIDE),
      caption: '',
      ms: 3600,
      pan: true,
      sound: { ambience: { wind: 0.25, fire: 0, crickets: 0.6, birds: 0 }, cues: [] },
    },
    ...(founders[0]
      ? [
          {
            svg: firelitFace(founders[0]),
            caption: '“We stay.”',
            quote: true,
            ms: 4600,
            push: { x: 50, y: 42 },
            sound: { ambience: { wind: 0.2, fire: 0, crickets: 0.5, birds: 0 }, cues: [] },
          },
        ]
      : []),
    { caption: '', ms: 3200, title: { name: state.guildName, day: 'Day 1' }, sound: { ambience: { wind: 0.4, fire: 0, crickets: 0.7, birds: 0 }, cues: [{ id: 'stamp', delay: 0.68 }] } },
  ];
}
