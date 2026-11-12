/**
 * Ageing and families (§5.2, §5.3, 1.10.0). Everyone has a birthday every
 * game year; from 60 the years start to take something, and from 65 someone
 * can die peacefully at home. Partners at the Depot sometimes have a baby, who
 * grows up there in real time and joins the guild at 16.
 *
 * Children live in `state.children`, not `state.survivors`, so nothing that
 * sends people out, posts them or casts them in events ever sees them.
 */
import { rehomeAnimals } from './animals.ts';
import { addChronicle, addGuildLog } from './chronicle.ts';
import {
  ADULT_AGE,
  BABY_GAP_DAYS,
  BIRTH_RELIEF,
  CHILD_GARDEN,
  CHILD_HELP_AGE,
  CHILD_RATIONS,
  CHILD_RELIEF,
  CHILD_RELIEF_MAX,
  CONCEIVE_CHANCE,
  DECLINE_AGE,
  DECLINE_CHANCE,
  DECLINE_FLOOR,
  MOTHER_AGES,
  NEARLY_DUE_DAYS,
  OLD_AGE_AGE,
  OLD_AGE_DEATH_BASE,
  PREGNANCY_DAYS,
  REL_FAMILY,
  STAT_GEN_MAX,
  STAT_MIN,
  YEAR_DAYS,
} from './constants.ts';
import { getTrait } from './content/index.ts';
import { atDepot, hasEmptyBed } from './depot/buildings.ts';
import { mourn } from './expedition/runs.ts';
import { recruit } from './game.ts';
import { createItem } from './gear.ts';
import { generateSurvivor } from './generator.ts';
import { adjustRelationship, arePartners } from './relationships.ts';
import type { Rng } from './rng.ts';
import { changeStress, maxHp, statName } from './stats.ts';
import { fullName, pronounForms } from './text.ts';
import { addTrait, hasTrait, removeTrait } from './traits.ts';
import type { GameState, StatId, Survivor } from './types.ts';
import { STAT_IDS } from './types.ts';

/** The stats old age wears down. */
const DECLINING: readonly StatId[] = ['grit', 'brawn', 'aim'];

// ---------------------------------------------------------------- reading the family

/** "daughter" or "son". */
function childWord(s: Survivor): string {
  return s.pronouns === 'she' ? 'daughter' : 'son';
}

/** Children (still at the Depot, under 16) of this survivor. */
export function childrenOf(state: GameState, id: string): Survivor[] {
  return state.children.filter((c) => c.parents?.mother === id || c.parents?.father === id);
}

/** Anyone, child or grown, dead or gone, by id. */
function anyone(state: GameState, id: string): Survivor | undefined {
  return [...state.survivors, ...state.children, ...state.memorial, ...state.departed].find((s) => s.id === id);
}

/** A child's parents, as far as the guild knows them. */
export function parentsOf(state: GameState, child: Survivor): { mother?: Survivor; father?: Survivor } {
  if (!child.parents) return {};
  const mother = anyone(state, child.parents.mother);
  const father = anyone(state, child.parents.father);
  return { ...(mother ? { mother } : {}), ...(father ? { father } : {}) };
}

/** Beds the children take, and the babies on the way. */
export function bedsForFamilies(state: GameState): number {
  return state.children.length + state.survivors.filter((s) => s.expecting).length;
}

/** Rations the children eat a day. */
export function childRations(state: GameState): number {
  return state.children.length * CHILD_RATIONS;
}

/** What children of 12 and over add to the Garden a day. */
export function childGarden(state: GameState): number {
  return state.children.filter((c) => c.age >= CHILD_HELP_AGE).length * CHILD_GARDEN;
}

/** Stress everyone at the Depot sheds a day with children around. */
export function childRelief(state: GameState): number {
  return Math.min(CHILD_RELIEF_MAX, state.children.length * CHILD_RELIEF);
}

// ---------------------------------------------------------------- the day

/**
 * A day for families, after the Depot day: birthdays, old age, babies on the
 * way and born, and children growing up.
 */
export function playFamilyDay(state: GameState, day: number, rng: Rng): void {
  for (const s of [...state.survivors]) birthday(state, s, day, rng);
  for (const c of [...state.children]) birthday(state, c, day, rng);
  for (const s of [...state.survivors]) {
    if (s.age >= OLD_AGE_AGE && atDepot(s) && rng.chance(oldAgeChance(s.age))) dieOfOldAge(state, s, day, rng);
  }
  for (const mother of state.survivors.filter((s) => s.expecting)) {
    const e = mother.expecting!;
    if (day >= e.dueDay && mother.status === 'ready') birth(state, mother, day, rng);
    else if (day >= e.dueDay - NEARLY_DUE_DAYS && mother.status === 'ready' && !hasTrait(mother, 'nearly_due')) addTrait(mother, 'nearly_due', { day, silent: true });
  }
  for (const [mother, father] of couplesReady(state, day)) {
    if (rng.chance(CONCEIVE_CHANCE)) expecting(state, mother, father, day);
  }
}

