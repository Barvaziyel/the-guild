import { addChronicle, addGuildLog } from './chronicle.ts';
import {
  AFFINITY_MAX,
  AFFINITY_MIN,
  PARTNER_DAILY_CHANCE,
  PARTNER_GUILD_FACTOR,
  PARTNER_SECOND_FACTOR,
  PARTNER_SPLIT_SCORE,
  REL_AFFINITY_SCALE,
  REL_MAX,
  REL_MIN,
  REL_START_NOISE,
  REL_THRESHOLDS,
} from './constants.ts';
import { getTrait } from './content/index.ts';
import type { Rng } from './rng.ts';
import { fullName } from './text.ts';
import { mulTraitHook } from './traits.ts';
import type { GameState, Relationship, RelationshipFlag, RelationshipLabel, Survivor } from './types.ts';

export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function labelFor(score: number): RelationshipLabel {
  for (const t of REL_THRESHOLDS) if (score >= t.min) return t.label;
  return 'feud';
}

const LABEL_NAMES: Record<RelationshipLabel, string> = {
  feud: 'Feud',
  rival: 'Rivals',
  neutral: 'Neutral',
  friend: 'Friends',
  bonded: 'Bonded',
};

export function labelName(label: RelationshipLabel): string {
  return LABEL_NAMES[label];
}

/**
 * How well two survivors' traits get along, from -2 to +2. Symmetric.
 * Sums both survivors' sociability and every trait-to-trait affinity in both directions.
 */
export function traitAffinity(x: Survivor, y: Survivor): number {
  let total = 0;
  const xIds = x.traits.map((t) => t.id);
  const yIds = y.traits.map((t) => t.id);
  for (const id of xIds) {
    const def = getTrait(id);
    total += def.sociability ?? 0;
    for (const other of yIds) total += def.affinity?.[other] ?? 0;
  }
  for (const id of yIds) {
    const def = getTrait(id);
    total += def.sociability ?? 0;
    for (const other of xIds) total += def.affinity?.[other] ?? 0;
  }
  return Math.max(AFFINITY_MIN, Math.min(AFFINITY_MAX, total));
}

export function getRelationship(state: GameState, a: string, b: string): Relationship | undefined {
  return state.relationships[pairKey(a, b)];
}

export function relationshipScore(state: GameState, a: string, b: string): number {
  return getRelationship(state, a, b)?.score ?? 0;
}

export function relationshipLabel(state: GameState, a: string, b: string): RelationshipLabel {
  return labelFor(relationshipScore(state, a, b));
}

function ensureRelationship(state: GameState, a: string, b: string): Relationship {
  const key = pairKey(a, b);
  let rel = state.relationships[key];
  if (!rel) {
    const [first, second] = a < b ? [a, b] : [b, a];
    rel = { a: first, b: second, score: 0, flags: [] };
    state.relationships[key] = rel;
  }
  return rel;
}

function findSurvivor(state: GameState, id: string): Survivor | undefined {
  return state.survivors.find((s) => s.id === id) ?? state.memorial.find((s) => s.id === id);
}

/** Create starting relationships between a newcomer and everyone already in the guild. */
export function initRelationships(state: GameState, newcomer: Survivor, rng: Rng): void {
  for (const other of state.survivors) {
    if (other.id === newcomer.id) continue;
    const rel = ensureRelationship(state, newcomer.id, other.id);
    const affinity = traitAffinity(newcomer, other);
    rel.score = clampScore(affinity * REL_AFFINITY_SCALE + rng.int(-REL_START_NOISE, REL_START_NOISE));
  }
}

function clampScore(score: number): number {
  return Math.max(REL_MIN, Math.min(REL_MAX, Math.round(score)));
}

export interface AdjustOptions {
  day: number;
  /** Scale positive changes by both survivors' relGainMult traits (Loner, Paranoid...). Default true. */
  useTraitMult?: boolean;
  /** Skip Chronicle entries on label changes. */
  silent?: boolean;
}

