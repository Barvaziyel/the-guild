/**
 * Planning a run: how long it takes, what it costs, and whether it's allowed.
 */
import { DAY_MS, HUNGER_STRESS, RAID_FULL_FENCE, SNEAKY_DURATION_MULT, STRESS_HIGH } from '../constants.ts';
import { findLocation, getEnemy, getGear, getLocation, getTrait } from '../content/index.ts';
import { locationState } from '../locations.ts';
import { crewConflicts } from '../relationships.ts';
import { maxHp } from '../stats.ts';
import { fullName } from '../text.ts';
import { maxTraitHook, mulTraitHook } from '../traits.ts';
import type { GameState, RunPlan, Survivor } from '../types.ts';
import { crewLimit, findVehicle, gasNeeded, planVehicles, vehicleDef, vehicleName, vehicleProblem } from '../vehicles.ts';

function crewOf(state: GameState, plan: RunPlan): Survivor[] {
  const out: Survivor[] = [];
  for (const id of plan.crew) {
    const s = state.survivors.find((x) => x.id === id);
    if (s) out.push(s);
  }
  return out;
}

/**
 * How long the run would take on foot, in ms. The slowest crew member sets
 * the pace; sneaking takes longer. This is also how far the place is: the
 * number of beats, and the walk home after a wreck, come from it.
 */
export function footDuration(state: GameState, plan: RunPlan): number {
  const loc = getLocation(plan.locationId);
  let slowest = 1;
  for (const s of crewOf(state, plan)) slowest = Math.max(slowest, mulTraitHook(s, 'durationMult'));
  const mult = slowest * (plan.approach === 'sneaky' ? SNEAKY_DURATION_MULT : 1);
  return Math.round(loc.durationMin * mult) * 60_000;
}

/** Run length in ms: on foot, or at the pace of the slowest vehicle. */
export function runDuration(state: GameState, plan: RunPlan): number {
  const vehicles = planVehicles(state, plan);
  if (vehicles.length === 0) return footDuration(state, plan);
  const speed = Math.max(...vehicles.map((v) => vehicleDef(v).speed));
  return Math.round(getLocation(plan.locationId).durationMin * speed) * 60_000;
}

/** Rations each crew member needs: one per game day away (some eat more). */
function rationNeeds(state: GameState, plan: RunPlan): { s: Survivor; need: number }[] {
  const days = Math.max(1, Math.ceil(runDuration(state, plan) / DAY_MS));
  return crewOf(state, plan).map((s) => ({ s, need: Math.max(1, maxTraitHook(s, 'rationUse')) * days }));
}

/** Rations the crew needs: one per member per game day away (some eat more). */
export function rationsNeeded(state: GameState, plan: RunPlan): number {
  return rationNeeds(state, plan).reduce((n, r) => n + r.need, 0);
}

/** Rations the crew actually takes: what it needs, or all the Depot has if that's less. */
export function rationsPacked(state: GameState, plan: RunPlan): number {
  return Math.min(rationsNeeded(state, plan), Math.max(0, state.resources.rations));
}

/**
 * Who goes out hungry when the Depot is short: rations go to the crew in
 * order, a full share each, and whoever's share runs out goes without.
 * A crew can always leave, so an empty larder never stops the guild from
 * hunting or scavenging its way out.
 */
export function hungryCrew(state: GameState, plan: RunPlan): Survivor[] {
  let left = Math.max(0, state.resources.rations);
  const hungry: Survivor[] = [];
  for (const { s, need } of rationNeeds(state, plan)) {
    if (left >= need) left -= need;
    else hungry.push(s);
  }
  return hungry;
}

/** Can this survivor be sent out right now? Returns the reason if not. */
export function unavailableReason(s: Survivor): string | undefined {
  if (s.status === 'away') return 'is already out on a run';
  if (s.status !== 'ready') return 'is not available';
  const blocking = s.traits.find((t) => getTrait(t.id).blocksRuns);
  if (blocking) return `is ${getTrait(blocking.id).name.toLowerCase()} and needs rest`;
  return undefined;
}

