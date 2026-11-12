/**
 * Animals (§9.7): a dog, a cat, a goat and a crow, at most one of each. Strays
 * turn up at the gate, and the player keeps them or sends them off; now and
 * then one follows a crew home. Each kind does one thing for the Depot (read
 * here, in the Depot day and in raids), and its keeper rests a little easier.
 */
import { addChronicle, addGuildLog } from './chronicle.ts';
import {
  CAT_RELIEF,
  CROW_SCRAP,
  CROW_SCRAP_CHANCE,
  CROW_TRINKET_CHANCE,
  DOG_DEFENSE,
  GOAT_MILK,
  KEEPER_RELIEF,
  STRAY_DAYS,
} from './constants.ts';
import { GEAR, getAnimal } from './content/index.ts';
import { atDepot } from './depot/buildings.ts';
import { createItem, itemName } from './gear.ts';
import { newId } from './ids.ts';
import { relationshipScore } from './relationships.ts';
import type { Rng } from './rng.ts';
import { changeStress, effectiveStat } from './stats.ts';
import { anyTraitHook } from './traits.ts';
import { fullName } from './text.ts';
import type { Animal, AnimalKind, GameState, Stray, Survivor } from './types.ts';
import { ANIMAL_KINDS } from './types.ts';

/** "Rust, the dog". */
export function animalLabel(a: Animal): string {
  return `${a.name}, the ${getAnimal(a.kind).name}`;
}

/** The guild's animal of this kind, if it has one. */
export function animalOf(state: GameState, kind: AnimalKind): Animal | undefined {
  return state.animals.find((a) => a.kind === kind);
}

/** Who looks after this animal, if they're still in the guild. */
export function keeperOf(state: GameState, a: Animal): Survivor | undefined {
  return a.keeper ? state.survivors.find((s) => s.id === a.keeper) : undefined;
}

/** The animals someone looks after. */
export function animalsKeptBy(state: GameState, survivorId: string): Animal[] {
  return state.animals.filter((a) => a.keeper === survivorId);
}

/** A name nobody's animal has had yet, if there is one. */
function pickName(state: GameState, kind: AnimalKind, rng: Rng): string {
  const used = new Set([...state.animals, ...state.depot.strays.map((s) => s.animal)].map((a) => a.name));
  const free = getAnimal(kind).names.filter((n) => !used.has(n));
  return rng.pick(free.length > 0 ? free : getAnimal(kind).names);
}

export function newAnimal(state: GameState, kind: AnimalKind, rng: Rng, day: number): Animal {
  return { id: newId(state, 'a'), kind, name: pickName(state, kind, rng), sinceDay: day };
}

/** Kinds the guild doesn't keep yet, and that aren't already waiting at the gate. */
export function missingKinds(state: GameState): AnimalKind[] {
  return ANIMAL_KINDS.filter((k) => !animalOf(state, k) && !state.depot.strays.some((s) => s.animal.kind === k));
}

/** Whoever would take an animal in: someone at home with a way with animals, or else the steadiest. */
export function likelyKeeper(state: GameState): Survivor | undefined {
  const home = state.survivors.filter(atDepot);
  const pool = home.length > 0 ? home : state.survivors;
  return pool.find((s) => anyTraitHook(s, 'likesAnimals')) ?? [...pool].sort((a, b) => effectiveStat(b, 'nerve') - effectiveStat(a, 'nerve'))[0];
}

// ---------------------------------------------------------------- at the gate

/** A stray turns up at the gate, of a kind the guild doesn't keep. Returns it, or nothing if the guild has one of each. */
export function strayArrives(state: GameState, day: number, rng: Rng): Stray | undefined {
  const kinds = missingKinds(state);
  if (kinds.length === 0) return undefined;
  const stray: Stray = { animal: newAnimal(state, rng.pick(kinds), rng, day), expiresDay: day + STRAY_DAYS };
  state.depot.strays.push(stray);
  addGuildLog(state, day, getAnimal(stray.animal.kind).arrives, ['animal', stray.animal.id]);
  // Someone with a way with animals feeds it straight away.
  const friend = state.survivors.filter(atDepot).find((s) => anyTraitHook(s, 'likesAnimals'));
  if (friend) {
    changeStress(friend, -10, { rng, day });
    addChronicle(friend, day, `Fed a stray ${getAnimal(stray.animal.kind).name} at the Depot gate.`, ['animal']);
  }
  return stray;
}

/** Strays nobody kept wander off. */
export function expireStrays(state: GameState, day: number): void {
  for (const s of state.depot.strays.filter((x) => x.expiresDay <= day)) {
    addGuildLog(state, day, `The stray ${getAnimal(s.animal.kind).name} wandered off.`, ['animal']);
  }
  state.depot.strays = state.depot.strays.filter((x) => x.expiresDay > day);
}

/** Why this stray can't be kept, if it can't. */
export function keepProblem(state: GameState, animalId: string): string | undefined {
  const stray = state.depot.strays.find((s) => s.animal.id === animalId);
  if (!stray) return 'It has wandered off.';
  if (animalOf(state, stray.animal.kind)) return `The guild already has a ${getAnimal(stray.animal.kind).name}.`;
  if (state.survivors.length === 0) return 'There is nobody to look after it.';
  return undefined;
}

/** Keep a stray: it joins the guild, with whoever is likeliest to look after it. Throws if it can't. */
export function keepStray(state: GameState, animalId: string, day: number): Animal {
  const problem = keepProblem(state, animalId);
  if (problem) throw new Error(problem);
  const stray = state.depot.strays.find((s) => s.animal.id === animalId)!;
  state.depot.strays = state.depot.strays.filter((s) => s !== stray);
  return adopt(state, stray.animal, likelyKeeper(state), day, 'at the gate');
}