export interface AdjustResult {
  before: number;
  after: number;
  /** Set when the label changed, e.g. neutral -> friend. */
  labelChange?: { from: RelationshipLabel; to: RelationshipLabel };
}

/** Change the relationship between two survivors and log label changes in both Chronicles. */
export function adjustRelationship(
  state: GameState,
  aId: string,
  bId: string,
  delta: number,
  opts: AdjustOptions,
): AdjustResult {
  if (aId === bId) throw new Error('adjustRelationship: same survivor');
  const rel = ensureRelationship(state, aId, bId);
  const before = rel.score;
  const a = findSurvivor(state, aId);
  const b = findSurvivor(state, bId);

  let change = delta;
  if (change > 0 && opts.useTraitMult !== false && a && b) {
    change *= (mulTraitHook(a, 'relGainMult') + mulTraitHook(b, 'relGainMult')) / 2;
  }
  rel.score = clampScore(before + change);

  const result: AdjustResult = { before, after: rel.score };
  const from = labelFor(before);
  const to = labelFor(rel.score);
  // Partners who are no longer even friends split up.
  if (rel.flags.some((f) => f.kind === 'partners') && rel.score < PARTNER_SPLIT_SCORE) {
    rel.flags = rel.flags.filter((f) => f.kind !== 'partners');
    if (a && b) {
      addChronicle(a, opts.day, `Split up with ${fullName(b)}.`, ['relationship', b.id]);
      addChronicle(b, opts.day, `Split up with ${fullName(a)}.`, ['relationship', a.id]);
      addGuildLog(state, opts.day, `${a.firstName} and ${b.firstName} have split up.`, ['partners', a.id, b.id]);
    }
  }
  if (from !== to) {
    result.labelChange = { from, to };
    if (!opts.silent && a && b) {
      addChronicle(a, opts.day, labelChangeText(from, to, fullName(b)), ['relationship', b.id]);
      addChronicle(b, opts.day, labelChangeText(from, to, fullName(a)), ['relationship', a.id]);
    }
  }
  return result;
}

const LABEL_ORDER: RelationshipLabel[] = ['feud', 'rival', 'neutral', 'friend', 'bonded'];

function labelChangeText(from: RelationshipLabel, to: RelationshipLabel, other: string): string {
  const warmer = LABEL_ORDER.indexOf(to) > LABEL_ORDER.indexOf(from);
  switch (to) {
    case 'bonded':
      return `Bonded with ${other}.`;
    case 'friend':
      return warmer ? `Became friends with ${other}.` : `Drifted apart from ${other}, but still friends.`;
    case 'neutral':
      return warmer ? `Buried the hatchet with ${other}.` : `Fell out with ${other}.`;
    case 'rival':
      return warmer ? `Cooled off with ${other}, though still rivals.` : `Became rivals with ${other}.`;
    case 'feud':
      return `Started a feud with ${other}.`;
  }
}

// ---------------------------------------------------------------- partners

export function arePartners(state: GameState, a: string, b: string): boolean {
  return hasFlag(state, a, b, 'partners');
}

/** A living survivor's partner, if they have one (the first, in the rare case of two). */
export function partnerOf(state: GameState, id: string): Survivor | undefined {
  return state.survivors.find((o) => o.id !== id && arePartners(state, id, o.id));
}

/** Whether `a` could fall for `b`: straight for the other sex, gay for their own, bi for either. */
export function drawnTo(a: Survivor, b: Survivor): boolean {
  if (a.orientation === 'bi') return true;
  const sameSex = a.pronouns === b.pronouns;
  return a.orientation === 'gay' ? sameSex : !sameSex;
}

/**
 * The chance, on a day at the Depot together, that two survivors become
 * partners: Bonded adults drawn to each other who aren't grieving. About 99%
 * of people stay with one partner.
 */
