/**
 * The Vultures on screen (§7.11): their screen (standing, strength, what they
 * do to the guild, their people and camps, prisoners, their history), the
 * Reach's panel and a place's line, the planner's job and warning, and report
 * lines. Plain TypeScript, tested in Node.
 */
import {
  BAND_NAMES,
  VULTURES_RANSOM,
  VULTURES_TURF_FINDS,
  campAt,
  campLeader,
  getLocation,
  joinChance,
  locationState,
  onTurf,
  prisonerProblem,
  tradeCut,
  turf,
  vultureBand,
  vulturesActive,
  type GameState,
  type RunJob,
  type RunSummary,
  type Survivor,
  type VultureBand,
  type VultureMember,
} from '../engine/index.ts';
import type { Choice } from './runs-view.ts';

/** Eight Depot days make a real day. */
const DAYS_PER_REAL_DAY = 8;

const MEANING: Record<VultureBand, string> = {
  war: 'They attack crews they meet, raid the Depot and the guild\'s outposts, and send threats to the gate.',
  wary: 'Meetings out there are standoffs: a toll, or a fight. Now and then they raid.',
  truce: 'Crews pass each other with a nod. No raids.',
  trade: 'Friendly meetings, and their own traders come to the gate with good deals.',
};

/** "Scattered", "A crew to reckon with", "Strong", "At their strongest". */
export function strengthWord(strength: number): string {
  if (strength < 25) return 'Scattered';
  if (strength < 50) return 'A crew to reckon with';
  if (strength < 75) return 'Strong';
  return 'At their strongest';
}

const placeName = (id: string): string => getLocation(id).name;
const name = (s: Survivor): string => `${s.firstName} ${s.lastName}`;

