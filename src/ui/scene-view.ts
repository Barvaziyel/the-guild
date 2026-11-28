/**
 * Scenes played on the battle stage (4b): Haven's gate before the last fight, and the first sight of an
 * elite. A scene is a few shots; each moves for as long as its lines take to read, and has its sound.
 * `components/SceneStage.tsx` plays them. Plain TypeScript, tested in Node.
 */
import type { Survivor } from '../engine/index.ts';
import type { StageModel } from '../scene/index.ts';
import type { ShotSound } from './sound-view.ts';

export interface SceneShot {
  /** The stage, moving (`StageExtra.keys`, `StageModel.arrive`, a timed `shot`). */
  model: StageModel;
  /** Its lines under the stage, each from so many seconds in. */
  lines: { at: number; text: string }[];
  /** How long it plays before the next. */
  ms: number;
  sound: ShotSound;
  /** Close-ups: someone's own face over the stage while they speak, so it's plain who it is. */
  faces?: SceneFace[];
  /** A name stamped down over the stage from so many seconds in, the stage jolting with it (an elite's, 4c). */
  stamp?: SceneStamp;
}

/** A name slammed down over the stage (4c): big, in the stencil, with a smaller line under it. */
export interface SceneStamp {
  at: number;
  title: string;
  sub?: string;
  /** Up top, over the sky, for something low to the ground that a stamp across the bottom would cover. */
  top?: boolean;
}

/** A face over the stage in a scene (4b): someone of the guild, or of the Vultures, from and until so many seconds in. */
export interface SceneFace {
  survivor: Survivor;
  name: string;
  at: number;
  until: number;
  /** Shaking with fear and pain, or a Vulture, hard. */
  tone: 'hurt' | 'vulture';
  side: 'left' | 'right';
}

/** Long enough to read the line: a moment, and a bit more for each word. */
export function readingTime(text: string): number {
  return Math.round(1400 + text.split(/\s+/).length * 260);
}
