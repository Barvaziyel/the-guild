/**
 * Runs the scripted events in content/events.ts: decides which ones fit the
 * crew and the place, casts crew members into their roles, rolls the check
 * and applies the effects.
 */
import { addChronicle } from '../chronicle.ts';
import { DC, EVENT_CHANCE, EVENT_SEEN_PENALTY } from '../constants.ts';
import { EVENTS, getAnimal, getLocation, getTrait, type EventDef, type EventEffect, type EventOutcome, type EventRole, type EventTarget } from '../content/index.ts';
import { locationState } from '../locations.ts';
import { newAnimal } from '../animals.ts';
import { generateSurvivor } from '../generator.ts';
import { arePartners, relationshipLabel } from '../relationships.ts';
import { addPractice, effectiveStat, maxHp, statName } from '../stats.ts';
import { addTrait, getTraitInstance, hasTrait, revealTrait } from '../traits.ts';
import type { BeatKind, LogLine } from '../types.ts';
import { addLoot, findGear, lootMult, pickResource, relate, resolveFight, richFind } from './beats.ts';
import { buildEncounter, describeGroup } from './combat.ts';
import { absorbRads, capitalize, check, fmt, hurt, say, simDay, standing, startBeat, stress, type Member, type Sim } from './context.ts';

interface Cast {
  a: Member;
  b?: Member;
}

function fitsRole(m: Member, role: EventRole): boolean {
  if (role.trait && !hasTrait(m.s, role.trait)) return false;
  if (role.gear && !Object.values(m.s.equipment).some((item) => item?.defId === role.gear)) return false;
  if (role.minRuns !== undefined && m.s.counters.runs < role.minRuns) return false;
  if (role.maxRuns !== undefined && m.s.counters.runs > role.maxRuns) return false;
  return true;
}

/** Pick one member for a role: the best or worst at a stat if the role says so, otherwise at random. */
function choose(sim: Sim, candidates: Member[], role: EventRole): Member | undefined {
  if (candidates.length === 0) return undefined;
  const stat = role.best ?? role.worst;
  if (!stat) return sim.rng.pick(candidates);
  const sign = role.best ? 1 : -1;
  let top = candidates[0]!;
  for (const m of candidates) {
    if (sign * effectiveStat(m.s, stat) > sign * effectiveStat(top.s, stat)) top = m;
  }
  return top;
}

function pairFits(sim: Sim, a: Member, b: Member, relation: NonNullable<EventDef['pair']>): boolean {
  const label = relationshipLabel(sim.state, a.s.id, b.s.id);
  if (relation === 'partners') return arePartners(sim.state, a.s.id, b.s.id);
  if (relation === 'bonded') return label === 'bonded';
  if (relation === 'friendly') return label === 'friend' || label === 'bonded';
  return label === 'rival' || label === 'feud';
}

/** Find crew members to play the event's roles, or undefined if the crew can't. */
function cast(sim: Sim, event: EventDef): Cast | undefined {
  const crew = standing(sim);
  const forA = crew.filter((m) => fitsRole(m, event.a));
  if (!event.b) {
    const a = choose(sim, forA, event.a);
    return a ? { a } : undefined;
  }
  const role = event.b;
  if (event.pair) {
    const pairs: Cast[] = [];
    for (const a of forA) {
      for (const b of crew) {
        if (b !== a && fitsRole(b, role) && pairFits(sim, a, b, event.pair)) pairs.push({ a, b });
      }
    }
    return pairs.length > 0 ? sim.rng.pick(pairs) : undefined;
  }
  const a = choose(sim, forA, event.a);
  if (!a) return undefined;
  const b = choose(sim, crew.filter((m) => m !== a && fitsRole(m, role)), role);
  if (b) return { a, b };
  return role.optional ? { a } : undefined;
}

function leads(sim: Sim): string[] {
  return sim.loc.leadsTo.filter((id) => !locationState(sim.state, id).discovered && !sim.discovered.includes(id));
}

