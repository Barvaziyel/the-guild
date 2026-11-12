/**
 * Labels for vehicles: the Vehicles screen, the Depot's panel, and the
 * planner's picker. Plain TypeScript so it can be tested in Node.
 */
import {
  buildVehicleProblem,
  buildableVehicles,
  costText,
  crewLimit,
  gasLegs,
  gasNeeded,
  repairCost,
  repairProblem,
  vehicleDef,
  vehicleName,
  vehicleProblem,
  type GameState,
  type RunPlan,
  type Vehicle,
  type VehicleDef,
} from '../engine/index.ts';

/** "Seats 5. Carries 10 more loads. Gets there in 55% of the walking time. Burns 2 gas a leg." */
export function vehicleFacts(def: VehicleDef): string {
  return `Seats ${def.seats}. Carries ${def.cargo} more loads. Gets there in ${Math.round(def.speed * 100)}% of the walking time. Burns ${def.gas} gas a leg.`;
}

/** Condition in words, for the bar's label. */
export function conditionText(condition: number): string {
  if (condition <= 0) return 'Broken down';
  if (condition < 30) return 'In poor shape';
  if (condition < 70) return 'Worn';
  return 'Good';
}

export interface VehicleRow {
  vehicle: Vehicle;
  name: string;
  description: string;
  facts: string;
  condition: number;
  /** "Good, 82%". */
  conditionLabel: string;
  /** Where it is: "At the Depot", "Out on a run", "Needs repairs before it runs". */
  status: string;
  /** "Repair: 24 scrap, 3 tech", if it needs it. */
  repair?: { cost: string; problem?: string };
}

export function vehicleRows(state: GameState): VehicleRow[] {
  return state.vehicles.map((v) => {
    const def = vehicleDef(v);
    const status = v.runId ? 'Out on a run.' : v.condition <= 0 ? 'At the Depot, and won’t run until it’s repaired.' : 'At the Depot.';
    const problem = repairProblem(state, v.id);
    const repair = v.condition < 100 ? { cost: costText(repairCost(v)), ...(problem && !/good shape/.test(problem) ? { problem } : {}) } : undefined;
    return {
      vehicle: v,
      name: def.name,
      description: def.description,
      facts: vehicleFacts(def),
      condition: v.condition,
      conditionLabel: `${conditionText(v.condition)}, ${v.condition}%`,
      status,
      ...(repair ? { repair } : {}),
    };
  });
}

export interface BuildRow {
  id: string;
  name: string;
  facts: string;
  cost: string;
  problem?: string;
}

/** What the Workshop can build, and why not yet. */
export function vehicleBuildRows(state: GameState): BuildRow[] {
  return buildableVehicles().map((def) => {
    const problem = buildVehicleProblem(state, def.id);
    return { id: def.id, name: def.name, facts: vehicleFacts(def), cost: costText(def.build!.cost), ...(problem ? { problem } : {}) };
  });
}

/** The Depot's line: "No vehicles yet." or "The Hatchback (at home, 82%) and the Motorcycle (out)." */
export function vehiclesLine(state: GameState): string {
  if (state.vehicles.length === 0) return 'No vehicles yet. They’re rare: found on runs, sold by traders, or built in the Workshop.';
  const parts = state.vehicles.map((v) => `the ${vehicleName(v)} (${v.runId ? 'out' : v.condition <= 0 ? 'broken down' : `at home, ${v.condition}%`})`);
  const list = parts.length === 1 ? parts[0]! : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]!}`;
  return `${list[0]!.toUpperCase()}${list.slice(1)}.`;
}

// ---------------------------------------------------------------- the planner

export interface VehicleChoice {
  vehicle: Vehicle;
  name: string;
  /** "Seats 5, 82%". */
  label: string;
  /** Why it can't go, if it can't. */
  reason?: string;
}

/** Every vehicle, with why it can't go now if it can't. */
export function vehicleChoices(state: GameState): VehicleChoice[] {
  return state.vehicles.map((v) => {
    const why = vehicleProblem(v);
    const label = `Seats ${vehicleDef(v).seats}, ${v.condition}%`;
    return { vehicle: v, name: vehicleName(v), label, ...(why ? { reason: `The ${vehicleName(v)} ${why}.` } : {}) };
  });
}

/**
 * Take a vehicle or leave it. Nobody sneaks in a vehicle, so taking one
 * switches a sneaky approach to balanced.
 */
export function toggleVehicle(plan: RunPlan, id: string): RunPlan {
  const current = plan.vehicles ?? [];
  if (current.includes(id)) {
    const rest = current.filter((x) => x !== id);
    if (rest.length > 0) return { ...plan, vehicles: rest };
    const { vehicles: _drop, ...onFoot } = plan;
    return onFoot;
  }
  return { ...plan, vehicles: [...current, id], ...(plan.approach === 'sneaky' ? { approach: 'balanced' as const } : {}) };
}

/** The planner's line about gas and seats. */
export function vehicleNote(state: GameState, plan: RunPlan): string {
  const picked = plan.vehicles ?? [];
  if (picked.length === 0) return `On foot, a crew is up to ${crewLimit(state, plan)}. Vehicles seat more and get there faster, but burn gas and draw trouble.`;
  const gas = gasNeeded(state, plan);
  const legs = gasLegs(state, plan);
  return `Seats ${crewLimit(state, plan)}. ${gas} gas there and back (${legs} ${legs === 1 ? 'leg' : 'legs'}), of ${state.resources.gas} at the Depot.`;
}
