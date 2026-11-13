/**
 * Animals the guild can keep (§9.7). Each kind does one thing for the Depot,
 * and whoever looks after one rests a little easier. The numbers live in
 * constants.ts; `effect` must say the same.
 */
import type { AnimalKind } from '../types.ts';

export interface AnimalDef {
  id: AnimalKind;
  /** "dog": lower case, as in "a stray dog". */
  name: string;
  description: string;
  /** What it does for the guild. */
  effect: string;
  /** How one turns up at the gate, for the news. */
  arrives: string;
  /** Names it might get. */
  names: readonly string[];
}

export const ANIMALS: readonly AnimalDef[] = [
  {
    id: 'dog',
    name: 'dog',
    description: 'Thin, scarred and loyal to whoever feeds it. Barks at anything that moves past the fence at night.',
    effect: 'Fights alongside the defenders when raiders come, biting for 2–3.',
    arrives: 'A thin dog is sitting outside the gate, watching the cook pot.',
    names: ['Rust', 'Biscuit', 'Bones', 'Patch', 'Scout', 'Ranger', 'Diesel', 'Mutt', 'Tank', 'Ash', 'Lucky', 'Rook'],
  },
  {
    id: 'cat',
    name: 'cat',
    description: 'Comes and goes as it likes, keeps the rats out of the stores, and always seems to know who needs company.',
    effect: 'Each day it finds whoever at the Depot is most on edge, who sheds 3 more stress.',
    arrives: 'A one-eared cat has moved into the station house and doesn\'t seem to plan on leaving.',
    names: ['Smudge', 'Whiskers', 'Ghost', 'Soot', 'Pickles', 'Mittens', 'Shadow', 'Tinker', 'Pepper', 'Cinder'],
  },
  {
    id: 'goat',
    name: 'goat',
    description: 'Eats the weeds, the fence posts and anything left lying about. Gives milk if asked politely.',
    effect: 'Milk: a ration a day.',
    arrives: 'A goat with a broken rope round its neck is chewing on the fence.',
    names: ['Nanny', 'Gruff', 'Dolly', 'Butter', 'Clover', 'Billy', 'Hazel', 'Mabel', 'Turnip'],
  },
  {
    id: 'crow',
    name: 'crow',
    description: 'Clever, nosy and fond of anything that shines. Sits on the water tower and judges everyone.',
    effect: 'Brings home shiny things: now and then a little scrap, and once in a while a trinket.',
    arrives: 'A crow has been sitting on the gate for three days, and today it brought a bottle cap.',
    names: ['Jinx', 'Penny', 'Shiny', 'Rook', 'Inky', 'Button', 'Nickel', 'Pip', 'Corvus', 'Magpie'],
  },
];

const byId = new Map<AnimalKind, AnimalDef>(ANIMALS.map((a) => [a.id, a]));

export function getAnimal(kind: AnimalKind): AnimalDef {
  const def = byId.get(kind);
  if (!def) throw new Error(`Unknown animal: ${kind}`);
  return def;
}
