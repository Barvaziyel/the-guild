/**
 * The tour: a walk through the game for a new guild. Each step shows a screen,
 * may point at one thing on it (an element with a matching `data-tour`
 * attribute), and explains it in a few sentences, with live numbers where
 * they help. Steps are grouped into parts so the player can skip what they
 * already know. Plain TypeScript so it can be tested in Node.
 */
import {
  CORNERS,
  DAY_MS,
  cornersLeft,
  DILEMMA_DAYS,
  FIRST_WEEK,
  LOCATIONS,
  STRESS_MAX,
  VULTURES_ARRIVE_DAY,
  MAX_CATCHUP_DAYS,
  MAX_CREW,
  LEAD_WAIT,
  RATION_KEEP_DAYS,
  RAID_WAIT,
  RADIO_WAIT,
  dailyUpkeep,
  gardenYield,
  knownLocations,
  storyStep,
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
  // Reordered in 2.8.2 (Aviel: the corners were under "people"): what's on the
  // Depot first, then supplies, people, runs and building, then what comes up
  // at home, and last what a new guild won't meet for a while.
  { id: 'depot', title: 'The Depot' },
  { id: 'supplies', title: 'Supplies and food' },
  { id: 'people', title: 'Your people' },
  { id: 'runs', title: 'Runs' },
  { id: 'building', title: 'Building' },
  { id: 'trouble', title: 'Raids and decisions' },
  { id: 'later', title: 'Later on' },
];
const depot = (): Route => ({ screen: 'depot', tab: 'today' });
const depotBuildings = (): Route => ({ screen: 'depot', tab: 'buildings' });

const SMALL = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve'];

/** "Four survivors", "One survivor", "14 survivors": a count to start a sentence with. */
function countOf(n: number, one: string, many: string): string {
  return `${SMALL[n] ?? n} ${n === 1 ? one : many}`;
}

/** "five real days", "a real day": a span of real days, rounded. */
export function proseDays(days: number): string {
  const n = Math.max(1, Math.round(days));
  return n === 1 ? 'a real day' : `${SMALL[n]?.toLowerCase() ?? n} real days`;
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
  return [...knownLocations(state)].filter((l) => !l.market).sort((a, b) => a.danger - b.danger || a.durationMin - b.durationMin)[0];
}

/** What to build first, with what it costs now: up to three suggestions. */
export function firstBuildSuggestions(state: GameState): string[] {
  const ideas: { id: BuildingId; level: number; why: string }[] = [
    { id: 'bunks', level: 2, why: 'to make room for a recruit' },
    { id: 'infirmary', level: 1, why: 'to heal faster' },
    { id: 'watchtower', level: 1, why: 'against raids' },
    { id: 'workshop', level: 1, why: 'to make gear and ammo' },
  ];
  // The first week's note asks for some buildings itself (§9.10): those aren't suggested twice.
  const asked = new Set(FIRST_WEEK.slice(state.story?.step ?? FIRST_WEEK.length).flatMap((step) => (step.goal.kind === 'building' ? [step.goal.building] : [])));
  const out: string[] = [];
  for (const idea of ideas) {
    if (asked.has(idea.id)) continue;
    const row = buildingRow(state, idea.id);
    if (row.level + 1 !== idea.level || !row.next) continue;
    const name = idea.level > 1 ? `${row.name} level ${idea.level}` : `${/^[AEIOU]/.test(row.name) ? 'an' : 'a'} ${row.name}`;
    out.push(`${name} (${row.next.cost}) ${idea.why}`);
    if (out.length === 3) break;
  }
  return out;
}

