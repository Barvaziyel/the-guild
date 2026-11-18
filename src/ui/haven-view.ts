/**
 * Haven (§9.11) on screen: the Haven tab (what the guild knows, the leads to
 * follow, what was found and what was heard), and the lines the planner, the
 * Reach and a run's report show for a lead. Plain TypeScript, tested in Node.
 */
import {
  DEPTH_NAMES,
  HAVEN_BROADCAST,
  HAVEN_JOURNEY,
  HAVEN_ROAD_MINUTES,
  HAVEN_TEAM,
  caravanCost,
  caravanProblem,
  costText,
  getGear,
  maxHp,
  roadProblems,
  roadSeats,
  vehicleName,
  vulturesStayAway,
  vulturesWord,
  HAVEN_CLUES,
  HAVEN_DREAMER,
  HAVEN_VULTURES,
  buildingDef,
  fillRoles,
  clueFound,
  clueReady,
  clueWhere,
  depthOpen,
  getClue,
  getLocation,
  havenDreamer,
  havenLeads,
  havenRoadOpen,
  hiddenLeads,
  leadAt,
  planDepth,
  pointsTo,
  type GameState,
  type HavenClue,
  type HavenHeard,
  type HavenHintSource,
  type RunPlan,
  type RunReport,
} from '../engine/index.ts';
import type { Route } from './route.ts';
import { formatDuration, joinNames } from './runs-view.ts';

export interface HavenLeadView {
  id: string;
  title: string;
  /** Why anyone thinks it's there. */
  lead: string;
  /** "Hilltop Radio Station, the outskirts", "The Radio Tower, level 2". */
  where: string;
  /** Which find pointed here: "From the engineer’s logbook." None for the first leads. */
  from?: string;
  /** How it stands: not found yet, the level not open, tried before, or the building not up. */
  note?: string;
  /** Where to go about it. */
  go?: { label: string; to: Route };
  /** A building clue that can be worked out now: the button's words. */
  action?: string;
}

export interface HavenFoundView {
  id: string;
  title: string;
  text: string;
  /** "Found by Briar at Hilltop Radio Station, day 12." */
  line: string;
  /** What the guild knows from it, in one line. None for a goodbye. */
  learned?: string;
  /** Where it points on to (Aviel, 2.9.1: "what's the next clue that it leads to"). */
  next: HavenNextView[];
  isNew: boolean;
}

/** A clue a find points on to, and how it stands now. */
export interface HavenNextView {
  title: string;
  /** "The Water Plant: a lead now.", "Found.", "Once the convoy band is found too." */
  line: string;
  status: 'lead' | 'found' | 'waits';
}

export interface HavenHeardView {
  text: string;
  /** "On a run to the Old Metro, day 14." */
  line: string;
  isNew: boolean;
}

export interface HavenView {
  broadcast: string;
  /** Once Haven is finished (§9.12): the broadcast is gone, and this says so instead. */
  radioOff?: string;
  /** "First heard on day 9." */
  since: string;
  /** What the guild knows so far, a line a clue, in the order found. */
  known: string[];
  /** Once the guild knows where Haven is and how to get in. */
  road?: string;
  leads: HavenLeadView[];
  /** When some leads are at places nobody has found yet: never named, but there's more out there. */
  hidden?: string;
  /** Newest first. */
  found: HavenFoundView[];
  /** Newest first. */
  heard: HavenHeardView[];
}

/** "the Old Metro" in a sentence, "Hilltop Radio Station" as it is. */
function placeIn(id: string): string {
  return getLocation(id).name.replace(/^The /, 'the ');
}

/**
 * The Haven tab. `seen` is what the player had seen when they opened it, so
 * what came after shows as new.
 */
