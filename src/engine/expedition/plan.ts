/**
 * Planning a run: how long it takes, what it costs, and whether it's allowed.
 */
import { DAY_MS, MAX_CREW, SNEAKY_DURATION_MULT, STRESS_HIGH } from '../constants.ts';
import { findLocation, getGear, getLocation, getTrait } from '../content/index.ts';
import { locationState } from '../locations.ts';
import { crewConflicts } from '../relationships.ts';
import { maxHp } from '../stats.ts';
import { fullName } from '../text.ts';
import { maxTraitHook, mulTraitHook } from '../traits.ts';
import type { GameState, RunPlan, Survivor } from '../types.ts';

function crewOf(state: GameState, plan: RunPlan): Survivor[] {
  const out: Survivor[] = [];
  for (const id of plan.crew) {
    const s = state.survivors.find((x) => x.id === id);
    if (s) out.push(s);
  }
  return out;
}

/** Run length in ms. The slowest crew member sets the pace; sneaking takes longer. */
export function runDuration(state: GameState, plan: RunPlan): number {
  const loc = getLocation(plan.locationId);
  let slowest = 1;
  for (const s of crewOf(state, plan)) slowest = Math.max(slowest, mulTraitHook(s, 'durationMult'));
  const mult = slowest * (plan.approach === 'sneaky' ? SNEAKY_DURATION_MULT : 1);
  return Math.round(loc.durationMin * mult) * 60_000;
}

/** Rations the crew packs: one per member per game day away (some eat more). */
export function rationsNeeded(state: GameState, plan: RunPlan): number {
  const days = Math.max(1, Math.ceil(runDuration(state, plan) / DAY_MS));
  let perDay = 0;
  for (const s of crewOf(state, plan)) perDay += Math.max(1, maxTraitHook(s, 'rationUse'));
  return perDay * days;
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
  if (plan.crew.length > MAX_CREW) problems.push(`A crew can have at most ${MAX_CREW} survivors.`);
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
  const rations = rationsNeeded(state, plan);
  if (rations > state.resources.rations) problems.push(`Not enough rations: the crew needs ${rations}.`);
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
  return warnings;
}
