/**
 * Decisions at the Depot (§9.5). About once a real day something comes up
 * that the player decides: four answers, with what follows hidden and
 * depending on who's involved. Left alone for about a real day, the people
 * involved settle it themselves, usually not the best way.
 *
 * Content is data in `content/dilemmas.ts`; this file casts, plays and settles.
 */
import { addChronicle, addGuildLog } from './chronicle.ts';
import { DILEMMA_DAYS, DILEMMA_GAP, VULTURES_BOSS_STRENGTH, VULTURES_ENVOY_GAP, VULTURES_LIEUTENANT_STRENGTH, VULTURES_RAID_DC } from './constants.ts';
import { DILEMMAS, getDilemma, getLocation, type DilemmaDef, type DilemmaEffect, type DilemmaOutcome, type DilemmaTest, type DilemmaWho } from './content/index.ts';
import { atDepot, hasFreeBunk } from './depot/buildings.ts';
import { frontier } from './depot/day.ts';
import { addWanderer, generateCandidate } from './depot/recruits.ts';
import { dayAt, recruit, withRng } from './game.ts';
import { ensureLocationState } from './locations.ts';
import { leaveGuild } from './leaving.ts';
import { raid } from './depot/events.ts';
import { changeStanding, changeStrength, freeLieutenants, noteMember, prisoners, vultureBand, vultureBoss, vultureMember, vulturesActive } from './vultures.ts';
import { adjustRelationship, arePartners, relationshipLabel } from './relationships.ts';
import type { Rng } from './rng.ts';
import { addPractice, changeStress, effectiveStat, maxHp, rollCheck } from './stats.ts';
import { fillRoles } from './text.ts';
import { addTrait, hasTrait } from './traits.ts';
import type { ActiveDilemma, GameState, Resources, Survivor, VultureMember } from './types.ts';
import { RESOURCE_IDS } from './types.ts';

/** What a decision came to: shown to the player and written in the news. */
export interface DilemmaResult {
  title: string;
  /** The answer chosen, filled in; undefined when nobody answered. */
  choice?: string;
  text: string;
}

// ---------------------------------------------------------------- who it's about

/** The people a decision is about, as role → survivor, plus the stranger. Missing people (dead, gone) leave it undefined. */
export function dilemmaRoles(state: GameState, d: ActiveDilemma): Record<string, Survivor> | undefined {
  const roles: Record<string, Survivor> = {};
  for (const [role, id] of Object.entries(d.cast)) {
    const s = state.survivors.find((x) => x.id === id);
    if (!s) return undefined;
    roles[role] = s;
  }
  if (d.stranger) roles.s = state.survivors.find((x) => x.id === d.stranger!.id) ?? d.stranger;
  // The Vultures' envoy, still one of theirs; a prisoner, still the guild's (§7.11).
  if (d.envoy) {
    const m = vultureMember(state, d.envoy);
    if (!m || m.status !== 'free') return undefined;
    roles.v = m.person;
  }
  if (d.prisoner) {
    const m = vultureMember(state, d.prisoner);
    if (!m || m.status !== 'captured') return undefined;
    roles.p = m.person;
  }
  return roles;
}

/** Fill a decision's text for the people it's about. */
export function dilemmaText(state: GameState, d: ActiveDilemma, template: string): string {
  return fillRoles(template, dilemmaRoles(state, d) ?? {});
}

function afford(state: GameState, need: Partial<Resources> | undefined): boolean {
  return RESOURCE_IDS.every((r) => state.resources[r] >= (need?.[r] ?? 0));
}

/** Who could be `a` and `b` for this decision now, picked at random among those who fit. */
function cast(state: GameState, def: DilemmaDef, rng: Rng): Record<string, string> | undefined {
  const home = state.survivors.filter(atDepot);
  const as = rng.shuffle(home.filter((s) => !def.cast.a?.trait || hasTrait(s, def.cast.a.trait)));
  for (const a of as) {
    if (!def.cast.b) return { a: a.id };
    const want = def.cast.b.with;
    const bs = home.filter((b) => {
      if (b.id === a.id) return false;
      const label = relationshipLabel(state, a.id, b.id);
      if (want === 'close') return label === 'friend' || label === 'bonded';
      if (want === 'apart') return label === 'rival' || label === 'feud';
      if (want === 'feud') return label === 'feud';
      if (want === 'partner') return arePartners(state, a.id, b.id);
      return true;
    });
    if (bs.length > 0) return { a: a.id, b: rng.pick(bs).id };
  }
  return undefined;
}

