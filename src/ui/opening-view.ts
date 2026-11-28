/**
 * The opening scene (§9.10, 3.14.0), for a new guild before anything else: the camp they lost burning
 * behind them, the founders on the rail line, the old depot, the first fire, and the guild's name. Each
 * shot moves (see `scene/opening.ts` and the yard's own motion) and holds long enough to read its line.
 * Plain TypeScript, tested in Node.
 */
import { STARTING_SURVIVORS, type GameState } from '../engine/index.ts';
import { RAIL_SECONDS, railLineSvg, yardSvg, type FigureLook } from '../scene/index.ts';
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
  sound: ShotSound;
}



const NUMBERS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'];

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
    'They lit a fire in the yard. Someone said it first. “We stay.”',
  ];
  // The old depot at dusk, the founders coming in through the gate with everything they own.
  const dusk = { ...yardModel(state, 19), bare: 'empty' as const, people: [], trips: founders.map((s, order) => ({ id: s.id, look: figureLook(s), way: 'in' as const, pack: 'big' as const, at: -4500, order })) };
  // That night, round the fire: the only thing in the yard that's theirs yet.
  const night = { ...yardModel(state, 22), bare: 'fire' as const, people: founders.map((s, i) => ({ id: s.id, look: figureLook(s), place: { kind: 'idle' as const, slot: i }, go: '', label: s.firstName })) };
  // Under the night music: wind on the open line, the gravel under them, the old gate as the first of them reaches
  // it, the match and the fire, the stamp (3.15.0: real ones). No voice: words are heard only over the radio
  // (Aviel, 2026-11-28); “We stay.” is on the screen.
  return [
    {
      svg: railLineSvg(looks, 'far'),
      caption: lines[0]!,
      ms: hold(lines[0]!, RAIL_SECONDS.far),
      sound: { ambience: { wind: 0.9, fire: 0, crickets: 0.15, birds: 0.1 }, cues: [{ id: 'gale', gain: 0.7, delay: 0 }, { id: 'gravel_walk', gain: 0.35, delay: 0.6 }, { id: 'gravel_walk', gain: 0.4, rate: 0.97, delay: 4.4 }] },
    },
    {
      svg: railLineSvg(looks, 'near'),
      caption: lines[1]!,
      ms: hold(lines[1]!, RAIL_SECONDS.near),
      sound: { ambience: { wind: 0.75, fire: 0, crickets: 0.3, birds: 0 }, cues: [{ id: 'gale', gain: 0.5, rate: 0.96, delay: 2.5 }, { id: 'gravel_walk', gain: 0.95, delay: 0.1 }, { id: 'gravel_walk', gain: 0.9, rate: 1.03, delay: 4.0 }] },
    },
    {
      svg: yardSvg(dusk, 0),
      caption: lines[2]!,
      ms: hold(lines[2]!, 9),
      push: { x: 50, y: 88 },
      sound: { ambience: { wind: 0.6, fire: 0, crickets: 0.55, birds: 0.15 }, cues: [{ id: 'gravel_walk', gain: 0.5, delay: 0.2 }, { id: 'creak', gain: 0.8, delay: 4.0 }, { id: 'gravel_walk', gain: 0.4, rate: 0.95, delay: 4.6 }] },
    },
    {
      svg: yardSvg(night, 0),
      caption: lines[3]!,
      ms: hold(lines[3]!, 7),
      push: { x: 53, y: 64 },
      catches: true,
      sound: { ambience: { wind: 0.35, fire: 0.9, crickets: 0.8, birds: 0 }, cues: [{ id: 'match', delay: 0.2 }] },
    },
    { caption: '', ms: 3200, title: { name: state.guildName, day: 'Day 1' }, sound: { ambience: { wind: 0.4, fire: 0.8, crickets: 0.7, birds: 0 }, cues: [{ id: 'stamp', delay: 0.68 }] } },
  ];
}
