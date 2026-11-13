/**
 * Captives (§9.8): sometimes a raid the guild beats leaves one of them behind
 * alive. They're held at the Depot: they eat, now and then slip out, and can
 * be questioned once, asked to join, or let go. Raiders (and the Vultures)
 * may come back for them.
 */
import { addGuildLog } from './chronicle.ts';
import {
  CAPTIVE_CACHE,
  CAPTIVE_ESCAPE_CHANCE,
  CAPTIVE_JOIN_CHANCE,
  CAPTIVE_QUESTION_DC,
  PRACTICE_HARD,
  VULTURES_RELEASE_STANDING,
  YEAR_DAYS,
} from './constants.ts';
import { atDepot, hasFreeBunk } from './depot/buildings.ts';
import { dayAt, recruit, withRng } from './game.ts';
import { generateSurvivor } from './generator.ts';
import type { Rng } from './rng.ts';
import { addPractice, checkBonus, rollCheck } from './stats.ts';
import { fullName } from './text.ts';
import type { Captive, CheckInfo, GameState, Resources, Survivor } from './types.ts';
import { changeStanding, vulturesActive } from './vultures.ts';

/** One of a beaten raid, left behind alive and held at the Depot. */
export function takeCaptive(state: GameState, from: Captive['from'], day: number, rng: Rng): Captive {
  const person = generateSurvivor(state, rng, { day, hiddenTraitChance: 0 });
  person.age = Math.max(person.age, 18);
  // Born a year ago at the latest, so ages and birthdays read right if they ever join.
  person.nextBirthday = day + 1 + (person.appearance.seed % YEAR_DAYS);
  const captive: Captive = { person, from, since: day };
  state.captives.push(captive);
  return captive;
}

export function captive(state: GameState, id: string): Captive | undefined {
  return state.captives.find((c) => c.person.id === id);
}

/** A day at the Depot for the captives: they're fed scraps (a ration every other day), and now and then one slips out. */
export function playCaptivesDay(state: GameState, day: number, rng: Rng): void {
  for (const c of [...state.captives]) {
    if ((day - c.since) % 2 === 1) state.resources.rations = Math.max(0, state.resources.rations - 1);
    if (!rng.chance(CAPTIVE_ESCAPE_CHANCE)) continue;
    state.captives = state.captives.filter((x) => x !== c);
    addGuildLog(state, day, `${fullName(c.person)} slipped out of the Depot in the night.`, ['captive', c.person.id]);
  }
}

export type CaptiveAction = 'question' | 'recruit' | 'release';

/** Who'd do the questioning: the best Nerve at the Depot, leaning on them. */
export function questioner(state: GameState): Survivor | undefined {
  let best: Survivor | undefined;
  for (const s of state.survivors.filter(atDepot)) if (!best || questionBonus(s) > questionBonus(best)) best = s;
  return best;
}

function questionBonus(s: Survivor): number {
  return checkBonus(s, 'nerve', ['intimidate']);
}

/** The chance questioning them works, with the best at the Depot doing it (a d10 and the bonus). */
export function questionChance(state: GameState): number {
  const who = questioner(state);
  return who ? Math.max(0, Math.min(1, (11 - (CAPTIVE_QUESTION_DC - questionBonus(who))) / 10)) : 0;
}

/** Why this can't be done with this captive now, if it can't. */
export function captiveProblem(state: GameState, id: string, action: CaptiveAction): string | undefined {
  const c = captive(state, id);
  if (!c) return 'They aren’t held here any more.';
  if (action === 'question' && c.questioned) return 'They’ve told all they will.';
  if (action === 'question' && !questioner(state)) return 'Nobody is home to question them.';
  if (action === 'recruit' && c.refused) return 'They said no.';
  if (action === 'recruit' && !hasFreeBunk(state)) return 'There is no bed for them.';
  return undefined;
}

/** What came of it, for the screen. */
export interface CaptiveResult {
  text: string;
  check?: CheckInfo;
}

/**
 * Do something with a captive. Questioned (once), they may give up a cache of
 * their band's; asked, they may join; let go, they walk off (the Vultures take
 * it kindly). Throws when it can't be done.
 */
export function decideCaptive(state: GameState, id: string, action: CaptiveAction, now: number): CaptiveResult {
  const problem = captiveProblem(state, id, action);
  if (problem) throw new Error(problem);
  const day = dayAt(state, now);
  const c = captive(state, id)!;
  const name = fullName(c.person);
  return withRng(state, (rng) => {
    if (action === 'question') {
      const who = questioner(state)!;
      const bonus = questionBonus(who);
      const roll = rollCheck(rng, bonus, CAPTIVE_QUESTION_DC, 'nerve');
      addPractice(who, 'nerve', PRACTICE_HARD, day);
      c.questioned = true;
      const check: CheckInfo = { who: who.id, stat: 'nerve', roll: roll.roll, bonus, dc: CAPTIVE_QUESTION_DC, success: roll.success };
      if (!roll.success) {
        const text = `${who.firstName} leaned on ${name}, who gave up nothing.`;
        addGuildLog(state, day, text, ['captive', id]);
        return { text, check };
      }
      const cache: Partial<Resources> = {};
      for (const [r, [lo, hi]] of Object.entries(CAPTIVE_CACHE) as [keyof typeof CAPTIVE_CACHE, readonly [number, number]][]) {
        const n = rng.int(lo, hi);
        state.resources[r] += n;
        cache[r] = n;
      }
      const text = `${who.firstName} leaned on ${name}, who told of a cache their band kept nearby: ${cacheText(cache)}, now in the stores.`;
      addGuildLog(state, day, text, ['captive', id]);
      return { text, check };
    }
    if (action === 'release') {
      state.captives = state.captives.filter((x) => x !== c);
      if (c.from === 'vultures' && vulturesActive(state)) changeStanding(state, Math.round(VULTURES_RELEASE_STANDING / 2), day);
      const text = `${name} was let go, and walked off into the Reach.`;
      addGuildLog(state, day, text, ['captive', id]);
      return { text };
    }
    // Asked to join.
    if (!rng.chance(CAPTIVE_JOIN_CHANCE)) {
      c.refused = true;
      const text = `${name} was asked to join, and said no.`;
      addGuildLog(state, day, text, ['captive', id]);
      return { text };
    }
    state.captives = state.captives.filter((x) => x !== c);
    const s = c.person;
    s.status = 'ready';
    s.stress = Math.min(s.stress, 30);
    recruit(state, s, rng, day, c.from === 'vultures' ? 'Left the Vultures and joined the guild.' : 'Was held at the Depot after a raid, and joined the guild.');
    return { text: `${name} joined the guild.` };
  });
}

function cacheText(cache: Partial<Resources>): string {
  const parts = Object.entries(cache).map(([r, n]) => `${n} ${r}`);
  return parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
