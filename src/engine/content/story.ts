/**
 * The first week (§9.10, 2.8.0): a short chain of things to do in a new
 * guild, one at a time, each with a reward, through the first places,
 * buildings and fights to a motorcycle, and ending with the first word of
 * Haven: the game's long goal. Aviel picked it, with the Depot's corners
 * (§9.9), so the first hours have a direction. Each step's goal is checked from the game as it is; the reward
 * is collected from the card.
 */
import type { BuildingId, Resources } from '../types.ts';

export type StoryGoal =
  /** Nothing in the stash that would fill an empty slot on anyone: the starting gear handed out. */
  | { kind: 'kitted' }
  | { kind: 'building'; building: BuildingId; level: number }
  /** Crews home from runs since the step began, at a place or anywhere. */
  | { kind: 'runs'; count: number; at?: string }
  /** Corners of the Depot searched, in all. */
  | { kind: 'corners'; count: number };

export type StoryGift =
  | { kind: 'supplies'; change: Partial<Resources> }
  /** A vehicle, in this condition (0–100). */
  | { kind: 'vehicle'; defId: string; condition: number }
  /** Someone at the gate who wants to join. */
  | { kind: 'wanderer' };

export interface StoryStep {
  id: string;
  title: string;
  /** Why: the setup. */
  text: string;
  /** What to do, short: "Search three corners of the Depot". */
  goalText: string;
  goal: StoryGoal;
  /** How it went, once collected. */
  done: string;
  gives: StoryGift[];
}

export const FIRST_WEEK: readonly StoryStep[] = [
  {
    id: 'kit_out',
    title: 'Kit them out',
    text: 'There’s gear sitting in the stash, doing nobody any good there. The Gear screen shows who can use what.',
    goalText: 'Hand out the gear in the stash',
    goal: { kind: 'kitted' },
    done: 'Better. Nobody goes out there in their shirtsleeves now.',
    gives: [{ kind: 'supplies', change: { ammo: 6 } }],
  },
  {
    id: 'garden',
    title: 'Get the Garden going',
    text: 'Too many mouths for one bed of beans. A bigger Garden first, before the rations run thin.',
    goalText: 'Improve the Garden to level 2',
    goal: { kind: 'building', building: 'garden', level: 2 },
    done: 'The new beds are dug and planted. Something green by the end of the week.',
    gives: [{ kind: 'supplies', change: { rations: 8 } }],
  },
  {
    id: 'first_run',
    title: 'A first run',
    text: 'The Rail Yard is close, and quiet as these places go. Send a crew and see what they bring back.',
    goalText: 'Bring a crew home from a run',
    goal: { kind: 'runs', count: 1 },
    done: 'They’re back, dirt under their nails and something to show for it.',
    gives: [{ kind: 'supplies', change: { scrap: 5 } }],
  },
  {
    id: 'corners',
    title: 'The old depot',
    text: 'While a crew is out, those at home can go through the old station itself. Its corners are listed under the yard.',
    goalText: 'Search three corners of the Depot',
    goal: { kind: 'corners', count: 3 },
    done: 'The place is starting to feel like theirs.',
    gives: [{ kind: 'supplies', change: { meds: 2 } }],
  },
  {
    id: 'smoke',
    title: 'Smoke over Maple Street',
    text: 'Someone saw smoke over Maple Street last night. Somebody else is out there.',
    goalText: 'Bring a crew home from Maple Street',
    goal: { kind: 'runs', count: 1, at: 'maple_street' },
    done: 'Whoever lit the fire was gone by the time the crew got there, but they left tracks, and the tracks led back here. The next morning there’s someone at the gate, asking to come in.',
    gives: [{ kind: 'wanderer' }],
  },
  {
    id: 'farm',
    title: 'The farm',
    text: 'Kessler Farm has food, and ferals that think it’s theirs.',
    goalText: 'Bring a crew home from Kessler Farm',
    goal: { kind: 'runs', count: 1, at: 'kessler_farm' },
    done: 'They came back with full sacks, and the guts of the old well pump: wire, a motor, a few parts worth more than the rest.',
    gives: [{ kind: 'supplies', change: { rations: 10, tech: 4 } }],
  },
  {
    id: 'wheels',
    title: 'Wheels',
    text: 'At the back of the engine shed, under a tarp, there’s a motorcycle. With a Workshop it could run again.',
    goalText: 'Build the Workshop',
    goal: { kind: 'building', building: 'workshop', level: 1 },
    done: 'It coughs, it smokes, and then it runs. Two can ride it, and they get there faster. It drinks gas, so bring some home.',
    gives: [
      { kind: 'vehicle', defId: 'motorcycle', condition: 60 },
      { kind: 'supplies', change: { gas: 8 } },
    ],
  },
  {
    id: 'on_air',
    title: 'Get on the air',
    text: 'With a Radio Tower the guild can hear who else is out there, and anyone out there can find the way here.',
    goalText: 'Build the Radio Tower',
    goal: { kind: 'building', building: 'radio_tower', level: 1 },
    // The lead to the long goal (Aviel, 2026-11-15): Haven. Finding it is a roadmap step of its own (§15).
    done: 'The first night on the air is mostly static. Then a woman’s voice, calm and clear: “This is Haven. We have power, clean water, and room for you. All survivors welcome.” It comes again on the hour, every hour, the same words. Nobody here has heard of Haven, or knows where it is. Everyone is listening now.',
    gives: [{ kind: 'supplies', change: { scrap: 10 } }],
  },
];
