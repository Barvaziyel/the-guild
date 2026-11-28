import type { GearDef, TraitDef } from '../types.ts';
import { ENEMIES, type EnemyDef } from './enemies.ts';
import { GEAR } from './gear.ts';
import { HAVEN_SITE, LOCATIONS, type LocationDef } from './locations.ts';
import { ORIGINS, type OriginDef } from './origins.ts';
import { TRAITS } from './traits.ts';
import { VEHICLES, type VehicleDef } from './vehicles.ts';

export { GEAR } from './gear.ts';
export { ORIGINS, type OriginDef } from './origins.ts';
export { TRAITS } from './traits.ts';
export { FIRST_NAMES, LAST_NAMES } from './names.ts';
export { ENEMIES, type EliteDef, type EnemyDef, type EnemyType } from './enemies.ts';
export { ELITES } from './elites.ts';
export { HAVEN_SITE, LOCATIONS, type LocationDef, type EncounterDef, type HazardKind } from './locations.ts';
export {
  EVENTS,
  type EventBase,
  type EventDef,
  type EventRole,
  type EventEffect,
  type EventOutcome,
  type EventCheck,
  type EventTarget,
} from './events.ts';
export { FORKS, type ForkDef, type ForkOrder, type ForkPick, type RadioMood } from './forks.ts';
export { PRESS_ON, PRESS_ASIDES, PRESS_ON_GO, PRESS_ON_HOME, PRESS_ON_PICKS, type PressOnDef, type PressOnMeet, type PressOnTeaser } from './press-on.ts';
export { MOVES, type MoveDef } from './moves.ts';
export { NEEDS, PARTS, PART_HAUL, partAt, type NeedDef, type NeedFail, type PartDef, type PartNeed } from './needs.ts';
export { PERKS, type PerkDef } from './perks.ts';
export { EVOLUTIONS, type EvolutionRule, type RunTally, type NumericCounter } from './evolutions.ts';
export { BUILDINGS, type BuildingDef, type BuildingLevel } from './buildings.ts';
export { RECIPES, UPGRADES, type Recipe, type Upgrade } from './workshop.ts';
export { NEMESIS_NAMES, NICKNAMES, WEAPON_NAMES, type NicknameRule } from './stories.ts';
export { VEHICLES, type VehicleDef } from './vehicles.ts';
export { LINE_STOPS, PROJECTS, getProject, type ProjectDef, type ProjectStage } from './projects.ts';
export { ANIMALS, getAnimal, type AnimalDef } from './animals.ts';
export { CORNERS, getCorner, type CornerDef, type CornerGift, type CornerOutcome } from './corners.ts';
export { FIRST_WEEK, FIRST_WEEK_BEFORE, type StoryGift, type StoryGoal, type StoryStep } from './story.ts';
export { HAVEN_BROADCAST, HAVEN_CLUES, HAVEN_DREAMER, HAVEN_HINTS, HAVEN_JOURNEY, HAVEN_ROAD, HAVEN_VULTURES, type HavenClue, type HavenClueWhere, type HavenHint } from './haven.ts';
export { RAID_BANDS, RAID_SPOILS, type RaidBandDef } from './raids.ts';

const traitById = new Map<string, TraitDef>(TRAITS.map((t) => [t.id, t]));
const gearById = new Map<string, GearDef>(GEAR.map((g) => [g.id, g]));
const enemyById = new Map<string, EnemyDef>(ENEMIES.map((e) => [e.id, e]));
// Corwin Dam is a place the game can name but isn't on the map (§9.12).
const locationById = new Map<string, LocationDef>([...LOCATIONS, HAVEN_SITE].map((l) => [l.id, l]));
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

/** The elite that lives at a place, if one does (§7.15, 3.12.0). */
export function eliteAt(placeId: string): EnemyDef | undefined {
  return ENEMIES.find((e) => e.elite?.place === placeId);
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
