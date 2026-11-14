import type { StatId } from '../types.ts';

/**
 * Jobs a fight can come with (§7.4, 2.5.0; Aviel: "goals sometimes other than
 * fighting… someone do x for 3 turns… instead of 'shoot', 'hold the door'").
 * Someone spends their turns on the job instead of fighting; it's done when
 * they've put in `rounds` of work (two a round when they're `fast`). A job
 * with a `deadline` is lost if it isn't done by the end of that round. A fight
 * won first gets the job done anyway. What each one gives is `reward`, played
 * in expedition/goals.ts.
 */
export interface GoalDef {
  id: string;
  /** Its name on the screen: "Hold the door". */
  title: string;
  /** The move that works it: "Hold the door", "Haul the crate". */
  move: string;
  /** The line when the fight starts. */
  intro: string;
  /** What the move does, for the move picker and the screen. */
  detail: string;
  /** Turns of work it takes. */
  rounds: number;
  /** Done by the end of this round, or it's lost. */
  deadline?: number;
  /** Twice as fast for someone with this stat at `min` or more, or carrying one of `gear`. */
  fast: { stat?: StatId; min?: number; gear?: string[] };
  /** The best stat for it: who a crew on its own puts on it. */
  stat: StatId;
  /** The kinds of enemy it comes with. */
  against: string[];
  weight: number;
  /** What getting it done does. */
  reward: 'shut' | 'cache' | 'rescue' | 'unlock';
  /** A line for each turn of work: {a} is who. */
  working: string;
  /** When it's done, and when it's lost. */
  done: string;
  lost: string;
}

export const GOALS: readonly GoalDef[] = [
  {
    id: 'hold_door',
    title: 'Hold the door',
    move: 'Hold the door',
    intro: 'More of them are coming through a side door.',
    detail: 'No attack. Each round nobody holds it, another one gets through (two at most). Held three rounds (two for someone strong), it stays shut.',
    rounds: 3,
    fast: { stat: 'brawn', min: 7 },
    stat: 'brawn',
    against: ['raider', 'hollow', 'feral'],
    weight: 3,
    reward: 'shut',
    working: '{a} puts a shoulder to the door.',
    done: 'The door is shut and wedged. No more get through.',
    lost: 'Another one comes through the door.',
  },
  {
    id: 'grab_and_go',
    title: 'Grab their stash',
    move: 'Haul the crate',
    intro: 'Their stash is right there, and they mean to get it away.',
    detail: 'No attack. Two rounds of hauling (one for someone very strong), by the end of round 3, and the crate is yours; win the fight first and it is too.',
    rounds: 2,
    deadline: 3,
    fast: { stat: 'brawn', min: 8 },
    stat: 'brawn',
    against: ['raider'],
    weight: 2,
    reward: 'cache',
    working: '{a} drags the crate toward cover.',
    done: 'The crate is clear, and it’s ours.',
    lost: 'They get their stash away.',
  },
  {
    id: 'get_out',
    title: 'Get them out',
    move: 'Carry them out',
    intro: 'Someone is cornered here, a stranger with nowhere to run.',
    detail: 'No attack. Two rounds to carry them clear (one for someone very strong), by the end of round 4; win the fight first and they’re safe too. Some come home with you; the rest give what they can.',
    rounds: 2,
    deadline: 4,
    fast: { stat: 'brawn', min: 8 },
    stat: 'grit',
    against: ['feral', 'hollow'],
    weight: 2,
    reward: 'rescue',
    working: '{a} hauls the stranger toward the way out.',
    done: 'The stranger is clear of it.',
    lost: 'The stranger doesn’t make it.',
  },
  {
    id: 'fix_open',
    title: 'Open the cage',
    move: 'Work the lock',
    intro: 'There’s a locked supply cage here, and it won’t stay reachable for long.',
    detail: 'No attack. Three rounds on the lock (one fewer with Lockpicks or a Multitool), by the end of round 4, and what’s inside is yours; win the fight first and it is too.',
    rounds: 3,
    deadline: 4,
    fast: { stat: 'wits', min: 8, gear: ['lockpicks', 'multitool'] },
    stat: 'wits',
    against: ['scrapbot', 'raider'],
    weight: 2,
    reward: 'unlock',
    working: '{a} works the lock.',
    done: 'The cage swings open.',
    lost: 'The cage locks down for good.',
  },
];

export function getGoal(id: string): GoalDef {
  const g = GOALS.find((x) => x.id === id);
  if (!g) throw new Error(`Unknown goal: ${id}`);
  return g;
}
