/**
 * The Depot's own corners (§9.9, 2.7.0): parts of the old rail depot nobody
 * has gone through yet. Someone at home searches one at a time, a short job,
 * and each has a find and a bit of story. Aviel picked this to give the first
 * hours more to do than send a run and wait.
 *
 * A corner's outcomes are tried in order (a stat check of whoever searches,
 * or luck); the last always fits. Text uses {a.first}, {a.they}, ... for the
 * one searching. Some corners open only once another has been searched (the
 * keys are in the ticket office).
 */
import type { AnimalKind, Quality, Resources, StatId } from '../types.ts';

export type CornerGift =
  | { kind: 'supplies'; change: Partial<Resources> }
  | { kind: 'gear'; defId: string; quality?: Quality }
  /** An animal comes to the Depot, kept by whoever found it; if the guild already has one of the kind, it moves on. */
  | { kind: 'animal'; animal: AnimalKind }
  /** A place out in the Reach is marked on the map. */
  | { kind: 'reveal' }
  /** Someone joins (or waits at the gate for a bed). */
  | { kind: 'person' }
  | { kind: 'practice'; stat: StatId; amount: number }
  | { kind: 'stress'; amount: number }
  | { kind: 'hurt'; amount: number };

export interface CornerOutcome {
  /** Whoever searches: d10 + the stat against `dc`; or plain luck. None: always fits. */
  test?: { stat: StatId; dc: number } | { chance: number };
  text: string;
  gives: CornerGift[];
}

export interface CornerDef {
  id: string;
  name: string;
  /** What it is, before anyone has gone in. */
  intro: string;
  /** How long a search takes, in minutes. */
  minutes: number;
  /** The stat that helps. */
  stat: StatId;
  /** Opens once this corner has been searched; `locked` says why it can't be yet. */
  needs?: { corner: string; locked: string };
  outcomes: CornerOutcome[];
}

