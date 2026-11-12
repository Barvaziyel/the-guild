/**
 * The yard: who is where at the Depot, for the drawing in `src/scene`, and
 * the line shown when something in it is tapped. Plain TypeScript, tested in Node.
 */
import {
  BUILDING_IDS,
  buildingLevel,
  buildingName,
  canWork,
  costText,
  fullName,
  getLocation,
  nextLevel,
  partnerOf,
  postText,
  resting,
  vehicleName,
  workerSlots,
  workingAt,
  type BuildingId,
  type GameState,
  type Run,
  type Survivor,
} from '../engine/index.ts';
import { HAIR_STYLES, portraitLook } from '../portrait/index.ts';
import { GATE_SPOTS, IDLE_SPOTS, PARKING_X, REST_SPOTS } from '../scene/layout.ts';
import { dayPhase, type FigureLook, type YardModel, type YardPerson } from '../scene/model.ts';
import { routeHash } from './route.ts';
import { joinNames } from './runs-view.ts';
import { clockTime } from './time.ts';
import { survivorStatus } from './view.ts';

const LONG_HAIR = new Set(['long', 'ponytail', 'braids', 'locks', 'wild']);
const HATS = new Set(['beanie', 'bandana', 'goggles']);

/** A small figure's colors and shape, from the survivor's portrait so the two agree. */
export function figureLook(s: Survivor): FigureLook {
  const look = portraitLook(s);
  const style = HAIR_STYLES[look.hairIndex];
  const hurt = s.traits.some((t) => (t.id === 'wounded' || t.id === 'badly_wounded') && !t.hidden);
  return {
    skin: look.skin.base,
    skinShade: look.skin.shade,
    hair: look.hairColor.base,
    hairDark: look.hairColor.dark,
    longHair: style !== undefined && LONG_HAIR.has(style),
    bald: style === 'bald',
    cloth: look.clothColor,
    accent: look.accentColor,
    ...(s.equipment.armor ? { armor: s.equipment.armor.defId } : {}),
    ...(HATS.has(look.accessory) ? { hat: look.accessory as FigureLook['hat'] } : {}),
    hurt,
  };
}

const sheet = (s: Survivor): string => routeHash({ screen: 'survivor', id: s.id, tab: 'stats' });
const lower = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** Everyone at home, in order, with partners side by side. */
function idleOrder(state: GameState, idle: Survivor[]): Survivor[] {
  const out: Survivor[] = [];
  for (const s of idle) {
    if (out.includes(s)) continue;
    out.push(s);
    const partner = partnerOf(state, s.id);
    if (partner && idle.includes(partner) && !out.includes(partner)) out.push(partner);
  }
  return out;
}

/** The Depot as the drawing shows it, at the hour on the player's clock. */
export function yardModel(state: GameState, hour: number, day?: number): YardModel {
  const people: YardPerson[] = [];
  const home = state.survivors.filter((s) => s.status === 'ready');

  // On their cots.
  const infirmary = buildingLevel(state, 'infirmary') > 0;
  const cots = infirmary ? REST_SPOTS.infirmary : REST_SPOTS.bunks;
  home.filter(resting).slice(0, cots.length).forEach((s, slot) => {
    people.push({ id: s.id, look: figureLook(s), place: { kind: 'resting', slot, infirmary }, go: sheet(s), label: `${fullName(s)}. ${survivorStatus(s, day).label}.` });
  });

  // At their posts.
  const working = new Set<string>();
  for (const id of BUILDING_IDS) {
    if (buildingLevel(state, id) === 0) continue;
    workingAt(state, id).slice(0, 3).forEach((s, slot) => {
      working.add(s.id);
      people.push({ id: s.id, look: figureLook(s), place: { kind: 'post', building: id, slot }, go: sheet(s), label: `${fullName(s)} ${lower(postText(state, s))}.` });
    });
  }

  // Everyone else, by the fire and about the yard.
  const idle = idleOrder(state, home.filter((s) => canWork(s) && !working.has(s.id)));
  idle.slice(0, IDLE_SPOTS.length).forEach((s, slot) => {
    const partner = partnerOf(state, s.id);
    const withPartner = partner && idle.includes(partner) ? ` with ${partner.firstName}` : '';
    const where = IDLE_SPOTS[slot]!.pose === 'sit' ? `by the fire${withPartner}` : `about the yard${withPartner}`;
    people.push({ id: s.id, look: figureLook(s), place: { kind: 'idle', slot }, go: sheet(s), label: `${fullName(s)}, taking it easy ${where}.` });
  });

  // At the gate.
  state.depot.recruits.slice(0, GATE_SPOTS.length).forEach((c, slot) => {
    const s = c.survivor;
    people.push({ id: s.id, look: figureLook(s), place: { kind: 'gate', slot }, go: routeHash({ screen: 'recruits' }), label: `${fullName(s)}, at the gate asking to join.` });
  });

  const vehicles = state.vehicles
    .filter((v) => !v.runId)
    .slice(0, PARKING_X.length)
    .map((v) => ({ id: v.id, defId: v.defId, broken: v.condition <= 0, label: v.condition <= 0 ? `The ${vehicleName(v)}, broken down.` : `The ${vehicleName(v)}, ${v.condition}%.` }));

  const buildings = {} as Record<BuildingId, number>;
  for (const id of BUILDING_IDS) buildings[id] = buildingLevel(state, id);

  return { buildings, people, trader: state.depot.offers.length > 0, vehicles, phase: dayPhase(hour) };
}

/** What a tap on a building says: "Garden, level 2. 2 of 3 working." or what it would cost. */
export function buildingCaption(state: GameState, id: BuildingId): string {
  const level = buildingLevel(state, id);
  const name = buildingName(state, id);
  if (level === 0) {
    const next = nextLevel(state, id);
    return `${name}: not built yet${next ? `. ${costText(next.cost)}` : ''}.`;
  }
  const slots = workerSlots(state, id);
  const crew = slots > 0 ? ` ${workingAt(state, id).length} of ${slots} working.` : '';
  return `${name}, level ${level}.${crew}`;
}

/** Who's out, so an empty yard makes sense: "Rhea and Cal are at Maple Street, back at 9:40 PM." */
export function awayLines(state: GameState): string[] {
  return state.runs.map((run: Run) => {
    const names = run.plan.crew.map((id) => state.survivors.find((s) => s.id === id)?.firstName).filter((n): n is string => n !== undefined);
    return `${joinNames(names)} ${names.length === 1 ? 'is' : 'are'} out at ${getLocation(run.plan.locationId).name}, back at ${clockTime(run.returnAt)}.`;
  });
}
