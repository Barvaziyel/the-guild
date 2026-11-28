/**
 * The opening scene (§9.10, 3.14.0), for a new guild before anything else: the camp they lost burning
 * behind them, the founders on the rail line, the old depot, the first fire, and the guild's name. Each
 * shot moves (see `scene/opening.ts` and the yard's own motion) and holds long enough to read its line.
 * Plain TypeScript, tested in Node.
 */
import { STARTING_SURVIVORS, type GameState } from '../engine/index.ts';
import { RAIL_SECONDS, railLineSvg, yardSvg, type FigureLook } from '../scene/index.ts';
import { readingTime } from './gate-scene.ts';
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
  /** Nobody home: the windows dark. */
  dark?: true;
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
  const before = yardModel(state, 19);
  const dusk = { ...before, buildings: { ...before.buildings, firepit: 0 }, people: [], trips: founders.map((s, order) => ({ id: s.id, look: figureLook(s), way: 'in' as const, pack: 'big' as const, at: 0, order })) };
  // That night, round the fire.
  const night = yardModel(state, 22);
  return [
    { svg: railLineSvg(looks, 'far'), caption: lines[0]!, ms: hold(lines[0]!, RAIL_SECONDS.far) },
    { svg: railLineSvg(looks, 'near'), caption: lines[1]!, ms: hold(lines[1]!, RAIL_SECONDS.near) },
    { svg: yardSvg(dusk, 0), caption: lines[2]!, ms: hold(lines[2]!, 8), push: { x: 50, y: 88 }, dark: true },
    { svg: yardSvg(night, 0), caption: lines[3]!, ms: hold(lines[3]!, 6), push: { x: 53, y: 64 } },
    { caption: '', ms: 3200, title: { name: state.guildName, day: 'Day 1' } },
  ];
}