export function romanceChance(state: GameState, a: Survivor, b: Survivor): number {
  if (a.id === b.id || a.age < 18 || b.age < 18) return 0;
  if (!drawnTo(a, b) || !drawnTo(b, a)) return 0;
  if (relationshipLabel(state, a.id, b.id) !== 'bonded' || arePartners(state, a.id, b.id)) return 0;
  if (a.traits.some((t) => t.id === 'grieving') || b.traits.some((t) => t.id === 'grieving')) return 0;
  let p = PARTNER_DAILY_CHANCE;
  if (partnerOf(state, a.id) || partnerOf(state, b.id)) p *= PARTNER_SECOND_FACTOR;
  return p * PARTNER_GUILD_FACTOR ** couplesIn(state);
}

/** How many couples the guild has among the living. */
export function couplesIn(state: GameState): number {
  let n = 0;
  for (const rel of Object.values(state.relationships)) {
    if (!rel.flags.some((f) => f.kind === 'partners')) continue;
    if (state.survivors.some((s) => s.id === rel.a) && state.survivors.some((s) => s.id === rel.b)) n += 1;
  }
  return n;
}

/** Two survivors become partners. */
export function becomePartners(state: GameState, a: Survivor, b: Survivor, day: number): void {
  addFlag(state, a.id, b.id, { kind: 'partners' });
  addChronicle(a, day, `Became partners with ${fullName(b)}.`, ['relationship', b.id]);
  addChronicle(b, day, `Became partners with ${fullName(a)}.`, ['relationship', a.id]);
  addGuildLog(state, day, `${a.firstName} and ${b.firstName} are together now.`, ['partners', a.id, b.id]);
}

// ---------------------------------------------------------------- flags

export function hasFlag(state: GameState, a: string, b: string, kind: RelationshipFlag['kind']): boolean {
  return getRelationship(state, a, b)?.flags.some((f) => f.kind === kind) ?? false;
}

export function addFlag(state: GameState, a: string, b: string, flag: RelationshipFlag): void {
  const rel = ensureRelationship(state, a, b);
  const same = rel.flags.some((f) => JSON.stringify(f) === JSON.stringify(flag));
  if (!same) rel.flags.push(flag);
}

export function removeFlag(state: GameState, a: string, b: string, kind: RelationshipFlag['kind']): void {
  const rel = getRelationship(state, a, b);
  if (rel) rel.flags = rel.flags.filter((f) => f.kind !== kind);
}

// ---------------------------------------------------------------- queries

export interface RelationshipView {
  other: Survivor;
  score: number;
  label: RelationshipLabel;
  flags: RelationshipFlag[];
}

/** Everyone a survivor has a relationship with (living guild members), warmest first. */
export function relationshipsOf(state: GameState, id: string): RelationshipView[] {
  const out: RelationshipView[] = [];
  for (const other of state.survivors) {
    if (other.id === id) continue;
    const rel = getRelationship(state, id, other.id);
    const score = rel?.score ?? 0;
    out.push({ other, score, label: labelFor(score), flags: rel?.flags ?? [] });
  }
  return out.sort((x, y) => y.score - x.score);
}

/**
 * Crew cohesion modifier from -2 to +2: the average pair score in the crew,
 * scaled so that +50 average gives +2 and -50 gives -2. Solo crews get 0.
 */
export function crewCohesion(state: GameState, ids: readonly string[]): number {
  if (ids.length < 2) return 0;
  let total = 0;
  let pairs = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      total += relationshipScore(state, ids[i]!, ids[j]!);
      pairs++;
    }
  }
  const avg = total / pairs;
  return Math.max(-2, Math.min(2, Math.round(avg / 25)));
}

/** Pairs in a crew whose label is rival or feud, for planner warnings. */
export function crewConflicts(state: GameState, ids: readonly string[]): { a: string; b: string; label: RelationshipLabel }[] {
  const out: { a: string; b: string; label: RelationshipLabel }[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const label = relationshipLabel(state, ids[i]!, ids[j]!);
      if (label === 'rival' || label === 'feud') out.push({ a: ids[i]!, b: ids[j]!, label });
    }
  }
  return out;
}
