import type { Difficulty } from '../constants.ts';
import type { AnimalKind, ResourceId, StatId } from '../types.ts';

/**
 * Scripted events for runs. An event takes the place of a plain travel,
 * hazard, discovery or social beat when the crew and the place fit it.
 *
 * Text placeholders: {a.first} {a.they} {a.them} {a.their} {a.is} {a.has}
 * (and the same for b, plus capitalized forms like {a.They}), and {loc}.
 * Write so that verbs don't have to agree with a pronoun: "{a.first} laughs",
 * not "{a.they} laughs".
 *
 * To add an event, append it to EVENTS. The tests check ids, references and
 * placeholders, and that every event can actually happen.
 */

/** Who plays a part in the event. With no filters, anyone can. */
export interface EventRole {
  /** Must have this trait (hidden ones count, and are revealed). */
  trait?: string;
  /** Must have this gear equipped (content id). */
  gear?: string;
  /** Take the crew member with the highest / lowest value of this stat. */
  best?: StatId;
  worst?: StatId;
  minRuns?: number;
  maxRuns?: number;
  /** Role b only: the event can still happen without it (solo runs). */
  optional?: boolean;
}

export type EventTarget = 'a' | 'b' | 'all' | 'others';

export type EventEffect =
  /** Add loot. 'any' picks from what the location offers. `scales` adds danger - 1. */
  | { type: 'loot'; resource: ResourceId | 'any'; amount: [number, number]; scales?: boolean }
  /** Find a random piece of gear. */
  | { type: 'gear'; chance?: number }
  | { type: 'damage'; who: EventTarget; amount: [number, number]; cause: string; scales?: boolean }
  | { type: 'heal'; who: EventTarget; amount: number }
  /** Positive adds stress, negative relieves it. */
  | { type: 'stress'; who: EventTarget; amount: number }
  | { type: 'rads'; who: EventTarget; amount: [number, number] }
  /** Between a and b, or between a and everyone else. */
  | { type: 'relationship'; with: 'b' | 'crew'; amount: number }
  /** Gain a trait or condition. `source` goes in the Chronicle. */
  | { type: 'trait'; who: EventTarget; trait: string; chance?: number; source: string }
  | { type: 'practice'; who: EventTarget; stat: StatId; amount: number }
  /** Reveal a location this one leads to. */
  | { type: 'discover' }
  /** Extra explored %. */
  | { type: 'explore'; amount: number }
  /** Gain or lose carried meds and ammo. */
  | { type: 'supplies'; meds?: number; ammo?: number }
  /** A line for the Chronicle, written without a subject. */
  | { type: 'chronicle'; who: EventTarget; text: string }
  | { type: 'turnBack' }
  /** A fight breaks out with whatever lives here. */
  | { type: 'fight'; ambushed?: boolean }
  /** An animal follows a home, to be kept by the guild (§9.7). */
  | { type: 'animal'; kind: AnimalKind; chance?: number }
  /** Someone comes home with the crew to join the guild, found by a (§10). */
  | { type: 'survivor' };

export interface EventOutcome {
  text: string;
  effects?: EventEffect[];
}

export type EventCheck =
  | { who?: 'a' | 'b'; stat: StatId; dc: Difficulty; /** Add half the location's danger. */ danger?: boolean; contexts?: string[]; crew?: boolean }
  /** No skill involved: success with this probability. */
  | { chance: number };

export interface EventDef {
  id: string;
  title: string;
  kind: 'travel' | 'hazard' | 'discovery' | 'social';
  /** Relative chance among the events that fit. */
  weight: number;
  /** Only at these locations (content ids). */
  locations?: string[];
  minDanger?: number;
  maxDanger?: number;
  minCrew?: number;
  noRadiation?: boolean;
  /** Only if there is still a location to discover from here. */
  needsLead?: boolean;
  needsMeds?: number;
  needsAmmo?: number;
  a: EventRole;
  b?: EventRole;
  /** a and b must have this kind of relationship. */
  pair?: 'friendly' | 'hostile' | 'bonded' | 'partners';
  intro: string;
  /** Without a check, `success` always happens. */
  check?: EventCheck;
  success: EventOutcome;
  failure?: EventOutcome;
}

const TECH_PLACES = ['rail_yard', 'old_metro', 'st_judes', 'water_plant', 'radio_station', 'checkpoint_bravo'];
const SETTLED_PLACES = ['rail_yard', 'maple_street', 'kessler_farm'];
const RAIDER_PLACES = ['maple_street', 'kessler_farm', 'radio_station', 'drowned_mall'];
const BUILDINGS = ['maple_street', 'drowned_mall', 'st_judes', 'old_metro', 'water_plant', 'checkpoint_bravo', 'radio_station'];

