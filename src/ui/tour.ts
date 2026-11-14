/**
 * The tour: a walk through the game for a new guild. Each step shows a screen,
 * may point at one thing on it (an element with a matching `data-tour`
 * attribute), and explains it in a few sentences, with live numbers where
 * they help. Steps are grouped into parts so the player can skip what they
 * already know. Plain TypeScript so it can be tested in Node.
 */
import {
  DAY_MS,
  LOCATIONS,
  MAX_CATCHUP_DAYS,
  MAX_CREW,
  LEAD_WAIT,
  RATION_KEEP_DAYS,
  RAID_WAIT,
  RADIO_WAIT,
  dailyUpkeep,
  gardenYield,
  knownLocations,
  type BuildingId,
  type GameState,
} from '../engine/index.ts';
import { buildingRow, homeCounts, oneDecimal } from './depot-view.ts';
import type { Route } from './route.ts';
import { joinNames } from './runs-view.ts';

export interface TourPart {
  id: string;
  title: string;
}

export interface TourStep {
  id: string;
  part: string;
  title: string;
  /** The screen this step shows. */
  route: (state: GameState) => Route;
  /** The `data-tour` value of the thing to point at, if any. */
  target?: string;
  text: (state: GameState) => string;
}

export const TOUR_PARTS: readonly TourPart[] = [
  { id: 'supplies', title: 'Supplies' },
  { id: 'food', title: 'Food' },
  { id: 'people', title: 'Your people' },
  { id: 'runs', title: 'Runs' },
  { id: 'building', title: 'Building' },
  { id: 'recruits', title: 'Recruits' },
  { id: 'time', title: 'Time' },
];

const depot = (): Route => ({ screen: 'depot', tab: 'today' });
const depotBuildings = (): Route => ({ screen: 'depot', tab: 'buildings' });

const SMALL = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/** "Four survivors", "One survivor", "14 survivors": a count to start a sentence with. */
function countOf(n: number, one: string, many: string): string {
  return `${SMALL[n] ?? n} ${n === 1 ? one : many}`;
}

/** "10 minutes", "an hour", "2½ hours", in prose. */
export function proseDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const halves = Math.round(minutes / 30) / 2;
  if (halves === 1) return 'an hour';
  const whole = Math.floor(halves);
  return `${whole}${halves > whole ? '½' : ''} hours`;
}

/** Someone to show on the sheet: the first survivor, or the roster if nobody's left. */
function firstSurvivorRoute(state: GameState, tab: 'stats' | 'bonds' | 'story'): Route {
  const s = state.survivors[0];
  return s ? { screen: 'survivor', id: s.id, tab } : { screen: 'roster' };
}

/** The safest known place, for a first run. */
function easiestPlace(state: GameState) {
  return [...knownLocations(state)].sort((a, b) => a.danger - b.danger || a.durationMin - b.durationMin)[0];
}

/** What to build first, with what it costs now: up to three suggestions. */
export function firstBuildSuggestions(state: GameState): string[] {
  const ideas: { id: BuildingId; level: number; why: string }[] = [
    { id: 'bunks', level: 2, why: 'to make room for a recruit' },
    { id: 'infirmary', level: 1, why: 'to heal faster' },
    { id: 'watchtower', level: 1, why: 'against raids' },
    { id: 'workshop', level: 1, why: 'to make gear and ammo' },
  ];
  const out: string[] = [];
  for (const idea of ideas) {
    const row = buildingRow(state, idea.id);
    if (row.level + 1 !== idea.level || !row.next) continue;
    const name = idea.level > 1 ? `${row.name} level ${idea.level}` : `${/^[AEIOU]/.test(row.name) ? 'an' : 'a'} ${row.name}`;
    out.push(`${name} (${row.next.cost}) ${idea.why}`);
    if (out.length === 3) break;
  }
  return out;
}

