/**
 * Scenes played on the battle stage (4b): Haven's gate before the last fight, and the first sight of an
 * elite. A scene is a few shots; each moves for as long as its lines take to read, and has its sound.
 * `components/SceneStage.tsx` plays them. Plain TypeScript, tested in Node.
 */
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
}

/** Long enough to read the line: a moment, and a bit more for each word. */
export function readingTime(text: string): number {
  return Math.round(1400 + text.split(/\s+/).length * 260);
}
