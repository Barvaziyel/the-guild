import { addChronicle } from './chronicle.ts';
import {
  CARRY_BASE,
  HP_BASE,
  HP_PER_GRIT,
  NERVE_STRESS_DIVISOR,
  PRACTICE_PER_LEVEL,
  STAT_MAX,
  STRESS_AFTER_BREAK,
  STRESS_HIGH,
  STRESS_HIGH_PENALTY,
  STRESS_MAX,
} from './constants.ts';
import { getTrait } from './content/index.ts';
import { attachmentMult, equippedItems, itemDef, relicBonus } from './gear.ts';
import type { Rng } from './rng.ts';
import { addTrait, getTraitInstance, mulTraitHook } from './traits.ts';
import type { CheckMod, StatId, Stats, Survivor } from './types.ts';
import { STAT_IDS } from './types.ts';

const STAT_NAMES: Record<StatId, string> = {
  grit: 'Grit',
  brawn: 'Brawn',
  aim: 'Aim',
  wits: 'Wits',
  nerve: 'Nerve',
};

export function statName(stat: StatId): string {
  return STAT_NAMES[stat];
}

export function emptyStats(value = 0): Stats {
  return { grit: value, brawn: value, aim: value, wits: value, nerve: value };
}

// ---------------------------------------------------------------- effective stats

/** Base stat plus flat modifiers from traits (hidden included) and equipped gear. Never below 0. */
export function effectiveStat(s: Survivor, stat: StatId): number {
  let value = s.stats[stat];
  for (const t of s.traits) value += getTrait(t.id).statMods?.[stat] ?? 0;
  for (const item of Object.values(s.equipment)) {
    if (item) value += (itemDef(item).statMods?.[stat] ?? 0) * attachmentMult(item, s) + relicBonus(item, stat);
  }
  return Math.max(0, value);
}

export function effectiveStats(s: Survivor): Stats {
  const out = emptyStats();
  for (const stat of STAT_IDS) out[stat] = effectiveStat(s, stat);
  return out;
}

export function maxHp(s: Survivor): number {
  return HP_BASE + HP_PER_GRIT * effectiveStat(s, 'grit');
}

/** Loot units this survivor can carry home. */
export function carryCapacity(s: Survivor): number {
  return CARRY_BASE + effectiveStat(s, 'brawn');
}

// ---------------------------------------------------------------- checks

export interface CheckResult {
  stat: StatId | undefined;
  roll: number;
  bonus: number;
  total: number;
  dc: number;
  success: boolean;
  /** total - dc; negative on failure. */
  margin: number;
}

/** Roll d10 + bonus against a DC. */
export function rollCheck(rng: Rng, bonus: number, dc: number, stat?: StatId): CheckResult {
  const roll = rng.d10();
  const total = roll + bonus;
  return { stat, roll, bonus, total, dc, success: total >= dc, margin: total - dc };
}

/** Does a situational modifier apply to this stat and set of contexts? */
export function checkModApplies(mod: CheckMod, stat: StatId | undefined, contexts: readonly string[]): boolean {
  if (mod.stat !== undefined && mod.stat !== stat) return false;
  if (mod.context !== undefined && !contexts.includes(mod.context)) return false;
  // A mod with neither stat nor context would apply to everything; content should use statMods instead.
  return mod.stat !== undefined || mod.context !== undefined;
}

/** Sum of trait and gear check modifiers that apply. */
export function situationalMods(s: Survivor, stat: StatId | undefined, contexts: readonly string[]): number {
  let total = 0;
  for (const t of s.traits) {
    for (const mod of getTrait(t.id).hooks?.checkMods ?? []) {
      if (checkModApplies(mod, stat, contexts)) total += mod.mod;
    }
  }
  for (const item of equippedItems(s)) {
    for (const mod of itemDef(item).hooks?.checkMods ?? []) {
      if (checkModApplies(mod, stat, contexts)) total += mod.mod * attachmentMult(item, s);
    }
  }
  return total;
}

/** Contexts for checks against an enemy type, including Vengeful targeting. */
export function enemyContexts(s: Survivor, enemyType: string): string[] {
  const contexts = [`enemy:${enemyType}`];
  if (getTraitInstance(s, 'vengeful')?.target === enemyType) contexts.push('vengeance');
  return contexts;
}