/** Whether a decision can come up now. */
function fits(state: GameState, def: DilemmaDef): boolean {
  if (!afford(state, def.needs?.supplies)) return false;
  if (def.needs?.undiscovered && frontier(state).length === 0) return false;
  const v = def.needs?.vultures;
  if (v) {
    if (!vulturesActive(state) || !envoyFor(state)) return false;
    const met = (state.dilemmas.seen[FIRST_CONTACT] ?? 0) > 0;
    if (v.first ? met : !met) return false;
    if (v.bands && !v.bands.includes(vultureBand(state))) return false;
    if (v.minStrength !== undefined && state.vultures.strength < v.minStrength) return false;
    if (v.prisoner && prisoners(state).length === 0) return false;
  }
  return true;
}

/** The Vultures' first visit: the decision every other envoy waits for. */
const FIRST_CONTACT = 'vulture_first_contact';

/** Who the Vultures send: a lieutenant, or the boss when there are none. */
function envoyFor(state: GameState): VultureMember | undefined {
  return freeLieutenants(state)[0] ?? vultureBoss(state);
}

/** An envoy's due: the Vultures are here, and their day has come. */
function envoyDue(state: GameState, day: number): boolean {
  return vulturesActive(state) && day >= state.vultures.nextEnvoyDay;
}

// ---------------------------------------------------------------- coming up and settling

/**
 * A Depot day for decisions: one still unanswered at its deadline is settled
 * by the people involved; otherwise, when its day comes, a new one comes up.
 * Returns what was settled, if anything.
 */
export function playDilemmaDay(state: GameState, day: number, rng: Rng): DilemmaResult | undefined {
  const active = state.dilemmas.active;
  if (active) {
    if (!dilemmaRoles(state, active)) {
      // Someone it was about is gone: it doesn't matter any more.
      delete state.dilemmas.active;
      state.dilemmas.nextDay = day + rng.int(DILEMMA_GAP[0], DILEMMA_GAP[1]);
      return undefined;
    }
    if (day < active.deadlineDay) return undefined;
    return resolve(state, getDilemma(active.defId).unanswered, undefined, day, rng);
  }
  // The Vultures keep their own schedule (§7.11): an envoy comes when it's due, whatever else is.
  if (envoyDue(state, day)) {
    const d = startDilemma(state, day, rng, undefined, true);
    state.vultures.nextEnvoyDay = day + (d ? rng.int(VULTURES_ENVOY_GAP[0], VULTURES_ENVOY_GAP[1]) : 1);
    if (d) return undefined;
  }
  if (day < state.dilemmas.nextDay) return undefined;
  startDilemma(state, day, rng);
  return undefined;
}

/** Bring up a decision, if one fits the guild today. New ones come first. Returns it. */
export function startDilemma(state: GameState, day: number, rng: Rng, only?: string, envoy = false): ActiveDilemma | undefined {
  // The Vultures' decisions come only as envoys, on their schedule; `only` asks for one directly (tests).
  const options = DILEMMAS.filter((d) => (only ? d.id === only : (d.needs?.vultures !== undefined) === envoy) && fits(state, d));
  const picks = rng.shuffle([...options]).sort((a, b) => (state.dilemmas.seen[a.id] ?? 0) - (state.dilemmas.seen[b.id] ?? 0));
  for (const def of picks) {
    const who = cast(state, def, rng);
    if (!who) continue;
    const d: ActiveDilemma = { defId: def.id, cast: who, day, deadlineDay: day + DILEMMA_DAYS };
    if (def.needs?.stranger) d.stranger = generateCandidate(state, rng, day);
    if (def.needs?.vultures) {
      const envoy = envoyFor(state)!;
      envoy.met = true;
      d.envoy = envoy.person.id;
      if (def.needs.vultures.prisoner) d.prisoner = prisoners(state)[0]!.person.id;
    }
    state.dilemmas.active = d;
    state.dilemmas.seen[def.id] = (state.dilemmas.seen[def.id] ?? 0) + 1;
    return d;
  }
  // Nothing fits today: try again tomorrow.
  state.dilemmas.nextDay = day + 1;
  return undefined;
}

