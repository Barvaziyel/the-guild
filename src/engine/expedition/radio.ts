/**
 * Forks on runs, and calling home about them (§7.12).
 *
 * A fork stops the run at a choice. Without a Radio Tower, whoever found it
 * decides on the spot. With one, they call home: `simulateRun` plays the run
 * with nobody answering (they wait, then decide), and `startRun` plays it
 * again once for each order, forcing that answer. The dice are seeded, so
 * every replay is the same up to the fork; the player's answer picks which
 * future happens.
 */
import { EVENT_SEEN_PENALTY, FORK_CHANCE, RADIO_WAIT } from '../constants.ts';
import { FORKS, getTrait, type ForkDef } from '../content/index.ts';
import { hasTrait, getTraitInstance, revealTrait } from '../traits.ts';
import type { BeatKind, RadioOrder } from '../types.ts';
import { say, simDay, startBeat, type Member, type Sim } from './context.ts';
import { cast, fitsSituation, playOutcome, text, type Cast } from './events.ts';

export interface ForkSpec {
  forkId: string;
  title: string;
  /** The kind of beat the answer and what follows are logged under. */
  kind: BeatKind;
  /** Whoever found it, and calls home. */
  by: Member;
  /** Already filled in, and already said in the current beat. */
  intro: string;
  ask: string;
  orders: RadioOrder[];
  /** What `by` does unasked. */
  pick: string;
}

function lower(label: string): string {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

function labelOf(spec: ForkSpec, id: string): string {
  return lower(spec.orders.find((o) => o.id === id)?.label ?? id);
}

/**
 * The crew has come to a fork; its intro is in the current beat. Returns the
 * order they follow and whether it was their own pick. With a radio, the
 * answer and what follows go in a new beat: at once in a replay for that
 * answer, or after waiting in vain for one.
 */
export function reachFork(sim: Sim, spec: ForkSpec): { order: string; picked: boolean } {
  const called = sim.radio;
  const who = spec.by.s.firstName;
  if (!called) {
    sim.fork = { forkId: spec.forkId, title: spec.title, by: spec.by.s.id, intro: spec.intro, ask: spec.ask, orders: spec.orders, at: sim.offset, called, fromBeat: sim.beats.length };
    say(sim, sim.members.length === 1 ? `${who} weighs it up, and decides: ${labelOf(spec, spec.pick)}.` : `They talk it over. ${who} makes the call: ${labelOf(spec, spec.pick)}.`);
    return { order: spec.pick, picked: true };
  }
  say(sim, `${who} gets on the radio to the Depot.`);
  sim.fork = { forkId: spec.forkId, title: spec.title, by: spec.by.s.id, intro: spec.intro, ask: spec.ask, orders: spec.orders, at: sim.offset, called, fromBeat: sim.beats.length };
  const answer = sim.answer !== undefined && spec.orders.some((o) => o.id === sim.answer) ? sim.answer : undefined;
  if (answer !== undefined) {
    // A replay for an answer given later on a led run (§7.13) waits as long as the crew did.
    const waited = sim.answerWait ?? 0;
    sim.delay += waited;
    sim.offset += waited;
    startBeat(sim, spec.kind, 'Word from home');
    say(sim, `Word from home: ${labelOf(spec, answer)}.`);
    return { order: answer, picked: false };
  }
  sim.delay += RADIO_WAIT;
  sim.offset += RADIO_WAIT;
  startBeat(sim, spec.kind, 'No word from home');
  say(sim, `Half an hour by the radio, and nothing. ${who} makes the call: ${labelOf(spec, spec.pick)}.`, { tone: 'bad' });
  return { order: spec.pick, picked: true };
}

/** Time the crew spends on an order, from here on. */
export function spendTime(sim: Sim, minutes: number): void {
  const ms = minutes * 60_000;
  sim.delay += ms;
  sim.offset += ms;
}

/** What `a` does unasked, and the trait behind it if a trait decided. */
export function forkPick(sim: Sim, fork: ForkDef, a: Member): { order: string; trait?: string } {
  for (const p of fork.picks) {
    if (p.trait && !hasTrait(a.s, p.trait)) continue;
    if (p.approach && p.approach !== sim.plan.approach) continue;
    if (p.retreat && p.retreat !== sim.plan.retreat) continue;
    return { order: p.order, ...(p.trait ? { trait: p.trait } : {}) };
  }
  return { order: fork.picks[fork.picks.length - 1]!.order };
}

function playFork(sim: Sim, fork: ForkDef, roles: Cast): void {
  startBeat(sim, fork.kind, fork.title);
  sim.events.push(fork.id);
  const intro = text(sim, fork.intro, roles);
  say(sim, intro);
  const pick = forkPick(sim, fork, roles.a);
  const { order: chosen, picked } = reachFork(sim, {
    forkId: fork.id,
    title: fork.title,
    kind: fork.kind,
    by: roles.a,
    intro,
    ask: text(sim, fork.ask, roles),
    orders: fork.orders.map((o) => ({ id: o.id, label: o.label })),
    pick: pick.order,
  });
  // A hidden trait that made the call shows itself.
  if (picked && pick.trait && getTraitInstance(roles.a.s, pick.trait)?.hidden) {
    revealTrait(roles.a.s, pick.trait, simDay(sim));
    say(sim, `So that is how it is: ${roles.a.s.firstName} is ${getTrait(pick.trait).name}.`);
  }
  const order = fork.orders.find((o) => o.id === chosen)!;
  if (order.minutes) {
    spendTime(sim, order.minutes);
    startBeat(sim, fork.kind, fork.title);
  }
  playOutcome(sim, fork, roles, order);
}

/** Maybe turn a plain beat of this kind into a fork. At most one a run. Returns true if one was played. */
export function tryFork(sim: Sim, kind: BeatKind): boolean {
  if (sim.fork || (kind !== 'travel' && kind !== 'hazard' && kind !== 'discovery')) return false;
  if (!sim.rng.chance(FORK_CHANCE)) return false;
  const options: { fork: ForkDef; roles: Cast; weight: number }[] = [];
  for (const fork of FORKS) {
    if (!fitsSituation(sim, fork, kind)) continue;
    const roles = cast(sim, fork);
    if (!roles) continue;
    const seen = sim.state.eventsSeen[fork.id] ?? 0;
    options.push({ fork, roles, weight: fork.weight / (1 + seen * EVENT_SEEN_PENALTY) });
  }
  if (options.length === 0) return false;
  const pick = sim.rng.weightedBy(options, (o) => o.weight);
  playFork(sim, pick.fork, pick.roles);
  return true;
}
