import type { EnemyType } from './enemies.ts';
import type { HazardKind } from './locations.ts';

/**
 * Text pools for run logs. Placeholders:
 *   {a.first} {a.they} {a.their} ... (and {b.*}) for survivors, see text.ts fillRoles()
 *   {loc} location name, {group} / {Group} enemy group ("three Rad-hounds")
 * The event content pack (roadmap PR 4) grows these pools.
 *
 * Runs can be one person. A pool that talks about the group ("the crew",
 * "everyone") is a CrewLines with separate lines for someone alone, where
 * {a} is that person; other pools are written to read right either way.
 */

/** Lines for a crew of two or more, and for someone out alone ({a} is them). */
export interface CrewLines {
  crew: readonly string[];
  solo: readonly string[];
}

export const DEPART_LINES: CrewLines = {
  crew: [
    'The crew checks their gear one last time and heads out for {loc}.',
    'The Depot gate rattles shut behind them. {loc} is waiting.',
    'Packs on, heads down. The crew sets off toward {loc}.',
  ],
  solo: [
    '{a.first} shoulders {a.their} pack and heads out for {loc} alone.',
    '{a.first} slips out of the Depot gate without a word, bound for {loc}.',
  ],
};

export const COMBAT_INTROS: Record<EnemyType, readonly string[]> = {
  feral: [
    'A low growl, then another. {Group}, coming in fast.',
    'Eyes shine in the undergrowth. {Group} have caught the scent.',
    'Something moves at the edge of sight. Then it stops pretending: {group}.',
  ],
  raider: [
    '{Group} step out from cover, weapons already up.',
    'A whistle from the rooftops. {Group}, and they want the packs.',
    'Voices ahead, then silence. {Group} are already looking this way.',
  ],
  hollow: [
    'A wet, dragging sound. {Group} shamble out of the dark.',
    'What looked like bodies starts to get up. {Group}.',
    'A smell like burnt hair arrives first. Then {group}.',
  ],
  scrapbot: [
    'A red light blinks on. "PRESENT IDENTIFICATION." {Group}.',
    'Servos whine somewhere ahead. {Group}, still on patrol after forty years.',
    'A speaker crackles: "THIS AREA IS RESTRICTED." {Group} roll into view.',
  ],
};

export const AMBUSHED_LINES = [
  'Nobody saw it coming.',
  'They attack before there is time to shout.',
  'There is no time to pick ground.',
] as const;

export const SPOTTED_LINES = [
  '{a.first} spots them first.',
  '{a.first} raises a fist: movement ahead.',
] as const;

export const DROP_LINES: CrewLines = {
  crew: ['{a.first} spots them early enough to pick the ground. The crew strikes first.', 'Thanks to {a.first}, the crew has the drop on them.'],
  solo: ['{a.first} spots them early enough to pick the ground, and strikes first.', '{a.first} sees them long before they see {a.them}.'],
};

export const SNEAK_PAST_LINES: CrewLines = {
  crew: [
    'The crew goes to ground and waits. Even {a.first} manages not to make a sound. The danger passes, close enough to smell.',
    'They take the long way round, {a.first} placing every step with care. Nobody sees them.',
  ],
  solo: [
    '{a.first} goes to ground and waits without a sound. The danger passes, close enough to smell.',
    '{a.first} takes the long way round, placing every step with care. Nobody sees a thing.',
  ],
};

export const SNEAK_FAIL_LINES: CrewLines = {
  crew: ['{a.first} kicks a loose can. Every head turns.', 'The crew tries to slip past, but {a.first} is not quiet enough.'],
  solo: ['{a.first} kicks a loose can. Every head turns.', '{a.first} tries to slip past, but not quietly enough.'],
};

export const INTIMIDATE_SUCCESS = [
  '{a.first} steps forward and stares them down. They decide this is not worth dying over.',
  '{a.first} says a few quiet words. The raiders back away, hands off their weapons.',
] as const;

export const INTIMIDATE_FAIL = [
  '{a.first} tries to warn them off. They laugh.',
  '{a.first} tells them to walk away. They do not.',
] as const;

export const CALM_SUCCESS = [
  '{a.first} crouches, speaks low and holds very still. The animals circle once and slink away.',
  '{a.first} tosses a scrap of food and keeps talking. Somehow, it works. They leave.',
] as const;