/** Why the player can't answer this now, if they can't. */
export function decideProblem(state: GameState, choice: number): string | undefined {
  const d = state.dilemmas.active;
  if (!d) return 'There is nothing to decide.';
  if (!Number.isInteger(choice) || choice < 0 || choice >= getDilemma(d.defId).choices.length) return 'That isn\'t one of the answers.';
  if (!dilemmaRoles(state, d)) return 'It doesn\'t matter any more.';
  return undefined;
}

/** The player answers the decision waiting at the Depot. Throws if they can't. */
export function decideDilemma(state: GameState, choice: number, now: number): DilemmaResult {
  const problem = decideProblem(state, choice);
  if (problem) throw new Error(problem);
  const day = dayAt(state, now);
  const def = getDilemma(state.dilemmas.active!.defId);
  return withRng(state, (rng) => resolve(state, def.choices[choice]!.outcomes, def.choices[choice]!.label, day, rng));
}

function resolve(state: GameState, outcomes: readonly DilemmaOutcome[], label: string | undefined, day: number, rng: Rng): DilemmaResult {
  const d = state.dilemmas.active!;
  const def = getDilemma(d.defId);
  const roles = dilemmaRoles(state, d)!;
  const outcome = outcomes.find((o) => !o.test || passes(state, o.test, roles, rng)) ?? outcomes[outcomes.length - 1]!;
  let text = fillRoles(outcome.text, roles);
  for (const effect of outcome.effects) {
    if (effect.kind === 'reveal') {
      text = text.replace('{place}', reveal(state, rng) ?? 'somewhere');
      continue;
    }
    const extra = apply(state, effect, roles, d, day, rng);
    if (extra) text += ` ${fillRoles(extra, roles)}`;
  }
  for (const role of ['a', 'b'] as const) {
    const line = def.chronicle?.[role];
    const s = roles[role];
    if (line && s && state.survivors.includes(s)) addChronicle(s, day, fillRoles(line, roles), ['decision', def.id]);
  }
  const choice = label ? fillRoles(label, roles) : undefined;
  addGuildLog(state, day, `${def.title}: ${text}`, ['decision', def.id]);
  delete state.dilemmas.active;
  state.dilemmas.nextDay = day + rng.int(DILEMMA_GAP[0], DILEMMA_GAP[1]);
  return { title: def.title, ...(choice ? { choice } : {}), text };
}

function passes(state: GameState, test: DilemmaTest, roles: Record<string, Survivor>, rng: Rng): boolean {
  if ('chance' in test) return rng.chance(test.chance);
  if ('close' in test) return ['friend', 'bonded'].includes(relationshipLabel(state, roles.a!.id, roles.b!.id));
  if ('apart' in test) return ['rival', 'feud'].includes(relationshipLabel(state, roles.a!.id, roles.b!.id));
  if ('trait' in test) return hasTrait(roles[test.who]!, test.trait);
  const who =
    test.who === 'best'
      ? state.survivors.filter(atDepot).reduce((x, y) => (effectiveStat(y, test.stat) > effectiveStat(x, test.stat) ? y : x), roles.a!)
      : roles[test.who]!;
  return rollCheck(rng, effectiveStat(who, test.stat), test.dc).success;
}

/** The people an effect is about. */
function people(state: GameState, who: DilemmaWho, roles: Record<string, Survivor>): Survivor[] {
  if (who === 'home') return state.survivors.filter(atDepot);
  if (who === 'both') return [roles.a, roles.b].filter((s): s is Survivor => s !== undefined);
  return roles[who] ? [roles[who]!] : [];
}