/** Problems that stop the run from starting. Empty means the plan is valid. */
export function validatePlan(state: GameState, plan: RunPlan): string[] {
  const problems: string[] = [];
  const loc = findLocation(plan.locationId);
  if (!loc) return [`Unknown location: ${plan.locationId}`];
  if (!locationState(state, loc.id).discovered) problems.push(`${loc.name} has not been discovered yet.`);

  if (plan.crew.length < 1) problems.push('Pick at least one survivor.');
  const vehicleIds = plan.vehicles ?? [];
  const limit = crewLimit(state, plan);
  if (plan.crew.length > limit) {
    problems.push(vehicleIds.length === 0 ? `On foot, a crew can have at most ${limit} survivors.` : `The vehicles seat ${limit}.`);
  }
  if (new Set(plan.crew).size !== plan.crew.length) problems.push('A survivor is listed twice.');
  for (const id of plan.crew) {
    const s = state.survivors.find((x) => x.id === id);
    if (!s) {
      problems.push(`Unknown survivor: ${id}`);
      continue;
    }
    const reason = unavailableReason(s);
    if (reason) problems.push(`${fullName(s)} ${reason}.`);
  }
  if (problems.length > 0) return problems;

  if (plan.meds < 0 || plan.ammo < 0 || !Number.isInteger(plan.meds) || !Number.isInteger(plan.ammo)) {
    problems.push('Supplies must be whole numbers.');
  }
  if (plan.meds > state.resources.meds) problems.push('Not enough meds at the Depot.');
  if (plan.ammo > state.resources.ammo) problems.push('Not enough ammo at the Depot.');

  if (vehicleIds.length > 0) {
    if (new Set(vehicleIds).size !== vehicleIds.length) problems.push('A vehicle is listed twice.');
    for (const id of vehicleIds) {
      const v = findVehicle(state, id);
      if (!v) {
        problems.push(`Unknown vehicle: ${id}`);
        continue;
      }
      const why = vehicleProblem(v);
      if (why) problems.push(`The ${vehicleName(v)} ${why}.`);
    }
    if (plan.crew.length < vehicleIds.length) problems.push('Every vehicle needs someone to drive it.');
    if (plan.approach === 'sneaky') problems.push("Nobody sneaks anywhere in a vehicle. Pick another approach, or walk.");
    const gas = gasNeeded(state, plan);
    if (gas > state.resources.gas) problems.push(`The vehicles need ${gas} gas there and back; the Depot has ${state.resources.gas}.`);
  }
  return problems;
}

/** Things worth knowing before sending this crew, none of which stop the run. */
export function planWarnings(state: GameState, plan: RunPlan): string[] {
  const warnings: string[] = [];
  const crew = crewOf(state, plan);
  const name = (id: string): string => crew.find((s) => s.id === id)?.firstName ?? id;
  for (const c of crewConflicts(state, plan.crew)) {
    warnings.push(c.label === 'feud' ? `${name(c.a)} and ${name(c.b)} are feuding.` : `${name(c.a)} and ${name(c.b)} are rivals.`);
  }
  for (const s of crew) {
    if (s.hp < maxHp(s) / 2) warnings.push(`${s.firstName} is hurt (${s.hp}/${maxHp(s)} HP).`);
    if (s.stress >= STRESS_HIGH) warnings.push(`${s.firstName} is close to breaking (stress ${s.stress}).`);
    if (!s.equipment.weapon) warnings.push(`${s.firstName} has no weapon.`);
  }
  const needAmmo = crew.some((s) => {
    const w = s.equipment.weapon;
    return w !== undefined && getGear(w.defId).usesAmmo === true;
  });
  if (needAmmo && plan.ammo === 0) warnings.push('Someone carries a gun, but the crew is taking no ammo.');
  for (const n of state.nemeses ?? []) {
    if (n.status !== 'atLarge' || n.locationId !== plan.locationId) continue;
    const kind = getEnemy(n.enemyId).name;
    const settle = crew.filter((s) => n.downed.includes(s.id)).map((s) => s.firstName);
    const scores = settle.length === 0 ? '' : ` ${settle.length === 1 ? `${settle[0]} has` : `${settle.slice(0, -1).join(', ')} and ${settle[settle.length - 1]} have`} a score to settle.`;
    warnings.push(`${n.name[0]!.toUpperCase()}${n.name.slice(1)}, ${/^[AEIOU]/.test(kind) ? 'an' : 'a'} ${kind} the guild knows by name, haunts this place.${scores}`);
  }
  for (const v of planVehicles(state, plan)) {
    if (v.condition > 0 && v.condition < 30) warnings.push(`The ${vehicleName(v)} is in poor shape (${v.condition}%), so it's more likely to be wrecked.`);
  }
  const left = state.survivors.filter((s) => s.status === 'ready' && !plan.crew.includes(s.id) && !s.traits.some((t) => getTrait(t.id).blocksRuns)).length;
  if (left < RAID_FULL_FENCE) {
    warnings.push(
      left === 0
        ? 'Nobody would be left at home: if raiders come, the Depot is easy pickings.'
        : `Only ${left} would be left at home to hold the fence. Raiders like a thin fence.`,
    );
  }
  const hungry = hungryCrew(state, plan);
  if (hungry.length > 0) {
    const names = hungry.map((s) => s.firstName);
    const who = names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]!}`;
    const one = hungry.length === 1;
    const lead = state.resources.rations <= 0 ? 'No rations at the Depot' : 'Not enough rations for everyone';
    warnings.push(`${lead}: ${who} ${one ? 'goes' : 'go'} out hungry (+${HUNGER_STRESS} stress${one ? '' : ' each'}).`);
  }
  return warnings;
}