export const TOUR_STEPS: readonly TourStep[] = [
  // ---------------------------------------------------------------- supplies
  {
    id: 'welcome',
    part: 'supplies',
    title: 'Welcome to the Depot',
    route: () => ({ screen: 'depot' }),
    text: () =>
      'Your guild lives in an old rail depot, forty years after the Burn. This tour shows what everything is for. Skip a part you know, or the whole tour; Settings can show it again.',
  },
  {
    id: 'bell',
    part: 'supplies',
    title: 'The bell',
    route: depot,
    target: 'bell',
    text: () =>
      'The bell up top keeps track of what needs you: raiders, a crew on the radio or at a fight, a decision, people at the gate, crews back with a report, and warnings. Tap it, then tap a line to go there.',
  },
  {
    id: 'supplies',
    part: 'supplies',
    title: 'Six supplies',
    route: depot,
    target: 'resources',
    text: () =>
      'Scrap builds buildings and gear. Rations feed everyone. Meds patch people up, on runs and in the Infirmary. Ammo feeds guns. Tech goes into better buildings and gear. Gas runs vehicles, once you have one.',
  },
  {
    id: 'more-supplies',
    part: 'supplies',
    title: 'Getting more',
    route: depot,
    target: 'resources',
    text: () =>
      'Almost everything comes home with crews from runs in the Reach. The Garden grows rations, the Workshop turns scrap into ammo, and now and then a trader offers a swap.',
  },
  {
    id: 'gear',
    part: 'supplies',
    title: 'Gear',
    route: depot,
    target: 'gear',
    text: () =>
      "Weapons, armor, tools and trinkets that crews find, or the Workshop makes, go into the stash. Open it to hand them out, or take apart what nobody needs for scrap once there's a Workshop. People change gear only while they're at the Depot.",
  },

  // ---------------------------------------------------------------- food
  {
    id: 'garden',
    part: 'food',
    title: 'The Garden',
    route: () => ({ screen: 'building', id: 'garden' }),
    target: 'workers',
    text: (state) =>
      `Everyone at home eats a ration a day, and a few eat two. Right now the guild eats ${dailyUpkeep(state)} a day, and the Garden grows about ${oneDecimal(gardenYield(state))}. Every gardener, and every level, grows more.`,
  },
  {
    id: 'hungry',
    part: 'food',
    title: 'Running out',
    route: () => ({ screen: 'building', id: 'garden' }),
    text: () =>
      `Rations keep ${RATION_KEEP_DAYS} days; after that, half of what's left goes off each day, so a hoard shrinks. If the rations run out, nobody starves, but hungry people can't rest, heal slowly, and grow tense. Hunting runs bring back food, and a bigger Garden feeds a bigger guild.`,
  },

  // ---------------------------------------------------------------- people
  {
    id: 'roster',
    part: 'people',
    title: 'Your survivors',
    route: () => ({ screen: 'roster' }),
    text: (state) => {
      return `${countOf(state.survivors.length, 'survivor', 'survivors')}, each with health and stress. Every run costs some stress, more the longer and more dangerous it is, and it fades at home: the Firepit decides how fast, so rest people between runs. At 100, someone breaks, and comes out of it changed.`;
    },
  },
  {
    id: 'yard',
    part: 'people',
    title: 'The yard',
    route: () => ({ screen: 'depot' }),
    target: 'yard',
    text: () =>
      "The Yard shows the Depot as it is right now: who's at work, who's by the fire, who's resting, and who's at the gate. It darkens with the evening. Tap anyone or anything to see what it is.",
  },
  {
    id: 'stats',
    part: 'people',
    title: 'Getting better',
    route: (state) => firstSurvivorRoute(state, 'stats'),
    target: 'stats',
    text: () =>
      'Five stats: Grit, Brawn, Aim, Wits and Nerve. Nobody spends points. People get better at what they actually do, on runs and at their posts.',
  },
  {
    id: 'bonds',
    part: 'people',
    title: 'Who gets along',
    route: (state) => firstSurvivorRoute(state, 'bonds'),
    target: 'bonds',
    text: () =>
      'People grow closer or further apart with everything they go through. Bonded friends look after each other on runs and help each other rest at home; rivals make it all harder, and a feud can end with someone walking out. Now and then two Bonded people become partners, and partners sometimes have a baby, who grows up at the Depot and joins the guild at 16.',
  },
  {
    id: 'story',
    part: 'people',
    title: 'Their story',
    route: (state) => firstSurvivorRoute(state, 'story'),
    text: () =>
      "What happens to people changes them: scars, new traits, friends and feuds, and the years, a birthday every game year. It's all written in their Chronicle, here on their sheet.",
  },

  // ---------------------------------------------------------------- runs
  {
    id: 'reach',
    part: 'runs',
    title: 'The Reach',
    route: () => ({ screen: 'reach' }),
    target: 'map',
    text: (state) =>
      `You know ${countOf(knownLocations(state).length, 'place', 'places').toLowerCase()}. Each has a danger from 1 to 5, and a ring that fills as you explore it. Question marks are roads to places nobody has found yet.`,
  },
  {
    id: 'why-runs',
    part: 'runs',
    title: 'Why go out',
    route: () => ({ screen: 'reach' }),
    target: 'map',
    text: () =>
      'Runs are how the guild gets nearly everything. Scavenge for supplies, scout to explore and find new places, or hunt for food. Each place mostly finds one or two things (tap it to see which), and dangerous places pay better and hurt more.',
  },
  {
    id: 'plan',
    part: 'runs',
    title: 'Planning a run',
    route: (state) => {
      const place = easiestPlace(state);
      return place ? { screen: 'plan', locationId: place.id } : { screen: 'reach' };
    },
    target: 'crew',
    text: (state) => {
      const place = easiestPlace(state);
      const first = place ? ` A good first run: three people scavenging ${place.name}.` : '';
      return `First pick a crew of 1 to ${MAX_CREW}, then their orders: a job, supplies, how careful to be. Under the orders it says how risky it is: how often someone gets hurt.${first}`;
    },
  },
  {
    id: 'out',
    part: 'runs',
    title: 'Out in real time',
    route: () => ({ screen: 'runs' }),
    text: () => {
      const minutes = LOCATIONS.map((l) => l.durationMin);
      return `Runs take real time, ${proseDuration(Math.min(...minutes))} to ${proseDuration(Math.max(...minutes))}, and crews come home even with the game closed. Each person goes out once a game day. The report tells you what happened out there, and who came back changed.`;
    },
  },
  {
    id: 'radio',
    part: 'runs',
    title: 'On the radio',
    route: () => ({ screen: 'runs' }),
    text: () =>
      `Now and then a crew comes to a fork: a sealed door, raiders on the road, the Vultures. With a Radio Tower they call home, and you get a notice and a card with their options. They wait ${Math.round(RADIO_WAIT / 60_000)} minutes for your answer, then decide by their orders. Without a tower they decide on the spot.`,
  },
  {
    id: 'lead',
    part: 'runs',
    title: 'Leading the fights',
    route: (state) => {
      const place = easiestPlace(state);
      return place ? { screen: 'plan', locationId: place.id, step: 'orders' } : { screen: 'reach' };
    },
    target: 'lead',
    text: () =>
      `With a Radio Tower you lead a crew's fights: at every fight they call home and wait up to ${Math.round(LEAD_WAIT / 60_000)} minutes (switch it off in the orders to let them fight on their own). Then it's yours, round by round, on the battle stage: a move for each person, from what their gear and traits let them do, and a tap on the enemy they go after. Nobody answers? They fight on their own, as always.`,
  },
  {
    id: 'vehicles',
    part: 'runs',
    title: 'Vehicles',
    route: () => ({ screen: 'vehicles' }),
    target: 'vehicles',
    text: () =>
      `On foot a crew is at most ${MAX_CREW}. Vehicles seat more, get there faster and carry more, but they burn gas, draw trouble and wear down. They're rare: scouting turns up the odd wreck, traders sometimes sell one, and the Workshop can build some.`,
  },

  {
    id: 'further',
    part: 'runs',
    title: 'Further out',
    route: (state) => {
      const place = easiestPlace(state);
      return place ? { screen: 'reach', id: place.id, tab: 'outpost' } : { screen: 'reach' };
    },
    target: 'place-tabs',
    text: () =>
      "Explore a place's outskirts fully and two things open: the way deeper in, deadlier but richer, and an outpost, a camp that sends supplies home and shortens runs nearby. Outposts need the Radio Tower.",
  },
  {
    id: 'vultures',
    part: 'runs',
    title: 'The Vultures',
    route: () => ({ screen: 'reach' }),
    target: 'vultures',
    text: () =>
      "Another guild, the Vultures, works the Reach too. A few days in they set up camp and send someone to the gate. They compete for places, people and trade; deal with them, trade with them or fight them. This panel shows how things stand.",
  },

  // ---------------------------------------------------------------- building
  {
    id: 'buildings',
    part: 'building',
    title: 'Buildings',
    route: depotBuildings,
    target: 'buildings',
    text: () =>
      'Buildings cost scrap and tech, and the bigger ones other supplies too; their upper levels use a little every day. The Bunks hold beds, the Garden grows food, the Firepit eases stress. Tap a building to see what its next level does.',
  },
  {
    id: 'posts',
    part: 'building',
    title: 'Posts',
    route: depotBuildings,
    target: 'buildings',
    text: () =>
      "People at home work a post, and practice its stat every day: gardeners sharpen their Wits, firekeepers their Nerve. Change posts from a building or from someone's sheet.",
  },
  {
    id: 'build-first',
    part: 'building',
    title: 'What to build first',
    route: depotBuildings,
    target: 'to-build',
    text: (state) => {
      const ideas = firstBuildSuggestions(state);
      if (ideas.length === 0) return 'Every building can go higher. Tap one to see its next level and what it costs.';
      return `Good first goals: ${joinNames(ideas)}. You'll need runs to pay for them.`;
    },
  },
  {
    id: 'projects',
    part: 'building',
    title: 'Projects',
    route: () => ({ screen: 'depot', tab: 'projects' }),
    target: 'projects',
    text: () =>
      'Once the Depot is built up, big works change it for good: rails to the far places, a wall, a clinic. Each comes in three stages. Pay for a stage, put a crew on it, and they work it off day by day.',
  },
  {
    id: 'raids',
    part: 'building',
    title: 'Raids',
    route: depot,
    text: () =>
      `Raiders sometimes come for the Depot, and ferals, hollows and scrapbots from places you know. A Watchtower may see them coming: keep people home, call a crew back by radio, shore up the fence, hide stores. At the gate they wait ${Math.round(RAID_WAIT / 3_600_000)} hours for you: pay raiders off, stare them down, or fight. Only those home when they arrive can hold it. Beaten, they may leave gear or a captive.`,
  },

  // ---------------------------------------------------------------- recruits
  {
    id: 'gate',
    part: 'recruits',
    title: 'At the gate',
    route: () => ({ screen: 'recruits' }),
    text: (state) => {
      const { beds, cap } = homeCounts(state);
      const room = beds >= cap ? `all ${cap} beds are taken, so build the Bunks up first` : `${cap - beds} ${cap - beds === 1 ? 'bed is' : 'beds are'} free`;
      return `Some people answer the radio or turn up at the gate, but most come from the Reach: someone found on a run, or, with a Radio Tower, a call for help, who joins owing their rescuer a life. Taking someone in is free, but they need a bed (partners share one): ${room}. Short of beds, someone sleeps on the floor. Strays turn up at the gate too.`;
    },
  },

  // ---------------------------------------------------------------- time
  {
    id: 'days',
    part: 'time',
    title: 'Days pass',
    route: depot,
    text: () => {
      const hours = Math.round(DAY_MS / 3_600_000);
      return `The game keeps going when it's closed. A day passes every ${hours === 1 ? 'hour' : `${hours} hours`}: the Garden grows, people eat, heal and rest, and visitors come and go. Days you missed are played when you come back, up to ${MAX_CATCHUP_DAYS}.`;
    },
  },
  {
    id: 'decisions',
    part: 'time',
    title: 'Decisions',
    route: depot,
    text: () =>
      `About once a day something needs deciding: two people at odds, a stranger at the gate, a find nobody will share. It shows at the top of the Depot with four answers, and what follows isn't written on the buttons. Leave it about a day and they settle it themselves, usually badly.`,
  },
  {
    id: 'notices',
    part: 'time',
    title: 'Notices',
    route: () => ({ screen: 'settings' }),
    target: 'notices',
    text: () => 'Turn this on to get a notice when a crew is due home or calls on the radio, or when something needs deciding.',
  },
  {
    id: 'done',
    part: 'time',
    title: "That's the tour",
    route: depot,
    text: () => "Send your first crew out when you're ready. Settings can show this tour again.",
  },
];

