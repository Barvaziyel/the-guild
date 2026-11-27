/**
 * Elites on screen (§7.15, 3.12.0): what lives at a place once the guild has
 * seen it, as a picture, a row of tags and its prize; going after it from the
 * planner; its prize on the card when a crew calls about it.
 */
import { eliteStatus, getEnemy, getGear, type EnemyDef, type GameState, type RunPlan } from '../engine/index.ts';
import type { Chip } from './glyphs.ts';
import type { Choice } from './runs-view.ts';

export interface EliteCardView {
  id: string;
  kind: string;
  type: string;
  /** "The Switchman". */
  name: string;
  description: string;
  state: 'atLarge' | 'dead';
  /** What it does, as tags. */
  chips: Chip[];
  /** Its prize: a Relic with a name, and what it is ("Relic Crowbar"). */
  prize: { item: string; name: string; what: string };
  /** Once it's dead: who brought it down, and when. */
  line?: string;
}

/** What it does that matters in a fight, as tags (the game's own words for each). */
export function eliteChips(def: EnemyDef): Chip[] {
  const out: Chip[] = [];
  if (def.plates) out.push({ glyph: 'plates', text: `${def.plates} plates`, label: `Plated: each hit knocks one of its ${def.plates} plates off instead of hurting it` });
  if (def.calls) out.push({ glyph: 'noise', text: `calls ${def.calls.max}`, label: `Calls up to ${def.calls.max} more of them in` });
  if (def.sweeps) out.push({ glyph: 'sweep', text: 'sweeps', label: 'Sweeps a whole rank of you at once' });
  if (def.dives) out.push({ glyph: 'wave', text: 'goes under', label: 'Goes under the water, then comes up under any one of you' });
  if (def.enrages) out.push({ glyph: 'bolt', text: 'twice at half', label: 'Strikes twice once it is down to half' });
  if (def.flies) out.push({ glyph: 'ammo', text: 'only shots', label: 'Up out of reach: only a shot gets to it' });
  if (def.aims) out.push({ glyph: 'pin', text: 'aims', label: 'Lines up shots a round ahead' });
  if (def.mends) out.push({ glyph: 'meds', text: 'mends', label: 'Patches up the others' });
  if (def.grabs) out.push({ glyph: 'hurt', text: 'grabs', label: 'Grabs one of you and holds on' });
  if (def.rises) out.push({ glyph: 'rise', text: 'gets up', label: 'Gets back up once unless finished on the ground' });
  if (def.rads) out.push({ glyph: 'skull', text: `+${def.rads} rads`, label: `Each hit is ${def.rads} radiation too` });
  return out;
}

/** "Relic Crowbar". */
function prizeWhat(item: string): string {
  return `Relic ${getGear(item).name}`;
}

/** The elite at a place, once the guild has seen it; undefined before then, or where none lives. */
export function eliteCard(state: GameState, placeId: string): EliteCardView | undefined {
  const status = eliteStatus(state, placeId);
  if (!status || status.state === 'unknown') return undefined;
  const def = status.def;
  const elite = def.elite!;
  const killer = status.record?.killedBy;
  return {
    id: def.id,
    kind: def.id,
    type: def.type,
    name: def.name,
    description: def.description,
    state: status.state,
    chips: eliteChips(def),
    prize: { item: elite.prize.item, name: elite.prize.name, what: prizeWhat(elite.prize.item) },
    ...(status.state === 'dead' && killer ? { line: `Brought down by ${killer.name} on day ${status.record!.diedDay ?? status.record!.seen}.` } : {}),
  };
}

/** Whether the planner offers going after it: seen, at large, and a job that goes looking. */
export function eliteChoice(state: GameState, plan: RunPlan): EliteCardView | undefined {
  const card = eliteCard(state, plan.locationId);
  if (!card || card.state !== 'atLarge') return undefined;
  return ['scavenge', 'scout', 'hunt'].includes(plan.job) ? card : undefined;
}

/** Going after it, or not. */
export function withElite(plan: RunPlan, go: boolean): RunPlan {
  const { elite: _, ...rest } = plan;
  return go ? { ...rest, elite: true } : rest;
}

/** A plan whose job no longer goes looking drops the order. */
export function withJobElite(plan: RunPlan): RunPlan {
  return plan.elite && !['scavenge', 'scout', 'hunt'].includes(plan.job) ? withElite(plan, false) : plan;
}

/** Its prize, as a tag for the card when a crew calls about it. */
export function prizeChip(eliteId: string): Chip {
  const def = getEnemy(eliteId);
  const prize = def.elite!.prize;
  return { glyph: 'star', text: prize.name, tone: 'good', label: `Bring down ${def.name.replace(/^The /, 'the ')} for ${prize.name}, a ${prizeWhat(prize.item)}` };
}

/** A place's tag in the Reach's list: the elite that's still at large there. */
export function eliteTag(state: GameState, placeId: string): string | undefined {
  const card = eliteCard(state, placeId);
  return card?.state === 'atLarge' ? card.name : undefined;
}

/** Going after it from the planner: the choice, and what each means as tags. */
export const ELITE_CHOICES: readonly Choice<'no' | 'yes'>[] = [
  { id: 'no', name: 'Leave it be', description: 'Run as planned. It may still turn up.', chips: [] },
  { id: 'yes', name: 'Go after it', description: 'At the deepest point of the run, they find where it lives.', chips: [{ glyph: 'swords', text: 'its lair', label: 'They find where it lives, at the deepest point of the run' }] },
];
