import type { GearDef, TraitDef } from '../types.ts';
import { ENEMIES, type EnemyDef } from './enemies.ts';
import { GEAR } from './gear.ts';
import { LOCATIONS, type LocationDef } from './locations.ts';
import { ORIGINS, type OriginDef } from './origins.ts';
import { TRAITS } from './traits.ts';
import { VEHICLES, type VehicleDef } from './vehicles.ts';

export { GEAR } from './gear.ts';
export { ORIGINS, type OriginDef } from './origins.ts';
export { TRAITS } from './traits.ts';
export { FIRST_NAMES, LAST_NAMES } from './names.ts';
export { ENEMIES, type EnemyDef, type EnemyType } from './enemies.ts';
export { LOCATIONS, type LocationDef, type EncounterDef, type HazardKind } from './locations.ts';
export {
  EVENTS,
  type EventDef,
  type EventRole,
  type EventEffect,
  type EventOutcome,
  type EventCheck,
  type EventTarget,
} from './events.ts';
export { EVOLUTIONS, type EvolutionRule, type RunTally, type NumericCounter } from './evolutions.ts';
export { BUILDINGS, type BuildingDef, type BuildingLevel } from './buildings.ts';
export { RECIPES, UPGRADES, type Recipe, type Upgrade } from './workshop.ts';
export { NEMESIS_NAMES, NICKNAMES, WEAPON_NAMES, type NicknameRule } from './stories.ts';
export { VEHICLES, type VehicleDef } from './vehicles.ts';
export { LINE_STOPS, PROJECTS, getProject, type ProjectDef, type ProjectStage } from './projects.ts';

const traitById = new Map<string, TraitDef>(TRAITS.map((t) => [t.id, t]));
const gearById = new Map<string, GearDef>(GEAR.map((g) => [g.id, g]));
const enemyById = new Map<string, EnemyDef>(ENEMIES.map((e) => [e.id, e]));
const locationById = new Map<string, LocationDef>(LOCATIONS.map((l) => [l.id, l]));
const originById = new Map<string, OriginDef>(ORIGINS.map((o) => [o.id, o]));
const vehicleById = new Map<string, VehicleDef>(VEHICLES.map((v) => [v.id, v]));

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

export function getEnemy(id: string): EnemyDef {
  const def = enemyById.get(id);
  if (!def) throw new Error(`Unknown enemy: ${id}`);
  return def;
}

export function findEnemy(id: string): EnemyDef | undefined {
  return enemyById.get(id);
}

export function getLocation(id: string): LocationDef {
  const def = locationById.get(id);
  if (!def) throw new Error(`Unknown location: ${id}`);
  return def;
}

export function findLocation(id: string): LocationDef | undefined {
  return locationById.get(id);
}

export function getVehicleDef(id: string): VehicleDef {
  const def = vehicleById.get(id);
  if (!def) throw new Error(`Unknown vehicle: ${id}`);
  return def;
}
export { DILEMMAS, getDilemma, type DilemmaDef, type DilemmaChoice, type DilemmaOutcome, type DilemmaEffect, type DilemmaTest, type DilemmaWho } from './dilemmas.ts';
