/**
 * Places that need the right people (§7.16, 3.13.0), as the planner, the Reach and the radio show
 * them: a place's best part on each level, its needs as pictures, lit when someone in the crew covers
 * one, and the perks a crew's pairs bring. No numbers: who covers it, or nobody. Plain TypeScript, tested in Node.
 */
import {
  DEPTH_NAMES,
  NEEDS,
  NEED_CARGO,
  crewPerks,
  gearCalled,
  getTrait,
  getVehicleDef,
  knowsPart,
  needsCoveredBy,
  partAt,
  plannedPart,
  type GameState,
  type NeedCover,
  type NeedKind,
  type PlannedNeed,
  type PressOnView,
  type RunPlan,
  type Survivor,
} from '../engine/index.ts';
import type { Chip, GlyphName } from './glyphs.ts';

/** Each need as a picture. */
export const NEED_GLYPHS: Record<NeedKind, GlyphName> = {
  locked: 'lock',
  heavy: 'weight',
  radiation: 'rads',
  machines: 'cog',
  flooded: 'water',
  carry: 'load',
  traps: 'trap',
  animals: 'paw',
};

/** A crew perk as a picture. */
const PERK_GLYPHS: Record<string, GlyphName> = {
  look_and_check: 'eye',
  keep_breathing: 'meds',
  old_hands: 'shield',
  strip_it: 'wrench',
  bait_and_shot: 'swords',
};

const firstName = (state: GameState, id: string): string => state.survivors.find((s) => s.id === id)?.firstName ?? '?';

/** Who covers it, in a few words: "Maya", "Maya and Dex", "the Pickup Truck". */
function coverShort(state: GameState, cover: NeedCover, plan?: RunPlan): string {
  if (cover.how === 'together') return `${firstName(state, cover.by)} & ${firstName(state, cover.with!)}`;
  if (cover.how === 'vehicle') return rideName(state, plan) ?? firstName(state, cover.by);
  return firstName(state, cover.by);
}

/** How they cover it, read out: "Maya, with the lockpicks". */
function coverLong(state: GameState, cover: NeedCover, plan?: RunPlan): string {
  const who = firstName(state, cover.by);
  switch (cover.how) {
    case 'trait':
      return `${who}, ${getTrait(cover.trait!).name}`;
    case 'gear':
    case 'tool':
      return `${who}, with ${gearCalled(cover.item!)}`;
    case 'together':
      return `${who} and ${firstName(state, cover.with!)}, together`;
    case 'vehicle':
      return `the ${rideName(state, plan) ?? 'vehicle'}`;
    case 'stat':
      return who;
  }
}

/** The vehicle on the plan with room for a load. */
function rideName(state: GameState, plan?: RunPlan): string | undefined {
  const v = (plan?.vehicles ?? []).map((id) => state.vehicles.find((x) => x.id === id)).find((x) => x && getVehicleDef(x.defId).cargo >= NEED_CARGO);
  return v ? getVehicleDef(v.defId).name : undefined;
}

/** A need as a tag: lit with who covers it, or dark with what it is. */
export function needChip(state: GameState, need: PlannedNeed, plan?: RunPlan): Chip {
  const def = NEEDS[need.kind];
  const glyph = NEED_GLYPHS[need.kind];
  if (need.cover) return { glyph, text: coverShort(state, need.cover, plan), tone: 'good', label: `${def.name}: ${coverLong(state, need.cover, plan)}` };
  return { glyph, text: def.name, dim: true, label: `${def.name}: needs ${def.takes}. Nobody in this crew.` };
}

/** A need as a plain tag, with no crew to light it: on the Reach. */
export function needTag(kind: NeedKind): Chip {
  const def = NEEDS[kind];
  return { glyph: NEED_GLYPHS[kind], text: def.name, label: `${def.name}: needs ${def.takes}` };
}

/** What isn't known yet. */
export const UNKNOWN_PART: Chip = { glyph: 'unknown', text: 'Not known', dim: true, label: 'Not known yet: a crew that searches there finds out, and scouts see a level further in' };

export interface PartCardView {
  level: number;
  levelName: string;
  /** The part's name once known. */
  title?: string;
  chips: Chip[];
  /** Every need covered: they'll get in. */
  open: boolean;
}

/** The planner's card: the best part of the level the plan goes to, and how this crew covers it. */
export function partCard(state: GameState, plan: RunPlan): PartCardView | undefined {
  const seen = plannedPart(state, plan);
  if (!seen) return undefined;
  const base = { level: seen.level, levelName: DEPTH_NAMES[seen.level - 1]! };
  if (!seen.known) return { ...base, chips: [UNKNOWN_PART], open: false };
  return {
    ...base,
    title: seen.part.title,
    chips: seen.needs.map((n) => needChip(state, n, plan)),
    open: plan.crew.length > 0 && seen.needs.every((n) => n.cover !== undefined),
  };
}

/** The tags on someone in the crew picker: the needs here they cover alone, once the guild knows of them. */
export function coverChips(state: GameState, s: Survivor, plan: RunPlan): Chip[] {
  const seen = plannedPart(state, plan);
  if (!seen?.known) return [];
  return needsCoveredBy(s, plan.locationId, seen.level).map((k) => ({ glyph: NEED_GLYPHS[k], text: NEEDS[k].name, tone: 'good' as const, label: `${NEEDS[k].name}: ${s.firstName} can do it` }));
}

/** The Reach's levels: each one's best part, if the guild knows of it. */
export function levelPart(state: GameState, locationId: string, level: number): { title?: string; chips: Chip[] } | undefined {
  const part = partAt(locationId, level);
  if (!part) return undefined;
  if (!knowsPart(state, locationId, level)) return { chips: [UNKNOWN_PART] };
  return { title: part.title, chips: part.needs.map((n) => needTag(n.kind)) };
}

/** Whether to show a place's levels on the Reach at all: once there's more than the outskirts, or a part is known. */
export function anyPartKnown(state: GameState, locationId: string): boolean {
  return [1, 2, 3].some((l) => knowsPart(state, locationId, l));
}

/** The radio's press-on card: what the level further in needs, lit by the crew as they stand. */
export function deeperChips(view: PressOnView): Chip[] {
  if (!view.part) return [];
  if (!view.part.known) return [UNKNOWN_PART];
  return view.part.needs.map((n) => {
    const def = NEEDS[n.kind];
    return n.covered
      ? { glyph: NEED_GLYPHS[n.kind], text: def.name, tone: 'good' as const, label: `Further in, ${def.name.toLowerCase()}: someone here can do it` }
      : { glyph: NEED_GLYPHS[n.kind], text: def.name, dim: true as const, label: `Further in, ${def.name.toLowerCase()}: needs ${def.takes}, and nobody here can` };
  });
}

/** The crew's perks (§7.16), for the action bar beside how well they get on. */
export function perkChips(state: GameState, crew: readonly string[]): Chip[] {
  const people = crew.map((id) => state.survivors.find((s) => s.id === id)).filter((s): s is Survivor => s !== undefined);
  return crewPerks(people).map(({ perk, pair }) => ({
    glyph: PERK_GLYPHS[perk.id] ?? 'star',
    text: perk.name,
    tone: 'good' as const,
    label: `${firstName(state, pair[0])} and ${firstName(state, pair[1])}: ${perk.does}`,
  }));
}