/** Could this event happen here, now, to this crew? (Casting is checked separately.) */
function fitsSituation(sim: Sim, event: EventDef, kind: BeatKind): boolean {
  if (event.kind !== kind || sim.events.includes(event.id)) return false;
  if (event.locations && !event.locations.includes(sim.loc.id)) return false;
  if (event.minDanger !== undefined && sim.loc.danger < event.minDanger) return false;
  if (event.maxDanger !== undefined && sim.loc.danger > event.maxDanger) return false;
  if (event.noRadiation && sim.loc.radiation > 0) return false;
  if (event.minCrew !== undefined && standing(sim).length < event.minCrew) return false;
  if (event.needsLead && leads(sim).length === 0) return false;
  if (event.needsMeds !== undefined && sim.meds < event.needsMeds) return false;
  if (event.needsAmmo !== undefined && sim.ammo < event.needsAmmo) return false;
  return true;
}

function targets(sim: Sim, who: EventTarget, roles: Cast): Member[] {
  switch (who) {
    case 'a':
      return [roles.a];
    case 'b':
      // An optional second role falls back to the first.
      return [roles.b ?? roles.a];
    case 'all':
      return standing(sim);
    case 'others':
      return standing(sim).filter((m) => m !== roles.a);
  }
}

function text(sim: Sim, template: string, roles: Cast, vars: Record<string, string> = {}): string {
  const members: Record<string, Member> = { a: roles.a };
  if (roles.b) members.b = roles.b;
  return fmt(template, members, { loc: sim.loc.name, ...vars });
}

function applyEffect(sim: Sim, event: EventDef, effect: EventEffect, roles: Cast): void {
  const { rng } = sim;
  const day = simDay(sim);
  const source = `"${event.title}" at ${sim.loc.name}`;
  switch (effect.type) {
    case 'loot': {
      const res = effect.resource === 'any' ? pickResource(sim) : effect.resource;
      const base = rng.int(effect.amount[0], effect.amount[1]) + (effect.scales ? sim.loc.danger - 1 : 0);
      const amount = richFind(sim, base * lootMult(roles.a));
      addLoot(sim, res, amount);
      say(sim, `${capitalize(String(amount))} ${res} for the packs.`, { tone: 'good' });
      break;
    }
    case 'gear':
      if (effect.chance === undefined || rng.chance(effect.chance)) findGear(sim, roles.a);
      break;
    case 'damage':
      for (const m of targets(sim, effect.who, roles)) {
        const amount = rng.int(effect.amount[0], effect.amount[1]) + (effect.scales ? sim.loc.danger - 1 : 0);
        const wentDown = hurt(sim, m, amount, effect.cause);
        say(sim, `${m.s.firstName} is hurt (-${amount} HP)${wentDown ? ' and goes down.' : '.'}`, { tone: 'bad' });
      }
      break;
    case 'heal':
      for (const m of targets(sim, effect.who, roles)) m.s.hp = Math.min(maxHp(m.s), m.s.hp + effect.amount);
      break;
    case 'stress':
      for (const m of targets(sim, effect.who, roles)) stress(sim, m, effect.amount, source);
      break;
    case 'rads':
      for (const m of targets(sim, effect.who, roles)) absorbRads(m, rng.int(effect.amount[0], effect.amount[1]));
      break;
    case 'relationship': {
      const others = effect.with === 'b' ? (roles.b ? [roles.b] : []) : standing(sim).filter((m) => m !== roles.a);
      for (const other of others) relate(sim, roles.a, other, effect.amount);
      break;
    }
    case 'trait':
      for (const m of targets(sim, effect.who, roles)) {
        if (effect.chance !== undefined && !rng.chance(effect.chance)) continue;
        const result = addTrait(m.s, effect.trait, { day, rng, source: text(sim, effect.source, roles) });
        if (result.added) say(sim, `${m.s.firstName} is now ${getTrait(effect.trait).name}.`, { tone: 'good' });
      }
      break;
    case 'practice':
      for (const m of targets(sim, effect.who, roles)) {
        for (const up of addPractice(m.s, effect.stat, effect.amount, day)) {
          say(sim, `${m.s.firstName}'s ${statName(effect.stat)} rises to ${up.to}.`, { tone: 'good' });
        }
      }
      break;
    case 'discover': {
      const options = leads(sim);
      if (options.length === 0) break;
      const id = rng.pick(options);
      sim.discovered.push(id);
      say(sim, `A new place for the map: ${getLocation(id).name}.`, { tone: 'good' });
      break;
    }
    case 'explore':
      sim.exploreBonus += effect.amount;
      break;
    case 'supplies':
      sim.meds = Math.max(0, sim.meds + (effect.meds ?? 0));
      sim.ammo = Math.max(0, sim.ammo + (effect.ammo ?? 0));
      break;
    case 'chronicle':
      for (const m of targets(sim, effect.who, roles)) addChronicle(m.s, day, text(sim, effect.text, roles), ['event', event.id]);
      break;
    case 'turnBack':
      sim.turnBack = true;
      break;
    case 'animal': {
      if (effect.chance !== undefined && !rng.chance(effect.chance)) break;
      const a = newAnimal(sim.state, effect.kind, rng, day);
      a.keeper = roles.a.s.id;
      sim.animals.push(a);
      say(sim, `The ${getAnimal(effect.kind).name} is still at ${roles.a.s.firstName}'s heels when the Depot comes in sight.`, { tone: 'good' });
      break;
    }
    case 'survivor': {
      const person = generateSurvivor(sim.state, rng, { day });
      person.hp = Math.max(1, Math.round(maxHp(person) * 0.7));
      sim.found.push({ person, by: roles.a.s.id });
      say(sim, `${person.firstName} ${person.lastName} comes home with ${sim.members.length === 1 ? roles.a.s.firstName : 'them'}.`, { tone: 'good' });
      break;
    }
    case 'fight': {
      const enemies = buildEncounter(sim);
      const group = describeGroup(enemies);
      say(sim, `${capitalize(group)}${enemies.length === 1 ? ' attacks' : ' attack'} at once.`, { tone: 'bad' });
      resolveFight(sim, enemies, { ambushed: effect.ambushed !== false, drop: false });
      break;
    }
  }
}

