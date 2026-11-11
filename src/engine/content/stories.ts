/**
 * Names the guild gives out: to enemies that got away (nemeses), to weapons
 * with enough kills, and to survivors who earned one (nicknames).
 * See docs/DESIGN.md §15, step 11. Add names and rules here, not in code.
 */
import type { EnemyType } from './enemies.ts';
import type { NumericCounter, RunTally } from './evolutions.ts';

/** What the guild calls an enemy that got away. Each name is used once, ever. */
export const NEMESIS_NAMES: Record<EnemyType, readonly string[]> = {
  raider: [
    'Mother Ash',
    'Knuckles Varga',
    'Red Tamsin',
    'the Toll-Man',
    'Big Ondine',
    'Gray Sadie',
    'Ratchet',
    'the Smiling Man',
    'Hollis Crane',
    'Saint Jude',
    'Two-Coats',
    'Lady Brass',
  ],
  feral: ['Old Notch', 'Scarback', 'the Grey One', 'Torn-Ear', 'Old Hungry', 'the Long Dog', 'Whistler', 'Mother of Packs', 'Three-Legs', 'the Pale Hound', 'Ribs', 'Patience'],
  hollow: ['the Weeping Man', 'Lantern', 'the Bride', 'Soft Pete', 'the Choir', 'the Grinner', 'the Sleeper', 'Mister Mumble', 'the Nurse', 'Candlewick', 'Tall Mary', 'the Hum'],
  scrapbot: ['Unit Seven', 'the Warden', 'Sergeant', 'Old Tick', 'the Inspector', 'Mister Polite', 'the Janitor', 'Lockdown', 'Patrol Four', 'the Usher', 'Clockwork', 'Gatekeeper'],
};

/**
 * Names for weapons that reach NAMED_GEAR_KILLS kills. They read naturally
 * after "the": "drops a Rad-hound with the Widowmaker".
 */
export const WEAPON_NAMES: Record<'melee' | 'ranged', readonly string[]> = {
  ranged: ['Widowmaker', 'Long Talk', 'Last Word', 'Persuader', 'Doorknocker', 'Thunderclap', 'Hushabye', 'Bad News', 'Undertaker', 'Old Reliable', 'Sermon', 'Goodnight'],
  melee: ['Bonebreaker', 'Headache', 'Argument', 'Lullaby', 'Old Faithful', 'Apology', 'Nails', 'Knock-Knock', 'Settler', 'Grandmother', 'Short Answer', 'Kindness'],
};

/**
 * How survivors earn a nickname, checked after every run for anyone who
 * doesn't have one yet. The first rule that fits, and rolls its chance, wins.
 */
export interface NicknameRule {
  id: string;
  /** Lifetime counters that must be at least this high. */
  counters?: Partial<Record<NumericCounter, number>>;
  /** Must have this trait. */
  trait?: string;
  /** This run must have included it. */
  needs?: keyof RunTally;
  chance: number;
  names: readonly string[];
  /** Why, for the Chronicle: "Earned a name: "Two-Shot", {why}." {nemesis} is the nemesis killed on the run. */
  why: string;
}

export const NICKNAMES: readonly NicknameRule[] = [
  { id: 'nemesis_killer', needs: 'nemesisKills', chance: 0.75, names: ['Giant-Killer', 'Grudge', 'Bane', 'Last Laugh'], why: 'for killing {nemesis}' },
  { id: 'sharpshooter', counters: { rangedKills: 12 }, chance: 0.4, names: ['Two-Shot', 'Dead Quiet', 'Long Arm', 'Pinhole'], why: 'for a dozen kills at range' },
  { id: 'brawler', counters: { meleeKills: 12 }, chance: 0.4, names: ['Knuckles', 'Hammer', 'Butcher', 'Mauler'], why: 'for a dozen kills up close' },
  { id: 'lazarus', trait: 'survivor', chance: 0.5, names: ['Lazarus', 'Twice-Dead', 'Lucky'], why: 'for coming back from a wound that should have been the end' },
  { id: 'bounce', counters: { timesDowned: 4 }, chance: 0.4, names: ['Bounce', 'Hard Case', 'Rubber'], why: 'for getting back up, every time' },
  { id: 'saver', counters: { alliesSaved: 2 }, chance: 0.5, names: ['Doc', 'Angel', 'Shepherd'], why: 'for dragging people back from the edge' },
  { id: 'one_eye', trait: 'lost_eye', chance: 0.3, names: ['Patch', 'One-Eye', 'Squint'], why: 'for the eye' },
  { id: 'glow', counters: { rads: 200 }, chance: 0.4, names: ['Sparky', 'Glow', 'Geiger'], why: 'for more radiation than anyone should walk away from' },
  { id: 'scav', counters: { scavenges: 25 }, chance: 0.3, names: ['Magpie', 'Pockets', 'Finder'], why: 'for a nose for what is worth carrying' },
  { id: 'old_hand', counters: { runs: 40 }, chance: 0.1, names: ['Old Hand', 'Sarge', 'Iron'], why: 'for forty runs and still here' },
  { id: 'rabbit', needs: 'fled', chance: 0.2, names: ['Rabbit', 'Quickstep', 'Hare'], why: 'for running when it counted' },
];