export function havenView(state: GameState, seen: { found: number; heard: number } = { found: Infinity, heard: Infinity }): HavenView | undefined {
  const haven = state.haven;
  if (!haven) return undefined;
  // The one who went (§9.11): their goodbye is filed with the clues, in their name.
  const gone = havenDreamer(state);
  const them = (t: string): string => (gone ? fillRoles(t, { a: gone }) : t);
  const title = (id: string): string => (id === HAVEN_VULTURES.id ? HAVEN_VULTURES.title : id === HAVEN_DREAMER.id ? them(HAVEN_DREAMER.title) : getClue(id).title);
  const learned = (id: string): string => (id === HAVEN_VULTURES.id ? HAVEN_VULTURES.learned : id === HAVEN_DREAMER.id ? them(HAVEN_DREAMER.learned) : getClue(id).learned);
  const text = (f: { id: string; at?: string }): string =>
    f.id === HAVEN_VULTURES.id ? HAVEN_VULTURES.text : f.id === HAVEN_DREAMER.id ? them(f.at ? HAVEN_DREAMER.said : HAVEN_DREAMER.note) : getClue(f.id).text;
  const found = haven.found.map((f, i) => {
    if (f.id === HAVEN_DREAMER.id) {
      const line = f.at ? `On the way home from ${placeIn(f.at)}, day ${f.day}.` : `Gone in the night, day ${f.day}.`;
      return { id: f.id, title: title(f.id), text: text(f), line, next: [], isNew: i >= seen.found };
    }
    const who = f.by ? state.survivors.find((s) => s.id === f.by)?.firstName ?? state.memorial.find((m) => m.id === f.by)?.firstName : undefined;
    const where = f.at ? ` at ${placeIn(f.at)}` : '';
    // What came to the Depot rather than on a run: the Vultures at the fence, or a building's clue worked out.
    const line = who
      ? `Found by ${who}${where}, day ${f.day}.`
      : f.at
        ? `Found${where}, day ${f.day}.`
        : f.id === HAVEN_VULTURES.id
          ? `At the fence, day ${f.day}.`
          : `Worked out at the Depot, day ${f.day}.`;
    return { id: f.id, title: title(f.id), text: text(f), line, learned: learned(f.id), next: nextViews(state, f.id), isNew: i >= seen.found };
  });
  const hidden = hiddenLeads(state);
  const heard = haven.heard.map((h, i) => ({ text: h.text, line: `${heardFrom(h)}, day ${h.day}.`, isNew: i >= seen.heard }));
  return {
    broadcast: HAVEN_BROADCAST,
    ...(haven.end?.won ? { radioOff: 'On the radio, where Haven used to be: nothing.' } : {}),
    since: `First heard on day ${haven.day}.`,
    known: haven.found.map((f) => learned(f.id)),
    ...(havenRoadOpen(state) ? { road: 'They know where Haven is, and how to get in.' } : {}),
    // Something to work out now comes first.
    leads: havenLeads(state)
      .map((c) => leadView(state, c))
      .sort((a, b) => Number(!!b.action) - Number(!!a.action)),
    ...(hidden > 0 ? { hidden: 'There may be more out past the places the guild knows. Scouting turns up new ones.' } : {}),
    found: found.reverse(),
    heard: heard.reverse(),
  };
}

const FROM: Record<HavenHintSource, string> = {
  run: 'On a run',
  gate: 'From someone new at the gate',
  trader: 'From a trader',
  radio: 'On the radio',
  fire: 'At the fire',
  captive: 'From a captive',
  vultures: 'From the Vultures',
};

function heardFrom(h: HavenHeard): string {
  return h.source === 'run' && h.at ? `On a run to ${placeIn(h.at)}` : FROM[h.source];
}

/** Where a find points on to, and how each stands (2.9.1). */
function nextViews(state: GameState, id: string): HavenNextView[] {
  return pointsTo(id).map((c) => {
    const known = c.where.kind === 'build' || (state.locations[c.where.locationId]?.discovered ?? false);
    const where = known ? capital(clueWhere(c)) : undefined;
    if (clueFound(state, c.id)) return { title: c.title, line: where ? `${where}: found.` : 'Found.', status: 'found' as const };
    const missing = c.after.filter((a) => !clueFound(state, a)).map((a) => lower(getClue(a).title));
    if (missing.length > 0) return { title: c.title, line: `Once ${listed(missing)} ${missing.length === 1 ? 'is' : 'are'} found too.`, status: 'waits' as const };
    return { title: c.title, line: where ? `${where}: a lead now.` : 'A lead now.', status: 'lead' as const };
  });
}

/** One find as the Found tab shows it, for a run's report (2.9.1). Undefined until it's filed. */
export function findView(state: GameState, id: string): HavenFoundView | undefined {
  return havenView(state)?.found.find((f) => f.id === id);
}