/** Send a stray on its way. */
export function sendOffStray(state: GameState, animalId: string, day: number): void {
  const stray = state.depot.strays.find((s) => s.animal.id === animalId);
  if (!stray) return;
  state.depot.strays = state.depot.strays.filter((s) => s !== stray);
  addGuildLog(state, day, `The stray ${getAnimal(stray.animal.kind).name} was sent on its way.`, ['animal']);
}

/** An animal joins the guild, looked after by `keeper`. */
export function adopt(state: GameState, a: Animal, keeper: Survivor | undefined, day: number, where: string): Animal {
  a.sinceDay = day;
  if (keeper) {
    a.keeper = keeper.id;
    addChronicle(keeper, day, `Took in a ${getAnimal(a.kind).name} ${where} and named it ${a.name}.`, ['animal', a.id]);
  }
  state.animals.push(a);
  addGuildLog(state, day, `The guild has a ${getAnimal(a.kind).name} now: ${a.name}${keeper ? `, looked after by ${keeper.firstName}` : ''}.`, ['animal', a.id]);
  return a;
}

/** Animals that followed a crew home from a run: kept, unless the guild already has one of that kind. */
export function animalsFollowHome(state: GameState, found: readonly Animal[], day: number, place: string): void {
  for (const a of found) {
    const keeper = (a.keeper ? state.survivors.find((s) => s.id === a.keeper) : undefined) ?? likelyKeeper(state);
    if (animalOf(state, a.kind)) {
      addGuildLog(state, day, `A ${getAnimal(a.kind).name} followed the crew from ${place}, but the guild's own ${getAnimal(a.kind).name} ran it off.`, ['animal']);
      continue;
    }
    delete a.keeper;
    adopt(state, a, keeper, day, `at ${place}`);
  }
}

// ---------------------------------------------------------------- keepers

/** Why `survivorId` can't look after this animal, if they can't. */
export function keeperProblem(state: GameState, animalId: string, survivorId: string): string | undefined {
  if (!state.animals.some((a) => a.id === animalId)) return 'Unknown animal.';
  const s = state.survivors.find((x) => x.id === survivorId);
  if (!s) return 'Unknown survivor.';
  if (s.outpost) return `${s.firstName} lives at an outpost.`;
  return undefined;
}

/** Give an animal a new keeper. Throws if they can't take it. */
export function setKeeper(state: GameState, animalId: string, survivorId: string, day: number): void {
  const problem = keeperProblem(state, animalId, survivorId);
  if (problem) throw new Error(problem);
  const a = state.animals.find((x) => x.id === animalId)!;
  if (a.keeper === survivorId) return;
  a.keeper = survivorId;
  addChronicle(state.survivors.find((x) => x.id === survivorId)!, day, `Started looking after ${a.name}, the ${getAnimal(a.kind).name}.`, ['animal', a.id]);
}

/** Someone is gone (dead or left): their animals go to whoever was closest to them. */
export function rehomeAnimals(state: GameState, gone: Survivor, day: number, why: 'died' | 'left'): void {
  for (const a of state.animals.filter((x) => x.keeper === gone.id)) {
    const next = [...state.survivors].filter((s) => !s.outpost).sort((x, y) => relationshipScore(state, y.id, gone.id) - relationshipScore(state, x.id, gone.id))[0];
    if (!next) {
      delete a.keeper;
      continue;
    }
    a.keeper = next.id;
    addChronicle(next, day, `Took in ${a.name}, the ${getAnimal(a.kind).name}, after ${fullName(gone)} ${why}.`, ['animal', a.id]);
  }
}

// ---------------------------------------------------------------- what they do

/** The dog's share of holding off raids. */
export function dogDefense(state: GameState): number {
  return animalOf(state, 'dog') ? DOG_DEFENSE : 0;
}

/** Rations of milk a day. */
export function goatMilk(state: GameState): number {
  return animalOf(state, 'goat') ? GOAT_MILK : 0;
}

/**
 * The animals' day at the Depot, after people rest: keepers at home with
 * their animal shed a little more stress, the cat finds whoever is most on
 * edge, and the crow may bring something home.
 */
export function animalsDay(state: GameState, day: number, rng: Rng, hungry: boolean): void {
  if (state.animals.length === 0) return;
  const home = state.survivors.filter(atDepot);
  // Nobody rests on an empty stomach, not even with a cat on their lap.
  for (const a of hungry ? [] : state.animals) {
    const keeper = keeperOf(state, a);
    if (keeper && atDepot(keeper)) changeStress(keeper, -KEEPER_RELIEF, { rng, day });
  }
  if (animalOf(state, 'cat') && home.length > 0 && !hungry) {
    const tense = home.reduce((x, y) => (y.stress > x.stress ? y : x));
    if (tense.stress > 0) changeStress(tense, -CAT_RELIEF, { rng, day });
  }
  const crow = animalOf(state, 'crow');
  if (crow) {
    if (rng.chance(CROW_TRINKET_CHANCE)) {
      const trinkets = GEAR.filter((g) => g.slot === 'trinket');
      const item = createItem(state, rng.pick(trinkets).id);
      state.stash.push(item);
      addGuildLog(state, day, `${crow.name} the crow dropped something on the cook pot: a ${itemName(item)}. It's in the stash.`, ['animal', crow.id]);
    } else if (rng.chance(CROW_SCRAP_CHANCE)) {
      state.resources.scrap += rng.int(CROW_SCRAP[0], CROW_SCRAP[1]);
    }
  }
}
