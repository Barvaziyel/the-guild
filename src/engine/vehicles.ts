/**
 * Vehicles (§7.8): what the guild owns, what a run with them needs, and the
 * Workshop's repairs and builds.
 */
import { addGuildLog } from './chronicle.ts';
import { GAS_LEG_MINUTES, MAX_CREW, REPAIR_SCRAP_PER_10, REPAIR_TECH_PER_25 } from './constants.ts';
import { getLocation, getVehicleDef, VEHICLES, type VehicleDef } from './content/index.ts';
import { buildingLevel, canAfford, costText, payCost } from './depot/buildings.ts';
import { newId } from './ids.ts';
import type { GameState, Resources, RunPlan, Vehicle } from './types.ts';

export function vehicleDef(v: Vehicle): VehicleDef {
  return getVehicleDef(v.defId);
}

export function vehicleName(v: Vehicle): string {
  return vehicleDef(v).name;
}

export function findVehicle(state: GameState, id: string): Vehicle | undefined {
  return state.vehicles.find((v) => v.id === id);
}

/** A new vehicle, not yet the guild's: push it to state.vehicles (or a run's finds). */
export function createVehicle(state: GameState, defId: string, condition: number): Vehicle {
  getVehicleDef(defId);
  return { id: newId(state, 'v'), defId, condition: Math.max(0, Math.min(100, Math.round(condition))), runs: 0 };
}

/** Why a vehicle can't go out right now, if it can't. */
export function vehicleProblem(v: Vehicle): string | undefined {
  if (v.runId) return 'is already out';
  if (v.condition <= 0) return 'needs repairs before it will run';
  return undefined;
}

/** The plan's vehicles, in the order picked (unknown ids are skipped). */
export function planVehicles(state: GameState, plan: RunPlan): Vehicle[] {
  return (plan.vehicles ?? []).map((id) => findVehicle(state, id)).filter((v): v is Vehicle => v !== undefined);
}

/** How many a crew can be: 1 to 4 on foot, or as many as the vehicles seat. */
export function crewLimit(state: GameState, plan: RunPlan): number {
  const vehicles = planVehicles(state, plan);
  return vehicles.length === 0 ? MAX_CREW : vehicles.reduce((n, v) => n + vehicleDef(v).seats, 0);
}

/** Legs of the trip for gas: one per GAS_LEG_MINUTES of walking, at least one. */
export function gasLegs(locationId: string): number {
  return Math.max(1, Math.ceil(getLocation(locationId).durationMin / GAS_LEG_MINUTES));
}

/** Gas the plan's vehicles burn there and back. */
export function gasNeeded(state: GameState, plan: RunPlan): number {
  const legs = gasLegs(plan.locationId);
  return planVehicles(state, plan).reduce((n, v) => n + vehicleDef(v).gas * legs, 0);
}

/**
 * Who rides in what: one driver for each vehicle first, in crew order, then
 * the rest fill the seats in order.
 */
export function seating(state: GameState, plan: RunPlan): { vehicleId: string; riders: string[] }[] {
  const vehicles = planVehicles(state, plan);
  const seats = vehicles.map((v) => ({ vehicleId: v.id, riders: [] as string[], room: vehicleDef(v).seats }));
  plan.crew.forEach((id, i) => {
    const seat = i < seats.length ? seats[i] : seats.find((s) => s.riders.length < s.room);
    seat?.riders.push(id);
  });
  return seats.map(({ vehicleId, riders }) => ({ vehicleId, riders }));
}

// ---------------------------------------------------------------- the Workshop

/** Bringing a vehicle back to full condition: scrap for every 10 points, tech for every 25. */
export function repairCost(v: Vehicle): Partial<Resources> {
  const missing = 100 - v.condition;
  if (missing <= 0) return {};
  const tech = Math.floor(missing / 25) * REPAIR_TECH_PER_25;
  const scrap = Math.ceil(missing / 10) * REPAIR_SCRAP_PER_10;
  return tech > 0 ? { scrap, tech } : { scrap };
}

export function repairProblem(state: GameState, id: string): string | undefined {
  const v = findVehicle(state, id);
  if (!v) return 'That vehicle is gone.';
  if (v.runId) return `The ${vehicleName(v)} is out on a run.`;
  if (v.condition >= 100) return `The ${vehicleName(v)} is in good shape.`;
  if (buildingLevel(state, 'workshop') === 0) return 'Build the Workshop first.';
  const cost = repairCost(v);
  if (!canAfford(state, cost)) return `Needs ${costText(cost)}.`;
  return undefined;
}

/** Repair a vehicle at home to full condition. Throws if it can't be done. */
export function repairVehicle(state: GameState, id: string, day: number): Vehicle {
  const problem = repairProblem(state, id);
  if (problem) throw new Error(problem);
  const v = findVehicle(state, id)!;
  payCost(state, repairCost(v));
  v.condition = 100;
  addGuildLog(state, day, `Repaired the ${vehicleName(v)} in the Workshop.`, ['vehicle', v.id]);
  return v;
}

/** Vehicles the Workshop can build. */
export function buildableVehicles(): VehicleDef[] {
  return VEHICLES.filter((d) => d.build !== undefined);
}

export function buildVehicleProblem(state: GameState, defId: string): string | undefined {
  const def = getVehicleDef(defId);
  if (!def.build) return `The Workshop can't build a ${def.name}.`;
  const level = buildingLevel(state, 'workshop');
  if (level === 0) return 'Build the Workshop first.';
  if (level < def.build.level) return `Needs a level ${def.build.level} Workshop.`;
  if (!canAfford(state, def.build.cost)) return `Needs ${costText(def.build.cost)}.`;
  return undefined;
}

/** Build a vehicle in the Workshop, in full condition. Throws if it can't be done. */
export function buildVehicle(state: GameState, defId: string, day: number): Vehicle {
  const problem = buildVehicleProblem(state, defId);
  if (problem) throw new Error(problem);
  const def = getVehicleDef(defId);
  payCost(state, def.build!.cost);
  const v = createVehicle(state, defId, 100);
  state.vehicles.push(v);
  addGuildLog(state, day, `Built a ${def.name} in the Workshop.`, ['vehicle', v.id]);
  return v;
}