/** Apply one effect. Returns any extra sentence the story needs (a stranger with no bed to sleep in). */
function apply(state: GameState, e: DilemmaEffect, roles: Record<string, Survivor>, d: ActiveDilemma, day: number, rng: Rng): string | undefined {
  switch (e.kind) {
    case 'stress':
      for (const s of people(state, e.who, roles)) changeStress(s, e.amount, { rng, day, source: getDilemma(d.defId).title.toLowerCase() });
      return undefined;
    case 'bond': {
      const other = e.stranger ? roles.s : roles.b;
      if (other && roles.a && state.survivors.includes(other)) adjustRelationship(state, roles.a.id, other.id, e.amount, { day });
      return undefined;
    }
    case 'standing': {
      const s = roles[e.who];
      if (!s) return undefined;
      for (const o of state.survivors.filter(atDepot)) if (o.id !== s.id && o.id !== roles.a?.id && o.id !== roles.b?.id) adjustRelationship(state, s.id, o.id, e.amount, { day });
      return undefined;
    }
    case 'warm': {
      const home = state.survivors.filter(atDepot);
      for (let i = 0; i < home.length; i++) for (let j = i + 1; j < home.length; j++) adjustRelationship(state, home[i]!.id, home[j]!.id, e.amount, { day });
      return undefined;
    }
    case 'supplies':
      for (const r of RESOURCE_IDS) if (e.change[r]) state.resources[r] = Math.max(0, state.resources[r] + e.change[r]!);
      return undefined;
    case 'hurt':
      for (const s of people(state, e.who, roles)) {
        s.hp = Math.max(1, s.hp - e.amount);
        if (s.hp <= maxHp(s) / 3) addTrait(s, 'wounded', { day, rng, source: getDilemma(d.defId).title.toLowerCase() });
      }
      return undefined;
    case 'trait': {
      const s = roles[e.who];
      if (s) addTrait(s, e.trait, { day, rng, source: getDilemma(d.defId).title.toLowerCase() });
      return undefined;
    }
    case 'practice': {
      const s = roles[e.who];
      if (s) addPractice(s, e.stat, e.amount, day);
      return undefined;
    }
    case 'joins': {
      const s = d.stranger;
      if (!s || state.survivors.some((x) => x.id === s.id)) return undefined;
      if (!hasFreeBunk(state)) return 'There was no bed for {s.them}, so {s.they} moved on in the morning.';
      recruit(state, s, rng, day, 'Came to the gate at dusk, and was let in.');
      roles.s = s;
      return undefined;
    }
    case 'reveal':
      reveal(state, rng);
      return undefined;
    case 'wanderer':
      addWanderer(state, day, rng);
      return undefined;
    case 'leaves': {
      const s = roles[e.who];
      if (s && state.survivors.includes(s)) leaveGuild(state, s, day, fillRoles(e.reason, roles), rng);
      return undefined;
    }
    case 'vultures':
      if (e.standing) changeStanding(state, e.standing, day);
      if (e.atLeast !== undefined && state.vultures.standing < e.atLeast) changeStanding(state, e.atLeast - state.vultures.standing, day);
      if (e.strength) changeStrength(state, e.strength);
      return undefined;
    case 'captured': {
      const m = d.envoy ? vultureMember(state, d.envoy) : undefined;
      if (!m || m.status !== 'free') return undefined;
      m.status = 'captured';
      delete m.campId;
      changeStrength(state, m.role === 'boss' ? VULTURES_BOSS_STRENGTH : VULTURES_LIEUTENANT_STRENGTH);
      noteMember(m, day, 'Taken prisoner at the guild\'s gate.');
      return undefined;
    }
    case 'released': {
      const m = d.prisoner ? vultureMember(state, d.prisoner) : undefined;
      if (!m || m.status !== 'captured') return undefined;
      m.status = 'free';
      const home = state.vultures.camps.find((c) => c.home) ?? state.vultures.camps[0];
      if (home) m.campId = home.locationId;
      noteMember(m, day, 'Traded back to the Vultures by the guild.');
      return undefined;
    }
    case 'raid':
      raid(state, day, rng, { name: 'The Vultures', lower: 'the Vultures', dc: VULTURES_RAID_DC });
      return undefined;
  }
}

/** Put a place nobody has found on the map. Returns its name. */
function reveal(state: GameState, rng: Rng): string | undefined {
  const options = frontier(state);
  if (options.length === 0) return undefined;
  const id = rng.pick(options);
  ensureLocationState(state, id).discovered = true;
  return getLocation(id).name;
}
