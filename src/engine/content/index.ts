import type { GearDef, TraitDef } from '../types.ts';
import { GEAR } from './gear.ts';
import { ORIGINS, type OriginDef } from './origins.ts';
import { TRAITS } from './traits.ts';

export { GEAR } from './gear.ts';
export { ORIGINS, type OriginDef } from './origins.ts';
export { TRAITS } from './traits.ts';
export { FIRST_NAMES, LAST_NAMES } from './names.ts';

const traitById = new Map<string, TraitDef>(TRAITS.map((t) => [t.id, t]));
const gearById = new Map<string, GearDef>(GEAR.map((g) => [g.id, g]));
const originById = new Map<string, OriginDef>(ORIGINS.map((o) => [o.id, o]));

export function getTrait(id: string): TraitDef {
  const def = traitById.get(id);
  if (!def) throw new Error(`Unknown trait: ${id}`);
  return def;
}

export function findTrait(id: string): TraitDef | undefined {
  return traitById.get(id);
}

export function getGear(id: string): GearDef {
  const def = gearById.get(id);
  if (!def) throw new Error(`Unknown gear: ${id}`);
  return def;
}

export function findGear(id: string): GearDef | undefined {
  return gearById.get(id);
}

export function getOrigin(id: string): OriginDef {
  const def = originById.get(id);
  if (!def) throw new Error(`Unknown origin: ${id}`);
  return def;
}
