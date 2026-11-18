/**
 * The road east (§9.12, 3.0.0), as the guild sees it: seats for everyone and
 * places in a caravan, setting out together, and how it ended. The road itself
 * is a run (job `haven`) played from a script in `expedition/haven-road.ts`.
 */
import { addChronicle, addGuildLog } from './chronicle.ts';
import { HAVEN_CARAVAN_SEAT, HAVEN_VULTURE_STANDING, HAVEN_VULTURE_STRENGTH } from './constants.ts';
import { HAVEN_JOURNEY } from './content/index.ts';
import { canAfford, costText, hasFreeBunk, payCost } from './depot/buildings.ts';
import { openRaid } from './depot/raids.ts';
import { mourn, startRun } from './expedition/runs.ts';
import { vultureAllies } from './expedition/haven-road.ts';
import { havenPlanProblems } from './expedition/plan.ts';
import { dayAt, recruit } from './game.ts';
import { dreamerGoesAhead, havenRoadOpen } from './haven.ts';
import { bringHome } from './outposts.ts';
import type { Rng } from './rng.ts';
import { fillRoles } from './text.ts';
import type { GameState, HavenEnd, Resources, Run, RunPlan, Vehicle } from './types.ts';
import { vehicleDef, vehicleProblem } from './vehicles.ts';
import { changeStanding, vultureBand, vulturesActive } from './vultures.ts';

/** Who has to ride and what there is to carry them. `short`: seats still missing. */
export interface RoadSeats {
  people: number;
  children: number;
  /** The guild's vehicles that run. */
  vehicles: Vehicle[];
  /** Their seats, a driver each. */
  seats: number;
  /** Places bought in a caravan. */
  caravan: number;
  short: number;
}

export function roadSeats(state: GameState): RoadSeats {
  const vehicles = state.vehicles.filter((v) => !vehicleProblem(v));
  const seats = vehicles.reduce((n, v) => n + vehicleDef(v).seats, 0);
  const caravan = state.haven?.caravan ?? 0;
  const people = state.survivors.length;
  const children = state.children.length;
  return { people, children, vehicles, seats, caravan, short: Math.max(0, people + children - seats - caravan) };
}

/** What `n` places in a trader's caravan cost. */
export function caravanCost(n: number): Partial<Resources> {
  return { scrap: HAVEN_CARAVAN_SEAT.scrap * n, tech: HAVEN_CARAVAN_SEAT.tech * n };
}

/** Why the guild can't buy places in a caravan now, or undefined. */
export function caravanProblem(state: GameState): string | undefined {
  if (!havenRoadOpen(state) || state.haven?.end || state.haven?.road) return 'There’s no road to go on.';
  const { short } = roadSeats(state);
  if (short === 0) return 'Everyone has a seat already.';
  if (!canAfford(state, caravanCost(short))) return `Not enough: ${short === 1 ? 'a place' : `${short} places`} cost ${costText(caravanCost(short))}.`;
  return undefined;
}

/** Buy places in a trader's caravan for everyone the guild's vehicles can't carry. */
export function buyCaravan(state: GameState, now: number): void {
  const problem = caravanProblem(state);
  if (problem) throw new Error(problem);
  const { short } = roadSeats(state);
  payCost(state, caravanCost(short));
  state.haven!.caravan = (state.haven!.caravan ?? 0) + short;
  addGuildLog(state, dayAt(state, now), `For the road east: ${short === 1 ? 'a place' : `${short} places`} in a trader’s caravan (${costText(caravanCost(short))}).`, ['haven']);
}

/** The road east as a plan: everyone, every vehicle that runs, every med and round of ammo. */
export function roadPlan(state: GameState): RunPlan {
  return {
    locationId: 'corwin_dam',
    crew: state.survivors.map((s) => s.id),
    job: 'haven',
    meds: state.resources.meds,
    ammo: state.resources.ammo,
    approach: 'balanced',
    retreat: 'downed',
    lead: true,
    vehicles: roadSeats(state).vehicles.map((v) => v.id),
  };
}