function play(sim: Sim, event: EventDef, roles: Cast): void {
  startBeat(sim, event.kind, event.title);
  sim.events.push(event.id);

  // A hidden trait that drives an event is hidden no longer.
  for (const [member, role] of [
    [roles.a, event.a],
    [roles.b, event.b],
  ] as const) {
    if (member && role?.trait && getTraitInstance(member.s, role.trait)?.hidden) {
      revealTrait(member.s, role.trait, simDay(sim));
      say(sim, `So that is how it is: ${member.s.firstName} is ${getTrait(role.trait).name}.`);
    }
  }

  say(sim, text(sim, event.intro, roles));

  let outcome: EventOutcome = event.success;
  let line: Omit<LogLine, 'text'> = {};
  const spec = event.check;
  if (spec && 'chance' in spec) {
    if (!sim.rng.chance(spec.chance)) outcome = event.failure ?? event.success;
  } else if (spec) {
    const who = spec.who === 'b' ? (roles.b ?? roles.a) : roles.a;
    const dc = DC[spec.dc] + (spec.danger ? Math.floor(sim.loc.danger / 2) : 0);
    const result = check(sim, who, spec.stat, dc, spec.contexts ?? [], spec.crew ? { crew: true } : {});
    line = { check: result.info };
    if (!result.success) outcome = event.failure ?? event.success;
  }
  const good = outcome === event.success;
  say(sim, text(sim, outcome.text, roles), spec ? { ...line, tone: good ? 'good' : 'bad' } : line);
  for (const effect of outcome.effects ?? []) {
    // Someone who has gone down takes no further part.
    if (roles.a.down || roles.a.dead) break;
    applyEffect(sim, event, effect, roles);
  }
}

/**
 * Maybe replace a plain beat of this kind with a scripted event. Returns
 * true if an event was played. Events the guild has seen before are less
 * likely, and no event happens twice on one run.
 */
export function tryEvent(sim: Sim, kind: BeatKind): boolean {
  if (kind !== 'travel' && kind !== 'hazard' && kind !== 'discovery' && kind !== 'social') return false;
  if (!sim.rng.chance(EVENT_CHANCE[kind])) return false;

  const options: { event: EventDef; roles: Cast; weight: number }[] = [];
  for (const event of EVENTS) {
    if (!fitsSituation(sim, event, kind)) continue;
    const roles = cast(sim, event);
    if (!roles) continue;
    const seen = sim.state.eventsSeen[event.id] ?? 0;
    options.push({ event, roles, weight: event.weight / (1 + seen * EVENT_SEEN_PENALTY) });
  }
  if (options.length === 0) return false;
  const pick = sim.rng.weightedBy(options, (o) => o.weight);
  play(sim, pick.event, pick.roles);
  return true;
}
