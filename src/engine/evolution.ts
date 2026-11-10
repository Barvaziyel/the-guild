import { EVOLUTIONS, type EvolutionRule, type NumericCounter, type RunTally } from './content/index.ts';
import type { Rng } from './rng.ts';
import { addTrait, hasTrait, removeTrait } from './traits.ts';
import type { Survivor } from './types.ts';

export interface EvolutionContext {
  when: EvolutionRule['when'];
  rng: Rng;
  day: number;
  /** What happened on the run that just ended ('run' rules). */
  tally?: RunTally;
  /** Whether a Bonded friend is at the Depot too ('depotDay' rules). */
  bondedAtDepot?: boolean;
  rules?: readonly EvolutionRule[];
}

function conditionsMet(s: Survivor, rule: EvolutionRule, ctx: EvolutionContext): boolean {
  if (rule.when !== ctx.when) return false;
  if (hasTrait(s, rule.gain)) return false;
  if (rule.requires && !hasTrait(s, rule.requires)) return false;
  for (const counter of Object.keys(rule.counters ?? {}) as NumericCounter[]) {
    if (s.counters[counter] < (rule.counters?.[counter] ?? 0)) return false;
  }
  if (rule.needs && !((ctx.tally?.[rule.needs] ?? 0) > 0)) return false;
  if (rule.forbids && (ctx.tally?.[rule.forbids] ?? 0) > 0) return false;
  if (rule.needsBondedAtDepot && !ctx.bondedAtDepot) return false;
  return true;
}

/**
 * Check every evolution rule against a survivor and apply the ones that fire.
 * Returns the ids of traits gained. Chronicle entries are written by addTrait.
 */
export function applyEvolutions(s: Survivor, ctx: EvolutionContext): string[] {
  const gained: string[] = [];
  for (const rule of ctx.rules ?? EVOLUTIONS) {
    if (!conditionsMet(s, rule, ctx)) continue;
    if (!ctx.rng.chance(rule.chance)) continue;
    const removes = rule.removes && hasTrait(s, rule.removes) ? rule.removes : undefined;
    if (removes) removeTrait(s, removes, ctx.day);
    const result = addTrait(s, rule.gain, { day: ctx.day, source: rule.source, rng: ctx.rng, force: removes !== undefined });
    if (result.added) gained.push(rule.gain);
  }
  return gained;
}
