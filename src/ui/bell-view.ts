/**
 * The bell at the top (Aviel, 2.2.0): everything that needs the player, in
 * one place. Each item opens where it's dealt with.
 */
import { STRESS_MAX, atDepot, getLocation, type GameState } from '../engine/index.ts';
import { strayRows } from './animals-view.ts';
import { foodWarning } from './depot-view.ts';
import { dilemmaCard } from './dilemma-view.ts';
import { fightCards } from './fight-view.ts';
import { radioCards } from './radio-view.ts';
import { raidCard } from './raid-view.ts';
import { callCard } from './rescue-view.ts';
import type { Route } from './route.ts';
import { reportFirstNames, joinNames } from './runs-view.ts';

export type BellGroup = 'waiting' | 'gate' | 'back' | 'warning';

export interface BellItem {
  id: string;
  group: BellGroup;
  text: string;
  to: Route;
}

export const BELL_GROUPS: { id: BellGroup; title: string }[] = [
  { id: 'waiting', title: 'Waiting on you' },
  { id: 'gate', title: 'At the gate' },
  { id: 'back', title: 'Crews back' },
  { id: 'warning', title: 'Warnings' },
];

/** Stress at which someone is close to breaking: a warning. */
export const NEAR_BREAKING = Math.round(STRESS_MAX * 0.8);

/** Everything that needs the player now, by group, the most pressing first in each. */
export function bellItems(state: GameState, now: number): BellItem[] {
  const out: BellItem[] = [];
  const today: Route = { screen: 'depot', tab: 'today' };

  // Waiting on you.
  const raid = raidCard(state, now);
  if (raid) out.push({ id: 'raid', group: 'waiting', text: raid.kind === 'seen' ? `${raid.title}. ${raid.lines[0]}` : `${raid.title}: ${raid.inCommand ? 'you’re in command' : 'waiting for your orders'}.`, to: { screen: 'raid' } });
  for (const f of fightCards(state, now)) out.push({ id: `fight-${f.runId}`, group: 'waiting', text: `${f.callerName} at ${f.place}: ${f.inCommand ? 'you’re in command' : `a fight, waiting for your orders`}.`, to: { screen: 'fight', id: f.runId } });
  for (const c of radioCards(state, now)) out.push({ id: `radio-${c.runId}`, group: 'waiting', text: `${c.callerName} on the radio from ${c.place}: ${c.title.toLowerCase()}.`, to: { screen: 'run', id: c.runId } });
  const dilemma = dilemmaCard(state, now);
  if (dilemma) out.push({ id: 'dilemma', group: 'waiting', text: `Something to decide: ${dilemma.title.toLowerCase()}.`, to: today });
  const call = callCard(state, now);
  if (call && !call.runId) out.push({ id: 'call', group: 'waiting', text: `A call for help from ${getLocation(call.locationId).name}.`, to: { screen: 'reach', id: call.locationId } });

  // At the gate.
  const recruits = state.depot.recruits.length;
  if (recruits > 0) out.push({ id: 'recruits', group: 'gate', text: recruits === 1 ? 'Someone at the gate wants to join.' : `${recruits} at the gate want to join.`, to: { screen: 'recruits' } });
  for (const s of strayRows(state, now)) out.push({ id: `stray-${s.id}`, group: 'gate', text: `${s.title} at the gate.`, to: today });
  if (state.depot.offers.length > 0) out.push({ id: 'trader', group: 'gate', text: 'A trader at the gate.', to: today });

  // Crews back with a report not read yet.
  for (const r of state.reports.filter((x) => !x.read)) {
    out.push({ id: `report-${r.id}`, group: 'back', text: `${joinNames(Object.values(reportFirstNames(r)))}, back from ${getLocation(r.plan.locationId).name}.`, to: { screen: 'run', id: r.id } });
  }

  // Warnings.
  const food = foodWarning(state);
  if (food) out.push({ id: 'food', group: 'warning', text: state.resources.rations <= 0 ? 'The rations are gone.' : 'Food is running short.', to: today });
  for (const s of state.survivors.filter((x) => x.stress >= NEAR_BREAKING).sort((a, b) => b.stress - a.stress)) {
    out.push({ id: `stress-${s.id}`, group: 'warning', text: `${s.firstName} is near breaking (stress ${Math.round(s.stress)}).`, to: { screen: 'survivor', id: s.id, tab: 'stats' } });
  }
  const home = state.survivors.filter(atDepot).length;
  if (home === 0 && state.survivors.length > 0) out.push({ id: 'empty', group: 'warning', text: 'Nobody is home to hold the gate.', to: { screen: 'depot' } });
  for (const o of state.outposts.filter((x) => x.damaged)) out.push({ id: `outpost-${o.locationId}`, group: 'warning', text: `The outpost at ${getLocation(o.locationId).name} needs mending.`, to: { screen: 'reach', id: o.locationId, tab: 'outpost' } });

  return out;
}

/** What the bell shows: the items under their group titles, groups with nothing left out. */
export function bellGroups(items: readonly BellItem[]): { id: BellGroup; title: string; items: BellItem[] }[] {
  return BELL_GROUPS.map((g) => ({ ...g, items: items.filter((i) => i.group === g.id) })).filter((g) => g.items.length > 0);
}