export const TOUR_STEPS: readonly TourStep[] = [
  // ---------------------------------------------------------------- the Depot
  {
    id: 'welcome',
    part: 'depot',
    title: 'Welcome to the Depot',
    route: () => ({ screen: 'depot' }),
    text: () =>
      'Your guild lives in an old rail depot, forty years after the Burn. This tour shows what everything is for. Skip a part you know, or the whole tour; Settings can show it again.',
  },
  {
    id: 'yard',
    part: 'depot',
    title: 'The yard',
    route: () => ({ screen: 'depot' }),
    target: 'yard',
    text: () =>
      "The Depot opens on the Yard: the place as it is right now, who's at work, who's by the fire, who's resting, and who's at the gate. It darkens with the evening. Tap anyone or anything to see what it is.",
  },
  {
    id: 'corners',
    part: 'depot',
    title: 'The Depot’s corners',
    route: () => ({ screen: 'depot' }),
    target: 'corners',
    // Says how far the guild has got, for a tour shown again from Settings (2.8.3).
    text: (state) => {
      const minutes = CORNERS.map((c) => c.minutes);
      const left = cornersLeft(state).length;
      if (left === 0) return 'The old depot had corners nobody had been through, and this guild has searched them all, so their list under the yard is gone.';
      const opening = left === CORNERS.length ? 'Nobody has been through the old depot yet.' : `${countOf(left, 'corner', 'corners')} of the old depot ${left === 1 ? 'is' : 'are'} still to search.`;
      return `${opening} Under the yard, pick a corner and send someone who’s home to search it: ${Math.min(...minutes)} to ${Math.max(...minutes)} minutes, one at a time, and each holds something. Someone just back from a run can go; whoever is searching can’t go out.`;
    },
  },
  {
    id: 'dots',
    part: 'depot',
    title: 'Red dots',
    route: depot,
    target: 'tabbar',
    text: () => 'A red dot means something new or waiting. Follow the dots: the tab, then the tab inside it, then the thing itself. A fight or raid that needs your orders shows as a strip up top.',
  },
  {
    id: 'notices',
    part: 'depot',
    title: 'Notices',
    route: () => ({ screen: 'settings' }),
    target: 'notices',
    text: () => 'The game keeps going while it’s closed. Turn this on to get a notice when a crew is due home or waiting for your orders, raiders come, or something needs deciding.',
  },
  {
    id: 'days',
    part: 'depot',
    title: 'Days pass',
    route: depot,
    target: 'day',
    text: () => {
      const hours = Math.round(DAY_MS / 3_600_000);
      return `A day passes every ${hours === 1 ? 'hour' : `${hours} real hours`}, open or closed: the Garden grows, people eat, heal and rest, and visitors come and go. The dial by the day up top fills as it goes, and under the day is when the next one starts. When you come back, the last ${MAX_CATCHUP_DAYS} days you missed are played; any before that are skipped.`;
    },
  },

  // ---------------------------------------------------------------- supplies and food
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
      'Almost everything comes home with crews from runs in the Reach. The Garden grows rations, the Scrapyard strips the old station for scrap once it\u2019s built, the Workshop turns scrap into ammo, and outposts send some home. Too much of one thing? Trade it at the market at the Drive-In.',
  },
  {
    id: 'garden',
    part: 'supplies',
    title: 'The Garden',
    route: () => ({ screen: 'building', id: 'garden' }),
    target: 'workers',
    text: (state) =>
      `Everyone eats a ration a day, and a few eat two. Right now the guild eats ${dailyUpkeep(state)} a day, and the Garden grows about ${oneDecimal(gardenYield(state))}. Every gardener, and every level, grows more.`,
  },
  {
    id: 'hungry',
    part: 'supplies',
    title: 'Running out',
    route: () => ({ screen: 'building', id: 'garden' }),
    text: () =>
      `Rations keep ${RATION_KEEP_DAYS} days; after that, half of what's left goes off each day, so a hoard shrinks. If the rations run out, nobody starves, but hungry people can't rest, heal slowly, and grow tense. Hunting runs bring back food, and a bigger Garden feeds a bigger guild.`,
  },

  // ---------------------------------------------------------------- your people
  {
    id: 'roster',
    part: 'people',
    title: 'Your survivors',
    route: () => ({ screen: 'roster' }),
    text: (state) =>
      `${countOf(state.survivors.length, 'survivor', 'survivors')}, each with health and stress. Every run costs some stress, more the longer and more dangerous it is, and it fades at home: the Firepit decides how fast, so rest people between runs. At ${STRESS_MAX}, someone breaks, and comes out of it changed.`,
  },
  {
    id: 'stats',
    part: 'people',
    title: 'Getting better',
    route: (state) => firstSurvivorRoute(state, 'stats'),
    target: 'stats',
    text: () =>
      'Five stats: Grit, Brawn, Aim, Wits and Nerve. Nobody spends points. People get better at what they actually do, on runs and at their posts. The i beside Stats says what each one is for and how it grows.',
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
  {
    id: 'gear',
    part: 'people',
    title: 'Gear',
    route: () => ({ screen: 'gear' }),
    target: 'gear',
    text: () => 'Everyone’s four slots: weapon, armor, tool, trinket. A red slot is empty while the stash has something for it. Hand gear out at the Depot, before they go.',
  },
  {
    id: 'gate',
    part: 'people',
    title: 'New people',
    route: () => ({ screen: 'recruits' }),
    text: (state) => {
      const { beds, cap } = homeCounts(state);
      const room = beds >= cap ? `all ${cap} beds are taken, so build the Bunks up first` : `${cap - beds} ${cap - beds === 1 ? 'bed is' : 'beds are'} free`;
      return `Most new people come from the Reach: someone found on a run, or, once there's a Radio Tower, someone you rescue after a call for help. Others answer the radio or turn up at the gate. Taking someone in is free, but needs a free bed (partners share one): ${room}. Strays turn up at the gate too.`;
    },
  },

  // ---------------------------------------------------------------- runs
  {
    id: 'reach',
    part: 'runs',
    title: 'The Reach',
    route: () => ({ screen: 'reach' }),
    target: 'map',
    text: (state) =>
      `You know ${countOf(knownLocations(state).length, 'place', 'places').toLowerCase()}. Each has a danger from 1 to 5, and a ring that fills as you explore it. Question marks are roads to places nobody has found yet. Crews out walk the roads here.`,
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
    id: 'market',
    part: 'runs',
    title: 'The market',
    route: () => ({ screen: 'reach', id: 'drive_in' }),
    target: 'market',
    text: () =>
      'The Drive-In is a market, not a place to search. Send a crew with goods, rations say, and they bring back something else: scrap, gas, anything. Packed with nothing but goods, they carry three times as much. The more of one thing the guild trades there, the worse the price, until it settles back over a day or two.',
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
      const first = place ? ` A good first run: three people scavenging ${place.name.replace(/^The /, 'the ')}.` : '';
      return `First pick a crew of 1 to ${MAX_CREW}, then their orders: the job, how careful to be, when to pull out. Under the orders it says how risky the run is.${first}`;
    },
  },
  {
    id: 'out',
    part: 'runs',
    title: 'Out in real time',
    route: () => ({ screen: 'runs' }),
    text: () => {
      const minutes = LOCATIONS.map((l) => l.durationMin);
      const hours = Math.round(DAY_MS / 3_600_000);
      return `Runs take real time, ${proseDuration(Math.min(...minutes))} to ${proseDuration(Math.max(...minutes))}, and crews come home even with the game closed. Each person goes out once a game day, which is ${hours} real hours. The report tells you what happened out there, and who came back changed.`;
    },
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
      `At a fight a crew stops and waits up to ${Math.round(LEAD_WAIT / 60_000)} minutes for your orders (switch it off here to let them fight alone). You see what each enemy means to do. Give each person a move and a target: blades reach only the front rank, shots anyone. Some fights come with a job, like holding a door. Nobody answers? They fight on their own.`,
  },

  {
    id: 'radio',
    part: 'runs',
    title: 'On the radio',
    route: () => ({ screen: 'runs' }),
    text: () =>
      `Now and then a crew comes to a fork: a sealed door, raiders on the road, the Vultures. They get on the radio: you get a notice and a card with their options, and they wait ${Math.round(RADIO_WAIT / 60_000)} minutes for your answer before deciding themselves.`,
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
      "People at home work a post, and practice its stat every day: gardeners sharpen their Wits, firekeepers their Nerve, the Scrapyard's workers their Brawn. Change posts from a building or from someone's sheet.",
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
      const besides = storyStep(state) ? 'Besides what the first week asks for, good' : 'Good';
      return `${besides} first goals: ${joinNames(ideas)}. You'll need runs to pay for them.`;
    },
  },

  // ---------------------------------------------------------------- raids and decisions
  {
    id: 'raids',
    part: 'trouble',
    title: 'Raids',
    route: depot,
    text: () =>
      `Raiders sometimes come for the Depot or an outpost, and so do ferals, hollows and scrapbots. A Watchtower may see them coming, in time to shore up the fence, hide stores or, with a Radio Tower, call a crew home. At the gate they wait ${Math.round(RAID_WAIT / 3_600_000)} hours for you: pay raiders off, stare them down, or fight. Only those home when they arrive can hold it.`,
  },
  {
    id: 'decisions',
    part: 'trouble',
    title: 'Decisions',
    route: depot,
    text: () =>
      `About once a real day something needs deciding: two people at odds, a stranger at the gate, a find nobody will share. It shows at the top of the Today tab with four answers, and what follows isn't written on the buttons. Leave it ${Math.round((DILEMMA_DAYS * DAY_MS) / 3_600_000)} hours and they settle it themselves, usually badly.`,
  },

  // ---------------------------------------------------------------- later on
  {
    id: 'vehicles',
    part: 'later',
    title: 'Vehicles',
    route: () => ({ screen: 'vehicles' }),
    target: 'vehicles',
    text: () =>
      `On foot a crew is at most ${MAX_CREW}. A motorcycle carries two, cars and vans five or more. Vehicles get there faster and carry more, but burn gas, draw trouble and wear down. They're rare: scouting turns up the odd wreck, traders sometimes sell one, and the Workshop can build some.`,
  },
  {
    id: 'further',
    part: 'later',
    title: 'Further out',
    route: (state) => {
      const place = easiestPlace(state);
      return place ? { screen: 'reach', id: place.id, tab: 'outpost' } : { screen: 'reach' };
    },
    target: 'place-tabs',
    text: () =>
      "Explore a place's outskirts fully and two things open: the way deeper in, deadlier but richer, and an outpost, a camp that sends supplies home and shortens runs nearby. Outposts need the Radio Tower: each level keeps in touch with one more.",
  },
  {
    id: 'projects',
    part: 'later',
    title: 'Projects',
    route: () => ({ screen: 'depot', tab: 'projects' }),
    target: 'projects',
    text: () =>
      'Once the Depot is built up, big works change it for good: rails to the far places, a wall, a clinic. Each opens once its building is far enough along and comes in three stages. Pay for a stage, put a crew on it, and they work it off day by day.',
  },
  {
    id: 'vultures',
    part: 'later',
    title: 'The Vultures',
    route: () => ({ screen: 'reach' }),
    target: 'vultures',
    text: () =>
      `Another guild, the Vultures, works the Reach too. Around game day ${VULTURES_ARRIVE_DAY}, about ${proseDays((VULTURES_ARRIVE_DAY * DAY_MS) / 86_400_000)} in, they set up camp and send someone to the gate. They compete for places, people and trade; deal with them, trade with them or fight them. This panel shows how things stand.`,
  },
  {
    id: 'haven',
    part: 'later',
    title: 'Haven',
    // Before the broadcast there's no tab to show yet (§9.11).
    route: (state) => (state.haven ? { screen: 'haven' } : { screen: 'depot' }),
    text: (state) =>
      state.haven
        ? 'The long goal: find Haven. This tab is the guild’s notebook on it. The road at the top fills in as clues turn up; under it are what you know, the leads to follow (a run there might turn one up, or a building), what crews found, and what was heard on the roads. Once the guild knows the way, the road east opens here, and the whole guild sets out together.'
        : 'The long goal comes over the radio at the end of the first week. From then on a Haven tab keeps what the guild learns about it: leads to follow on runs, what crews find, and what people hear on the roads.',
  },
  {
    id: 'done',
    part: 'later',
    title: "That's the tour",
    route: () => ({ screen: 'depot' }),
    // The first week's note waits until the tour is over (2.8.1), so this step hands over to it.
    text: (state) =>
      storyStep(state)
        ? 'When you close this, a note above the yard says what to do first: the first week, one thing at a time, each with a reward. Settings can show this tour again.'
        : "Send your first crew out when you're ready. Settings can show this tour again.",
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
