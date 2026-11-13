import type { Approach, RetreatOrder } from '../types.ts';
import type { EventBase, EventCheck, EventOutcome } from './events.ts';

/**
 * Forks on runs (§7.12): something the crew has to decide. With a Radio
 * Tower, whoever is cast as `a` calls home and the player picks the order;
 * unanswered, or without a radio, `a` decides by the first pick that fits.
 *
 * Text uses the same placeholders as events ({a.first}, {loc}, ...). `intro`
 * is what they find, `ask` is what they say on the radio, in their own words.
 * An order's `label` is an instruction ("Open it"); the log repeats it.
 *
 * To add a fork, append it to FORKS. The tests check references and
 * placeholders, and that every order and each of its outcomes can happen.
 */

export interface ForkOrder {
  id: string;
  /** On the radio card and in the log: "Go around". */
  label: string;
  /** Real minutes it adds to the run. */
  minutes?: number;
  /** Without a check, `success` always happens. */
  check?: EventCheck;
  success: EventOutcome;
  failure?: EventOutcome;
}

/** What `a` does unasked: the first pick whose conditions all hold. One with no conditions always fits. */
export interface ForkPick {
  /** `a` has this trait (a hidden one counts). */
  trait?: string;
  approach?: Approach;
  retreat?: RetreatOrder;
  order: string;
}

export interface ForkDef extends EventBase {
  kind: 'travel' | 'hazard' | 'discovery';
  /** What they say on the radio. */
  ask: string;
  orders: ForkOrder[];
  /** The last one has no conditions. */
  picks: ForkPick[];
}

const BUILDINGS = ['drowned_mall', 'old_metro', 'radio_station', 'st_judes', 'water_plant', 'checkpoint_bravo'];
const RAIDER_ROADS = ['kessler_farm', 'old_metro', 'drowned_mall', 'radio_station', 'st_judes', 'checkpoint_bravo', 'red_hand_camp'];

