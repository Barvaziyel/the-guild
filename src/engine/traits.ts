import { addChronicle } from './chronicle.ts';
import { MAX_TRAITS } from './constants.ts';
import { getTrait } from './content/index.ts';
import type { Rng } from './rng.ts';
import type { Survivor, TraitDef, TraitHooks, TraitInstance } from './types.ts';

export function hasTrait(s: Survivor, id: string): boolean {
  return s.traits.some((t) => t.id === id);
}

export function getTraitInstance(s: Survivor, id: string): TraitInstance | undefined {
  return s.traits.find((t) => t.id === id);
}

/** Traits the player can see. Hidden traits still take effect. */
export function visibleTraits(s: Survivor): TraitInstance[] {
  return s.traits.filter((t) => !t.hidden);
}

/** Definitions of every trait the survivor holds (hidden included). */
export function traitDefs(s: Survivor): TraitDef[] {
  return s.traits.map((t) => getTrait(t.id));
}

/** Number of traits that count toward MAX_TRAITS (everything except conditions). */
export function traitSlotsUsed(s: Survivor): number {
  return s.traits.filter((t) => getTrait(t.id).kind !== 'condition').length;
}

export interface AddTraitOptions {
  day: number;
  /** Why it was gained; shown in tooltips and the Chronicle. */
  source?: string;
  hidden?: boolean;
  /** Target for traits that need one (Vengeful: an enemy type id). */
  target?: string;
  /** Needed to roll condition durations. */
  rng?: Rng;
  /** Ignore MAX_TRAITS (scars and stress traits are consequences, always applied). */
  force?: boolean;
  /** Don't write a Chronicle entry. */
  silent?: boolean;
}

export interface AddTraitResult {
  added: boolean;
  /** Trait id that was replaced by this one: its opposite, or at the cap the oldest one it pushed out. */
  replaced?: string;
  reason?: 'duplicate' | 'full' | 'extended';
}

/**
 * Give a survivor a trait. Handles opposites (the new trait replaces its
 * opposite), the trait cap, condition durations and the Chronicle entry.
 */
export function addTrait(s: Survivor, id: string, opts: AddTraitOptions): AddTraitResult {
  const def = getTrait(id);
  const existing = getTraitInstance(s, id);

  if (existing) {
    if (def.kind === 'condition' && def.durationDays) {
      const expires = rollExpiry(def, opts);
      if (existing.expiresDay === undefined || expires > existing.expiresDay) {
        existing.expiresDay = expires;
      }
      return { added: false, reason: 'extended' };
    }
    return { added: false, reason: 'duplicate' };
  }

  let replaced: string | undefined;
  if (def.opposite && hasTrait(s, def.opposite)) {
    replaced = def.opposite;
    s.traits = s.traits.filter((t) => t.id !== def.opposite);
  }

  // At the cap, something new pushes out the oldest habit: the earliest earned
  // or personality trait the player can see, never Veteran or Survivor (1.6.2;
  // before, people simply stopped changing once they had six).
  let pushedOut: string | undefined;
  if (def.kind !== 'condition' && !opts.force && !replaced && traitSlotsUsed(s) >= MAX_TRAITS) {
    const oldest = s.traits
      .filter((t) => !t.hidden && !KEPT_AT_CAP.has(t.id) && ['earned', 'personality'].includes(getTrait(t.id).kind))
      .sort((a, b) => a.gainedDay - b.gainedDay)[0];
    if (!oldest || opts.hidden) return { added: false, reason: 'full' };
    pushedOut = oldest.id;
    s.traits = s.traits.filter((t) => t !== oldest);
  }

  const instance: TraitInstance = { id, gainedDay: opts.day };
  if (opts.hidden) instance.hidden = true;
  if (opts.source) instance.source = opts.source;
  if (opts.target) instance.target = opts.target;
  if (def.kind === 'condition' && def.durationDays) instance.expiresDay = rollExpiry(def, opts);
  s.traits.push(instance);

  if (!opts.silent && !opts.hidden && def.kind !== 'condition') {
    const because = opts.source ? `: ${opts.source}` : '';
    const text = replaced
      ? `No longer ${getTrait(replaced).name}. Became ${def.name}${because}.`
      : pushedOut
        ? `Became ${def.name}${because}, and left being ${getTrait(pushedOut).name} behind.`
        : gainText(def, because);
    addChronicle(s, opts.day, text, ['trait', id]);
  }

  const gone = replaced ?? pushedOut;
  return gone ? { added: true, replaced: gone } : { added: true };
}