/** "a, b and c". */
function listed(items: string[]): string {
  return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)!}`;
}

function capital(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function leadView(state: GameState, c: HavenClue): HavenLeadView {
  const from = c.after.length > 0 ? `From ${listed(c.after.map((a) => lower(getClue(a).title)))}.` : undefined;
  const base = { id: c.id, title: c.title, lead: c.lead, ...(from ? { from } : {}) };
  if (c.where.kind === 'build') {
    const w = c.where;
    const name = buildingDef(w.building).name;
    const where = `The ${name}, level ${w.level}`;
    if (clueReady(state, c)) return { ...base, where, action: w.action };
    return { ...base, where, note: `Once the ${name} is at level ${w.level}.`, go: { label: 'See the Buildings', to: { screen: 'depot', tab: 'buildings' } } };
  }
  const w = c.where;
  const place = getLocation(w.locationId).name;
  const where = `${place}, ${DEPTH_NAMES[w.depth - 1]!.toLowerCase()}`;
  // Leads are only ever at places on the map (2.9.1), so there's no "nobody has found it" here.
  if (!depthOpen(state, w.locationId, w.depth)) {
    return { ...base, where, note: `${DEPTH_NAMES[w.depth - 1]} isn’t open yet: explore the level before it fully.`, go: { label: 'See the place', to: { screen: 'reach', id: w.locationId } } };
  }
  const tries = state.haven?.tries[c.id] ?? 0;
  const note = tries === 0 ? undefined : tries === 1 ? 'One crew looked and came back without it. Scouting looks harder.' : `${tries} crews looked and came back without it. Scouting looks harder.`;
  return { ...base, where, ...(note ? { note } : {}), go: { label: 'Plan a run there', to: { screen: 'plan', locationId: w.locationId } } };
}

/** The planner's line when the run would follow a lead: "A lead for Haven here: the engineer's logbook." */
export function planLeadLine(state: GameState, plan: Pick<RunPlan, 'locationId'> & Partial<RunPlan>): string | undefined {
  const depth = planDepth(plan);
  const clue = leadAt(state, plan.locationId, depth);
  if (clue) return `A lead for Haven here: ${lower(clue.title)}. If the crew gets there, they’ll look for it.`;
  // A lead deeper in than the level picked.
  const deeper = havenLeads(state).find((c) => c.where.kind === 'run' && c.where.locationId === plan.locationId && c.where.depth > depth);
  if (deeper && deeper.where.kind === 'run') return `A lead for Haven here, ${DEPTH_NAMES[deeper.where.depth - 1]!.toLowerCase()}: ${lower(deeper.title)}.`;
  return undefined;
}

/** The Reach's line for a place with leads: "A lead for Haven: the engineer's logbook." */
export function placeLeadLine(state: GameState, locationId: string): string | undefined {
  const here = havenLeads(state).filter((c) => c.where.kind === 'run' && c.where.locationId === locationId);
  if (here.length === 0) return undefined;
  return `A lead for Haven: ${here.map((c) => `${lower(c.title)}${c.where.kind === 'run' && c.where.depth > 1 ? ` (${DEPTH_NAMES[c.where.depth - 1]!.toLowerCase()})` : ''}`).join(', ')}.`;
}

/** Places with a lead to follow, for marks on the map. */
export function leadPlaces(state: GameState): Set<string> {
  return new Set(havenLeads(state).flatMap((c) => (c.where.kind === 'run' ? [c.where.locationId] : [])));
}

/** A report's line about Haven: who found what, or that it wasn't found. Undefined when the run had nothing to do with it. */
export function reportHavenLine(news: { lead?: { clue: string; found: boolean; by?: string } } | undefined, names: Record<string, string>): string | undefined {
  const lead = news?.lead;
  if (!lead) return undefined;
  const t = lower(getClue(lead.clue).title);
  if (!lead.found) return `For Haven: no sign of ${t} this time.`;
  const who = lead.by ? names[lead.by] : undefined;
  return who ? `For Haven: ${who} found ${t}.` : `For Haven: found ${t}.`;
}

/** A report's line for a place just found that has a lead for Haven: "There's a lead for Haven there: the engineer’s logbook." */
export function discoveredLeadLine(state: GameState, locationId: string): string | undefined {
  const here = havenLeads(state).filter((c) => c.where.kind === 'run' && c.where.locationId === locationId);
  return here.length > 0 ? `There’s a lead for Haven there: ${listed(here.map((c) => lower(c.title)))}.` : undefined;
}

/** "Rook went east to Haven, alone.": the one the broadcast pulled in, walking off from the road home. */
export function reportGoneLine(news: { ran?: { id: string } } | undefined, names: Record<string, string>): string | undefined {
  const id = news?.ran?.id;
  return id ? `${names[id] ?? 'One of them'} went east to Haven, alone.` : undefined;
}

/** Building clues ready to work out: something on the Haven tab waits for the player. */
export function havenReady(state: GameState): string[] {
  return HAVEN_CLUES.filter((c) => clueReady(state, c)).map((c) => c.id);
}

/** A title inside a sentence: "the engineer’s logbook", but "Red Hand’s ledger". */
function lower(title: string): string {
  return /^(Red Hand|Haven|St\. |Corwin)/.test(title) ? title : title.charAt(0).toLowerCase() + title.slice(1);
}

// ---------------------------------------------------------------- the road (2.9.0, Aviel: "make it look better")

/** A clue on the road: found, a lead open now, or still unknown. */
export type RoadStop = 'found' | 'open' | 'unknown';

export interface RoadView {
  /** One a clue, found ones first (in the order found), then the open leads, then the rest. */
  stops: RoadStop[];
  found: number;
  total: number;
  /** The far end: "Haven?" until they know where it is. */
  end: string;
  /** Under the map, in the notebook's hand: "6 of 13 found." or "The road is open." */
  line: string;
  roadOpen: boolean;
}

/** The hand-drawn road from the Depot to Haven at the top of the tab: how far along the guild is. */
export function roadView(state: GameState): RoadView | undefined {
  const haven = state.haven;
  if (!haven) return undefined;
  const total = HAVEN_CLUES.length;
  const found = HAVEN_CLUES.filter((c) => haven.found.some((f) => f.id === c.id)).length;
  const open = havenLeads(state).length;
  const stops: RoadStop[] = [...Array<RoadStop>(found).fill('found'), ...Array<RoadStop>(open).fill('open'), ...Array<RoadStop>(total - found - open).fill('unknown')];
  const roadOpen = havenRoadOpen(state);
  const known = haven.found.some((f) => f.id === 'bearing');
  return {
    stops,
    found,
    total,
    end: known ? 'Corwin Dam' : 'Haven?',
    line: haven.end ? (haven.end.won ? 'Haven is finished.' : 'Haven goes on.') : roadOpen ? 'The road is open.' : `${found} of ${total} found.`,
    roadOpen,
  };
}

/** Where the stops sit on the 340 × 120 map: a wandering road, left to right, the same every time. */
export function roadPoints(stops: number): { x: number; y: number }[] {
  const pts = [{ x: 22, y: 86 }];
  for (let i = 0; i < stops; i++) {
    const t = (i + 1) / (stops + 1);
    // Climbing gently east toward Haven, with a lazy bend or two, like a road on a map.
    pts.push({ x: Math.round(22 + t * 284), y: Math.round(84 - 30 * t + 11 * Math.sin(t * 9.5 + 0.3)) });
  }
  pts.push({ x: 312, y: 44 });
  return pts;
}

/** A smooth line through points (Catmull-Rom as cubic Béziers), as an SVG path. */
export function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  const p = points;
  let d = `M${p[0]!.x} ${p[0]!.y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[Math.max(0, i - 1)]!;
    const b = p[i]!;
    const c = p[i + 1]!;
    const e = p[Math.min(p.length - 1, i + 2)]!;
    const c1 = { x: b.x + (c.x - a.x) / 6, y: b.y + (c.y - a.y) / 6 };
    const c2 = { x: c.x - (e.x - b.x) / 6, y: c.y - (e.y - b.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${c.x} ${c.y}`;
  }
  return d;
}

/** How many hints the Heard page shows before "Older": the rest fold away, so the tab stays short. */
export const HEARD_SHOWN = 6;

// ---------------------------------------------------------------- the road east (§9.12, 3.0.0)

export interface RoadEastView {
  /** `ready`: the way is known and the guild hasn't gone; `out`: on the road now; `over`: it's done, for good. */
  stage: 'ready' | 'out' | 'over';
  title: string;
  lines: string[];
  /** Who has to ride and what carries them (ready). */
  seats?: string;
  /** Places in a trader's caravan for whoever the vehicles can't carry (ready, and short of seats). */
  caravan?: { label: string; cost: string; problem?: string };
  /** Worth knowing before they go, not stopping them (ready). */
  warnings: string[];
  /** What stops them going now (ready). */
  problems: string[];
  /** Setting out (ready, nothing stopping them). */
  go?: { label: string; confirm: string };
  /** The run, to follow it (out). */
  runId?: string;
}

/** Before the road east: what the Vultures sent, by how things stand with them; or that they aren't coming. */
function vultureLines(state: GameState): string[] {
  const word = vulturesWord(state);
  if (word) return [`${word.by} sends word from the Vultures: “${word.text}”`];
  return vulturesStayAway(state) ? [HAVEN_JOURNEY.noWord] : [];
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const numberWord = (n: number): string => NUMBER_WORDS[n] ?? String(n);

/** The road east on the Haven tab: getting ready, under way, or how it ended. Undefined until the way is known. */
export function roadEastView(state: GameState): RoadEastView | undefined {
  const haven = state.haven;
  if (!haven || !havenRoadOpen(state)) return undefined;

  if (haven.end) {
    const e = haven.end;
    if (!e.won) {
      return {
        stage: 'over',
        title: 'Haven goes on',
        lines: [`Day ${e.day}: the guild went east together, and came home beaten.`, 'The broadcast still comes, every hour.', 'It is what it is. The Depot is still there, and so are they, and they’ll keep building it.'],
        warnings: [],
        problems: [],
      };
    }
    const freed = e.freed + e.withVultures;
    const where =
      freed === 0
        ? undefined
        : e.withVultures === 0
          ? `${capital(numberWord(e.freed))} of those freed from its wards came home with the guild.`
          : e.freed === 0
            ? `${capital(numberWord(e.withVultures))} freed from its wards went with the Vultures: there was no room at the Depot.`
            : `Of those freed from its wards, ${numberWord(e.freed)} came home with the guild and ${numberWord(e.withVultures)} went with the Vultures: there wasn’t room for everyone.`;
    return {
      stage: 'over',
      title: 'Haven is finished',
      lines: [`Day ${e.day}: the guild went east together, and Haven is finished.`, ...(where ? [where] : []), 'Nobody found Dr. Marr.', 'The radio is quiet now. The Depot is the only haven there is: the one they built themselves.'],
      warnings: [],
      problems: [],
    };
  }

  if (haven.road) {
    const kids = haven.road.children.length;
    return {
      stage: 'out',
      title: 'On the road east',
      lines: [`The whole guild is on the road to Haven${kids > 0 ? `, ${kids === 1 ? 'the child' : 'the children'} too` : ''}. The Depot stands empty until they’re back.`],
      runId: haven.road.runId,
      warnings: [],
      problems: [],
    };
  }

  const seats = roadSeats(state);
  const riders = seats.people + seats.children;
  const who = seats.children > 0 ? `${numberWord(riders)} to carry: ${numberWord(seats.people)} of the guild and ${seats.children === 1 ? 'a child' : `${numberWord(seats.children)} children`}` : `${numberWord(riders)} to carry`;
  const vehicles = seats.vehicles.map((v) => `the ${vehicleName(v)}`);
  const carry =
    vehicles.length === 0
      ? 'The guild has no vehicle that runs.'
      : `${capital(joinNames(vehicles))} ${vehicles.length === 1 ? 'seats' : 'seat'} ${numberWord(seats.seats)}${seats.caravan > 0 ? `, and ${numberWord(seats.caravan)} ${seats.caravan === 1 ? 'has a place' : 'have places'} in a trader’s caravan` : ''}.`;
  const caravan =
    seats.short > 0
      ? (() => {
          const problem = caravanProblem(state);
          return {
            label: seats.short === 1 ? 'Buy a place in a caravan' : `Buy ${numberWord(seats.short)} places in a caravan`,
            cost: costText(caravanCost(seats.short)),
            ...(problem ? { problem } : {}),
          };
        })()
      : undefined;

  const warnings: string[] = [];
  const meds = state.resources.meds;
  if (meds === 0) warnings.push('No meds: nobody gets patched up between the fights.');
  else if (meds < 3) warnings.push(`Only ${meds === 1 ? 'one med' : `${numberWord(meds)} meds`} for the whole road.`);
  const guns = state.survivors.some((s) => s.equipment.weapon && getGear(s.equipment.weapon.defId).usesAmmo);
  if (guns && state.resources.ammo === 0) warnings.push('Some of them carry guns, but there’s no ammo.');
  const hurt = state.survivors.filter((s) => s.hp < maxHp(s) / 2).map((s) => s.firstName);
  if (hurt.length > 0) warnings.push(`${joinNames(hurt)} ${hurt.length === 1 ? 'is' : 'are'} hurt. Everyone comes anyway.`);
  const out = state.survivors.filter((s) => s.outpost !== undefined).map((s) => s.firstName);

  // The seats line is the caravan's to explain.
  const problems = roadProblems(state).filter((p) => !(caravan && p.startsWith('Not everyone has a seat')));
  return {
    stage: 'ready',
    title: 'The road east',
    lines: [
      'Corwin Dam is east, past the Glow. The whole guild goes together, children too, and nobody stays behind.',
      `The road takes ${formatDuration(HAVEN_ROAD_MINUTES.home * 60_000)} there and back, longer while they wait for your word at a fight. At each fight the ${numberWord(HAVEN_TEAM)} fittest go forward and the rest stay with the vehicles.`,
      `They take everything the Depot has: ${meds === 1 ? 'one med' : `${meds} meds`} and ${state.resources.ammo} ammo.`,
      ...(out.length > 0 ? [`${joinNames(out)} ${out.length === 1 ? 'comes' : 'come'} in from the outposts first.`] : []),
      ...vultureLines(state),
    ],
    seats: `${capital(who)}. ${carry}`,
    ...(caravan ? { caravan } : {}),
    warnings,
    problems,
    ...(problems.length === 0 && seats.short === 0
      ? {
          go: {
            label: 'Set out for Haven',
            confirm: 'Everyone sets out now, children too, and the Depot stands empty until they’re back. Once they’re on the road, there’s no turning back.',
          },
        }
      : {}),
  };
}

/** The Depot's headline while everyone is on the road east. */
export const EMPTY_DEPOT = 'Everyone is on the road east, children too. The Depot stands empty until they’re back.';

/** The orders line for the road east, where the planner's job, approach and retreat don't come into it. */
export const HAVEN_ORDERS = 'The whole guild, together, with everything the Depot had.';

export interface HavenReportView {
  headline: string;
  lines: { text: string; tone: 'good' | 'bad' | 'plain' }[];
}

/** A report from the road east (§9.12): how it ended, who was shot at the gate, who was freed and where they went. */
export function havenReport(state: GameState, report: Pick<RunReport, 'summary'>): HavenReportView | undefined {
  const end = report.summary.havenEnd;
  if (!end) return undefined;
  const lines: HavenReportView['lines'] = [];
  const shot = end.shot ? state.memorial.find((s) => s.id === end.shot) : undefined;
  if (shot) lines.push({ text: `${shot.firstName} was shot at Haven’s gate, running to warn the guild.`, tone: 'bad' });
  const after = state.haven?.end;
  if (end.won) {
    const freed = end.freed?.length ?? 0;
    if (freed > 0) {
      const joined = after?.freed ?? freed;
      const gone = after?.withVultures ?? 0;
      lines.push({
        text:
          gone === 0
            ? `${capital(numberWord(freed))} freed from Haven’s wards came home with the guild. They’re on the Roster now.`
            : joined === 0
              ? `${capital(numberWord(freed))} were freed from Haven’s wards. There was no room at the Depot, so they went with the Vultures.`
              : `${capital(numberWord(freed))} were freed from Haven’s wards: ${numberWord(joined)} came home with the guild, and ${numberWord(gone)} went with the Vultures, for want of beds.`,
        tone: 'good',
      });
    }
    if (end.vultures) lines.push({ text: 'The Vultures fought beside the guild at the gate. They won’t forget it.', tone: 'good' });
    lines.push({ text: 'Haven is finished. The game goes on.', tone: 'plain' });
  } else {
    if (end.vultures) lines.push({ text: 'The Vultures fought beside the guild at the gate, and dragged them out.', tone: 'plain' });
    lines.push({ text: 'Haven goes on. The Depot is still there, and so are they.', tone: 'plain' });
  }
  return { headline: end.won ? 'Haven is finished' : 'Haven goes on', lines };
}