export const CALM_FAIL = [
  '{a.first} tries to calm them. They are too hungry to listen.',
] as const;

export const ENEMIES_BREAK = [
  'The rest lose their nerve and run.',
  'What is left of them breaks and scatters.',
  'That is enough for the rest of them. They bolt.',
] as const;

export const FLEE_LINES: CrewLines = {
  crew: ['{a.first} panics and bolts.', "{a.first}'s nerve goes. {a.They} {a.is} gone before anyone can call out."],
  solo: ['{a.first} panics and bolts.', "{a.first}'s nerve goes, and {a.first} runs."],
};

export const WITHDRAW_SUCCESS: CrewLines = {
  crew: ['{a.first} calls the retreat. The crew falls back in good order.', '"Back! Back!" {a.first} gets everyone out.'],
  solo: ['{a.first} backs away step by step, and gets clear.', '{a.first} breaks off and makes it out.'],
};

export const WITHDRAW_FAIL: CrewLines = {
  crew: ['{a.first} calls the retreat, but they are pressed too hard to break away clean.'],
  solo: ['{a.first} tries to break away, but is pressed too hard to get clear.'],
};

export const STALEMATE_LINES = [
  'Neither side can finish it. Both pull back, each watching the other go.',
] as const;

export const SCAVENGE_INTROS: CrewLines = {
  crew: ['The crew spreads out to search.', 'Time to see what is left here.', 'They work through the place room by room.'],
  solo: ['Time to see what is left here.', '{a.first} works through the place room by room.', '{a.first} starts searching, slow and careful.'],
};

export const SCAVENGE_NOTHING = [
  '{a.first} finds nothing worth carrying.',
  '{a.first} comes up empty.',
  'Whatever was here, someone beat {a.first} to it.',
] as const;

export const POCKET_CAUGHT = [
  '{b.first} catches {a.first} slipping something into {a.their} own pocket. Words are exchanged.',
  '{b.first} sees {a.first} palm part of the haul. It gets ugly.',
] as const;

export const TRAVEL_FIND = [
  '{a.first} kicks over a crate on the way and finds a little scrap.',
  '{a.first} pries a few useful bits off a wreck along the way.',
] as const;

export const HAZARD_TEXT: Record<
  HazardKind,
  { title: string; intro: readonly string[]; avoided: readonly string[]; hit: readonly string[]; cause: string }
> = {
  radiation: {
    title: 'Hot Zone',
    intro: ['The air tastes of metal. Skin prickles.', 'A dead patch: no birds, no insects, no moss.'],
    avoided: [
      "{a.first}'s Geiger counter starts chattering. Time to back off and go around.",
    ],
    hit: ['{a.first} is retching long before the air clears.', '{a.first} comes out of it grey and shaking.'],
    cause: 'radiation',
  },
  collapse: {
    title: 'Collapse',
    intro: ['The floor groans.', 'Dust trickles from the ceiling. Then more than dust.'],
    avoided: ['{a.first} hears it go and gets clear just in time.', '{a.first} spots the cracks and finds another way through.'],
    hit: ['{a.first} is caught under falling rubble.', 'The floor gives way under {a.first}.'],
    cause: 'a collapse',
  },
  storm: {
    title: 'Dust Storm',
    intro: ['The sky goes brown. A dust storm rolls in off the flats.', 'Wind first, then grit, then nothing but noise.'],
    avoided: ['{a.first} shrugs it off.'],
    hit: ['{a.first} is battered and half-blind by the time it passes.', 'The storm takes it out of {a.first}.'],
    cause: 'a dust storm',
  },
  trap: {
    title: 'Trap',
    intro: ['Someone has been here, and did not want company.', 'A wire glints across the path.'],
    avoided: ['{a.first} spots the tripwire in time and steps over it.', '{a.first} finds the trap before it finds anyone.'],
    hit: ['{a.first} trips a wire. A scrap-bomb goes off.', '{a.first} steps on a spike trap.'],
    cause: 'a trap',
  },
  toxic: {
    title: 'Bad Air',
    intro: ['A sweet chemical smell hangs in the air.', 'Pale spores drift in the light.'],
    avoided: ['{a.first} breathes shallow and gets through fine.'],
    hit: ['{a.first} doubles over coughing.', '{a.first} staggers out with streaming eyes.'],
    cause: 'bad air',
  },
};

