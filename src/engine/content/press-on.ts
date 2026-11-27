/**
 * Press on or come home (3.11.0, §7.12): what a crew finds at the deepest
 * point of a run, and what they say about it on the radio. Story and dialogue,
 * so they can take their time (Aviel, 2026-11-27); every line has to make sense
 * on its own. {a.first}, {a.they}, {a.them} and the like are the caller.
 */
import type { EventCheck, EventOutcome } from './events.ts';
import type { RadioMood } from './forks.ts';
import type { CrewLines } from './flavor.ts';

/** What's ahead, as the crew sees it. Each starts the first beat deeper in with its own kind. */
export type PressOnTeaser = 'stash' | 'big' | 'voice';

export interface PressOnDef {
  title: string;
  /** The first beat deeper in. */
  beat: 'scavenge' | 'combat' | 'discovery';
  /** How likely, by job (scavenge, scout, hunt). */
  weight: { scavenge: number; scout: number; hunt: number };
  /** What they find, as told. */
  intro: CrewLines;
  /** What the caller asks, in their own words. */
  ask: CrewLines;
  /** How the caller sounds on the radio. */
  mood: RadioMood;
  /** A piece of gear for whoever's still standing after the first beat in: what the find promised. */
  prize?: boolean;
  /** Who they meet, if the first beat in is a meeting rather than a beat of `beat`'s kind: one of these, by weight. */
  meets?: readonly PressOnMeet[];
}

/**
 * Who's further in, for a teaser that promises someone. Played like an event's
 * outcome (with its check and effects); {a.first} and the like are whoever's
 * best at the check. Every one of them has to follow from every intro.
 */
export interface PressOnMeet {
  title: string;
  weight: number;
  /** Only where enemies of this type live (a trap needs someone to set it). */
  enemy?: string;
  check?: EventCheck;
  success: EventOutcome;
  failure?: EventOutcome;
}

export const PRESS_ON: Record<PressOnTeaser, PressOnDef> = {
  stash: {
    title: 'Further in',
    mood: 'excited',
    beat: 'scavenge',
    prize: true,
    weight: { scavenge: 3, scout: 1, hunt: 1 },
    intro: {
      crew: [
        'Past the last room they cleared, a stairwell goes down into the dark. The door at the bottom is barred from this side, and someone has painted KEEP OUT across it.',
        '{a.first} finds a hatch under a rotten rug. It’s padlocked, and the scratches around the lock are fresh: somebody still comes back here.',
        'Behind a fallen wall there’s a storeroom nobody has touched. Getting to it means going further in than they meant to.',
      ],
      solo: [
        'Past the last room {a.first} cleared, a stairwell goes down into the dark. The door at the bottom is barred from this side, and someone has painted KEEP OUT across it.',
        '{a.first} finds a hatch under a rotten rug. It’s padlocked, and the scratches around the lock are fresh: somebody still comes back here.',
        'Behind a fallen wall there’s a storeroom nobody has touched. Getting to it means going further in than {a.first} meant to.',
      ],
    },
    ask: {
      crew: [
        'It’s further in than we planned. Do we go and look?',
        'Could be nothing. Could be the best haul we’ve had. Your call.',
        'We’ve got a good load already. Do we push our luck?',
      ],
      solo: [
        'It’s further in than I planned. Do I go and look?',
        'Could be nothing. Could be the best haul I’ve had. Your call.',
        'I’ve got a good load already. Do I push my luck?',
      ],
    },
  },
  big: {
    title: 'Something big',
    mood: 'tense',
    beat: 'combat',
    prize: true,
    weight: { scavenge: 1, scout: 1, hunt: 3 },
    intro: {
      crew: [
        'Something heavy is moving further in. The floor shakes with every step, and everything else in the place has gone quiet.',
        'They follow a line of huge tracks to a nest, and under it a pile of salvage nobody has dared to pick over. Whatever made the tracks is close.',
        '{a.first} spots it through a broken window further in: something big, standing guard over a heap of crates.',
      ],
      solo: [
        'Something heavy is moving further in. The floor shakes with every step, and everything else in the place has gone quiet.',
        '{a.first} follows a line of huge tracks to a nest, and under it a pile of salvage nobody has dared to pick over. Whatever made the tracks is close.',
        '{a.first} spots it through a broken window further in: something big, standing guard over a heap of crates.',
      ],
    },
    ask: {
      crew: [
        'Big things sit on the best stuff. Do we take it on?',
        'We could take it. Probably. Say the word.',
        'I’d rather not, but I’d rather go home rich. What do you think?',
      ],
      solo: [
        'Big things sit on the best stuff. Do I take it on?',
        'I could take it. Probably. Say the word.',
        'I’d rather not, but I’d rather go home rich. What do you think?',
      ],
    },
  },
  voice: {
    title: 'Someone further in',
    mood: 'uneasy',
    beat: 'discovery',
    weight: { scavenge: 1, scout: 3, hunt: 1 },
    intro: {
      crew: [
        'Somewhere further in, someone is talking. It’s too far off to make out the words, and nobody seems to answer.',
        'There’s a light deeper in. It goes still when they stop, and moves again when they move.',
        'Fresh footprints lead further in, with a trail of empty cans beside them. Someone has been living down here.',
      ],
      solo: [
        'Somewhere further in, someone is talking. It’s too far off to make out the words, and nobody seems to answer.',
        'There’s a light deeper in. It goes still when {a.first} stops, and moves again when {a.they} moves.',
        'Fresh footprints lead further in, with a trail of empty cans beside them. Someone has been living down here.',
      ],
    },
    meets: [
      {
        title: 'A trap',
        weight: 2,
        enemy: 'raider',
        check: { stat: 'wits', dc: 'hard', danger: true },
        success: {
          text: '{a.first} stops short. The way in is too easy: a path cleared through the junk, a light left burning, and boot prints all around it. Somebody is waiting for whoever comes to look, and {a.first} sees them first.',
          effects: [{ type: 'fight', enemy: 'raider', drop: true }],
        },
        failure: {
          text: '{a.first} is halfway across the room when a door bangs shut behind {a.them}. Whoever was down here wanted company, and not the friendly kind.',
          effects: [{ type: 'fight', enemy: 'raider' }],
        },
      },
      {
        title: 'Someone hiding',
        weight: 2,
        check: { stat: 'nerve', dc: 'normal' },
        success: {
          text: '{a.first} calls out, quietly, and waits. A long while later someone comes out of the dark, thin and filthy, hands up, too tired to run any more.',
          effects: [{ type: 'survivor' }],
        },
        failure: {
          text: '{a.first} calls out, and whoever it is runs, deeper in, where nobody follows. In the corner where they slept there’s a bag of whatever they’d found, and some of it is medicine.',
          effects: [{ type: 'supplies', meds: 2 }],
        },
      },
      {
        title: 'An old hand',
        weight: 1,
        success: {
          text: 'It’s an old man with a lantern, who has lived down here since before. He won’t leave, and he won’t say his name, but for a can of beans he shows {a.first} the way through, and where the last people kept their bullets.',
          effects: [{ type: 'explore', amount: 10 }, { type: 'supplies', ammo: 8 }],
        },
      },
    ],
    ask: {
      crew: [
        'Could be someone who needs us. Could be bait. Do we go and see?',
        'Whoever it is knows this place better than we do. Worth finding out?',
        'We go in, or we go home with what we’ve got.',
      ],
      solo: [
        'Could be someone who needs help. Could be bait. Do I go and see?',
        'Whoever it is knows this place better than I do. Worth finding out?',
        'I go in, or I go home with what I’ve got.',
      ],
    },
  },
};