export const EVENTS: readonly EventDef[] = [
  // ============================================================ traits

  {
    id: 'stray_dog',
    title: 'A Stray',
    kind: 'travel',
    weight: 10,
    locations: SETTLED_PLACES,
    a: { trait: 'animal_lover' },
    intro: 'A half-starved dog has been trailing along for an hour. {a.first} stops, crouches and holds out a hand.',
    check: { stat: 'nerve', dc: 'normal', contexts: ['enemy:feral'] },
    success: {
      text: 'It comes, belly low, and eats from {a.their} palm. It trots beside {a.first} the rest of the way.',
      effects: [
        { type: 'stress', who: 'all', amount: -6 },
        { type: 'chronicle', who: 'a', text: 'Befriended a stray dog at {loc}.' },
        { type: 'trait', who: 'a', trait: 'beast_friend', chance: 0.4, source: 'a stray dog trusted {a.them} at {loc}' },
        { type: 'animal', kind: 'dog', chance: 0.6 },
      ],
    },
    failure: {
      text: 'It bares its teeth and bolts. {a.first} watches the place where it was for a while.',
      effects: [{ type: 'stress', who: 'a', amount: 3 }],
    },
  },
  {
    id: 'tinkerer_terminal',
    title: 'Dead Terminal',
    kind: 'discovery',
    weight: 10,
    locations: TECH_PLACES,
    a: { trait: 'tinkerer' },
    intro: 'A wall terminal, dark for forty years. {a.first} already has the panel off.',
    check: { stat: 'wits', dc: 'hard', contexts: ['tech'] },
    success: {
      text: 'A screen flickers green. {a.first} pulls the boards that still work, and a floor plan with them.',
      effects: [
        { type: 'loot', resource: 'tech', amount: [2, 3], scales: true },
        { type: 'explore', amount: 3 },
      ],
    },
    failure: {
      text: 'Something inside pops. {a.first} shakes out a burned hand and swears at it.',
      effects: [
        { type: 'damage', who: 'a', amount: [1, 2], cause: 'a live wire' },
        { type: 'stress', who: 'a', amount: 3 },
      ],
    },
  },
  {
    id: 'greedy_safe',
    title: 'The Safe',
    kind: 'discovery',
    weight: 10,
    locations: BUILDINGS,
    a: { trait: 'greedy' },
    intro: 'A wall safe behind a fallen picture. {a.first} will not hear of leaving it.',
    check: { stat: 'wits', dc: 'hard', contexts: ['tech'] },
    success: {
      text: 'An hour of listening to tumblers, and it swings open. {a.first} grins like a child.',
      effects: [
        { type: 'loot', resource: 'scrap', amount: [4, 6], scales: true },
        { type: 'gear', chance: 0.5 },
        { type: 'stress', who: 'a', amount: -5 },
      ],
    },
    failure: {
      text: 'An hour of listening to tumblers, and nothing but a stiff neck to show for it.',
      effects: [
        { type: 'relationship', with: 'crew', amount: -4 },
        { type: 'stress', who: 'others', amount: 3 },
      ],
    },
  },
  {
    id: 'curious_door',
    title: 'The Door',
    kind: 'discovery',
    weight: 10,
    minDanger: 2,
    locations: BUILDINGS,
    a: { trait: 'curious' },
    intro: 'A steel door, welded shut from the outside. The sensible thing is to leave it. {a.first} is already working at the weld.',
    check: { stat: 'wits', dc: 'normal', danger: true },
    success: {
      text: 'Inside: a storeroom nobody has touched since the Burn. {a.first} does not say "told you", but only just.',
      effects: [
        { type: 'loot', resource: 'any', amount: [3, 5], scales: true },
        { type: 'gear', chance: 0.4 },
      ],
    },
    failure: {
      text: 'It was welded shut for a reason. The reason comes out.',
      effects: [{ type: 'fight' }],
    },
  },
  {
    id: 'cautious_tripwire',
    title: 'Tripwire',
    kind: 'travel',
    weight: 8,
    minDanger: 2,
    a: { trait: 'cautious' },
    intro: '{a.first} stops dead and stares at nothing. Then it catches the light: fishing line, ankle height.',
    success: {
      text: '{a.first} follows the line to a shotgun rigged in a doorway, and unloads it with steady hands.',
      effects: [
        { type: 'loot', resource: 'ammo', amount: [1, 2] },
        { type: 'loot', resource: 'scrap', amount: [1, 2] },
        { type: 'relationship', with: 'crew', amount: 3 },
      ],
    },
  },
  {
    id: 'coward_noise',
    title: 'Something in the Dark',
    kind: 'travel',
    weight: 9,
    a: { trait: 'cowardly' },
    intro: 'A crash from somewhere close. {a.first} goes rigid.',
    check: { stat: 'nerve', dc: 'normal' },
    success: {
      text: '{a.first} breathes, raises a weapon and goes to look. A cat. But {a.first} went to look.',
      effects: [
        { type: 'practice', who: 'a', stat: 'nerve', amount: 3 },
        { type: 'stress', who: 'a', amount: -4 },
      ],
    },
    failure: {
      text: '{a.first} is twenty meters down the road before anyone can speak. It was a cat.',
      effects: [
        { type: 'stress', who: 'a', amount: 8 },
        { type: 'relationship', with: 'crew', amount: -2 },
      ],
    },
  },
  {
    id: 'brave_crossing',
    title: 'The Crossing',
    kind: 'hazard',
    weight: 10,
    a: { trait: 'brave' },
    intro: 'The only way on is a beam over a long drop. {a.first} hands off {a.their} pack and goes first, with the rope.',
    check: { stat: 'grit', dc: 'normal', danger: true },
    success: {
      text: '{a.first} makes it across and ties off on the far side as if it were nothing.',
      effects: [
        { type: 'explore', amount: 3 },
        { type: 'relationship', with: 'crew', amount: 3 },
      ],
    },
    failure: {
      text: 'The beam rolls. {a.first} drops a full story into rubble and lies very still before starting to swear.',
      effects: [{ type: 'damage', who: 'a', amount: [3, 5], cause: 'a fall', scales: true }],
    },
  },
  {
    id: 'hothead_scavengers',
    title: 'Claim Jumpers',
    kind: 'travel',
    weight: 10,
    maxDanger: 4,
    a: { trait: 'hothead' },
    intro: 'Two strangers are stripping a wreck the guild had marked as its own. {a.first} is already walking toward them.',
    check: { stat: 'brawn', dc: 'normal' },
    success: {
      text: 'One shove and a lot of shouting. The strangers decide the wreck is not worth it and leave what they had pulled.',
      effects: [
        { type: 'loot', resource: 'any', amount: [2, 4] },
        { type: 'stress', who: 'others', amount: 2 },
      ],
    },
    failure: {
      text: 'It turns into a brawl in the dirt. The strangers leave with the salvage and {a.first} gets up with a split lip.',
      effects: [
        { type: 'damage', who: 'a', amount: [2, 3], cause: 'a brawl' },
        { type: 'relationship', with: 'crew', amount: -4 },
      ],
    },
  },
  {
    id: 'generous_traveler',
    title: 'The Traveler',
    kind: 'travel',
    weight: 9,
    a: { trait: 'generous' },
    intro: 'An old woman sits by the road with an empty pack. Before anyone can argue, {a.first} is unwrapping {a.their} own rations.',
    success: {
      text: 'She eats slowly, then draws in the dust: a way through that is not on any map the guild has.',
      effects: [
        { type: 'stress', who: 'all', amount: -4 },
        { type: 'explore', amount: 3 },
        { type: 'chronicle', who: 'a', text: 'Fed a starving traveler on the road to {loc}.' },
      ],
    },
  },
  {
    id: 'glutton_tins',
    title: 'Mystery Tins',
    kind: 'discovery',
    weight: 9,
    a: { trait: 'glutton' },
    intro: 'A crate of tins with the labels long gone. Anyone sensible would carry them home to boil first. {a.first} has a knife in one already.',
    check: { stat: 'grit', dc: 'normal' },
    success: {
      text: 'Peaches. {a.first} eats four tins standing up and has to be dragged away from the fifth.',
      effects: [
        { type: 'heal', who: 'a', amount: 4 },
        { type: 'stress', who: 'a', amount: -8 },
        { type: 'loot', resource: 'rations', amount: [2, 3] },
      ],
    },
    failure: {
      text: 'Not peaches. {a.first} spends the next hour behind a wall, and the crate stays where it is.',
      effects: [
        { type: 'damage', who: 'a', amount: [1, 2], cause: 'bad tins' },
        { type: 'stress', who: 'a', amount: 4 },
      ],
    },
  },
  {
    id: 'drinker_bottle',
    title: 'The Good Stuff',
    kind: 'discovery',
    weight: 8,
    a: { trait: 'drinker' },
    intro: 'Behind a bar that has been looted a hundred times, {a.first} reaches up inside the till drawer and comes out with a sealed bottle.',
    success: {
      text: '{a.first} takes one long pull, corks it and tucks it away. For a while the shaking stops.',
      effects: [
        { type: 'stress', who: 'a', amount: -12 },
        { type: 'stress', who: 'others', amount: 1 },
      ],
    },
  },
  {
    id: 'lucky_find',
    title: 'Dumb Luck',
    kind: 'travel',
    weight: 8,
    a: { trait: 'lucky' },
    intro: '{a.first} trips over nothing and lands face down in the weeds.',
    success: {
      text: 'And gets up holding what {a.they} landed on.',
      effects: [{ type: 'gear' }],
    },
  },
  {
    id: 'unlucky_floor',
    title: 'Of Course',
    kind: 'hazard',
    weight: 8,
    locations: BUILDINGS,
    a: { trait: 'unlucky' },
    intro: 'Four people cross the same floor. It gives way under {a.first}.',
    check: { stat: 'grit', dc: 'normal' },
    success: {
      text: '{a.first} catches the edge, hangs there and starts to laugh. Of course it was {a.them}.',
      effects: [{ type: 'stress', who: 'all', amount: -2 }],
    },
    failure: {
      text: '{a.first} lands in the basement in a cloud of plaster.',
      effects: [{ type: 'damage', who: 'a', amount: [2, 4], cause: 'a rotten floor', scales: true }],
    },
  },
  {
    id: 'loner_wanders',
    title: 'Gone Again',
    kind: 'discovery',
    weight: 9,
    minCrew: 2,
    a: { trait: 'loner' },
    intro: 'Someone turns to ask {a.first} a question and finds {a.them} gone. No note, as usual.',
    check: { stat: 'wits', dc: 'normal' },
    success: {
      text: '{a.first} is back within the hour with a full pack and no explanation.',
      effects: [{ type: 'loot', resource: 'any', amount: [3, 5], scales: true }],
    },
    failure: {
      text: '{a.first} is back within the hour with nothing, and does not see why everyone is angry.',
      effects: [
        { type: 'relationship', with: 'crew', amount: -4 },
        { type: 'stress', who: 'others', amount: 3 },
      ],
    },
  },
  {
    id: 'patcher_stranger',
    title: 'The Wounded Man',
    kind: 'travel',
    weight: 9,
    needsMeds: 1,
    a: { trait: 'patcher' },
    intro: 'A man is propped against a wall with a rag pressed to his thigh. {a.first} is kneeling beside him before stopping to wonder whether it is a trap.',
    success: {
      text: 'It is not a trap. {a.first} cleans and binds the wound. The man presses a handful of cartridges on {a.them} and limps off the other way.',
      effects: [
        { type: 'supplies', meds: -1 },
        { type: 'loot', resource: 'ammo', amount: [2, 3] },
        { type: 'stress', who: 'all', amount: -5 },
        { type: 'chronicle', who: 'a', text: 'Patched up a stranger on the road to {loc} and asked for nothing.' },
      ],
    },
  },
  {
    id: 'paranoid_detour',
    title: 'The Long Way',
    kind: 'travel',
    weight: 9,
    minCrew: 2,
    a: { trait: 'paranoid' },
    intro: '{a.first} refuses to take the obvious road. No reason given, only "not that way". The crew goes round.',
    check: { chance: 0.5 },
    success: {
      text: 'From the ridge they can see the obvious road, and the men lying in wait along it. Nobody says anything to {a.first}. Nobody needs to.',
      effects: [
        { type: 'relationship', with: 'crew', amount: 5 },
        { type: 'stress', who: 'a', amount: -6 },
      ],
    },
    failure: {
      text: 'An extra hour through brambles, and the obvious road was empty the whole time.',
      effects: [
        { type: 'relationship', with: 'crew', amount: -3 },
        { type: 'stress', who: 'others', amount: 2 },
      ],
    },
  },
  {
    id: 'haunted_flashback',
    title: 'Somewhere Else',
    kind: 'social',
    weight: 10,
    minCrew: 2,
    a: { trait: 'haunted' },
    b: {},
    intro: '{a.first} has stopped walking. {a.Their} eyes are open, but {a.they} {a.is} not here. {b.first} goes back for {a.them}.',
    check: { who: 'b', stat: 'nerve', dc: 'normal' },
    success: {
      text: '{b.first} talks, low and steady, about nothing at all, until {a.first} comes back. Neither mentions it again.',
      effects: [
        { type: 'relationship', with: 'b', amount: 10 },
        { type: 'stress', who: 'a', amount: -8 },
      ],
    },
    failure: {
      text: '{b.first} takes {a.their} arm. {a.first} lashes out, then stands there shaking.',
      effects: [
        { type: 'stress', who: 'a', amount: 10 },
        { type: 'stress', who: 'b', amount: 4 },
      ],
    },
  },
  {
    id: 'optimist_cynic',
    title: 'The Argument',
    kind: 'social',
    weight: 9,
    a: { trait: 'optimist' },
    b: { trait: 'cynic' },
    intro: '{a.first} says things are getting better. {b.first} asks, with real interest, what on earth gave {a.them} that idea.',
    check: { chance: 0.55 },
    success: {
      text: 'It goes on for an hour. At the end, {b.first} admits it was the best argument {b.they} {b.has} lost in years.',
      effects: [
        { type: 'relationship', with: 'b', amount: 9 },
        { type: 'stress', who: 'all', amount: -2 },
      ],
    },
    failure: {
      text: 'It goes on for an hour. By the end, both are quite sure the other is what is wrong with the world.',
      effects: [{ type: 'relationship', with: 'b', amount: -9 }],
    },
  },

  // ============================================================ relationships

  {
    id: 'rivals_ledge',
    title: 'The Ledge',
    kind: 'hazard',
    weight: 14,
    a: {},
    b: {},
    pair: 'hostile',
    intro: 'A narrow ledge, one at a time. {a.first} is halfway when the edge crumbles. The only one close enough to reach {a.them} is {b.first}.',
    check: { chance: 0.65 },
    success: {
      text: '{b.first} has {a.their} wrist before either of them thinks about it. They sit on the far side, breathing hard and not looking at each other.',
      effects: [
        { type: 'relationship', with: 'b', amount: 20 },
        { type: 'chronicle', who: 'a', text: 'Was pulled back from a fall at {loc} by {b.first}, of all people.' },
      ],
    },
    failure: {
      text: '{b.first} hesitates. Only for a moment, but {a.first} sees it on the way down.',
      effects: [
        { type: 'damage', who: 'a', amount: [2, 4], cause: 'a fall', scales: true },
        { type: 'relationship', with: 'b', amount: -15 },
      ],
    },
  },
  {
    id: 'bonded_promise',
    title: 'A Promise',
    kind: 'social',
    weight: 10,
    a: {},
    b: {},
    pair: 'bonded',
    intro: '{a.first} and {b.first} keep the last watch together.',
    success: {
      text: 'Some time before dawn they agree: whichever of them is left carries the other home. They shake on it, and both feel lighter for having said it.',
      effects: [
        { type: 'stress', who: 'a', amount: -8 },
        { type: 'stress', who: 'b', amount: -8 },
        { type: 'chronicle', who: 'a', text: 'Made a promise with {b.first} at {loc}.' },
        { type: 'chronicle', who: 'b', text: 'Made a promise with {a.first} at {loc}.' },
      ],
    },
  },
  // ============================================================ partners (roadmap step 12)
  {
    id: 'partners_watch',
    title: 'Taking the Watch',
    kind: 'social',
    weight: 10,
    a: {},
    b: {},
    pair: 'partners',
    intro: '{b.first} is asleep on {b.their} feet. {a.first} takes the watch without a word.',
    success: {
      text: 'Two hours later {b.first} wakes to find the watch done and something hot waiting in a dented cup.',
      effects: [
        { type: 'stress', who: 'b', amount: -10 },
        { type: 'stress', who: 'a', amount: 3 },
        { type: 'relationship', with: 'b', amount: 3 },
      ],
    },
  },
  {
    id: 'partners_argue',
    title: 'Not You Too',
    kind: 'social',
    weight: 8,
    a: {},
    b: {},
    pair: 'partners',
    intro: '{a.first} wants {b.first} to stay back from the next stretch. {b.first} will not hear of it.',
    check: { who: 'a', stat: 'nerve', dc: 'normal' },
    success: {
      text: 'It gets talked through behind a wall, low and fierce, and the two of them come out of it closer.',
      effects: [
        { type: 'relationship', with: 'b', amount: 4 },
        { type: 'stress', who: 'a', amount: -4 },
        { type: 'stress', who: 'b', amount: -4 },
      ],
    },
    failure: {
      text: 'Neither gives an inch. {a.first} and {b.first} walk the rest of the day on opposite sides of the road.',
      effects: [
        { type: 'relationship', with: 'b', amount: -6 },
        { type: 'stress', who: 'a', amount: 5 },
        { type: 'stress', who: 'b', amount: 5 },
      ],
    },
  },
  {
    id: 'partners_ring',
    title: 'Something Shiny',
    kind: 'discovery',
    weight: 6,
    a: {},
    b: {},
    pair: 'partners',
    intro: '{a.first} turns up a ring in the rubble, plain and only a little bent, and pockets it fast.',
    success: {
      text: 'By nightfall it is on {b.first}\'s finger. Neither of them says much about it, and neither needs to.',
      effects: [
        { type: 'stress', who: 'a', amount: -6 },
        { type: 'stress', who: 'b', amount: -6 },
        { type: 'chronicle', who: 'a', text: 'Gave {b.first} a ring found at {loc}.' },
        { type: 'chronicle', who: 'b', text: 'Got a ring from {a.first}, found at {loc}.' },
      ],
    },
  },
  {
    id: 'friends_song',
    title: 'Half a Song',
    kind: 'social',
    weight: 9,
    a: {},
    b: {},
    pair: 'friendly',
    intro: '{a.first} is whistling something without noticing. {b.first} knows the next line.',
    success: {
      text: 'Between them they get most of it, and argue happily about the rest for a mile.',
      effects: [
        { type: 'relationship', with: 'b', amount: 6 },
        { type: 'stress', who: 'all', amount: -3 },
      ],
    },
  },
  {
    id: 'mentor_lesson',
    title: 'A Lesson',
    kind: 'social',
    weight: 12,
    a: { minRuns: 10 },
    b: { maxRuns: 4 },
    intro: 'At the rest stop, {a.first} sets three cans on a wall and hands {b.first} a weapon. "Slower. Breathe out first."',
    success: {
      text: '{b.first} misses, misses, and then does not miss. {a.first} nods once, which from {a.first} is a speech.',
      effects: [
        { type: 'practice', who: 'b', stat: 'aim', amount: 5 },
        { type: 'relationship', with: 'b', amount: 7 },
      ],
    },
  },
  {
    id: 'veteran_story',
    title: 'The Early Days',
    kind: 'travel',
    weight: 9,
    minCrew: 2,
    a: { minRuns: 10 },
    intro: 'Something on the road reminds {a.first} of the guild\'s first winter, and for once {a.they} {a.does} not keep it to {a.themself}.',
    success: {
      text: 'It is a terrible story and {a.first} tells it well. The others are still laughing when the light goes.',
      effects: [
        { type: 'stress', who: 'others', amount: -6 },
        { type: 'relationship', with: 'crew', amount: 3 },
      ],
    },
  },
  {
    id: 'old_photo_shown',
    title: 'The Photograph',
    kind: 'social',
    weight: 9,
    a: { gear: 'old_photo' },
    b: {},
    intro: '{b.first} asks who is in the photograph {a.first} keeps looking at. For a moment it seems {a.first} will not answer.',
    success: {
      text: 'Then {a.first} hands it over, and tells {b.them}.',
      effects: [
        { type: 'relationship', with: 'b', amount: 9 },
        { type: 'stress', who: 'a', amount: -4 },
      ],
    },
  },
  {
    id: 'music_box_night',
    title: 'The Music Box',
    kind: 'travel',
    weight: 8,
    a: { gear: 'music_box' },
    intro: 'When it is time to stop for the night, {a.first} winds the music box and sets it on a stone.',
    success: {
      text: 'Half a tune, over and over, thin as wire. Nobody speaks until it runs down.',
      effects: [{ type: 'stress', who: 'all', amount: -7 }],
    },
  },

  // ============================================================ anywhere

  {
    id: 'trader_caravan',
    title: 'Caravan',
    kind: 'travel',
    weight: 7,
    maxDanger: 3,
    a: { best: 'nerve' },
    intro: 'A trade caravan is watering its mules at a crossroads. {a.first} goes over to see what a pocketful of scrap will buy.',
    check: { stat: 'nerve', dc: 'normal' },
    success: {
      text: '{a.first} haggles them down to almost fair. Fresh bandages go into the packs, and something that is nearly coffee.',
      effects: [
        { type: 'supplies', meds: 1 },
        { type: 'loot', resource: 'rations', amount: [1, 2] },
        { type: 'stress', who: 'all', amount: -3 },
      ],
    },
    failure: {
      text: 'The caravan master has been cheating scavengers since before {a.first} was born. No deal.',
      effects: [{ type: 'stress', who: 'a', amount: 2 }],
    },
  },
  {
    id: 'collapsed_overpass',
    title: 'Blocked Road',
    kind: 'travel',
    weight: 7,
    a: { best: 'brawn' },
    intro: 'An overpass has come down across the road. There is a gap, if someone can shift the slab leaning over it.',
    check: { stat: 'brawn', dc: 'normal', danger: true },
    success: {
      text: '{a.first} gets a shoulder under it and heaves. It moves just enough.',
      effects: [{ type: 'explore', amount: 3 }],
    },
    failure: {
      text: '{a.first} strains until something in {a.their} back complains. The slab does not care. It is the long way round, then.',
      effects: [
        { type: 'damage', who: 'a', amount: [1, 2], cause: 'a pulled back' },
        { type: 'stress', who: 'all', amount: 2 },
      ],
    },
  },
  {
    id: 'clean_rain',
    title: 'Clean Rain',
    kind: 'travel',
    weight: 6,
    noRadiation: true,
    a: {},
    intro: 'It starts to rain. {a.first} holds out the counter out of habit, then lowers it slowly. Clean.',
    success: {
      text: 'Packs come off, and faces turn up to it, like children.',
      effects: [{ type: 'stress', who: 'all', amount: -5 }],
    },
  },
  {
    id: 'rival_crew',
    title: 'The Vultures',
    kind: 'travel',
    weight: 7,
    minDanger: 2,
    a: { best: 'nerve' },
    intro: 'Another crew is coming up the road: Vultures, by the feathers on their packs. Both sides stop at shouting distance. {a.first} steps forward.',
    check: { stat: 'nerve', dc: 'normal', danger: true, contexts: ['intimidate'] },
    success: {
      text: 'A few careful words, a trade of rumors, and each side goes its own way. {a.first} learned more than {a.they} gave.',
      effects: [{ type: 'explore', amount: 4 }],
    },
    failure: {
      text: 'The Vultures say nothing, and smile, and fall in a few hundred meters behind. They follow for hours.',
      effects: [{ type: 'stress', who: 'all', amount: 5 }],
    },
  },
  {
    id: 'storm_shelter',
    title: 'Storm Coming',
    kind: 'hazard',
    weight: 7,
    a: { best: 'wits' },
    intro: 'The horizon has gone the color of a bruise. There is perhaps a quarter of an hour. {a.first} looks for somewhere to sit it out.',
    check: { stat: 'wits', dc: 'normal', crew: true },
    success: {
      text: '{a.first} finds a culvert, dry and deep. They spend two hours shoulder to shoulder listening to the world tear itself up outside.',
      effects: [
        { type: 'relationship', with: 'crew', amount: 2 },
        { type: 'stress', who: 'all', amount: -2 },
      ],
    },
    failure: {
      text: 'There is nothing. It has to be taken in the open, back to the wind and pack over the head.',
      effects: [
        { type: 'damage', who: 'all', amount: [1, 2], cause: 'a dust storm' },
        { type: 'stress', who: 'all', amount: 4 },
      ],
    },
  },
  {
    id: 'dead_scavenger',
    title: 'Someone Before Us',
    kind: 'discovery',
    weight: 9,
    needsLead: true,
    a: {},
    intro: '{a.first} finds a scavenger who has been sitting against the same wall for a long time. There is a notebook in the coat.',
    success: {
      text: 'Most of it is water damage. One page is a careful map, with a cross and two words: "worth it".',
      effects: [{ type: 'discover' }, { type: 'stress', who: 'all', amount: 2 }],
    },
  },
  {
    id: 'raider_toll',
    title: 'The Toll',
    kind: 'travel',
    weight: 9,
    locations: RAIDER_PLACES,
    a: { best: 'nerve' },
    intro: 'A barricade of tires, and four raiders sitting on it. "Road tax," says the biggest. {a.first} walks up to discuss it.',
    check: { stat: 'nerve', dc: 'hard', contexts: ['intimidate', 'enemy:raider'], crew: true },
    success: {
      text: '{a.first} explains, pleasantly, what the tax would cost them to collect. The raiders find they are busy elsewhere.',
      effects: [
        { type: 'relationship', with: 'crew', amount: 3 },
        { type: 'stress', who: 'all', amount: -2 },
      ],
    },
    failure: {
      text: 'There are four of them, and more in the windows. The toll is paid in ammunition, eyes down all the way through.',
      effects: [
        { type: 'supplies', ammo: -4 },
        { type: 'stress', who: 'all', amount: 4 },
      ],
    },
  },
  {
    id: 'child_drawing',
    title: 'On the Wall',
    kind: 'discovery',
    weight: 6,
    locations: BUILDINGS,
    a: {},
    intro: '{a.first} wipes the dust off a wall and finds crayon underneath: a house, a yellow sun, four stick figures and a dog.',
    success: {
      text: '{a.first} looks at it for a long moment, then goes back to work a little more gently.',
      effects: [
        { type: 'stress', who: 'a', amount: -3 },
        { type: 'explore', amount: 2 },
      ],
    },
  },

  // ============================================================ the Rail Yard

  {
    id: 'railyard_handcar',
    title: 'The Handcar',
    kind: 'travel',
    weight: 12,
    locations: ['rail_yard'],
    minCrew: 2,
    a: { best: 'brawn' },
    intro: 'A pump handcar sits on a siding, rusted but whole. {a.first} takes one handle.',
    check: { stat: 'brawn', dc: 'easy' },
    success: {
      text: 'It shrieks, then rolls. They ride the length of the yard whooping like idiots.',
      effects: [
        { type: 'stress', who: 'all', amount: -5 },
        { type: 'explore', amount: 3 },
      ],
    },
    failure: {
      text: 'It rolls three meters and throws a wheel. {a.first} goes over the front.',
      effects: [{ type: 'damage', who: 'a', amount: [1, 2], cause: 'a derailed handcar' }],
    },
  },
  {
    id: 'railyard_container',
    title: 'Sealed Container',
    kind: 'discovery',
    weight: 12,
    locations: ['rail_yard'],
    a: { best: 'brawn' },
    intro: 'One freight container still has its customs seal. {a.first} looks for something to use as a lever.',
    check: { stat: 'brawn', dc: 'normal', contexts: ['scavenge'] },
    success: {
      text: 'The doors scream open on a wall of crates. Most of it is rot. Not all.',
      effects: [
        { type: 'loot', resource: 'any', amount: [3, 5] },
        { type: 'gear', chance: 0.3 },
      ],
    },
    failure: {
      text: 'The seal holds. Forty years, and it still holds. {a.first} gives it a kick for the principle of the thing.',
    },
  },

  // ============================================================ Maple Street

  {
    id: 'suburb_shelter',
    title: 'Backyard Shelter',
    kind: 'discovery',
    weight: 12,
    locations: ['maple_street'],
    a: { best: 'wits' },
    intro: 'The lawn behind number 14 is a little too square in one place. {a.first} starts probing with a knife.',
    check: { stat: 'wits', dc: 'normal' },
    success: {
      text: 'A hatch, a ladder, and shelves someone stocked for a war they did not live to sit out.',
      effects: [
        { type: 'loot', resource: 'rations', amount: [3, 4] },
        { type: 'loot', resource: 'meds', amount: [1, 1] },
      ],
    },
    failure: {
      text: 'If there is a hatch, {a.first} cannot find the latch. The square of lawn keeps its secret.',
    },
  },
  {
    id: 'suburb_table',
    title: 'Dinner for Four',
    kind: 'travel',
    weight: 10,
    locations: ['maple_street'],
    a: {},
    intro: 'Through a broken window {a.first} sees a dining table, still laid for four. The chairs are pushed back as if the family had just stood up.',
    success: {
      text: 'The rest of the street goes by more quietly.',
      effects: [
        { type: 'stress', who: 'all', amount: 3 },
        { type: 'explore', amount: 2 },
      ],
    },
  },

  // ============================================================ Kessler Farm

  {
    id: 'farm_bees',
    title: 'Wild Hive',
    kind: 'discovery',
    weight: 12,
    locations: ['kessler_farm'],
    a: { best: 'grit' },
    intro: 'The old barn hums. Bees have filled a whole wall with comb. {a.first} wraps a scarf round {a.their} face and goes in.',
    check: { stat: 'grit', dc: 'normal' },
    success: {
      text: '{a.first} comes out stung twice and carrying a slab of comb the size of a door.',
      effects: [
        { type: 'loot', resource: 'rations', amount: [3, 5] },
        { type: 'stress', who: 'all', amount: -3 },
      ],
    },
    failure: {
      text: '{a.first} comes out at a run, without the honey and with most of the bees.',
      effects: [
        { type: 'damage', who: 'a', amount: [1, 3], cause: 'a swarm of bees' },
        { type: 'stress', who: 'a', amount: 4 },
      ],
    },
  },
  {
    id: 'farm_cellar',
    title: 'Storm Cellar',
    kind: 'discovery',
    weight: 12,
    locations: ['kessler_farm'],
    a: { best: 'brawn' },
    intro: 'Cellar doors behind the farmhouse, chained from the inside. {a.first} takes hold of both handles.',
    check: { stat: 'brawn', dc: 'normal' },
    success: {
      text: 'The hasp tears out of the rotten wood. Below: preserving jars, rows of them, and a few still good.',
      effects: [
        { type: 'loot', resource: 'rations', amount: [2, 4] },
        { type: 'gear', chance: 0.3 },
      ],
    },
    failure: {
      text: 'The chain holds. Whoever locked it wanted to be left alone, and still is.',
      effects: [{ type: 'stress', who: 'a', amount: 2 }],
    },
  },

  // ============================================================ the Old Metro

  {
    id: 'metro_flooded',
    title: 'Black Water',
    kind: 'hazard',
    weight: 12,
    locations: ['old_metro'],
    a: { best: 'grit' },
    intro: 'The tunnel dips under water for twenty meters. {a.first} strips off {a.their} pack and goes first, holding the rope in {a.their} teeth.',
    check: { stat: 'grit', dc: 'normal', danger: true },
    success: {
      text: '{a.first} surfaces on the far side in a station nobody has reached in decades.',
      effects: [
        { type: 'explore', amount: 4 },
        { type: 'loot', resource: 'ammo', amount: [1, 3] },
      ],
    },
    failure: {
      text: 'Something under the water has hold of {a.their} leg. {a.first} comes back up choking and bleeding. It will have to be another way.',
      effects: [
        { type: 'damage', who: 'a', amount: [2, 3], cause: 'something in the flooded tunnel' },
        { type: 'stress', who: 'a', amount: 6 },
      ],
    },
  },
  {
    id: 'metro_train',
    title: 'The Last Train',
    kind: 'discovery',
    weight: 12,
    locations: ['old_metro'],
    a: {},
    intro: '{a.first} forces the doors of a carriage. The passengers are all still in their seats.',
    success: {
      text: 'The luggage racks are full. What is useful comes away, without looking down.',
      effects: [
        { type: 'loot', resource: 'any', amount: [3, 5] },
        { type: 'stress', who: 'all', amount: 3 },
      ],
    },
  },

  // ============================================================ the Drowned Mall

  {
    id: 'mall_mannequins',
    title: 'Mannequins',
    kind: 'travel',
    weight: 12,
    locations: ['drowned_mall'],
    a: { worst: 'nerve' },
    intro: 'The mannequins in the atrium have moved since the last pass through. {a.first} is certain of it. They are all facing the same way now.',
    check: { stat: 'nerve', dc: 'normal' },
    success: {
      text: '{a.first} walks up to the nearest one and knocks its hat off. Nothing happens. Probably.',
      effects: [{ type: 'stress', who: 'all', amount: -2 }],
    },
    failure: {
      text: 'Nobody will turn their back on the atrium after that.',
      effects: [{ type: 'stress', who: 'all', amount: 5 }],
    },
  },
  {
    id: 'mall_vending',
    title: 'Vending Machine',
    kind: 'discovery',
    weight: 12,
    locations: ['drowned_mall'],
    a: { best: 'brawn' },
    intro: 'A vending machine lies on its face in a dry corridor, unopened. {a.first} rolls up {a.their} sleeves.',
    check: { stat: 'brawn', dc: 'normal' },
    success: {
      text: 'The back panel comes away. Forty-year-old chocolate is still chocolate.',
      effects: [
        { type: 'loot', resource: 'rations', amount: [3, 5] },
        { type: 'stress', who: 'all', amount: -2 },
      ],
    },
    failure: {
      text: 'It tips, slides and goes into the water with a sound that carries through the whole building.',
      effects: [{ type: 'stress', who: 'all', amount: 3 }],
    },
  },

  // ============================================================ the Radio Station

  {
    id: 'radio_transmitter',
    title: 'On Air',
    kind: 'discovery',
    weight: 14,
    locations: ['radio_station'],
    a: { best: 'wits' },
    intro: 'The receiver in the booth still has power from a panel on the roof. {a.first} puts on the headphones and starts turning the dial.',
    check: { stat: 'wits', dc: 'hard', contexts: ['tech'] },
    success: {
      text: 'Static, static, and then a voice, reading out names and a place. Somebody else is alive out there.',
      effects: [
        { type: 'discover' },
        { type: 'explore', amount: 4 },
        { type: 'stress', who: 'all', amount: -5 },
        { type: 'chronicle', who: 'a', text: 'Heard a human voice on the radio at {loc}.' },
      ],
    },
    failure: {
      text: 'Static from one end of the dial to the other. {a.first} listens for longer than is sensible.',
      effects: [{ type: 'stress', who: 'a', amount: 3 }],
    },
  },

  // ============================================================ St. Jude's

  {
    id: 'hospital_pharmacy',
    title: 'The Pharmacy',
    kind: 'discovery',
    weight: 12,
    locations: ['st_judes'],
    a: { best: 'wits' },
    intro: 'The pharmacy shutter is down and the keypad still has a red light. {a.first} studies the wear on the buttons.',
    check: { stat: 'wits', dc: 'hard', contexts: ['tech'] },
    success: {
      text: 'Four digits, third try. The shutter rattles up on shelves that are not quite empty.',
      effects: [{ type: 'loot', resource: 'meds', amount: [4, 6] }],
    },
    failure: {
      text: 'Third try, wrong. Somewhere down the corridor an alarm starts, and it is not the only thing that wakes.',
      effects: [{ type: 'fight' }],
    },
  },
  {
    id: 'hospital_ward',
    title: 'Ward Nine',
    kind: 'hazard',
    weight: 10,
    locations: ['st_judes'],
    a: { worst: 'nerve' },
    intro: 'The way through is a ward where every bed has its curtains drawn. Something behind one of them is breathing. {a.first} is nearest.',
    check: { stat: 'nerve', dc: 'hard' },
    success: {
      text: '{a.first} keeps walking at the same pace, eyes front, and never looks back. The breathing does not change.',
      effects: [{ type: 'practice', who: 'a', stat: 'nerve', amount: 3 }],
    },
    failure: {
      text: '{a.first} runs. Behind, one by one, the curtains are opening.',
      effects: [
        { type: 'stress', who: 'all', amount: 7 },
        { type: 'stress', who: 'a', amount: 4 },
      ],
    },
  },

  // ============================================================ the Water Plant

  {
    id: 'water_valves',
    title: 'The Valve Room',
    kind: 'hazard',
    weight: 12,
    locations: ['water_plant'],
    a: { best: 'wits' },
    intro: 'The main hall is waist-deep in something green. There is a valve room, and a wall of unlabeled wheels. {a.first} traces the pipes.',
    check: { stat: 'wits', dc: 'normal', danger: true, contexts: ['tech'] },
    success: {
      text: '{a.first} turns the third wheel from the left. The hall drains with a long sucking sound, and there is a way through.',
      effects: [
        { type: 'explore', amount: 4 },
        { type: 'loot', resource: 'tech', amount: [1, 3] },
      ],
    },
    failure: {
      text: 'Wrong wheel. A yellow cloud rolls out of a ruptured tank, and it is a coughing, bloody scramble to get out.',
      effects: [
        { type: 'damage', who: 'all', amount: [1, 2], cause: 'chlorine gas' },
        { type: 'stress', who: 'all', amount: 4 },
      ],
    },
  },

  // ============================================================ Blackwater Swamp

  {
    id: 'swamp_mud',
    title: 'Sinking',
    kind: 'hazard',
    weight: 12,
    locations: ['blackwater'],
    minCrew: 2,
    a: {},
    b: { best: 'brawn' },
    intro: '{a.first} steps on what looks like ground and goes in to the hip. Then deeper. {b.first} throws down {b.their} pack and lies flat.',
    check: { who: 'b', stat: 'brawn', dc: 'normal' },
    success: {
      text: '{b.first} hauls {a.them} out a hand at a time. They lie in the reeds, black to the neck, laughing with relief.',
      effects: [
        { type: 'relationship', with: 'b', amount: 10 },
        { type: 'stress', who: 'a', amount: 3 },
      ],
    },
    failure: {
      text: 'It takes everyone, a rope and most of an hour. The swamp keeps {a.their} boots, and something in it has been at {a.their} legs.',
      effects: [
        { type: 'damage', who: 'a', amount: [2, 3], cause: 'the swamp' },
        { type: 'stress', who: 'a', amount: 8 },
        { type: 'relationship', with: 'b', amount: 4 },
      ],
    },
  },
  {
    id: 'swamp_glow',
    title: 'Glowing Water',
    kind: 'discovery',
    weight: 12,
    locations: ['blackwater'],
    a: { best: 'wits' },
    intro: 'A pool that gives off its own pale light, ringed with fat orange fungus. {a.first} has heard of this.',
    check: { stat: 'wits', dc: 'normal', contexts: ['medicine'] },
    success: {
      text: '{a.first} cuts only the caps, wearing gloves, and wraps them in cloth. Dried, they are worth more than bandages.',
      effects: [{ type: 'loot', resource: 'meds', amount: [3, 4] }],
    },
    failure: {
      text: 'Wrong fungus. Wrong pool. {a.first} realizes it when the counter in someone\'s pack starts to scream.',
      effects: [
        { type: 'rads', who: 'a', amount: [12, 18] },
        { type: 'rads', who: 'others', amount: [4, 8] },
        { type: 'stress', who: 'a', amount: 4 },
      ],
    },
  },

  // ============================================================ Checkpoint Bravo

  {
    id: 'checkpoint_mines',
    title: 'Minefield',
    kind: 'hazard',
    weight: 12,
    locations: ['checkpoint_bravo'],
    a: { best: 'wits' },
    b: { optional: true },
    intro: 'Little red flags, most of them fallen, across the only approach. {a.first} gets down on {a.their} belly and starts looking for the pattern.',
    check: { stat: 'wits', dc: 'hard', crew: true },
    success: {
      text: '{a.first} marks a path with strips of cloth. They cross in single file, stepping in each other\'s prints.',
      effects: [
        { type: 'explore', amount: 5 },
        { type: 'practice', who: 'a', stat: 'wits', amount: 3 },
      ],
    },
    failure: {
      text: 'The pattern has a gap in it. There is a flat crack and a fountain of dirt.',
      effects: [
        { type: 'damage', who: 'b', amount: [4, 6], cause: 'a landmine' },
        { type: 'stress', who: 'all', amount: 5 },
      ],
    },
  },
  {
    id: 'checkpoint_armory',
    title: 'The Armory Cage',
    kind: 'discovery',
    weight: 12,
    locations: ['checkpoint_bravo'],
    a: { best: 'brawn' },
    intro: 'A steel cage in the guard post, padlocked, with crates stenciled in army green inside. {a.first} finds a length of rail.',
    check: { stat: 'brawn', dc: 'hard' },
    success: {
      text: 'The padlock gives before the rail does. Inside, under the dust, the grease on the cartridges is still wet.',
      effects: [
        { type: 'loot', resource: 'ammo', amount: [5, 8] },
        { type: 'gear', chance: 0.5 },
      ],
    },
    failure: {
      text: 'The army built that cage to keep people like {a.first} out, and it still does its job.',
      effects: [{ type: 'stress', who: 'a', amount: 3 }],
    },
  },

  // ============================================================ Red Hand Camp

  {
    id: 'raider_cage',
    title: 'The Cage',
    kind: 'discovery',
    weight: 14,
    locations: ['red_hand_camp'],
    a: { best: 'wits' },
    intro: 'Behind the stadium, away from the fires, there is a cage with someone in it. {a.first} goes in alone, on {a.their} stomach.',
    check: { stat: 'wits', dc: 'hard', contexts: ['sneak'] },
    success: {
      text: '{a.first} cuts the lashings. The prisoner does not waste time on thanks, but on the way out points to where the Red Hand keeps what it steals.',
      effects: [
        { type: 'loot', resource: 'ammo', amount: [3, 5] },
        { type: 'loot', resource: 'rations', amount: [2, 4] },
        { type: 'stress', who: 'all', amount: -5 },
        { type: 'chronicle', who: 'a', text: 'Cut a prisoner loose from the Red Hand at {loc}.' },
      ],
    },
    failure: {
      text: 'A dog barks. Then every dog in the camp.',
      effects: [{ type: 'fight' }],
    },
  },

  // ============================================================ the Glow

  {
    id: 'glow_whispers',
    title: 'Whispers',
    kind: 'hazard',
    weight: 12,
    locations: ['the_glow'],
    a: { worst: 'nerve' },
    intro: 'Near the center the air hums, and inside the hum there are almost words. {a.first} has stopped to listen.',
    check: { stat: 'nerve', dc: 'hard' },
    success: {
      text: '{a.first} shakes {a.their} head hard, like a dog, and walks on. "It knew my name," {a.they} will say later, and nothing more.',
      effects: [
        { type: 'stress', who: 'a', amount: 4 },
        { type: 'practice', who: 'a', stat: 'nerve', amount: 4 },
      ],
    },
    failure: {
      text: '{a.first} is at the very rim before stumbling back. {a.They} {a.is} still answering it.',
      effects: [
        { type: 'stress', who: 'a', amount: 16 },
        { type: 'rads', who: 'a', amount: [8, 14] },
        { type: 'stress', who: 'others', amount: 4 },
      ],
    },
  },
  {
    id: 'glow_glass',
    title: 'Under the Glass',
    kind: 'discovery',
    weight: 12,
    locations: ['the_glow'],
    a: { best: 'wits' },
    intro: 'Something is fused into the crater glass, a hand\'s depth down: a sealed case, unmarked by the heat. {a.first} studies the fracture lines.',
    check: { stat: 'wits', dc: 'hard' },
    success: {
      text: 'One tap in the right place and the glass splits clean. Whatever was built to survive this was built very well.',
      effects: [
        { type: 'loot', resource: 'tech', amount: [5, 8] },
        { type: 'gear' },
      ],
    },
    failure: {
      text: 'The glass shatters the wrong way and a breath of hot air comes up out of the ground. Every counter goes off at once.',
      effects: [
        { type: 'rads', who: 'all', amount: [8, 14] },
        { type: 'stress', who: 'all', amount: 4 },
      ],
    },
  },

  // ============================================================ animals (§9.7, 1.9.0)

  {
    id: 'goat_on_the_road',
    title: 'A Goat',
    kind: 'travel',
    weight: 6,
    locations: ['kessler_farm', 'maple_street', 'rail_yard'],
    a: { best: 'wits' },
    intro: 'A goat with a frayed rope round its neck is standing in the middle of the road, eating a tyre.',
    check: { stat: 'wits', dc: 'easy' },
    success: {
      text: '{a.first} pulls up a handful of grass and talks to it like an old friend. It decides {a.first} is all right, and follows.',
      effects: [{ type: 'animal', kind: 'goat' }],
    },
    failure: {
      text: 'It butts {a.first} hard in the knee and trots off into the scrub, rope and all.',
      effects: [{ type: 'damage', who: 'a', amount: [1, 2], cause: 'a goat' }],
    },
  },
  {
    id: 'cat_in_the_ruins',
    title: 'Something Hissing',
    kind: 'discovery',
    weight: 6,
    locations: BUILDINGS,
    a: { best: 'nerve' },
    intro: 'Something small and furious is hissing from inside a burst vending machine.',
    check: { stat: 'nerve', dc: 'normal' },
    success: {
      text: '{a.first} sits very still for a long time. In the end a thin grey cat climbs out, sniffs {a.their} boots, and settles in {a.their} pack as if it had always been there.',
      effects: [{ type: 'animal', kind: 'cat' }],
    },
    failure: {
      text: 'A yowl, a blur of claws, and three red lines across the back of {a.first}\'s hand. The cat is long gone.',
      effects: [{ type: 'damage', who: 'a', amount: [1, 1], cause: 'a cat' }],
    },
  },
  {
    id: 'crow_with_a_key',
    title: 'A Crow',
    kind: 'travel',
    weight: 6,
    a: {},
    intro: 'A crow lands on {a.first}\'s pack and won\'t be shooed off. It has something shiny in its beak.',
    check: { chance: 0.5 },
    success: {
      text: 'It drops a ring of keys into {a.first}\'s hand, and rides on the pack the whole way home.',
      effects: [
        { type: 'loot', resource: 'scrap', amount: [1, 2] },
        { type: 'animal', kind: 'crow' },
      ],
    },
    failure: {
      text: 'It looks {a.first} in the eye, thinks better of it, and flies off with whatever it was.',
    },
  },

  // ============================================================ people found out there (§10, 1.9.0)

  {
    id: 'cart_on_the_road',
    title: 'A Shopping Cart',
    kind: 'travel',
    weight: 16,
    maxDanger: 3,
    a: { best: 'nerve' },
    intro: 'Someone is pushing a shopping cart along the same road, loaded with a whole life: pots, blankets, a birdcage with no bird.',
    check: { stat: 'nerve', dc: 'normal' },
    success: {
      text: '{a.first} falls into step and gets talking. By the next crossroads the cart has a new direction.',
      effects: [
        { type: 'survivor' },
        { type: 'chronicle', who: 'a', text: 'Talked a stranger with a shopping cart into coming home from {loc}.' },
      ],
    },
    failure: {
      text: 'The stranger keeps a hand on a knife and the cart between them, and turns off at the next corner.',
      effects: [{ type: 'stress', who: 'a', amount: 2 }],
    },
  },
  {
    id: 'the_holdout',
    title: 'The Holdout',
    kind: 'discovery',
    weight: 14,
    locations: BUILDINGS,
    a: { best: 'wits' },
    intro: 'A voice from behind a barricade of filing cabinets: "Keep walking." It sounds like it hasn\'t talked to anyone in a long time.',
    check: { stat: 'wits', dc: 'normal', danger: true },
    success: {
      text: '{a.first} keeps talking: about the Depot, the fire, the food. After an hour the cabinets scrape aside. Two years alone in there, and enough is enough.',
      effects: [
        { type: 'survivor' },
        { type: 'chronicle', who: 'a', text: 'Talked a holdout out from behind a barricade at {loc}.' },
      ],
    },
    failure: {
      text: 'A warning shot cracks off the wall beside {a.first}. The voice says nothing more.',
      effects: [{ type: 'stress', who: 'all', amount: 4 }],
    },
  },
  {
    id: 'cage_in_the_camp',
    title: 'The Cage',
    kind: 'discovery',
    weight: 14,
    locations: RAIDER_PLACES,
    minDanger: 2,
    a: { best: 'wits' },
    intro: 'Behind a burned-out bus, a dog cage with a person in it, thin and filthy and very much awake. "Please."',
    check: { stat: 'wits', dc: 'normal', danger: true, contexts: ['tech'] },
    success: {
      text: '{a.first} has the padlock off in under a minute. Nobody comes to see why the cage is empty until much later.',
      effects: [
        { type: 'survivor' },
        { type: 'chronicle', who: 'a', text: 'Let a prisoner out of a raiders\' cage at {loc}.' },
      ],
    },
    failure: {
      text: 'The lock won\'t give, and someone heard the rattling.',
      effects: [{ type: 'fight' }],
    },
  },
  {
    id: 'the_deserter',
    title: 'Hands Up',
    kind: 'travel',
    weight: 11,
    locations: ['red_hand_camp', 'checkpoint_bravo', 'drowned_mall', 'blackwater'],
    a: { best: 'wits' },
    intro: 'Someone steps out of a doorway with both hands up and a red armband torn half off. "I\'m done with them. Take me with you."',
    check: { stat: 'wits', dc: 'normal', danger: true },
    success: {
      text: '{a.first} looks for the trap and doesn\'t find one. The deserter talks the whole way, and some of it is even useful.',
      effects: [
        { type: 'survivor' },
        { type: 'explore', amount: 4 },
      ],
    },
    failure: {
      text: 'It was a trap after all.',
      effects: [{ type: 'fight', ambushed: true }],
    },
  },
];
