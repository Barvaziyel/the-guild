/**
 * Decisions at the Depot (§9.5): now and then something needs the player to
 * choose. Four answers, and what follows each isn't written on the button: it
 * depends on who's involved (their traits, stats and how they get along) and
 * on luck. Left unanswered for about a real day, the people involved settle it
 * themselves, usually not the best way.
 *
 * Text placeholders: {a.first}, {b.first}, {s.first} (the stranger), and each
 * role's pronouns: {a.they}, {b.Their}, {s.them}... Survivors are men or women,
 * so verbs are singular: "{a.They} says".
 *
 * Every outcome list is checked in order; the first whose test passes is what
 * happens, and the last one has no test.
 */
import type { Resources, StatId } from '../types.ts';

/** Who an effect or test is about. `home` is everyone at the Depot; `best` is whoever there is best at the stat. */
export type DilemmaWho = 'a' | 'b' | 'both' | 'home';

export type DilemmaTest =
  | { stat: StatId; who: 'a' | 'b' | 'best'; dc: number }
  | { chance: number }
  | { trait: string; who: 'a' | 'b' }
  | { close: true }
  | { apart: true };

export type DilemmaEffect =
  /** Stress up (or down, negative). */
  | { kind: 'stress'; who: DilemmaWho; amount: number }
  /** a and b's relationship; with `stranger`, a and the stranger (who must have joined). */
  | { kind: 'bond'; amount: number; stranger?: true }
  /** How everyone else at the Depot feels about them. */
  | { kind: 'standing'; who: 'a' | 'b'; amount: number }
  /** Every pair at the Depot warms (or cools) by this much. */
  | { kind: 'warm'; amount: number }
  /** Supplies gained (positive) or lost (negative, never below zero). */
  | { kind: 'supplies'; change: Partial<Resources> }
  /** Health lost, never below 1; Wounded under a third. */
  | { kind: 'hurt'; who: DilemmaWho; amount: number }
  | { kind: 'trait'; who: 'a' | 'b'; trait: string }
  | { kind: 'practice'; who: 'a' | 'b'; stat: StatId; amount: number }
  /** The stranger joins, if there's a bed; otherwise they move on in the morning. */
  | { kind: 'joins' }
  /** Word of a place nobody in the guild has found. */
  | { kind: 'reveal' }
  /** Someone new turns up at the gate. */
  | { kind: 'wanderer' };

export interface DilemmaOutcome {
  test?: DilemmaTest;
  text: string;
  effects: readonly DilemmaEffect[];
}

export interface DilemmaChoice {
  label: string;
  outcomes: readonly DilemmaOutcome[];
}

export interface DilemmaDef {
  id: string;
  title: string;
  text: string;
  /** Who it's about: `a` and, for most, `b`. */
  cast: {
    a?: { trait?: string };
    b?: { with?: 'close' | 'apart' | 'partner' };
  };
  /** What has to be true for it to come up. */
  needs?: { supplies?: Partial<Resources>; stranger?: true; undiscovered?: true };
  choices: readonly [DilemmaChoice, DilemmaChoice, DilemmaChoice, DilemmaChoice];
  /** What happens when nobody decides. */
  unanswered: readonly DilemmaOutcome[];
  /** Subject-less Chronicle lines for those involved, whatever was decided. */
  chronicle?: { a?: string; b?: string };
}

