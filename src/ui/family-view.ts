/**
 * Families on screen (1.10.0): the children at the Depot, how old they are and
 * when they join the guild, the family lines on a survivor's sheet, and the
 * notices for a baby due or a child about to join.
 */
import { ADULT_AGE, CHILD_HELP_AGE, MOTHER_AGES, YEAR_DAYS, dayStart, getOrigin, hasEmptyBed, hasTrait, partnerOf, type GameState, type Survivor } from '../engine/index.ts';
import type { PlannedNotice } from './runs-view.ts';

/** Eight Depot days make a real day. */
const DAYS_PER_REAL_DAY = 8;

/** "about 3 real days", "about 2 real weeks", "about 5 real months", "about 2 real years". */
export function realSpan(gameDays: number): string {
  const days = gameDays / DAYS_PER_REAL_DAY;
  const about = (n: number, unit: string): string => `about ${n} real ${unit}${n === 1 ? '' : 's'}`;
  if (days < 1) return 'less than a real day';
  if (days < 14) return about(Math.round(days), 'day');
  if (days < 60) return about(Math.round(days / 7), 'week');
  if (days < 548) return about(Math.round(days / 30.4), 'month');
  return about(Math.round(days / 365), 'year');
}

/** "a newborn", "4 months old", "1 year old", "6 years old". Months are game months, from the day they were born. */
export function ageText(s: Survivor, day: number): string {
  if (s.age > 0 || s.bornDay === undefined) return `${s.age} ${s.age === 1 ? 'year' : 'years'} old`;
  const months = Math.floor((day - s.bornDay) / (YEAR_DAYS / 12));
  if (months < 1) return 'a newborn';
  return `${months} ${months === 1 ? 'month' : 'months'} old`;
}

/** "Depot-Born, 4 months" for a baby, "Depot-Born, 6" for a child, as `originLine` reads for everyone else. */
export function childOriginLine(s: Survivor, day: number): string {
  const age = s.age > 0 || s.bornDay === undefined ? String(s.age) : ageText(s, day).replace(/ old$/, '').replace(/^a newborn$/, 'newborn');
  return `${getOrigin(s.origin).name}, ${age}`;
}

/** Whether this person is one of the Depot's children (not yet in the guild). */
export function isChild(state: GameState, id: string): boolean {
  return state.children.some((c) => c.id === id);
}

/** Game days until a child turns 16 and joins the guild. */
export function daysUntilGrown(c: Survivor, day: number): number {
  const birthday = c.nextBirthday ?? day;
  return Math.max(0, birthday + (ADULT_AGE - c.age - 1) * YEAR_DAYS - day);
}

/** "Joins the guild at 16, in about 2 real years." and what they do meanwhile. */
export function growingLine(c: Survivor, day: number): string {
  const when = `Joins the guild at ${ADULT_AGE}, in ${realSpan(daysUntilGrown(c, day))}.`;
  return c.age >= CHILD_HELP_AGE ? `Helps in the Garden. ${when}` : when;
}

function anyone(state: GameState, id: string): Survivor | undefined {
  return [...state.survivors, ...state.children, ...state.memorial, ...state.departed].find((s) => s.id === id);
}

/** "Mara Kell", or "the late Mara Kell" for a parent who died. */
function parentName(p: Survivor): string {
  return `${p.status === 'dead' ? 'the late ' : ''}${p.firstName} ${p.lastName}`;
}

/** "Daughter of Mara Kell and the late Tom Voss." for anyone born at the Depot; undefined for everyone else. */
export function parentsLine(state: GameState, s: Survivor): string | undefined {
  if (!s.parents) return undefined;
  const names = [s.parents.mother, s.parents.father].map((id) => (id ? anyone(state, id) : undefined)).filter((p): p is Survivor => p !== undefined);
  if (names.length === 0) return undefined;
  const word = s.pronouns === 'she' ? 'Daughter' : 'Son';
  return `${word} of ${names.map(parentName).join(' and ')}.`;
}

/** Their children, young or grown, still with the guild; oldest first. */
export function kidsOf(state: GameState, id: string): Survivor[] {
  return [...state.survivors, ...state.children]
    .filter((c) => c.parents?.mother === id || c.parents?.father === id)
    .sort((a, b) => (a.bornDay ?? 0) - (b.bornDay ?? 0));
}