function joinPlaces(names: readonly string[]): string {
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** What they're doing to the guild right now, line by line. */
export function vultureEffects(state: GameState): string[] {
  if (!vulturesActive(state)) return [];
  const band = vultureBand(state);
  const out: string[] = [];
  const known = turf(state).filter((id) => locationState(state, id).discovered);
  if (known.length > 0) out.push(`They work ${joinPlaces(known.map(placeName))}. Finds there are ${Math.round((1 - VULTURES_TURF_FINDS) * 100)}% thinner, and crews may meet them.`);
  if (band !== 'trade') out.push('People the guild leaves waiting, at the gate or calling for help, may go to them instead.');
  const cut = tradeCut(state);
  if (cut < 1) out.push(`Caravans pay ${Math.round((1 - cut) * 100)}% less while they're this strong.`);
  if (band === 'war') out.push('They raid the Depot as often as raiders do, and the guild\'s outposts on their turf.');
  if (band === 'wary') out.push('They raid now and then.');
  return out;
}

export interface VulturePersonRow {
  id: string;
  /** Their name, once met; their boss's name is known from the radio. */
  name: string;
  role: string;
  where: string;
  met: boolean;
  /** For the portrait, once met. */
  person?: Survivor;
  story: string[];
}

function whereIs(state: GameState, m: VultureMember): string {
  switch (m.status) {
    case 'captured':
      return 'The guild\'s prisoner.';
    case 'dead':
      return 'Dead.';
    case 'joined':
      return 'Left them, and joined the guild.';
    case 'free': {
      if (!m.campId) return 'With the Vultures.';
      const where = locationState(state, m.campId).discovered ? placeName(m.campId) : 'a place the guild hasn\'t found';
      return `Holds their camp at ${where}.`;
    }
  }
}

/** Their people: the boss first, then lieutenants, the living before the rest. */
export function vulturePeople(state: GameState): VulturePersonRow[] {
  const order = (m: VultureMember): number => (m.status === 'free' ? 0 : m.status === 'captured' ? 1 : 2) * 10 + (m.role === 'boss' ? 0 : 1);
  return [...state.vultures.people]
    .sort((a, b) => order(a) - order(b))
    .map((m) => {
      const known = m.met || m.role === 'boss';
      return {
        id: m.person.id,
        name: known ? name(m.person) : 'Not met yet',
        role: m.role === 'boss' ? 'Their boss' : 'A lieutenant',
        where: whereIs(state, m),
        met: m.met,
        ...(m.met ? { person: m.person } : {}),
        story: m.history.map((h) => h.text),
      };
    });
}

export interface VultureCampRow {
  id: string;
  place: string;
  /** "held by Iris Yates, their boss". */
  held: string;
  home: boolean;
}

export function vultureCamps(state: GameState): VultureCampRow[] {
  if (!vulturesActive(state)) return [];
  return state.vultures.camps
    .filter((c) => locationState(state, c.locationId).discovered)
    .map((c) => {
      const leader = campLeader(state, c);
      const who = leader ? (leader.met || leader.role === 'boss' ? name(leader.person) : 'a lieutenant the guild hasn\'t met') : 'nobody in particular';
      return { id: c.locationId, place: placeName(c.locationId), held: `Held by ${who}${leader?.role === 'boss' ? ', their boss' : ''}.`, home: c.home === true };
    });
}

export interface PrisonerRow {
  id: string;
  name: string;
  role: string;
  person: Survivor;
  /** "Trade back: +15 standing, 20 scrap and 10 tech." */
  ransom: string;
  ransomProblem?: string;
  /** "Ask to join: about 35%." */
  recruit: string;
  recruitProblem?: string;
}

export function prisonerRows(state: GameState): PrisonerRow[] {
  return state.vultures.people
    .filter((m) => m.status === 'captured')
    .map((m) => {
      const ransomProblem = prisonerProblem(state, m.person.id, 'ransom');
      const recruitProblem = prisonerProblem(state, m.person.id, 'recruit');
      return {
        id: m.person.id,
        name: name(m.person),
        role: m.role === 'boss' ? 'Their boss' : 'A lieutenant',
        person: m.person,
        ransom: `Trade back: they pay ${VULTURES_RANSOM.scrap} scrap and ${VULTURES_RANSOM.tech} tech, and it warms them.`,
        ...(ransomProblem ? { ransomProblem } : {}),
        recruit: `Ask ${m.person.pronouns === 'she' ? 'her' : 'him'} to join: about ${Math.round(joinChance(state, m.person.id) * 100)}% ${m.person.pronouns === 'she' ? 'she' : 'he'} says yes. The Vultures won't like the asking.`,
        ...(recruitProblem ? { recruitProblem } : {}),
      };
    });
}

/** Their story with the guild, from the news: newest first. */
export function vultureHistory(state: GameState, max = 10): string[] {
  return state.log
    .filter((l) => l.tags?.includes('vultures') || l.tags?.some((t) => t.startsWith('vulture_')))
    .slice(-max)
    .reverse()
    .map((l) => l.text);
}

export interface VulturesView {
  arrived: boolean;
  /** Before they come, or while they're gone. */
  note?: string;
  band: VultureBand;
  bandName: string;
  standing: number;
  meaning: string;
  strength: string;
  effects: string[];
  camps: VultureCampRow[];
  people: VulturePersonRow[];
  prisoners: PrisonerRow[];
  history: string[];
}

export function vulturesView(state: GameState, day: number): VulturesView {
  const v = state.vultures;
  const band = vultureBand(state);
  const base = {
    band,
    bandName: BAND_NAMES[band],
    standing: v.standing,
    meaning: MEANING[band],
    strength: `${strengthWord(v.strength)} (${Math.round(v.strength)} of 100)`,
    effects: vultureEffects(state),
    camps: vultureCamps(state),
    people: vulturePeople(state),
    prisoners: prisonerRows(state),
    history: vultureHistory(state),
  };
  if (!v.arrived) return { ...base, arrived: false, note: 'Word on the radio is that another crew works the far side of the Reach. Nobody here has met them yet.' };
  if (v.camps.length === 0) {
    const back = v.returnDay !== undefined ? Math.max(1, Math.round((v.returnDay - day) / DAYS_PER_REAL_DAY)) : undefined;
    return { ...base, arrived: true, note: `Driven out of the Reach, for now.${back ? ` Word is they'll be back in about ${back} real ${back === 1 ? 'day' : 'days'}.` : ''}` };
  }
  return { ...base, arrived: true };
}

/** The Reach's panel: one line on how things stand, or a rumour before they come. */
export function vulturesSummary(state: GameState): string {
  const v = state.vultures;
  if (!v.arrived) return 'Another crew works the far side of the Reach. Nobody here has met them yet.';
  if (v.camps.length === 0) return 'Driven out of the Reach, for now. Nobody thinks it\'s for good.';
  return `${BAND_NAMES[vultureBand(state)]}. ${strengthWord(v.strength)}, with ${v.camps.length === 1 ? 'one camp' : `${v.camps.length} camps`}.`;
}

/** One line for the Depot's header: where things stand with them (2.2.0: the full summary is on their screen). */
export function vulturesShort(state: GameState): string {
  if (state.vultures.camps.length === 0) return 'The Vultures: driven out';
  return `The Vultures: ${BAND_NAMES[vultureBand(state)].toLowerCase()}`;
}

/** A place's line: their camp here, or their turf. */
export function vulturePlaceLine(state: GameState, locationId: string): string | undefined {
  const camp = campAt(state, locationId);
  const thinner = `${Math.round((1 - VULTURES_TURF_FINDS) * 100)}% thinner`;
  if (camp) {
    const leader = campLeader(state, camp);
    const held = leader && (leader.met || leader.role === 'boss') ? `, held by ${name(leader.person)}` : '';
    return `The Vultures have a camp here${held}. Finds are ${thinner}, crews meet them often, and a crew can hit the camp.`;
  }
  if (onTurf(state, locationId)) return `The Vultures work here: finds are ${thinner}, and crews may meet them.`;
  return undefined;
}

/** The planner's job: hitting their camp, where there is one. */
export function assaultChoice(state: GameState, locationId: string): Choice<RunJob> | undefined {
  if (!campAt(state, locationId)) return undefined;
  const war = vultureBand(state) === 'war' ? '' : ' It means war with the Vultures.';
  return { id: 'assault', name: 'Hit their camp', description: `Go straight for the Vultures' camp: a hard fight, and their stores if the crew wins.${war}` };
}

/** What a run did with the Vultures, for the report. */
export function vultureReportLines(state: GameState, summary: RunSummary): string[] {
  const n = summary.vultures;
  if (!n) return [];
  const who = (id: string): string => {
    const m = state.vultures.people.find((x) => x.person.id === id);
    return m ? name(m.person) : 'one of them';
  };
  const out: string[] = [];
  if (n.campTaken) out.push(`Took the Vultures' camp at ${placeName(n.campTaken)}.`);
  for (const id of n.captured) out.push(`Brought ${who(id)} of the Vultures home as a prisoner.`);
  for (const id of n.killed) out.push(`Killed ${who(id)} of the Vultures.`);
  return out;
}

/** The tag in the Reach's list: "Vulture camp", "Vultures" for their turf, or nothing. */
export function vultureTag(state: GameState, locationId: string): string | undefined {
  if (campAt(state, locationId)) return 'Vulture camp';
  return onTurf(state, locationId) ? 'Vultures' : undefined;
}
