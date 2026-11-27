/**
 * Places that need the right people (§7.16, 3.13.0): who covers a part's needs, which parts the guild
 * knows about, and the perks a crew's pairs bring. Shared by the planner and the run.
 */
import { NEEDS, PERKS, getGear, getTrait, getVehicleDef, partAt, type PartDef, type PerkDef } from './content/index.ts';
import { DEPTHS, NEED_BAR, NEED_CARGO, NEED_TOGETHER, NEED_TOOL } from './constants.ts';
import { itemDef } from './gear.ts';
import { ensureLocationState, locationState, planDepth } from './locations.ts';
import { effectiveStat } from './stats.ts';
import type { GameState, ItemInstance, NeedKind, RunJob, RunPlan, Survivor } from './types.ts';

/** The job that goes for a place's best part: a scavenging crew, the first time it searches. */
export const PART_JOBS: readonly RunJob[] = ['scavenge'];

/** How good at a need's stat someone has to be to cover it on a level. */
export function needBar(level: number): number {
  return NEED_BAR[Math.max(1, Math.min(DEPTHS, level)) - 1]!;
}

/** How a need is covered: a trait or gear for it, good enough, a tool that helps, two at once, or a vehicle. */
export type CoverHow = 'trait' | 'gear' | 'stat' | 'tool' | 'together' | 'vehicle';

export interface NeedCover {
  how: CoverHow;
  /** Survivor id of whoever does it. */
  by: string;
  /** The other of two who do it together. */
  with?: string;
  /** The trait that covers it (how 'trait'). */
  trait?: string;
  /** The piece of gear that covers it or helps (how 'gear' or 'tool'), by its def id. */
  item?: string;
}

function items(s: Survivor): ItemInstance[] {
  return Object.values(s.equipment).filter((i): i is ItemInstance => i !== undefined && i !== null);
}

function holding(s: Survivor, kind: NeedKind, hook: 'needCover' | 'needHelp'): string | undefined {
  return items(s).find((i) => itemDef(i).hooks?.[hook]?.includes(kind))?.defId;
}

function bestOf<T>(list: readonly T[], score: (x: T) => number): T | undefined {
  let best: T | undefined;
  let top = -Infinity;
  for (const x of list) {
    const v = score(x);
    if (v > top) {
      best = x;
      top = v;
    }
  }
  return best;
}

/**
 * Who covers a need among these people on a level, if anyone: first a trait or a piece of gear that
 * covers it whatever the stats, then whoever is good enough, then someone a little less good holding a
 * tool that helps, then two who are nearly good enough together, then a vehicle with room for a load.
 * `hidden` lets a hidden trait count (on the run, where it then shows itself; never in the planner).
 */
export function coverNeed(people: readonly Survivor[], kind: NeedKind, level: number, opts: { vehicle?: boolean; hidden?: boolean } = {}): NeedCover | undefined {
  const def = NEEDS[kind];
  const stat = (s: Survivor): number => effectiveStat(s, def.stat);
  const bar = needBar(level);
  for (const hidden of opts.hidden ? [false, true] : [false]) {
    for (const s of people) {
      const t = s.traits.find((x) => (x.hidden === true) === hidden && getTrait(x.id).hooks?.needCover?.includes(kind));
      if (t) return { how: 'trait', by: s.id, trait: t.id };
    }
  }
  for (const s of people) {
    const item = holding(s, kind, 'needCover');
    if (item) return { how: 'gear', by: s.id, item };
  }
  const good = bestOf(
    people.filter((s) => stat(s) >= bar),
    stat,
  );
  if (good) return { how: 'stat', by: good.id };
  const helped = bestOf(
    people.filter((s) => holding(s, kind, 'needHelp') && stat(s) >= bar - NEED_TOOL),
    stat,
  );
  if (helped) return { how: 'tool', by: helped.id, item: holding(helped, kind, 'needHelp')! };
  if (def.together) {
    const pair = [...people].filter((s) => stat(s) >= bar - NEED_TOGETHER).sort((a, b) => stat(b) - stat(a));
    if (pair.length >= 2) return { how: 'together', by: pair[0]!.id, with: pair[1]!.id };
  }
  if (def.vehicle && opts.vehicle && people.length > 0) return { how: 'vehicle', by: bestOf(people, stat)!.id };
  return undefined;
}