export const CORNERS: readonly CornerDef[] = [
  {
    id: 'ticket_office',
    name: 'The ticket office',
    intro: 'A booth by the old platform, its window papered over from the inside.',
    minutes: 5,
    stat: 'wits',
    outcomes: [
      {
        test: { stat: 'wits', dc: 9 },
        text: '{a.first} goes through every drawer. Under the timetables: a route map with a place circled in pencil, and a ring of old keys.',
        gives: [{ kind: 'reveal' }, { kind: 'supplies', change: { scrap: 2 } }],
      },
      {
        text: 'Mouse droppings and ticket stubs, mostly. In the last drawer, a ring of old keys.',
        gives: [{ kind: 'supplies', change: { scrap: 3 } }],
      },
    ],
  },
  {
    id: 'signal_box',
    name: 'The signal box',
    intro: 'Up a flight of iron steps, the room that once worked every switch in the yard.',
    minutes: 10,
    stat: 'wits',
    outcomes: [
      {
        test: { stat: 'wits', dc: 10 },
        text: 'Behind the lever frame, a field radio nobody took with them. {a.first} strips it for parts a Radio Tower could use.',
        gives: [{ kind: 'supplies', change: { tech: 5 } }, { kind: 'practice', stat: 'wits', amount: 2 }],
      },
      {
        text: 'The levers are rusted solid. {a.first} pries loose some wire and a few bits of brass.',
        gives: [{ kind: 'supplies', change: { scrap: 5, tech: 2 } }],
      },
    ],
  },
  {
    id: 'water_tower',
    name: 'The water tower',
    intro: 'The tallest thing in the yard. The ladder up the side looks sound, mostly.',
    minutes: 10,
    stat: 'grit',
    outcomes: [
      {
        test: { stat: 'grit', dc: 9 },
        text: 'From the top the whole Reach lies open, and smoke rises somewhere nobody has been. An old lookout left a tin of rounds up there, too.',
        gives: [{ kind: 'reveal' }, { kind: 'supplies', change: { ammo: 6 } }],
      },
      {
        text: 'Halfway up, a rung gives. {a.first} comes down the fast way, bruised, but saw enough to point the way somewhere new.',
        gives: [{ kind: 'reveal' }, { kind: 'hurt', amount: 3 }],
      },
    ],
  },
  {
    id: 'freight_car',
    name: 'The locked freight car',
    intro: 'A boxcar on a siding, its door chained. Something shifts inside when the wind blows.',
    minutes: 15,
    stat: 'brawn',
    outcomes: [
      {
        test: { stat: 'brawn', dc: 9 },
        text: '{a.first} forces the door. On a nest of sacking, a dog lifts its head, looks {a.them} over, and decides {a.they} will do.',
        gives: [{ kind: 'animal', animal: 'dog' }, { kind: 'supplies', change: { scrap: 4 } }],
      },
      {
        text: 'The chain takes most of an hour and both of {a.first}’s arms. A thin dog bolts out past {a.them}, then comes back for the scraps.',
        gives: [{ kind: 'animal', animal: 'dog' }, { kind: 'stress', amount: 3 }],
      },
    ],
  },
  {
    id: 'cellar',
    name: 'The cellar',
    intro: 'Under the station house, behind a door that needs a key.',
    minutes: 15,
    stat: 'nerve',
    needs: { corner: 'ticket_office', locked: 'Locked. The keys might be in the ticket office.' },
    outcomes: [
      {
        test: { stat: 'nerve', dc: 9 },
        text: 'Down the steps with a lamp. Someone sealed a cache down here and never came back for it.',
        gives: [{ kind: 'supplies', change: { rations: 10, meds: 3 } }],
      },
      {
        text: 'Rats, a lot of them. {a.first} comes back up bitten and shaking, with what {a.they} could grab.',
        gives: [{ kind: 'supplies', change: { rations: 5, meds: 1 } }, { kind: 'hurt', amount: 2 }, { kind: 'stress', amount: 6 }],
      },
    ],
  },
  {
    id: 'coal_bunker',
    name: 'The coal bunker',
    intro: 'A pit of old coal by the tracks, black dust over everything.',
    minutes: 15,
    stat: 'brawn',
    outcomes: [
      {
        test: { stat: 'brawn', dc: 8 },
        text: 'Under a foot of coal, a crate someone buried in a hurry: rifle rounds, wrapped in oilcloth.',
        gives: [{ kind: 'supplies', change: { ammo: 10, scrap: 4 } }],
      },
      {
        text: 'Black to the elbows after an hour of shoveling, {a.first} turns up a few rounds and some scrap.',
        gives: [{ kind: 'supplies', change: { ammo: 4, scrap: 4 } }, { kind: 'stress', amount: 3 }],
      },
    ],
  },
  {
    id: 'stationmaster',
    name: 'The stationmaster’s house',
    intro: 'A cottage at the end of the platform. The curtains in the back room are drawn.',
    minutes: 15,
    stat: 'nerve',
    outcomes: [
      {
        test: { stat: 'nerve', dc: 10 },
        text: 'Someone is living in the back room. {a.first} keeps {a.their} voice low and {a.their} hands open, and after a long minute the stranger comes out.',
        gives: [{ kind: 'person' }],
      },
      {
        text: 'Someone was living in the back room, and goes out the window at the sight of {a.first}. They left a pack behind.',
        gives: [{ kind: 'supplies', change: { meds: 2, rations: 4 } }],
      },
    ],
  },
  {
    id: 'engine_shed',
    name: 'The engine shed',
    intro: 'A long shed with its doors shut tight. They were worked from the signal box.',
    minutes: 20,
    stat: 'wits',
    needs: { corner: 'signal_box', locked: 'Shut. Its doors are worked from the signal box.' },
    outcomes: [
      {
        test: { stat: 'wits', dc: 10 },
        text: 'Under a tarp at the back, a mechanic’s tool roll, every tool still in it, and a pile of fittings worth taking apart.',
        gives: [{ kind: 'gear', defId: 'multitool' }, { kind: 'supplies', change: { scrap: 8 } }],
      },
      {
        text: 'Mostly a dead locomotive. {a.first} works loose enough metal to make it worth the trip.',
        gives: [{ kind: 'supplies', change: { scrap: 12 } }],
      },
    ],
  },
];

export function getCorner(id: string): CornerDef {
  const c = CORNERS.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown corner: ${id}`);
  return c;
}