export interface SocialText {
  title: string;
  lines: readonly string[];
}

export const SOCIAL_ARGUMENT: SocialText = {
  title: 'Argument',
  lines: [
    '{a.first} and {b.first} argue about the route until both stop talking altogether.',
    '{a.first} snaps at {b.first} over nothing. {b.first} snaps back.',
    '{b.first} says {a.first} is going to get someone killed. {a.first} does not take it well.',
    'It starts over who carries what. By the end, {a.first} and {b.first} are not speaking.',
  ],
};

export const SOCIAL_SHARE: SocialText = {
  title: 'Shared Rations',
  lines: [
    '{a.first} splits {a.their} rations with {b.first} without being asked.',
    '{a.first} produces a tin of peaches from somewhere and shares it with {b.first}.',
    'At the rest stop, {a.first} gives {b.first} the last of {a.their} water.',
  ],
};

export const SOCIAL_TALK: SocialText = {
  title: 'Quiet Moment',
  lines: [
    '{a.first} tells {b.first} about life before the guild. {b.first} listens.',
    '{b.first} makes {a.first} laugh, properly, for the first time in days.',
    '{a.first} and {b.first} keep watch together and talk until the light changes.',
    '{a.first} teaches {b.first} a card game with half the deck missing.',
  ],
};

export const SOCIAL_COVER: SocialText = {
  title: 'Close Call',
  lines: [
    '{b.first} slips on loose rubble. {a.first} catches {b.their} pack strap before {b.they} {b.does} more than swear.',
    '{b.first} makes a noisy mistake. {a.first} covers for {b.them} and says nothing about it afterwards.',
  ],
};

export const DISCOVERY_STASH = [
  '{a.first} notices a loose floor panel. Underneath: a stash someone never came back for.',
  'Behind a false wall, {a.first} finds a cache sealed in plastic.',
  '{a.first} forces a locked cabinet. It was locked for a reason.',
] as const;

export const DISCOVERY_LEAD = [
  '{a.first} finds a hand-drawn map tucked in a dead man\'s coat. It marks a place called {loc}.',
  'From high ground, {a.first} spots something in the distance worth a closer look: {loc}.',
  'Scratched into a wall: directions, and a name. {loc}.',
] as const;

/** A wreck the crew gets running and drives home (§7.8). */
export const VEHICLE_FOUND = [
  'Under a tarp in a collapsed carport, {a.first} finds a {vehicle}. Half a day with a wrench and a lot of cursing, and it coughs into life.',
  '{a.first} follows a fuel smell to a {vehicle} with two flat tyres and a dead battery. It takes everything in the toolbag, but it runs.',
  'Behind a wall of rubble sits a {vehicle} somebody hid and never came back for. {a.first} gets it started on the third try.',
] as const;

export const DISCOVERY_LORE = [
  '{a.first} finds a diary from the first winter after the Burn and reads it cover to cover.',
  'A wall of photographs, hundreds of faces, each with a name and "MISSING" underneath. It is a while before anyone moves on.',
  '{a.first} gets an old radio to play ten seconds of music before it dies for good.',
  'A classroom, desks still in rows. On the board, in chalk: "Back Monday."',
] as const;

export const RETURN_LINES: Record<'completed' | 'turnedBack' | 'routed' | 'lost', CrewLines> = {
  completed: {
    crew: ['The Depot lights come into view. Home.', 'Tired, dirty, and back in one piece.', 'The gate opens before they reach it. Someone was watching for them.'],
    solo: ['The Depot lights come into view. Home.', 'Tired, dirty, and back in one piece.', 'The gate opens before {a.first} reaches it. Someone was watching.'],
  },
  turnedBack: {
    crew: ['The crew cut the run short and made it home.', 'They turned back early. Better a light pack than an empty bunk.'],
    solo: ['{a.first} cuts the run short and makes it home.', '{a.first} turns back early. Better a light pack than an empty bunk.'],
  },
  routed: {
    crew: ['They come in at dawn, carrying each other, with nothing to show for it.', 'What is left of the crew staggers through the gate and collapses.'],
    solo: ['{a.first} crawls in at dawn with nothing to show for it.', '{a.first} staggers through the gate and collapses.'],
  },
  lost: { crew: ['Nobody comes back.'], solo: ['Nobody comes back.'] },
};