export const DILEMMAS: readonly DilemmaDef[] = [
  {
    id: 'good_coat',
    title: 'A good coat',
    text: '{a.first} and {b.first} both swear they saw it first: a thick wool coat, no holes, found in a locker at the back of the station house. Winter is coming. Neither will let go of the sleeve.',
    cast: { a: {}, b: {} },
    chronicle: { a: 'Argued with {b.first} over a good coat.', b: 'Argued with {a.first} over a good coat.' },
    choices: [
      {
        label: 'Give it to {a.first}.',
        outcomes: [
          { test: { close: true }, text: '{b.first} shrugs. "Wear it well." It\'s only a coat, between friends.', effects: [{ kind: 'stress', who: 'a', amount: -5 }] },
          {
            text: '{a.first} wears it to dinner. {b.first} eats somewhere else.',
            effects: [
              { kind: 'stress', who: 'a', amount: -5 },
              { kind: 'stress', who: 'b', amount: 6 },
              { kind: 'bond', amount: -10 },
            ],
          },
        ],
      },
      {
        label: 'Give it to {b.first}.',
        outcomes: [
          { test: { close: true }, text: '{a.first} lets go of the sleeve and laughs. "It never fit me anyway."', effects: [{ kind: 'stress', who: 'b', amount: -5 }] },
          {
            text: '{b.first} wears it everywhere. {a.first} notices every time.',
            effects: [
              { kind: 'stress', who: 'b', amount: -5 },
              { kind: 'stress', who: 'a', amount: 6 },
              { kind: 'bond', amount: -10 },
            ],
          },
        ],
      },
      {
        label: 'Cut it in two.',
        outcomes: [
          {
            test: { chance: 0.35 },
            text: 'Two halves of a good coat. {a.first} starts laughing first, and then neither of them can stop.',
            effects: [
              { kind: 'bond', amount: 8 },
              { kind: 'stress', who: 'both', amount: -4 },
            ],
          },
          { text: 'Two halves of a good coat, and two people who are both cold now. Nobody won, which was the point.', effects: [{ kind: 'stress', who: 'both', amount: 3 }] },
        ],
      },
      {
        label: 'Sell it and be done with it.',
        outcomes: [
          {
            test: { chance: 0.3 },
            text: 'Sewn into the lining: a strip of circuit boards someone was smuggling. The coat fetches six scrap; the boards are worth more.',
            effects: [
              { kind: 'supplies', change: { scrap: 6, tech: 3 } },
              { kind: 'bond', amount: 3 },
            ],
          },
          {
            text: 'It fetches six scrap down the line. {a.first} and {b.first} watch it go and find they\'re not that angry with each other any more.',
            effects: [
              { kind: 'supplies', change: { scrap: 6 } },
              { kind: 'bond', amount: 2 },
            ],
          },
        ],
      },
    ],
    unanswered: [
      {
        test: { stat: 'brawn', who: 'a', dc: 10 },
        text: 'Nobody decided, so they settled it with their fists. {a.first} kept the coat, and {b.first} kept the grudge.',
        effects: [
          { kind: 'bond', amount: -15 },
          { kind: 'hurt', who: 'b', amount: 2 },
          { kind: 'stress', who: 'b', amount: 8 },
        ],
      },
      {
        text: 'Nobody decided, so they settled it with their fists, and {a.first} came off worse. {b.first} has the coat now.',
        effects: [
          { kind: 'bond', amount: -15 },
          { kind: 'hurt', who: 'a', amount: 2 },
          { kind: 'stress', who: 'a', amount: 8 },
        ],
      },
    ],
  },

  {
    id: 'missing_rations',
    title: 'Missing rations',
    text: 'Six rations are gone from the stores, and {b.first} says {a.first} was up in the night. {a.first} says {a.they} only went out for air.',
    cast: { a: {}, b: {} },
    needs: { supplies: { rations: 10 } },
    chronicle: { a: 'Suspected of taking rations from the stores.', b: 'Pointed the finger at {a.first} over missing rations.' },
    choices: [
      {
        label: 'Search {a.first}\'s cot.',
        outcomes: [
          {
            test: { trait: 'greedy', who: 'a' },
            text: 'The rations are under {a.first}\'s blanket, with a few more besides. {a.first} doesn\'t look anyone in the eye for days.',
            effects: [
              { kind: 'supplies', change: { rations: 3 } },
              { kind: 'stress', who: 'a', amount: 10 },
              { kind: 'standing', who: 'a', amount: -5 },
            ],
          },
          {
            text: 'Nothing under the cot but a photo and a knife. {a.first} won\'t forget who pointed, or that you looked.',
            effects: [
              { kind: 'supplies', change: { rations: -6 } },
              { kind: 'stress', who: 'a', amount: 8 },
              { kind: 'bond', amount: -10 },
            ],
          },
        ],
      },
      {
        label: 'Ask everyone, at dinner.',
        outcomes: [
          {
            test: { trait: 'greedy', who: 'a' },
            text: 'Under all those eyes, {a.first} owns up and brings back what {a.they} hasn\'t eaten.',
            effects: [
              { kind: 'supplies', change: { rations: -2 } },
              { kind: 'stress', who: 'a', amount: 6 },
              { kind: 'standing', who: 'a', amount: -3 },
            ],
          },
          {
            test: { chance: 0.4 },
            text: 'It was rats. {b.first} finds the hole behind the shelves the next morning, and apologizes, more or less.',
            effects: [
              { kind: 'supplies', change: { rations: -6 } },
              { kind: 'bond', amount: 4 },
            ],
          },
          {
            text: 'Everyone looks at everyone. Dinner is very quiet, and nobody owns up.',
            effects: [
              { kind: 'supplies', change: { rations: -6 } },
              { kind: 'stress', who: 'home', amount: 3 },
            ],
          },
        ],
      },
      {
        label: 'Let it go, and put a lock on the stores.',
        outcomes: [
          {
            test: { trait: 'greedy', who: 'a' },
            text: 'The lock holds. Somebody rattles it twice in the night, then stops trying.',
            effects: [
              { kind: 'supplies', change: { rations: -6, scrap: -2 } },
              { kind: 'stress', who: 'a', amount: 3 },
            ],
          },
          { text: 'The lock holds, and nothing else goes missing. Nobody ever finds out.', effects: [{ kind: 'supplies', change: { rations: -6, scrap: -2 } }] },
        ],
      },
      {
        label: 'Put {b.first} on the stores at night.',
        outcomes: [
          {
            test: { stat: 'wits', who: 'b', dc: 11 },
            text: 'On the second night {b.first} finds where the rats get in. Nobody stole anything, and {b.first} says so to {a.first}\'s face.',
            effects: [
              { kind: 'supplies', change: { rations: -6 } },
              { kind: 'bond', amount: 6 },
              { kind: 'practice', who: 'b', stat: 'wits', amount: 2 },
            ],
          },
          {
            text: '{b.first} sits up two nights and sees nothing but {b.their} own breath. Tired and sour, {b.they} still blames {a.first}.',
            effects: [
              { kind: 'supplies', change: { rations: -6 } },
              { kind: 'stress', who: 'b', amount: 6 },
              { kind: 'bond', amount: -8 },
            ],
          },
        ],
      },
    ],
    unanswered: [
      {
        text: 'Nobody settled it, so {b.first} did: {b.they} told everyone it was {a.first}. Whether or not it was, it stuck.',
        effects: [
          { kind: 'supplies', change: { rations: -6 } },
          { kind: 'bond', amount: -15 },
          { kind: 'standing', who: 'a', amount: -5 },
        ],
      },
    ],
  },

  {
    id: 'stranger_at_gate',
    title: 'Someone at the gate',
    text: 'A stranger stands at the gate at dusk: {s.first}, thin, a pack too light for the road. {a.first} found {s.them} and wants to know what to do. {s.They} won\'t say where {s.they} came from.',
    cast: { a: {} },
    needs: { stranger: true },
    chronicle: { a: 'Found {s.first} at the gate at dusk.' },
    choices: [
      {
        label: 'Let {s.them} in.',
        outcomes: [
          {
            test: { chance: 0.15 },
            text: '{s.first} was gone before dawn, and so were some of the supplies.',
            effects: [
              { kind: 'supplies', change: { scrap: -8, ammo: -5 } },
              { kind: 'stress', who: 'a', amount: 5 },
            ],
          },
          {
            test: { chance: 0.18 },
            text: '{s.first} stays, and brings a fever in with {s.them}. {a.first} catches it first.',
            effects: [{ kind: 'joins' }, { kind: 'trait', who: 'a', trait: 'feverish' }],
          },
          { text: '{s.first} stays. {s.They} eats like {s.they} hasn\'t in a week, and is up before anyone to help.', effects: [{ kind: 'joins' }] },
        ],
      },
      {
        label: 'Feed {s.them} and send {s.them} on.',
        outcomes: [
          {
            test: { chance: 0.3 },
            text: '{s.first} eats, thanks everyone twice, and leaves at first light. Two days later there\'s a bundle at the gate: radio parts, wrapped in a shirt.',
            effects: [
              { kind: 'supplies', change: { rations: -2, tech: 3 } },
              { kind: 'stress', who: 'home', amount: -2 },
            ],
          },
          {
            text: '{s.first} eats and goes. It felt right, and everyone sleeps a little better.',
            effects: [
              { kind: 'supplies', change: { rations: -2 } },
              { kind: 'stress', who: 'home', amount: -3 },
            ],
          },
        ],
      },
      {
        label: 'Turn {s.them} away.',
        outcomes: [
          {
            test: { trait: 'generous', who: 'a' },
            text: '{a.first} does as {a.they} is told, and slips {s.first} a ration through the fence anyway. {a.They} doesn\'t sleep well.',
            effects: [
              { kind: 'supplies', change: { rations: -1 } },
              { kind: 'stress', who: 'a', amount: 6 },
            ],
          },
          { text: '{s.first} goes without a word. {a.first} watches {s.them} until the road bends.', effects: [{ kind: 'stress', who: 'a', amount: 3 }] },
        ],
      },
      {
        label: 'Make {s.them} earn a place: a night on watch with {a.first}.',
        outcomes: [
          {
            test: { stat: 'wits', who: 'a', dc: 11 },
            text: '{a.first} keeps one eye on the road and one on {s.first}. {s.first} doesn\'t close {s.their} eyes all night, and in the morning {a.first} vouches for {s.them}.',
            effects: [{ kind: 'joins' }, { kind: 'bond', amount: 15, stranger: true }, { kind: 'practice', who: 'a', stat: 'nerve', amount: 1 }],
          },
          {
            text: 'Some time after midnight {s.first} was gone, and so was {a.first}\'s good knife. {a.first} slept through it.',
            effects: [
              { kind: 'supplies', change: { scrap: -4 } },
              { kind: 'stress', who: 'a', amount: 6 },
            ],
          },
        ],
      },
    ],
    unanswered: [{ text: 'Nobody decided, and by morning {s.first} had moved on, with a few rations from the stores.', effects: [{ kind: 'supplies', change: { rations: -3 } }] }],
  },

  {
    id: 'light_on_the_hill',
    title: 'A light on the hill',
    text: 'There\'s been a light on the hill past the rail yard three nights running. {a.first} wants to go and look, alone, tonight. "In and out. Nobody needs to come."',
    cast: { a: {}, b: {} },
    chronicle: { a: 'Wanted to find out what the light on the hill was.' },
    choices: [
      {
        label: 'Let {a.first} go.',
        outcomes: [
          {
            test: { stat: 'wits', who: 'a', dc: 12 },
            text: '{a.first} comes back at dawn with a tin of meds and a story about an old man who wouldn\'t come down.',
            effects: [
              { kind: 'supplies', change: { meds: 4 } },
              { kind: 'practice', who: 'a', stat: 'wits', amount: 2 },
              { kind: 'stress', who: 'a', amount: -4 },
            ],
          },
          { test: { stat: 'nerve', who: 'a', dc: 10 }, text: '{a.first} found nothing up there but a cold camp and the feeling of being watched, and came back fast.', effects: [{ kind: 'stress', who: 'a', amount: 8 }] },
          {
            text: '{a.first} came back limping, with no light and no story {a.they} will tell.',
            effects: [
              { kind: 'hurt', who: 'a', amount: 5 },
              { kind: 'stress', who: 'a', amount: 10 },
            ],
          },
        ],
      },
      {
        label: 'Send {b.first} along.',
        outcomes: [
          {
            test: { close: true },
            text: 'They go together and come back laughing, with a crate of shells the old camp left behind.',
            effects: [
              { kind: 'supplies', change: { ammo: 8 } },
              { kind: 'bond', amount: 8 },
            ],
          },
          {
            test: { stat: 'aim', who: 'b', dc: 11 },
            text: 'Something was waiting up there. {b.first} saw it first. They come back shaken, with the shells they went for.',
            effects: [
              { kind: 'supplies', change: { ammo: 6 } },
              { kind: 'stress', who: 'both', amount: 6 },
              { kind: 'bond', amount: 6 },
            ],
          },
          {
            text: 'They argued all the way up and all the way down, and found nothing.',
            effects: [
              { kind: 'bond', amount: -6 },
              { kind: 'stress', who: 'both', amount: 3 },
            ],
          },
        ],
      },
      {
        label: 'Forbid it.',
        outcomes: [
          {
            test: { trait: 'curious', who: 'a' },
            text: '{a.first} goes anyway, after midnight, and is back in {a.their} cot before anyone notices. {a.They} leaves a radio part on the workbench and says nothing.',
            effects: [
              { kind: 'supplies', change: { tech: 2 } },
              { kind: 'standing', who: 'a', amount: -2 },
            ],
          },
          { text: '{a.first} sulks for a day, then lets it go. The light goes out on its own.', effects: [{ kind: 'stress', who: 'a', amount: 5 }] },
        ],
      },
      {
        label: 'Tell {a.first} to wait for a proper crew.',
        outcomes: [
          { test: { chance: 0.5 }, text: 'By the time a crew could go, the light was gone, and so was whoever made it. {a.first} keeps looking at the hill.', effects: [{ kind: 'stress', who: 'a', amount: 3 }] },
          { text: 'The light comes back every night. {a.first} stops talking about it, which is worse.', effects: [{ kind: 'stress', who: 'a', amount: 6 }] },
        ],
      },
    ],
    unanswered: [
      {
        test: { stat: 'wits', who: 'a', dc: 13 },
        text: 'Nobody answered, so {a.first} took that for a yes and went. {a.They} came back with a tin of meds.',
        effects: [{ kind: 'supplies', change: { meds: 3 } }],
      },
      {
        text: 'Nobody answered, so {a.first} took that for a yes and went. {a.They} came back hurt, and won\'t say how.',
        effects: [
          { kind: 'hurt', who: 'a', amount: 5 },
          { kind: 'stress', who: 'a', amount: 8 },
        ],
      },
    ],
  },

  {
    id: 'bad_blood',
    title: 'Bad blood at dinner',
    text: '{a.first} and {b.first} were at it again over dinner, and this time the plates went flying. The others want it settled.',
    cast: { a: {}, b: { with: 'apart' } },
    chronicle: { a: 'Came to blows with {b.first} over dinner.', b: 'Came to blows with {a.first} over dinner.' },
    choices: [
      {
        label: 'Put them to work together for a week.',
        outcomes: [
          {
            test: { stat: 'nerve', who: 'a', dc: 11 },
            text: 'A week of digging the same beds. By the end they\'re not friends, but they\'ve stopped counting each other\'s mistakes.',
            effects: [{ kind: 'bond', amount: 15 }],
          },
          {
            text: 'A week of digging the same beds, in silence. On the eighth day {b.first} asks for any other job in the Reach.',
            effects: [
              { kind: 'bond', amount: -5 },
              { kind: 'stress', who: 'both', amount: 4 },
            ],
          },
        ],
      },
      {
        label: 'Keep them apart.',
        outcomes: [{ text: 'They take turns at the fire. It works, mostly. Nobody enjoys the arrangement.', effects: [{ kind: 'stress', who: 'both', amount: 2 }] }],
      },
      {
        label: 'Let them fight it out.',
        outcomes: [
          {
            test: { stat: 'brawn', who: 'a', dc: 11 },
            text: '{a.first} puts {b.first} in the dirt and offers a hand. To everyone\'s surprise, {b.first} takes it.',
            effects: [
              { kind: 'hurt', who: 'b', amount: 3 },
              { kind: 'bond', amount: 10 },
            ],
          },
          {
            test: { chance: 0.4 },
            text: '{b.first} wins, {a.first} limps for days, and it is not over.',
            effects: [
              { kind: 'hurt', who: 'a', amount: 3 },
              { kind: 'bond', amount: -10 },
            ],
          },
          {
            text: 'Nobody wins. Both are bruised, and the guild is two pairs of hands short for a day.',
            effects: [
              { kind: 'hurt', who: 'both', amount: 2 },
              { kind: 'bond', amount: -5 },
              { kind: 'stress', who: 'home', amount: 2 },
            ],
          },
        ],
      },
      {
        label: 'Make them apologize, in front of everyone.',
        outcomes: [
          {
            test: { chance: 0.35 },
            text: 'Through their teeth, they do. Something shifts, a little.',
            effects: [
              { kind: 'bond', amount: 8 },
              { kind: 'stress', who: 'both', amount: 3 },
            ],
          },
          {
            text: 'They say the words. Nobody believes them, least of all each other.',
            effects: [
              { kind: 'bond', amount: -4 },
              { kind: 'stress', who: 'both', amount: 6 },
            ],
          },
        ],
      },
    ],
    unanswered: [
      {
        text: 'Nobody stepped in, so they settled it behind the freight cars. Both came back bloody, and nothing is settled.',
        effects: [
          { kind: 'hurt', who: 'both', amount: 3 },
          { kind: 'bond', amount: -15 },
          { kind: 'stress', who: 'home', amount: 3 },
        ],
      },
    ],
  },

  {
    id: 'grief',
    title: 'Grief at the fire',
    text: '{a.first} hasn\'t eaten since the news. Tonight {a.they} asked whether the guild would do something, anything, to mark it.',
    cast: { a: { trait: 'grieving' }, b: {} },
    chronicle: { a: 'Asked the guild to mark the loss.' },
    choices: [
      {
        label: 'Hold a wake, with the good rations.',
        outcomes: [
          {
            text: 'Everyone eats, someone sings badly, and {a.first} laughs for the first time in days.',
            effects: [
              { kind: 'supplies', change: { rations: -6 } },
              { kind: 'stress', who: 'home', amount: -8 },
              { kind: 'stress', who: 'a', amount: -6 },
              { kind: 'warm', amount: 2 },
            ],
          },
        ],
      },
      {
        label: 'Ask {b.first} to sit with {a.first}.',
        outcomes: [
          {
            test: { close: true },
            text: '{b.first} sits up with {a.first} all night. Neither of them says much. It helps.',
            effects: [
              { kind: 'bond', amount: 10 },
              { kind: 'stress', who: 'a', amount: -8 },
            ],
          },
          {
            text: '{b.first} tries. {a.first} sends {b.them} away after an hour.',
            effects: [
              { kind: 'bond', amount: -3 },
              { kind: 'stress', who: 'a', amount: 2 },
            ],
          },
        ],
      },
      {
        label: 'Give {a.first} work to do.',
        outcomes: [
          {
            test: { stat: 'nerve', who: 'a', dc: 10 },
            text: 'Work helps. {a.first} rebuilds the Garden fence by hand, every post of it.',
            effects: [
              { kind: 'practice', who: 'a', stat: 'brawn', amount: 2 },
              { kind: 'stress', who: 'a', amount: -4 },
            ],
          },
          {
            text: '{a.first} goes through the motions, and breaks two tools doing it.',
            effects: [
              { kind: 'supplies', change: { scrap: -3 } },
              { kind: 'stress', who: 'a', amount: 4 },
            ],
          },
        ],
      },
      {
        label: 'Leave {a.first} be.',
        outcomes: [
          { test: { chance: 0.3 }, text: 'Some things you get through alone. {a.first} does.', effects: [{ kind: 'stress', who: 'a', amount: -5 }] },
          { text: '{a.first} keeps to {a.themself}, and the guild lets {a.them}.', effects: [{ kind: 'stress', who: 'a', amount: 4 }] },
        ],
      },
    ],
    unanswered: [
      {
        text: '{a.first} took the guild\'s silence as an answer.',
        effects: [
          { kind: 'stress', who: 'a', amount: 8 },
          { kind: 'standing', who: 'a', amount: -4 },
        ],
      },
    ],
  },

  {
    id: 'floorboards',
    title: 'Under the floorboards',
    text: '{b.first} found a stash under the floorboards by {a.first}\'s cot: scrap, a few rations, a box of shells. {a.first} says {a.they} was saving it for a bad winter.',
    cast: { a: { trait: 'greedy' }, b: {} },
    chronicle: { a: 'Caught keeping a stash under the floorboards.', b: 'Found {a.first}\'s stash under the floorboards.' },
    choices: [
      {
        label: 'Into the stores, all of it.',
        outcomes: [
          {
            text: '{a.first} hands it over without a word, and eats alone for a week.',
            effects: [
              { kind: 'supplies', change: { scrap: 8, rations: 4, ammo: 6 } },
              { kind: 'stress', who: 'a', amount: 8 },
              { kind: 'bond', amount: -8 },
            ],
          },
        ],
      },
      {
        label: 'Let {a.first} keep it.',
        outcomes: [
          {
            text: '{a.first} keeps it, and {b.first} makes sure everyone hears about it.',
            effects: [
              { kind: 'stress', who: 'a', amount: -4 },
              { kind: 'standing', who: 'a', amount: -5 },
              { kind: 'bond', amount: -5 },
            ],
          },
        ],
      },
      {
        label: 'Split it: half to the stores.',
        outcomes: [
          {
            test: { chance: 0.5 },
            text: '{a.first} takes the deal, a little ashamed and a little relieved.',
            effects: [
              { kind: 'supplies', change: { scrap: 4, rations: 2, ammo: 3 } },
              { kind: 'stress', who: 'a', amount: 2 },
            ],
          },
          { text: '{a.first} takes the deal, and starts a new stash the same night.', effects: [{ kind: 'supplies', change: { scrap: 4, rations: 2, ammo: 3 } }] },
        ],
      },
      {
        label: 'Put {a.first} in charge of the stores.',
        outcomes: [
          {
            test: { stat: 'wits', who: 'a', dc: 11 },
            text: 'Set someone who hoards to count the shelves: {a.first} knows every trick, and nothing goes missing on {a.their} watch.',
            effects: [
              { kind: 'supplies', change: { scrap: 8, rations: 4, ammo: 6 } },
              { kind: 'practice', who: 'a', stat: 'wits', amount: 2 },
              { kind: 'stress', who: 'a', amount: -3 },
            ],
          },
          { text: 'It seemed clever at the time. By the end of the week the shelves are a little lighter.', effects: [{ kind: 'supplies', change: { rations: -5, scrap: -4 } }] },
        ],
      },
    ],
    unanswered: [
      {
        text: '{a.first} moved the stash before anyone decided anything. Nobody knows where it is now.',
        effects: [
          { kind: 'bond', amount: -8 },
          { kind: 'standing', who: 'a', amount: -3 },
        ],
      },
    ],
  },

  {
    id: 'sick_child',
    title: 'A sick child',
    text: 'A woman from the road is at the gate with a feverish boy. She has nothing to trade, and asks for medicine. {a.first} is looking at you.',
    cast: { a: {} },
    needs: { supplies: { meds: 3 } },
    chronicle: { a: 'Was at the gate when a woman came asking for medicine for her boy.' },
    choices: [
      {
        label: 'Give her the meds she needs.',
        outcomes: [
          {
            test: { chance: 0.4 },
            text: 'Two weeks later she\'s back, the boy walking beside her, with a sack of shells she says she owes.',
            effects: [
              { kind: 'supplies', change: { meds: -3, ammo: 10 } },
              { kind: 'stress', who: 'home', amount: -4 },
            ],
          },
          {
            text: 'She cries, and goes. Everyone at the Depot stands a little straighter.',
            effects: [
              { kind: 'supplies', change: { meds: -3 } },
              { kind: 'stress', who: 'home', amount: -4 },
            ],
          },
        ],
      },
      {
        label: 'Give her one dose.',
        outcomes: [
          {
            test: { chance: 0.5 },
            text: 'One dose is enough. She sends word with a caravan a week later: he lived.',
            effects: [
              { kind: 'supplies', change: { meds: -1 } },
              { kind: 'stress', who: 'home', amount: -2 },
            ],
          },
          {
            text: 'One dose wasn\'t enough. Nobody hears what happened to them, and nobody asks.',
            effects: [
              { kind: 'supplies', change: { meds: -1 } },
              { kind: 'stress', who: 'home', amount: 3 },
              { kind: 'stress', who: 'a', amount: 4 },
            ],
          },
        ],
      },
      {
        label: 'Turn her away.',
        outcomes: [
          { test: { trait: 'cynic', who: 'a' }, text: '{a.first} closes the gate. "We can\'t save everyone." {a.They} believes it, mostly.', effects: [] },
          {
            text: '{a.first} closes the gate, and doesn\'t talk for the rest of the day.',
            effects: [
              { kind: 'stress', who: 'a', amount: 6 },
              { kind: 'stress', who: 'home', amount: 2 },
            ],
          },
        ],
      },
      {
        label: 'Ask what she can do in return.',
        outcomes: [
          {
            test: { chance: 0.35 },
            text: 'She was a nurse, before. She stays three days, sets a broken finger, and leaves the Infirmary better stocked than she found it.',
            effects: [
              { kind: 'supplies', change: { meds: 2 } },
              { kind: 'practice', who: 'a', stat: 'wits', amount: 2 },
            ],
          },
          {
            text: 'She can\'t do anything but beg, and she\'s too proud for that. She leaves.',
            effects: [{ kind: 'stress', who: 'a', amount: 3 }],
          },
        ],
      },
    ],
    unanswered: [{ text: 'By the time anyone thought to answer, she had gone.', effects: [{ kind: 'stress', who: 'home', amount: 2 }] }],
  },

  {
    id: 'whose_kill',
    title: 'Whose kill was it?',
    text: 'Back from the Reach, {a.first} and {b.first} both tell the story of the same kill, and only one of them can be right. The guild is taking sides.',
    cast: { a: {}, b: {} },
    chronicle: { a: 'Argued with {b.first} over whose kill it was.', b: 'Argued with {a.first} over whose kill it was.' },
    choices: [
      {
        label: 'Back {a.first}.',
        outcomes: [
          { test: { close: true }, text: 'Friends can laugh it off. {b.first} pours the next round.', effects: [{ kind: 'bond', amount: 2 }] },
          {
            text: '{b.first} goes quiet, and stays quiet.',
            effects: [
              { kind: 'bond', amount: -8 },
              { kind: 'stress', who: 'b', amount: 5 },
              { kind: 'standing', who: 'a', amount: 2 },
            ],
          },
        ],
      },
      {
        label: 'Back {b.first}.',
        outcomes: [
          { test: { close: true }, text: '{a.first} grins and lets {b.first} have it. "Next one\'s mine."', effects: [{ kind: 'bond', amount: 2 }] },
          {
            text: '{a.first} goes quiet, and stays quiet.',
            effects: [
              { kind: 'bond', amount: -8 },
              { kind: 'stress', who: 'a', amount: 5 },
              { kind: 'standing', who: 'b', amount: 2 },
            ],
          },
        ],
      },
      {
        label: 'Say it was both of them.',
        outcomes: [
          { test: { chance: 0.5 }, text: 'Good enough. They drink to it.', effects: [{ kind: 'bond', amount: 5 }] },
          { text: 'Neither of them likes sharing it.', effects: [{ kind: 'bond', amount: -3 }] },
        ],
      },
      {
        label: 'Tell them nobody cares who killed what.',
        outcomes: [
          {
            test: { trait: 'hothead', who: 'a' },
            text: '{a.first} cares, a lot, and says so with a chair.',
            effects: [
              { kind: 'hurt', who: 'b', amount: 1 },
              { kind: 'bond', amount: -10 },
            ],
          },
          { text: 'It ends the argument and spoils the evening.', effects: [{ kind: 'stress', who: 'both', amount: 3 }] },
        ],
      },
    ],
    unanswered: [
      {
        test: { stat: 'aim', who: 'a', dc: 11 },
        text: 'They settled it with a shooting contest at dawn and two wasted boxes of shells. {a.first} won, and {b.first} says the wind changed.',
        effects: [
          { kind: 'supplies', change: { ammo: -6 } },
          { kind: 'bond', amount: -5 },
          { kind: 'stress', who: 'b', amount: 4 },
        ],
      },
      {
        text: 'They settled it with a shooting contest at dawn and two wasted boxes of shells. {b.first} won, and {a.first} wants a rematch.',
        effects: [
          { kind: 'supplies', change: { ammo: -6 } },
          { kind: 'bond', amount: -5 },
          { kind: 'stress', who: 'a', amount: 4 },
        ],
      },
    ],
  },

  {
    id: 'old_map',
    title: 'An old map',
    text: '{a.first} found a map in the station master\'s desk, marked in red pencil. Most of the marks are places the guild knows. One isn\'t.',
    cast: { a: {} },
    needs: { undiscovered: true },
    chronicle: { a: 'Found an old map in the station master\'s desk.' },
    choices: [
      {
        label: 'Trust the map.',
        outcomes: [
          {
            test: { chance: 0.6 },
            text: 'The red mark is real: {place}, a place nobody in the guild has seen. It\'s on the Reach map now.',
            effects: [{ kind: 'reveal' }, { kind: 'practice', who: 'a', stat: 'wits', amount: 1 }],
          },
          { text: 'The red mark is a gas station that burned down years ago. {a.first} keeps the map anyway.', effects: [{ kind: 'stress', who: 'a', amount: 2 }] },
        ],
      },
      {
        label: 'Sell it to a caravan.',
        outcomes: [{ text: 'A trader pays eight scrap for it, and seems pleased about it, which is worrying.', effects: [{ kind: 'supplies', change: { scrap: 8 } }] }],
      },
      {
        label: 'Have {a.first} check it against the radio chatter.',
        outcomes: [
          { test: { stat: 'wits', who: 'a', dc: 10 }, text: '{a.first} matches the mark to a call sign that keeps coming up: {place}. It\'s on the Reach map now.', effects: [{ kind: 'reveal' }] },
          { text: 'Nights of static, and nothing that matches. The map goes in a drawer.', effects: [{ kind: 'stress', who: 'a', amount: 2 }] },
        ],
      },
      {
        label: 'Burn it. Maps get people killed.',
        outcomes: [
          { test: { trait: 'cautious', who: 'a' }, text: '"Good," says {a.first}, and feeds it to the fire {a.themself}.', effects: [{ kind: 'stress', who: 'a', amount: -3 }] },
          { text: '{a.first} watches it burn. "You might be right." {a.They} doesn\'t sound sure.', effects: [{ kind: 'stress', who: 'a', amount: 3 }] },
        ],
      },
    ],
    unanswered: [{ text: '{a.first} pinned the map above {a.their} cot, and stares at it every night.', effects: [{ kind: 'stress', who: 'a', amount: 3 }] }],
  },

  {
    id: 'party',
    title: 'They want a party',
    text: '{a.first} and {b.first} want to mark their time together. They\'d like the whole guild there, and the good rations.',
    cast: { a: {}, b: { with: 'partner' } },
    needs: { supplies: { rations: 10 } },
    chronicle: { a: 'Asked the guild for a party with {b.first}.', b: 'Asked the guild for a party with {a.first}.' },
    choices: [
      {
        label: 'Throw the party.',
        outcomes: [
          {
            text: 'Someone finds a fiddle, someone else finds a bottle, and for one night the Reach is a long way off.',
            effects: [
              { kind: 'supplies', change: { rations: -10 } },
              { kind: 'stress', who: 'home', amount: -10 },
              { kind: 'warm', amount: 2 },
            ],
          },
        ],
      },
      {
        label: 'A toast, nothing more.',
        outcomes: [
          {
            text: 'A toast at the fire. It\'s enough for them.',
            effects: [
              { kind: 'supplies', change: { rations: -2 } },
              { kind: 'stress', who: 'both', amount: -5 },
            ],
          },
        ],
      },
      {
        label: 'Not now.',
        outcomes: [
          {
            test: { chance: 0.3 },
            text: 'They throw it anyway, behind the freight cars, with rations they\'d been saving.',
            effects: [
              { kind: 'supplies', change: { rations: -4 } },
              { kind: 'stress', who: 'both', amount: -5 },
            ],
          },
          { text: 'They take it well, to your face.', effects: [{ kind: 'stress', who: 'both', amount: 5 }] },
        ],
      },
      {
        label: 'Make it a feast for anyone on the road.',
        outcomes: [
          {
            test: { chance: 0.5 },
            text: 'Word gets around. Travelers come in for the food, and one of them asks to stay.',
            effects: [
              { kind: 'supplies', change: { rations: -16 } },
              { kind: 'stress', who: 'home', amount: -10 },
              { kind: 'wanderer' },
            ],
          },
          {
            text: 'Half the Reach seems to come, eat, and leave.',
            effects: [
              { kind: 'supplies', change: { rations: -16 } },
              { kind: 'stress', who: 'home', amount: -6 },
            ],
          },
        ],
      },
    ],
    unanswered: [
      {
        text: 'Nobody answered, so they threw it themselves, with the rations they thought they had coming.',
        effects: [
          { kind: 'supplies', change: { rations: -8 } },
          { kind: 'stress', who: 'both', amount: -6 },
        ],
      },
    ],
  },

  {
    id: 'asleep_on_watch',
    title: 'Asleep on watch',
    text: '{b.first} says {a.first} was asleep on watch last night. {a.first} says {a.they} was resting {a.their} eyes. Anything could have walked in.',
    cast: { a: {}, b: {} },
    chronicle: { a: 'Accused by {b.first} of sleeping on watch.', b: 'Caught {a.first} asleep on watch.' },
    choices: [
      {
        label: 'Double watches for {a.first}.',
        outcomes: [
          {
            test: { stat: 'nerve', who: 'a', dc: 10 },
            text: '{a.first} takes it, and doesn\'t close {a.their} eyes on watch again.',
            effects: [
              { kind: 'practice', who: 'a', stat: 'nerve', amount: 2 },
              { kind: 'stress', who: 'a', amount: 6 },
            ],
          },
          {
            text: '{a.first} takes it badly, and blames {b.first} for every hour of it.',
            effects: [
              { kind: 'stress', who: 'a', amount: 8 },
              { kind: 'bond', amount: -8 },
            ],
          },
        ],
      },
      {
        label: 'Believe {a.first}.',
        outcomes: [
          { test: { chance: 0.6 }, text: 'Nothing comes of it, except that {b.first} feels nobody listened.', effects: [{ kind: 'bond', amount: -4 }] },
          {
            text: 'Two nights later, someone cut through the fence while {a.first} watched the stars, and took scrap before anyone woke.',
            effects: [
              { kind: 'supplies', change: { scrap: -10 } },
              { kind: 'stress', who: 'home', amount: 4 },
            ],
          },
        ],
      },
      {
        label: 'Put {b.first} on watch with {a.first}.',
        outcomes: [
          { test: { close: true }, text: 'Two on watch talk the night away. Nobody sleeps, and nothing gets in.', effects: [{ kind: 'bond', amount: 6 }] },
          {
            text: 'Two on watch who can\'t stand each other: nobody sleeps, out of spite.',
            effects: [
              { kind: 'bond', amount: -6 },
              { kind: 'stress', who: 'both', amount: 3 },
            ],
          },
        ],
      },
      {
        label: 'Let it go.',
        outcomes: [
          {
            text: '{b.first} lets it go too, loudly, to anyone who will listen.',
            effects: [
              { kind: 'standing', who: 'a', amount: -3 },
              { kind: 'stress', who: 'b', amount: 3 },
            ],
          },
        ],
      },
    ],
    unanswered: [
      {
        text: '{b.first} told everyone, and nobody has trusted {a.first} with a watch since.',
        effects: [
          { kind: 'standing', who: 'a', amount: -5 },
          { kind: 'stress', who: 'a', amount: 5 },
        ],
      },
    ],
  },
];

export function getDilemma(id: string): DilemmaDef {
  const d = DILEMMAS.find((x) => x.id === id);
  if (!d) throw new Error(`Unknown dilemma: ${id}`);
  return d;
}
