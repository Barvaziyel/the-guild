import type { GameState, Survivor } from './types.ts';

/** Add a line to a survivor's life story. Text is written without the subject: "Lost an eye at the Drowned Mall." */
export function addChronicle(s: Survivor, day: number, text: string, tags?: string[]): void {
  s.chronicle.push(tags && tags.length > 0 ? { day, text, tags } : { day, text });
}

/** Add a line to the guild-wide log. */
export function addGuildLog(state: GameState, day: number, text: string, tags?: string[]): void {
  state.log.push(tags && tags.length > 0 ? { day, text, tags } : { day, text });
}
