/**
 * Animals (§9.7) as the screens show them: strays at the gate, the guild's
 * animals with their keepers, the sheet's line, and what followed a crew home.
 * Plain TypeScript so it can be tested in Node.
 */
import {
  animalsKeptBy,
  atDepot,
  dayStart,
  getAnimal,
  keeperOf,
  type AnimalKind,
  type GameState,
  type RunSummary,
} from '../engine/index.ts';
import { whenText } from './dilemma-view.ts';

export interface StrayRow {
  id: string;
  kind: AnimalKind;
  /** "A stray goat". */
  title: string;
  /** How it turned up. */
  text: string;
  /** What it would do for the guild. */
  effect: string;
  /** "It will wander off by 9:40 PM." */
  leaves: string;
}

/** Strays waiting at the gate. */
export function strayRows(state: GameState, now: number): StrayRow[] {
  return state.depot.strays.map((s) => {
    const def = getAnimal(s.animal.kind);
    return {
      id: s.animal.id,
      kind: s.animal.kind,
      title: `A stray ${def.name}`,
      text: def.arrives,
      effect: def.effect,
      leaves: `It will wander off by ${whenText(dayStart(state, s.expiresDay), now)}.`,
    };
  });
}

export interface AnimalRow {
  id: string;
  kind: AnimalKind;
  /** "Rust, the dog". */
  title: string;
  description: string;
  effect: string;
  keeperId?: string;
  /** "Looked after by Mara." or "Nobody looks after it." */
  keeperLine: string;
  /** Who could look after it: anyone not living at an outpost. */
  keepers: { id: string; name: string }[];
}

/** The guild's animals, for the Yard tab. */
export function animalRows(state: GameState): AnimalRow[] {
  const keepers = state.survivors.filter((s) => !s.outpost).map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}` }));
  return state.animals.map((a) => {
    const def = getAnimal(a.kind);
    const keeper = keeperOf(state, a);
    return {
      id: a.id,
      kind: a.kind,
      title: `${a.name}, the ${def.name}`,
      description: def.description,
      effect: def.effect,
      ...(keeper ? { keeperId: keeper.id } : {}),
      keeperLine: keeper ? `Looked after by ${keeper.firstName}${atDepot(keeper) ? '' : ', who is away'}.` : 'Nobody looks after it.',
      keepers,
    };
  });
}

/** "Looks after Rust, the dog, and Smudge, the cat." for the sheet, or nothing. */
export function keeperLine(state: GameState, survivorId: string): string | undefined {
  const kept = animalsKeptBy(state, survivorId);
  if (kept.length === 0) return undefined;
  const names = kept.map((a) => `${a.name}, the ${getAnimal(a.kind).name}`);
  return `Looks after ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`}.`;
}

/** "A goat followed Mara home." for a report; `names` are the crew's first names by id. */
export function followedHome(summary: RunSummary, names: Record<string, string>): string[] {
  return (summary.animals ?? []).map((a) => `A ${getAnimal(a.kind).name} followed ${(a.keeper && names[a.keeper]) || 'the crew'} home.`);
}