function joinFirstNames(people: readonly Survivor[]): string {
  const names = people.map((p) => p.firstName);
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

/** The baby a survivor is waiting for, as the mother or the father. */
function waitingFor(state: GameState, s: Survivor): { mother: Survivor; dueDay: number } | undefined {
  if (s.expecting) return { mother: s, dueDay: s.expecting.dueDay };
  const mother = state.survivors.find((m) => m.expecting?.father === s.id);
  return mother?.expecting ? { mother, dueDay: mother.expecting.dueDay } : undefined;
}

/**
 * The family lines on a survivor's sheet: a baby on the way, their children,
 * and their parents if they were born at the Depot.
 */
export function familyLines(state: GameState, s: Survivor, day: number): string[] {
  const out: string[] = [];
  const baby = waitingFor(state, s);
  if (baby) {
    const left = baby.dueDay - day;
    const when = left <= 0 ? 'any time now' : `in ${realSpan(left)}`;
    if (baby.mother === s) {
      out.push(hasTrait(s, 'nearly_due') ? `Nearly due, and staying home until the baby comes, ${when}.` : `Expecting a baby, due ${when}.`);
    } else {
      out.push(`${baby.mother.firstName} is expecting ${s.pronouns === 'she' ? 'her' : 'his'} baby, due ${when}.`);
    }
  }
  const kids = kidsOf(state, s.id);
  if (kids.length > 0) out.push(`${s.pronouns === 'she' ? 'Mother' : 'Father'} of ${joinFirstNames(kids)}.`);
  const parents = parentsLine(state, s);
  if (parents) out.push(parents);
  return out;
}

export interface ChildRow {
  id: string;
  name: string;
  /** "Depot-Born, 4 months" */
  origin: string;
  /** "Mara and Tom's daughter" */
  family: string;
  /** "Joins the guild at 16, in about 2 real years." */
  growing: string;
}

/** The Depot's children for the roster, oldest first. */
export function childRows(state: GameState, day: number): ChildRow[] {
  return [...state.children]
    .sort((a, b) => (a.bornDay ?? 0) - (b.bornDay ?? 0))
    .map((c) => {
      const parents = [c.parents?.mother, c.parents?.father].map((id) => (id ? anyone(state, id) : undefined)).filter((p): p is Survivor => p !== undefined);
      const word = c.pronouns === 'she' ? 'daughter' : 'son';
      return {
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        origin: childOriginLine(c, day),
        family: parents.length > 0 ? `${joinFirstNames(parents)}'s ${word}` : 'Raised by the guild',
        growing: growingLine(c, day),
      };
    });
}

/** What the Roster says above the children. */
export function childrenSummary(state: GameState): string {
  const n = state.children.length;
  const on = state.survivors.filter((s) => s.expecting).length;
  const kids = n === 0 ? '' : `${n} ${n === 1 ? 'child' : 'children'} at the Depot`;
  const babies = on === 0 ? '' : `${on === 1 ? 'a baby' : `${on} babies`} on the way`;
  return [kids, babies].filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase()) + (kids || babies ? '.' : '');
}

/** Notices: a baby due, and a child about to turn 16 and join. */
export function familyNotices(state: GameState): PlannedNotice[] {
  const out: PlannedNotice[] = [];
  for (const m of state.survivors) {
    if (!m.expecting) continue;
    out.push({ id: `baby-${m.id}-${m.expecting.dueDay}`, at: dayStart(state, m.expecting.dueDay), title: 'A baby is due', body: `${m.firstName}'s baby is due at the Depot.` });
  }
  for (const c of state.children) {
    if (c.age !== ADULT_AGE - 1 || c.nextBirthday === undefined) continue;
    out.push({ id: `grown-${c.id}`, at: dayStart(state, c.nextBirthday), title: `${c.firstName} turns ${ADULT_AGE}`, body: `${c.firstName} ${c.lastName}, born at the Depot, joins the guild today.` });
  }
  return out;
}

/** Changes when `familyNotices` would: for App's notice sync. */
export function familyNoticeKey(state: GameState): string {
  const due = state.survivors.filter((s) => s.expecting).map((s) => `${s.id}@${s.expecting!.dueDay}`);
  const grown = state.children.filter((c) => c.age === ADULT_AGE - 1).map((c) => `${c.id}@${c.nextBirthday}`);
  return [...due, ...grown].join(';');
}

/**
 * For a couple who could have a baby but for the beds: "Every bed is taken,
 * so there's no room for a baby. The Bunks can keep one free." Undefined
 * otherwise.
 */
export function noRoomLine(state: GameState, s: Survivor): string | undefined {
  const partner = partnerOf(state, s.id);
  if (!partner || partner.pronouns === s.pronouns || !state.survivors.includes(partner)) return undefined;
  const mother = s.pronouns === 'she' ? s : partner;
  if (mother.expecting || mother.age < MOTHER_AGES[0] || mother.age > MOTHER_AGES[1] || hasEmptyBed(state)) return undefined;
  return "Every bed is taken, so there's no room for a baby. The Bunks can keep one free.";
}