/** The day's chance of dying of old age at this age. */
export function oldAgeChance(age: number): number {
  return age < OLD_AGE_AGE ? 0 : OLD_AGE_DEATH_BASE * (age - OLD_AGE_AGE + 1) ** 2;
}

/** A year older, if it's their birthday and they're home (away on a run, it waits for them). */
function birthday(state: GameState, s: Survivor, day: number, rng: Rng): void {
  if (s.nextBirthday === undefined || day < s.nextBirthday || s.status === 'away') return;
  s.age += 1;
  s.nextBirthday += YEAR_DAYS;
  if (state.children.includes(s) && s.age >= ADULT_AGE) {
    growUp(state, s, day, rng);
    return;
  }
  let line = `Turned ${s.age}.`;
  if (s.age >= DECLINE_AGE && rng.chance(DECLINE_CHANCE)) {
    const options = DECLINING.filter((k) => s.stats[k] > DECLINE_FLOOR);
    if (options.length > 0) {
      const stat = rng.pick(options);
      s.stats[stat] -= 1;
      s.hp = Math.min(s.hp, maxHp(s));
      line = `Turned ${s.age}, and the years are starting to tell: ${statName(stat)} down to ${s.stats[stat]}.`;
    }
  }
  addChronicle(s, day, line, ['birthday']);
}

/** Dies peacefully at the Depot. The guild mourns as for any death. */
export function dieOfOldAge(state: GameState, s: Survivor, day: number, rng: Rng): void {
  const index = state.survivors.indexOf(s);
  if (index < 0) return;
  state.survivors.splice(index, 1);
  const p = pronounForms(s.pronouns);
  s.status = 'dead';
  s.diedDay = day;
  s.causeOfDeath = `Died peacefully at the Depot, at ${s.age}`;
  delete s.post;
  delete s.expecting;
  addChronicle(s, day, `Died peacefully in ${p.their} sleep at the Depot, at ${s.age}.`, ['death']);
  for (const item of Object.values(s.equipment)) if (item) state.stash.push(item);
  s.equipment = {};
  state.memorial.push(s);
  addGuildLog(state, day, `${fullName(s)} died peacefully in ${p.their} sleep, at ${s.age}.`, ['death', s.id]);
  rehomeAnimals(state, s, day, 'died');
  mourn(state, { survivorId: s.id, name: fullName(s), cause: s.causeOfDeath }, rng, day);
  parentGone(state, s, day, 'died');
}

/** A parent died or walked out: their children remember. */
export function parentGone(state: GameState, parent: Survivor, day: number, how: 'died' | 'left'): void {
  for (const c of childrenOf(state, parent.id)) {
    const who = c.parents!.mother === parent.id ? 'mother' : 'father';
    addChronicle(c, day, how === 'died' ? `Lost ${pronounForms(c.pronouns).their} ${who}, ${fullName(parent)}, at ${c.age}.` : `Watched ${pronounForms(c.pronouns).their} ${who}, ${fullName(parent)}, walk out of the Depot, at ${c.age}.`, ['family', parent.id]);
  }
}

// ---------------------------------------------------------------- babies

/** Couples who could find a baby on the way today: a woman and a man, partners, both at the Depot. */
function couplesReady(state: GameState, day: number): [Survivor, Survivor][] {
  const out: [Survivor, Survivor][] = [];
  if (!hasEmptyBed(state)) return out;
  for (const mother of state.survivors) {
    if (mother.pronouns !== 'she' || mother.expecting || !atDepot(mother)) continue;
    if (mother.age < MOTHER_AGES[0] || mother.age > MOTHER_AGES[1]) continue;
    const father = state.survivors.find((f) => f.pronouns === 'he' && atDepot(f) && arePartners(state, mother.id, f.id));
    if (!father) continue;
    // A while after their last, before the next.
    const youngest = childrenOf(state, mother.id).reduce((m, c) => Math.max(m, c.bornDay ?? 0), 0);
    if (youngest > 0 && day - youngest < BABY_GAP_DAYS) continue;
    out.push([mother, father]);
  }
  return out;
}

/** A baby on the way. */
export function expecting(state: GameState, mother: Survivor, father: Survivor, day: number): void {
  mother.expecting = { father: father.id, dueDay: day + PREGNANCY_DAYS };
  addTrait(mother, 'expecting', { day, silent: true });
  addChronicle(mother, day, `Found out a baby is on the way, with ${fullName(father)}.`, ['family', father.id]);
  addChronicle(father, day, `Found out ${mother.firstName} is expecting his baby.`, ['family', mother.id]);
  addGuildLog(state, day, `${mother.firstName} and ${father.firstName} are expecting a baby.`, ['family', mother.id]);
}

