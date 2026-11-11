import { STAT_BASE, STAT_GEN_MAX, STAT_GEN_POINTS } from './constants.ts';
import { FIRST_NAMES, LAST_NAMES, ORIGINS, TRAITS, getGear, getOrigin, type OriginDef } from './content/index.ts';
import { createItem } from './gear.ts';
import { newId } from './ids.ts';
import type { Rng, Weighted } from './rng.ts';
import { emptyStats, maxHp } from './stats.ts';
import { fill } from './text.ts';
import { addTrait, hasTrait } from './traits.ts';
import type { Appearance, GameState, LifeCounters, Pronouns, Quality, Stats, Survivor } from './types.ts';
import { STAT_IDS } from './types.ts';

export interface GenerateOptions {
  day: number;
  /** Force an origin id. */
  origin?: string;
  pronouns?: Pronouns;
  /** Chance of one extra hidden personality trait (default 0.5). */
  hiddenTraitChance?: number;
}

const PRONOUN_WEIGHTS: { item: Pronouns; weight: number }[] = [
  { item: 'he', weight: 50 },
  { item: 'she', weight: 50 },
];

/** Hidden trait picks favor traits that are fun to discover. */
const HIDDEN_WEIGHT_MULT: Record<string, number> = { unlucky: 3, cowardly: 1.5, greedy: 1.5, lucky: 1.5 };

export function emptyCounters(): LifeCounters {
  return {
    runs: 0,
    combats: 0,
    kills: 0,
    rangedKills: 0,
    meleeKills: 0,
    killsByEnemy: {},
    timesDowned: 0,
    nearDeaths: 0,
    rads: 0,
    alliesLost: 0,
    alliesSaved: 0,
    scavenges: 0,
    daysAtDepot: 0,
  };
}

export function pickOrigin(rng: Rng, exclude: readonly string[] = []): OriginDef {
  const pool = ORIGINS.filter((o) => !exclude.includes(o.id));
  return rng.weightedBy(pool.length > 0 ? pool : ORIGINS, (o) => o.weight);
}

/** Distribute STAT_GEN_POINTS on top of STAT_BASE, weighted by origin, capped at STAT_GEN_MAX. */
export function rollStats(rng: Rng, origin: OriginDef): Stats {
  const stats = emptyStats(STAT_BASE);
  for (let i = 0; i < STAT_GEN_POINTS; i++) {
    const open = STAT_IDS.filter((stat) => stats[stat] < STAT_GEN_MAX);
    const stat = rng.weightedBy(open, (st) => origin.statWeights[st]);
    stats[stat] += 1;
  }
  return stats;
}

function rollName(rng: Rng, pronouns: Pronouns, taken: ReadonlySet<string>): { first: string; last: string } {
  const pool: readonly string[] = [...FIRST_NAMES[pronouns], ...FIRST_NAMES.either];
  for (let attempt = 0; attempt < 50; attempt++) {
    const first = rng.pick(pool);
    const last = rng.pick(LAST_NAMES);
    if (first !== last && !taken.has(first) && !taken.has(last)) return { first, last };
  }
  // Fall back to any combination; duplicates of first names are rare and harmless.
  return { first: rng.pick(pool), last: rng.pick(LAST_NAMES) };
}

function rollAppearance(rng: Rng): Appearance {
  return {
    seed: rng.seed32(),
    skinTone: rng.int(0, 99),
    hairColor: rng.int(0, 99),
    hairStyle: rng.int(0, 99),
    faceShape: rng.int(0, 99),
    eyes: rng.int(0, 99),
    brows: rng.int(0, 99),
    nose: rng.int(0, 99),
    mouth: rng.int(0, 99),
    facialHair: rng.int(0, 99),
  };
}

/** Personality traits that can appear at recruitment (startWeight > 0). */
function personalityPool(s: Survivor, hidden: boolean): Weighted<string>[] {
  return TRAITS.filter(
    (t) =>
      (t.startWeight ?? 0) > 0 &&
      !hasTrait(s, t.id) &&
      !(t.opposite !== undefined && hasTrait(s, t.opposite)),
  ).map((t) => ({
    item: t.id,
    weight: (t.startWeight ?? 0) * (hidden ? (HIDDEN_WEIGHT_MULT[t.id] ?? 1) : 1),
  }));
}

function rollTraits(rng: Rng, s: Survivor, origin: OriginDef, day: number, hiddenChance: number): void {
  for (const { trait, chance } of origin.traitChances) {
    if (rng.chance(chance)) addTrait(s, trait, { day, source: `${origin.name} upbringing`, silent: true });
  }
  const visibleTarget = rng.chance(0.55) ? 1 : 2;
  while (s.traits.length < visibleTarget) {
    const pool = personalityPool(s, false);
    if (pool.length === 0) break;
    addTrait(s, rng.weighted(pool), { day, silent: true });
  }
  if (rng.chance(hiddenChance)) {
    const pool = personalityPool(s, true);
    if (pool.length > 0) addTrait(s, rng.weighted(pool), { day, hidden: true, silent: true });
  }
}

function rollStartingGear(state: GameState, rng: Rng, s: Survivor, origin: OriginDef): void {
  const quality: Quality = rng.chance(0.4) ? 'rusty' : 'common';
  s.equipment.weapon = createItem(state, rng.pick(origin.startingWeapons), quality);
  if (origin.startingExtras && rng.chance(origin.startingExtras.chance)) {
    const defId = rng.pick(origin.startingExtras.gear);
    const slot = getGear(defId).slot;
    if (!s.equipment[slot]) s.equipment[slot] = createItem(state, defId, 'common');
  }
}

/**
 * Generate a new survivor. Does not add them to the guild; use recruit() for that.
 * Consumes ids from the state counter.
 */
export function generateSurvivor(state: GameState, rng: Rng, opts: GenerateOptions): Survivor {
  const origin = opts.origin ? getOrigin(opts.origin) : pickOrigin(rng);
  const pronouns = opts.pronouns ?? rng.weighted(PRONOUN_WEIGHTS);
  // Avoid repeating first or last names within the guild (shared surnames would imply family).
  const taken = new Set(state.survivors.flatMap((x) => [x.firstName, x.lastName]));
  const { first, last } = rollName(rng, pronouns, taken);

  const s: Survivor = {
    id: newId(state, 's'),
    firstName: first,
    lastName: last,
    pronouns,
    age: rng.int(origin.ageRange[0], origin.ageRange[1]),
    origin: origin.id,
    backstory: '',
    appearance: rollAppearance(rng),
    stats: rollStats(rng, origin),
    practice: emptyStats(0),
    hp: 0,
    stress: rng.int(0, 15),
    traits: [],
    equipment: {},
    counters: emptyCounters(),
    chronicle: [],
    status: 'ready',
    joinedDay: opts.day,
  };

  s.backstory = fill(rng.pick(origin.backstories), s);
  rollTraits(rng, s, origin, opts.day, opts.hiddenTraitChance ?? 0.5);
  rollStartingGear(state, rng, s, origin);
  s.hp = maxHp(s);
  return s;
}