/** Full bonus for a check: effective stat + situational mods + high-stress penalty. */
export function checkBonus(s: Survivor, stat: StatId, contexts: readonly string[] = []): number {
  let bonus = effectiveStat(s, stat) + situationalMods(s, stat, contexts);
  if (s.stress >= STRESS_HIGH) bonus += STRESS_HIGH_PENALTY;
  return bonus;
}

// ---------------------------------------------------------------- practice

/** Practice needed to raise a stat from its current value to the next. */
export function practiceNeeded(statValue: number): number {
  return PRACTICE_PER_LEVEL * Math.max(1, statValue);
}

export interface StatIncrease {
  stat: StatId;
  from: number;
  to: number;
}

/**
 * Add practice to a stat. When it crosses the threshold the base stat goes up
 * (possibly more than once) and a Chronicle entry is written.
 */
export function addPractice(s: Survivor, stat: StatId, amount: number, day: number): StatIncrease[] {
  const increases: StatIncrease[] = [];
  if (amount <= 0 || s.stats[stat] >= STAT_MAX) return increases;
  s.practice[stat] += amount;
  while (s.stats[stat] < STAT_MAX && s.practice[stat] >= practiceNeeded(s.stats[stat])) {
    s.practice[stat] -= practiceNeeded(s.stats[stat]);
    const from = s.stats[stat];
    s.stats[stat] = from + 1;
    increases.push({ stat, from, to: from + 1 });
    addChronicle(s, day, `${statName(stat)} rose to ${from + 1}.`, ['stat', stat]);
  }
  if (s.stats[stat] >= STAT_MAX) s.practice[stat] = 0;
  return increases;
}

// ---------------------------------------------------------------- stress

/** Multiplier on incoming stress from traits and Nerve. */
export function stressGainMultiplier(s: Survivor): number {
  const nerveFactor = Math.max(0, 1 - effectiveStat(s, 'nerve') / NERVE_STRESS_DIVISOR);
  return mulTraitHook(s, 'stressGainMult') * nerveFactor;
}

export interface StressResult {
  before: number;
  after: number;
  /** Set if this change hit the breaking point. */
  breakingPoint?: { trait: string; positive: boolean };
}

/** Breaking point outcomes. Negative ones are rolled 70% of the time. */
const NEGATIVE_BREAKS = ['jittery', 'paranoid', 'drinker', 'haunted'] as const;
const POSITIVE_BREAKS = ['unshakable', 'hardened'] as const;
export const POSITIVE_BREAK_CHANCE = 0.3;

/**
 * Change a survivor's stress. Positive amounts are scaled by stressGainMultiplier
 * unless `raw` is set. Reaching STRESS_MAX triggers a breaking point.
 */
export function changeStress(
  s: Survivor,
  amount: number,
  ctx: { rng: Rng; day: number; raw?: boolean; source?: string },
): StressResult {
  const before = s.stress;
  const scaled = amount > 0 && !ctx.raw ? amount * stressGainMultiplier(s) : amount;
  s.stress = Math.round(Math.min(STRESS_MAX, Math.max(0, s.stress + scaled)));
  const result: StressResult = { before, after: s.stress };

  if (s.stress >= STRESS_MAX) {
    const positive = ctx.rng.chance(POSITIVE_BREAK_CHANCE);
    const pool = (positive ? POSITIVE_BREAKS : NEGATIVE_BREAKS).filter((id) => !s.traits.some((t) => t.id === id));
    const source = ctx.source ? `pushed past breaking point by ${ctx.source}` : 'pushed past breaking point';
    if (pool.length > 0) {
      const trait = ctx.rng.pick(pool);
      addTrait(s, trait, { day: ctx.day, source, force: true, rng: ctx.rng });
      result.breakingPoint = { trait, positive };
    } else {
      addChronicle(s, ctx.day, 'Hit breaking point and somehow held together.', ['stress']);
    }
    s.stress = STRESS_AFTER_BREAK;
    result.after = s.stress;
  }
  return result;
}
