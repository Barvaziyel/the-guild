/**
 * What the yard drawing shows, as plain data. `src/ui/yard-view.ts` builds it
 * from the game; this module only draws it. Positions are the drawing's
 * business: the model says where someone is (at a post, by the fire, on a cot,
 * at the gate), and `layout.ts` turns that into a spot.
 */
import type { AnimalKind, BuildingId, ProjectId } from '../engine/types.ts';

/** How a small figure is drawn: colors from the survivor's portrait. */
export interface FigureLook {
  skin: string;
  skinShade: string;
  hair: string;
  hairDark: string;
  /** Long hair falls past the shoulders. */
  longHair: boolean;
  bald: boolean;
  cloth: string;
  accent: string;
  /** A vest or suit over the clothes, by armor id. */
  armor?: string;
  hat?: 'beanie' | 'bandana' | 'goggles';
  /** Bandaged: wounded or badly wounded. */
  hurt: boolean;
}

export type Place =
  /** Working a post at a building: slot 0, 1 or 2. */
  | { kind: 'post'; building: BuildingId; slot: number }
  /** On a project's crew, at work on it: slot 0, 1 or 2. */
  | { kind: 'project'; project: ProjectId; slot: number }
  /** Hanging out, around the fire first. Partners get neighbouring slots. */
  | { kind: 'idle'; slot: number }
  /** Resting until healed, on a cot by the Infirmary (or by the Bunks without one). */
  | { kind: 'resting'; slot: number; infirmary: boolean }
  /** Waiting outside the gate to join. */
  | { kind: 'gate'; slot: number };

export interface YardPerson {
  id: string;
  look: FigureLook;
  place: Place;
  /** Where a tap leads: a route hash such as "#/s/s3". */
  go: string;
  /** Read out for screen readers, and shown when tapped: "Mara Quill, working the Garden". */
  label: string;
}

export interface YardVehicle {
  id: string;
  defId: string;
  broken: boolean;
  label: string;
}

/** One of the guild's animals (§9.7). The dog keeps by its keeper when they're in the yard. */
export interface YardAnimal {
  id: string;
  kind: AnimalKind;
  keeperId?: string;
  label: string;
}

export type DayPhase = 'dawn' | 'day' | 'dusk' | 'night';

export interface YardModel {
  /** Level of every building; 0 is an empty lot. */
  buildings: Record<BuildingId, number>;
  /** How far each project has got (§9.6). */
  projects: Record<ProjectId, { done: number; working: boolean }>;
  /** Everyone at the Depot, and the recruits at the gate. */
  people: YardPerson[];
  /** A trader's cart at the gate. */
  trader: boolean;
  /** Vehicles at home. */
  vehicles: YardVehicle[];
  /** The guild's animals. */
  animals: YardAnimal[];
  phase: DayPhase;
}

/** The light by the hour on the player's clock. */
export function dayPhase(hour: number): DayPhase {
  if (hour >= 5 && hour < 7) return 'dawn';
  if (hour >= 7 && hour < 18) return 'day';
  if (hour >= 18 && hour < 20) return 'dusk';
  return 'night';
}