/** Traits a new one never pushes out at the cap: they mark what someone has lived through. */
const KEPT_AT_CAP = new Set(['veteran', 'survivor']);

function gainText(def: TraitDef, because: string): string {
  switch (def.kind) {
    case 'scar':
      return `Left with a permanent scar, ${def.name}${because}.`;
    case 'stress':
      return `Broke under the strain and became ${def.name}${because}.`;
    default:
      return `Became ${def.name}${because}.`;
  }
}

function rollExpiry(def: TraitDef, opts: AddTraitOptions): number {
  const [min, max] = def.durationDays ?? [1, 1];
  const days = opts.rng ? opts.rng.int(min, max) : Math.round((min + max) / 2);
  return opts.day + days;
}

export function removeTrait(s: Survivor, id: string, day: number, reason?: string): boolean {
  const before = s.traits.length;
  const instance = getTraitInstance(s, id);
  s.traits = s.traits.filter((t) => t.id !== id);
  const removed = s.traits.length < before;
  if (removed && instance && !instance.hidden && reason) {
    addChronicle(s, day, `No longer ${getTrait(id).name}: ${reason}.`, ['trait', id]);
  }
  return removed;
}

/** Reveal a hidden trait. Returns false if it wasn't hidden. */
export function revealTrait(s: Survivor, id: string, day: number): boolean {
  const instance = getTraitInstance(s, id);
  if (!instance || !instance.hidden) return false;
  delete instance.hidden;
  addChronicle(s, day, `Showed a side nobody had seen: ${getTrait(id).name}.`, ['trait', 'reveal', id]);
  return true;
}

/** Remove conditions whose expiry day has arrived. Returns the removed ids. */
export function expireConditions(s: Survivor, day: number): string[] {
  const expired = s.traits.filter((t) => t.expiresDay !== undefined && t.expiresDay <= day).map((t) => t.id);
  if (expired.length > 0) s.traits = s.traits.filter((t) => !expired.includes(t.id));
  return expired;
}

/** All trait hook objects for a survivor (hidden traits included). */
export function traitHooks(s: Survivor): TraitHooks[] {
  const out: TraitHooks[] = [];
  for (const t of s.traits) {
    const hooks = getTrait(t.id).hooks;
    if (hooks) out.push(hooks);
  }
  return out;
}

type NumericHook = {
  [K in keyof TraitHooks]-?: NonNullable<TraitHooks[K]> extends number ? K : never;
}[keyof TraitHooks];

/** Sum a numeric hook across all traits (absent = 0). */
export function sumTraitHook(s: Survivor, key: NumericHook): number {
  let total = 0;
  for (const h of traitHooks(s)) total += h[key] ?? 0;
  return total;
}

/** Multiply a multiplier hook across all traits (absent = 1). */
export function mulTraitHook(s: Survivor, key: NumericHook): number {
  let total = 1;
  for (const h of traitHooks(s)) total *= h[key] ?? 1;
  return total;
}

/** Highest value of a numeric hook across all traits (absent = 0). */
export function maxTraitHook(s: Survivor, key: NumericHook): number {
  let best = 0;
  for (const h of traitHooks(s)) best = Math.max(best, h[key] ?? 0);
  return best;
}

type FlagHook = {
  [K in keyof TraitHooks]-?: NonNullable<TraitHooks[K]> extends boolean ? K : never;
}[keyof TraitHooks];

export function anyTraitHook(s: Survivor, key: FlagHook): boolean {
  return traitHooks(s).some((h) => h[key] === true);
}