/** What stops the guild setting out now. People at an outpost don't: they come in first. */
export function roadProblems(state: GameState): string[] {
  return havenPlanProblems(state, roadPlan(state)).filter((p) => !p.endsWith('has to come in from the outpost first.'));
}

/**
 * What the Vultures send before the guild sets out (§9.12), by how things
 * stand with them: who says it and what. Undefined when none of them is coming.
 */
export function vulturesWord(state: GameState): { by: string; text: string } | undefined {
  const allies = vultureAllies(state);
  if (allies.length === 0) return undefined;
  return { by: allies[0]!.firstName, text: HAVEN_JOURNEY.word[vultureBand(state)] };
}

/** The Vultures are about, but none of them is coming: they never gave their word, or nobody of theirs is free. */
export function vulturesStayAway(state: GameState): boolean {
  return vulturesActive(state) && vultureAllies(state).length === 0;
}

/** The Vultures gave their word (§9.11), and some of them will be at the gate with the guild. */
export function vulturesComing(state: GameState): boolean {
  return vultureAllies(state).length > 0;
}

/** The road east is under way. */
export function onHavenRoad(state: GameState): boolean {
  return state.haven?.road !== undefined;
}

/** The whole guild sets out for Haven, together (§9.12). */
export function setOutForHaven(state: GameState, now: number): Run {
  const problems = roadProblems(state);
  if (problems.length > 0) throw new Error(problems.join(' '));
  const day = dayAt(state, now);
  // Everyone goes: people at an outpost come in first.
  for (const s of state.survivors) if (s.outpost !== undefined) bringHome(state, s.id, day);
  // Whoever was listening to the broadcast goes the night before, ahead of them (§9.11).
  dreamerGoesAhead(state, day);
  // Raiders nobody has seen coming find the gate shut and nobody home, and move on.
  const raid = openRaid(state);
  if (raid && raid.seen === undefined && raid.defenders === undefined) delete state.depot.raid;
  const run = startRun(state, roadPlan(state), now);
  state.haven!.road = { runId: run.id, children: state.children.map((c) => c.id) };
  delete state.haven!.caravan;
  addGuildLog(state, day, 'The whole guild sets out for Haven, together.', ['haven', 'run', run.id]);
  return run;
}

/** Home from Haven (§9.12): the one shot at the gate, who was freed and where they went, the Vultures, and the end for good. */
export function applyHavenEnd(state: GameState, end: HavenEnd, day: number, rng: Rng): void {
  const haven = state.haven;
  if (!haven) return;
  if (end.shot) {
    const i = state.departed.findIndex((s) => s.id === end.shot);
    if (i >= 0) {
      const s = state.departed.splice(i, 1)[0]!;
      s.status = 'dead';
      addChronicle(s, day, HAVEN_JOURNEY.shot, ['death']);
      state.memorial.push(s);
      addGuildLog(state, day, fillRoles(HAVEN_JOURNEY.shotNews, { a: s }), ['death', s.id]);
      mourn(state, { survivorId: s.id, name: s.firstName, cause: 'shot at Haven’s gate' }, rng, day);
    }
  }
  let joined = 0;
  let withVultures = 0;
  for (const person of end.freed ?? []) {
    // Who doesn't fit at the Depot goes with the Vultures (Aviel: "what if you don't have room in the depot for everyone?").
    if (hasFreeBunk(state)) {
      recruit(state, person, rng, day, HAVEN_JOURNEY.freed);
      joined++;
    } else withVultures++;
  }
  if (withVultures > 0) {
    state.vultures.strength = Math.min(100, state.vultures.strength + withVultures * HAVEN_VULTURE_STRENGTH);
    addGuildLog(state, day, HAVEN_JOURNEY.withVultures.replace('{n}', String(withVultures)), ['haven', 'vultures']);
  }
  if (end.vultures) changeStanding(state, end.won ? HAVEN_VULTURE_STANDING.won : HAVEN_VULTURE_STANDING.lost, day);
  haven.end = { day, won: end.won, freed: joined, withVultures };
  delete haven.road;
  addGuildLog(state, day, end.won ? 'Haven is finished.' : 'Haven goes on.', ['haven']);
}