/**
 * Something the caller adds in their own way, by a trait everyone can see (the
 * first of theirs that has one). Said by one person, so it reads right for a crew
 * or alone.
 */
export const PRESS_ASIDES: readonly { trait: string; lines: readonly string[] }[] = [
  { trait: 'haunted', lines: ['I don’t want to lose anyone else out here.'] },
  { trait: 'cowardly', lines: ['If you’re asking me, I’d go home.'] },
  { trait: 'cautious', lines: ['For what it’s worth, I’d rather not.'] },
  { trait: 'hothead', lines: ['I’m already on my way.', 'Just say yes.'] },
  { trait: 'brave', lines: ['I’ll go first.'] },
  { trait: 'greedy', lines: ['Think what it could be worth.'] },
  { trait: 'curious', lines: ['I have to know what it is.'] },
  { trait: 'cynic', lines: ['It’ll be a trap. It always is.'] },
  { trait: 'optimist', lines: ['Could be a lucky day.'] },
];

/** What the caller does unasked, tried in order: a trait of theirs, then the crew's orders. The last always fits. */
export const PRESS_ON_PICKS: readonly { trait?: string; retreat?: 'never'; order: 'press' | 'home' }[] = [
  { trait: 'hothead', order: 'press' },
  { trait: 'brave', order: 'press' },
  { trait: 'cowardly', order: 'home' },
  { trait: 'cautious', order: 'home' },
  { retreat: 'never', order: 'press' },
  { order: 'home' },
];

/** What they do once it's decided. {where} is "deeper in" or "into the heart of it". */
export const PRESS_ON_GO: CrewLines = {
  crew: ['They check their gear and go on, {where}.', 'They go on, {where}, quieter now.'],
  solo: ['{a.first} checks {a.their} gear and goes on, {where}.', '{a.first} goes on, {where}, quieter now.'],
};

export const PRESS_ON_HOME: CrewLines = {
  crew: ['They leave it for another day and turn for home with what they’ve got.', 'Not today. They turn back the way they came.'],
  solo: ['{a.first} leaves it for another day and turns for home with what {a.they} has.', 'Not today. {a.first} turns back the way {a.they} came.'],
};