export const FIRST_STEP = TOUR_STEPS[0]!.id;

export function tourStep(id: string | null | undefined): TourStep | undefined {
  return id ? TOUR_STEPS.find((s) => s.id === id) : undefined;
}

/** The step after this one, or null when the tour is over. */
export function nextStepId(id: string): string | null {
  const i = TOUR_STEPS.findIndex((s) => s.id === id);
  return i < 0 ? null : (TOUR_STEPS[i + 1]?.id ?? null);
}

/** The first step of the next part, or null when this is the last part. */
export function nextPartStepId(id: string): string | null {
  const step = tourStep(id);
  if (!step) return null;
  const part = TOUR_PARTS.findIndex((p) => p.id === step.part);
  const next = TOUR_PARTS[part + 1];
  return next ? (TOUR_STEPS.find((s) => s.part === next.id)?.id ?? null) : null;
}

export interface TourCard {
  title: string;
  text: string;
  /** "Supplies: 2 of 3" */
  where: string;
  /** "Part 1 of 7" */
  partOf: string;
  /** No more steps after this one. */
  last: boolean;
  /** The last step of its part, so skipping the part is the same as Next. */
  lastInPart: boolean;
}

export function tourCard(state: GameState, id: string): TourCard | null {
  const step = tourStep(id);
  if (!step) return null;
  const partIndex = TOUR_PARTS.findIndex((p) => p.id === step.part);
  const inPart = TOUR_STEPS.filter((s) => s.part === step.part);
  const n = inPart.indexOf(step) + 1;
  return {
    title: step.title,
    text: step.text(state),
    where: inPart.length > 1 ? `${TOUR_PARTS[partIndex]!.title}: ${n} of ${inPart.length}` : TOUR_PARTS[partIndex]!.title,
    partOf: `Part ${partIndex + 1} of ${TOUR_PARTS.length}`,
    last: nextStepId(id) === null,
    lastInPart: n === inPart.length,
  };
}