/** The baby is born: a new child at the Depot. */
export function birth(state: GameState, mother: Survivor, day: number, rng: Rng): Survivor {
  const fatherId = mother.expecting!.father;
  const father = anyone(state, fatherId);
  delete mother.expecting;
  removeTrait(mother, 'expecting', day);
  removeTrait(mother, 'nearly_due', day);
  const child = makeChild(state, mother, father, day, rng);
  state.children.push(child);
  const word = childWord(child);
  addChronicle(mother, day, `Had a ${word}, ${child.firstName}.`, ['family', child.id]);
  changeStress(mother, -BIRTH_RELIEF, { rng, day });
  if (father && state.survivors.includes(father)) {
    addChronicle(father, day, `Became a father: a ${word}, ${child.firstName}.`, ['family', child.id]);
    changeStress(father, -BIRTH_RELIEF, { rng, day });
  }
  addGuildLog(state, day, `${mother.firstName} had a baby ${child.pronouns === 'she' ? 'girl' : 'boy'}: ${fullName(child)}.${father ? ` ${father.firstName} is ${child.pronouns === 'she' ? 'her' : 'his'} father.` : ''}`, ['family', child.id]);
  return child;
}

/**
 * A child of these two: a face that mixes theirs, stats that lean toward
 * theirs, maybe one of their ways, and the father's surname.
 */
export function makeChild(state: GameState, mother: Survivor, father: Survivor | undefined, day: number, rng: Rng): Survivor {
  const c = generateSurvivor(state, rng, { day, origin: 'depot_born', hiddenTraitChance: 0.4 });
  const a = mother.appearance;
  const b = father?.appearance ?? a;
  const either = <T>(x: T, y: T): T => (rng.chance(0.5) ? x : y);
  c.appearance = {
    seed: c.appearance.seed,
    skinTone: Math.round((a.skinTone + b.skinTone) / 2),
    hairColor: either(a.hairColor, b.hairColor),
    hairStyle: c.appearance.hairStyle,
    faceShape: either(a.faceShape, b.faceShape),
    eyes: either(a.eyes, b.eyes),
    brows: either(a.brows, b.brows),
    nose: either(a.nose, b.nose),
    mouth: either(a.mouth, b.mouth),
    facialHair: either(a.facialHair, b.facialHair),
  };
  c.lastName = (father ?? mother).lastName;
  c.age = 0;
  c.bornDay = day;
  c.nextBirthday = day + YEAR_DAYS;
  c.parents = { mother: mother.id, father: father?.id ?? '' };
  c.equipment = {};
  c.stress = 0;
  // Stats lean toward the parents'.
  for (const k of STAT_IDS) {
    const theirs = (mother.stats[k] + (father ?? mother).stats[k]) / 2;
    const lean = theirs >= 6 ? 1 : theirs <= 3 ? -1 : 0;
    c.stats[k] = Math.max(STAT_MIN, Math.min(STAT_GEN_MAX, c.stats[k] + lean));
  }
  // Half the time, one of a parent's ways comes down to the child.
  const ways = [...mother.traits, ...(father?.traits ?? [])]
    .filter((t) => !t.hidden && (getTrait(t.id).startWeight ?? 0) > 0 && getTrait(t.id).kind === 'personality')
    .map((t) => t.id)
    .filter((id) => !hasTrait(c, id));
  if (ways.length > 0 && rng.chance(0.5)) {
    const id = rng.pick(ways);
    const parent = mother.traits.some((t) => t.id === id) ? mother : father!;
    addTrait(c, id, { day, silent: true, force: true, source: `like ${pronounForms(c.pronouns).their} ${parent === mother ? 'mother' : 'father'}` });
  }
  c.hp = maxHp(c);
  c.chronicle = [];
  addChronicle(c, day, `Born at the Depot to ${fullName(mother)}${father ? ` and ${fullName(father)}` : ''}.`, ['born']);
  return c;
}

/** Sixteen: the child joins the guild as a survivor. */
export function growUp(state: GameState, c: Survivor, day: number, rng: Rng): void {
  state.children = state.children.filter((x) => x !== c);
  recruit(state, c, rng, day, `Turned ${c.age} and joined the guild.`);
  c.equipment.weapon = createItem(state, 'pipe', 'rusty');
  for (const id of [c.parents?.mother, c.parents?.father]) {
    if (id && state.survivors.some((s) => s.id === id)) adjustRelationship(state, c.id, id, REL_FAMILY, { day, useTraitMult: false, silent: true });
  }
  addGuildLog(state, day, `${fullName(c)}, born at the Depot, is ${c.age} and joins the guild.`, ['family', c.id]);
}