/** Whether a vehicle on this plan has room for a load. */
export function planCarries(state: GameState, plan: RunPlan): boolean {
  return (plan.vehicles ?? []).some((id) => {
    const v = state.vehicles.find((x) => x.id === id);
    return v !== undefined && getVehicleDef(v.defId).cargo >= NEED_CARGO;
  });
}

// ---------------------------------------------------------------- what the guild knows

/** Whether the guild knows of a level's best part, and so what it needs. */
export function knowsPart(state: GameState, locationId: string, level: number): boolean {
  return (locationState(state, locationId).parts ?? []).includes(level);
}

/** A run came back knowing of these levels' parts. */
export function learnParts(state: GameState, locationId: string, levels: readonly number[]): void {
  const fresh = levels.filter((l) => partAt(locationId, l) && !knowsPart(state, locationId, l));
  if (fresh.length === 0) return;
  const here = ensureLocationState(state, locationId);
  here.parts = [...(here.parts ?? []), ...fresh].sort((a, b) => a - b);
}

/** One of a part's needs on a plan: what it is, what's in the way, and who covers it, if anyone. */
export interface PlannedNeed {
  kind: NeedKind;
  it: string;
  cover?: NeedCover;
}

/** The best part a plan would come to, and how its crew covers it. Undefined if the job or place has none. */
export function plannedPart(state: GameState, plan: RunPlan): { part: PartDef; level: number; known: boolean; needs: PlannedNeed[] } | undefined {
  if (!PART_JOBS.includes(plan.job)) return undefined;
  const level = planDepth(plan);
  const part = partAt(plan.locationId, level);
  if (!part) return undefined;
  const people = plan.crew.map((id) => state.survivors.find((s) => s.id === id)).filter((s): s is Survivor => s !== undefined);
  const vehicle = planCarries(state, plan);
  return {
    part,
    level,
    known: knowsPart(state, plan.locationId, level),
    needs: part.needs.map((n) => {
      const cover = coverNeed(people, n.kind, level, { vehicle });
      return { kind: n.kind, it: n.it ?? part.it, ...(cover ? { cover } : {}) };
    }),
  };
}

/** The needs of a level that this one person covers alone (for the crew picker's tags). */
export function needsCoveredBy(s: Survivor, locationId: string, level: number): NeedKind[] {
  const part = partAt(locationId, level);
  if (!part) return [];
  return part.needs.map((n) => n.kind).filter((k, i, all) => all.indexOf(k) === i && coverNeed([s], k, level) !== undefined);
}

/** How a line names a piece of gear mid-sentence: "the lockpicks", "the Geiger counter". */
export function gearCalled(defId: string): string {
  const def = getGear(defId);
  return def.called ?? `the ${def.name.toLowerCase()}`;
}

// ---------------------------------------------------------------- crew perks

/** A perk a crew has: which one, and the two who make it. */
export interface CrewPerk {
  perk: PerkDef;
  pair: readonly [string, string];
}

/** The perks these people make between them (§7.16): visible traits only, one pair for each perk. */
export function crewPerks(people: readonly Survivor[]): CrewPerk[] {
  const has = (s: Survivor, id: string): boolean => s.traits.some((t) => t.id === id && !t.hidden);
  const out: CrewPerk[] = [];
  for (const perk of PERKS) {
    const [first, second] = perk.traits;
    for (const a of people) {
      if (!has(a, first)) continue;
      const b = people.find((o) => o !== a && has(o, second));
      if (b) {
        out.push({ perk, pair: [a.id, b.id] });
        break;
      }
    }
  }
  return out;
}

/** What a crew's perks add to one person's check: the stat, and what the check is about. */
export function perkMod(perks: readonly CrewPerk[], id: string, stat: string, contexts: readonly string[]): number {
  let mod = 0;
  for (const { perk, pair } of perks) {
    for (const m of perk.mods) {
      if (m.stat && m.stat !== stat) continue;
      if (!contexts.includes(m.context)) continue;
      const who = m.who === undefined ? pair : [pair[m.who]];
      if (who.includes(id)) mod += m.mod;
    }
  }
  return mod;
}