export const FORKS: readonly ForkDef[] = [
  {
    id: 'sealed_door',
    title: 'A sealed door',
    kind: 'discovery',
    weight: 10,
    locations: BUILDINGS,
    a: { best: 'wits' },
    intro: 'Behind a collapsed stair, {a.first} finds a steel door with its seals still on. Nobody has been through it since.',
    ask: "There's a sealed door down here. I can get it open, but it'll take the best part of an hour. Do we wait?",
    orders: [
      {
        id: 'open',
        label: 'Open it',
        minutes: 45,
        check: { stat: 'wits', dc: 'hard', danger: true, contexts: ['tech'] },
        success: {
          text: 'The last seal gives with a hiss of old air. Shelves, and nobody has touched them.',
          effects: [
            { type: 'loot', resource: 'any', amount: [4, 8], scales: true },
            { type: 'gear', chance: 0.5 },
            { type: 'chronicle', who: 'a', text: 'Opened a sealed door at {loc}.' },
          ],
        },
        failure: {
          text: 'An hour of work, and the door has not moved an inch. Nobody says much on the way out.',
          effects: [{ type: 'stress', who: 'all', amount: 5 }],
        },
      },
      {
        id: 'leave',
        label: 'Leave it',
        success: { text: '{a.first} marks it on the map for another day, and they move on.', effects: [{ type: 'explore', amount: 2 }] },
      },
    ],
    picks: [
      { trait: 'tinkerer', order: 'open' },
      { trait: 'curious', order: 'open' },
      { trait: 'greedy', order: 'open' },
      { trait: 'cautious', order: 'leave' },
      { approach: 'aggressive', order: 'open' },
      { order: 'leave' },
    ],
  },
  {
    id: 'raiders_on_the_road',
    title: 'Raiders on the road',
    kind: 'travel',
    weight: 10,
    locations: RAIDER_ROADS,
    minDanger: 2,
    a: { best: 'wits' },
    intro: '{a.first} comes back from scouting ahead: raiders, five or six of them, camped right across the road.',
    ask: 'Raiders camped across the road ahead. We can go around, but it is a long way. Or we go through them.',
    orders: [
      {
        id: 'around',
        label: 'Go around',
        minutes: 30,
        check: { stat: 'grit', dc: 'normal', crew: true },
        success: { text: 'The long way, through backyards and over fences. Sore feet, and nobody saw them.', effects: [{ type: 'stress', who: 'all', amount: 3 }] },
        failure: {
          text: 'The long way is no easier: a fence gives way under {a.first}.',
          effects: [
            { type: 'damage', who: 'a', amount: [2, 5], cause: 'a fall on the long way round' },
            { type: 'stress', who: 'all', amount: 3 },
          ],
        },
      },
      {
        id: 'through',
        label: 'Go through them',
        success: { text: 'They go in hard, before the raiders are on their feet.', effects: [{ type: 'fight', ambushed: false, drop: true, enemy: 'raider' }] },
      },
      {
        id: 'sneak',
        label: 'Sneak past',
        check: { stat: 'wits', dc: 'hard', contexts: ['sneak'], crew: true },
        success: { text: 'Low and slow, right under their noses. One of them is asleep on a crate of ammo, and the crate comes along.', effects: [{ type: 'loot', resource: 'ammo', amount: [2, 5] }] },
        failure: { text: 'A bottle rolls. The fire goes quiet, and then everyone is shouting.', effects: [{ type: 'fight', ambushed: true, enemy: 'raider' }] },
      },
    ],
    picks: [
      { trait: 'hothead', order: 'through' },
      { approach: 'aggressive', order: 'through' },
      { approach: 'sneaky', order: 'sneak' },
      { order: 'around' },
    ],
  },
  {
    id: 'someone_on_the_road',
    title: 'Someone on the road',
    kind: 'travel',
    weight: 8,
    maxDanger: 3,
    a: { best: 'nerve' },
    intro: 'A lone figure waves from the verge, hands empty and held high. {a.first} goes over to talk.',
    ask: "There's someone out here on their own. Says a name is all they've got left, and asks to walk with us. Do we take them?",
    orders: [
      {
        id: 'take',
        label: 'Bring them along',
        check: { chance: 0.6 },
        success: { text: 'They keep up, they keep quiet, and they are still there when the Depot comes in sight.', effects: [{ type: 'survivor' }] },
        failure: {
          text: 'Somewhere along the way they slip off, and some of the meds go with them.',
          effects: [
            { type: 'supplies', meds: -2 },
            { type: 'stress', who: 'a', amount: 3 },
          ],
        },
      },
      {
        id: 'send',
        label: 'Send them on',
        success: { text: '{a.first} gives them some water and points them away from the worst of it.' },
      },
    ],
    picks: [
      { trait: 'generous', order: 'take' },
      { order: 'send' },
    ],
  },
  {
    id: 'hot_roof',
    title: 'A hot roof',
    kind: 'hazard',
    weight: 8,
    needsRadiation: true,
    a: { best: 'grit' },
    intro: "On a roof the counters don't like, {a.first} spots crates under a tarp: someone's stash, never collected.",
    ask: "There's a stash up on a roof, but the counter's clicking hard up there. A few minutes' climb. Worth it?",
    orders: [
      {
        id: 'up',
        label: 'Go up',
        check: { stat: 'grit', dc: 'normal' },
        success: {
          text: 'Up, grab, down, fast. The crates were worth it.',
          effects: [
            { type: 'loot', resource: 'any', amount: [4, 7], scales: true },
            { type: 'rads', who: 'a', amount: [8, 14] },
          ],
        },
        failure: {
          text: '{a.first} fights the knots on the tarp for far too long up there.',
          effects: [
            { type: 'loot', resource: 'any', amount: [2, 4], scales: true },
            { type: 'rads', who: 'a', amount: [16, 24] },
          ],
        },
      },
      {
        id: 'leave',
        label: 'Leave it',
        success: { text: 'Not worth the dose. {a.first} marks the roof on the map and they move on.' },
      },
    ],
    picks: [
      { trait: 'greedy', order: 'up' },
      { trait: 'cautious', order: 'leave' },
      { approach: 'aggressive', order: 'up' },
      { order: 'leave' },
    ],
  },
  {
    id: 'storm',
    title: 'A storm',
    kind: 'hazard',
    weight: 8,
    a: { best: 'wits' },
    intro: 'The sky to the west goes the color of a bruise. Dust first, then the rain that burns.',
    ask: "Storm's coming in, a bad one. We can hole up and sit it out, the best part of an hour. Or we push on and get wet.",
    orders: [
      {
        id: 'shelter',
        label: 'Shelter and wait',
        minutes: 40,
        success: { text: 'They sit it out in a basement, playing cards by torchlight. Nobody minds the rest.', effects: [{ type: 'stress', who: 'all', amount: -6 }] },
      },
      {
        id: 'push',
        label: 'Push on',
        check: { stat: 'grit', dc: 'normal', crew: true },
        success: { text: 'Heads down, they make good time while nothing else is out.', effects: [{ type: 'explore', amount: 3 }] },
        failure: {
          text: 'The rain finds every gap in their coats.',
          effects: [
            { type: 'damage', who: 'all', amount: [1, 3], cause: 'a burning rain' },
            { type: 'stress', who: 'all', amount: 4 },
          ],
        },
      },
    ],
    picks: [
      { trait: 'cautious', order: 'shelter' },
      { trait: 'cowardly', order: 'shelter' },
      { order: 'push' },
    ],
  },
];
