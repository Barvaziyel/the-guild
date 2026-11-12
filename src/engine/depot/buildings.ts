/**
 * Building and staffing the Depot: levels, costs, beds and who works where.
 */
import { addGuildLog } from '../chronicle.ts';
import { BUNKS_CAP, MAX_BUILDING_LEVEL, WORKER_SLOTS } from '../constants.ts';
import { BUILDINGS, getLocation, getTrait, type BuildingDef, type BuildingLevel } from '../content/index.ts';
import { statName } from '../stats.ts';
import type { BuildingId, GameState, Post, ResourceId, Resources, StatId, Survivor } from '../types.ts';
import { BUILDING_IDS, RESOURCE_IDS, STAT_IDS } from '../types.ts';

const byId = new Map<BuildingId, BuildingDef>(BUILDINGS.map((b) => [b.id, b]));

export function buildingDef(id: BuildingId): BuildingDef {
  const def = byId.get(id);
  if (!def) throw new Error(`Unknown building: ${id}`);
  return def;
}

/** Buildings as a new game has them. */
export function initialBuildings(): Record<BuildingId, number> {
  const out = {} as Record<BuildingId, number>;
  for (const id of BUILDING_IDS) out[id] = byId.get(id)?.startLevel ?? 0;
  return out;
}

export function buildingLevel(state: GameState, id: BuildingId): number {
  return state.buildings[id] ?? 0;
}

/** The name at the current level ("Bar" for a level 2 Firepit), or the base name if unbuilt. */
export function buildingName(state: GameState, id: BuildingId): string {
  const def = buildingDef(id);
  const level = buildingLevel(state, id);
  return (level > 0 ? def.levels[level - 1]?.name : undefined) ?? def.name;
}

/** What the next level would bring, or undefined at the top. */
export function nextLevel(state: GameState, id: BuildingId): BuildingLevel | undefined {
  const level = buildingLevel(state, id);
  return level >= MAX_BUILDING_LEVEL ? undefined : buildingDef(id).levels[level];
}

export function canAfford(state: GameState, cost: Partial<Resources>): boolean {
  return RESOURCE_IDS.every((r) => state.resources[r] >= (cost[r] ?? 0));
}

export function payCost(state: GameState, cost: Partial<Resources>): void {
  for (const r of RESOURCE_IDS) state.resources[r] -= cost[r] ?? 0;
}

/** "30 scrap, 2 tech". */
export function costText(cost: Partial<Resources>): string {
  const parts = (Object.entries(cost) as [ResourceId, number][]).filter(([, n]) => n > 0).map(([r, n]) => `${n} ${r}`);
  return parts.length > 0 ? parts.join(', ') : 'nothing';
}

/** Why the next level can't be built now, or undefined if it can. */
export function buildProblem(state: GameState, id: BuildingId): string | undefined {
  const next = nextLevel(state, id);
  if (!next) return `The ${buildingName(state, id)} is as good as it gets.`;
  if (!canAfford(state, next.cost)) return `Needs ${costText(next.cost)}.`;
  return undefined;
}

/** Build or improve a building, paying for it. Throws if it can't be done. */
export function build(state: GameState, id: BuildingId, day: number): void {
  const problem = buildProblem(state, id);
  if (problem) throw new Error(problem);
  payCost(state, nextLevel(state, id)!.cost);
  const before = buildingLevel(state, id);
  state.buildings[id] = before + 1;
  const name = buildingName(state, id);
  addGuildLog(state, day, before === 0 ? `Built the ${name}.` : `Improved the Depot: the ${name} is now level ${before + 1}.`, ['build', id]);
}

// ---------------------------------------------------------------- people

/** Beds in the Bunks: how many survivors the guild can hold. */
export function bunksCap(state: GameState): number {
  return BUNKS_CAP[Math.min(buildingLevel(state, 'bunks'), MAX_BUILDING_LEVEL)] ?? 0;
}

export function hasFreeBunk(state: GameState): boolean {
  return state.survivors.length < bunksCap(state);
}

/** At the Depot today (not out on a run). */
export function atDepot(s: Survivor): boolean {
  return s.status === 'ready' && s.outpost === undefined;
}

/** At the Depot and fit to work (serious wounds keep people in bed). */
export function canWork(s: Survivor): boolean {
  return atDepot(s) && !s.traits.some((t) => getTrait(t.id).blocksRuns);
}

/** At the Depot but in bed until healed: no work, and no new post until then. */
export function resting(s: Survivor): boolean {
  return atDepot(s) && !canWork(s);
}

export function workerSlots(state: GameState, id: BuildingId): number {
  if (!buildingDef(id).workStat) return 0;
  return WORKER_SLOTS[Math.min(buildingLevel(state, id), MAX_BUILDING_LEVEL)] ?? 0;
}

/** Everyone posted to a building, home or not. */
export function postedTo(state: GameState, id: BuildingId): Survivor[] {
  return state.survivors.filter((s) => s.post?.building === id);
}

/**
 * Take the extra workers off any building with more than it has room for,
 * keeping those at the Depot first. Returns who was taken off, and from where.
 */
export function trimPosts(state: GameState): { survivor: Survivor; building: BuildingId }[] {
  const removed: { survivor: Survivor; building: BuildingId }[] = [];
  for (const id of BUILDING_IDS) {
    const posted = postedTo(state, id);
    const room = workerSlots(state, id);
    if (posted.length <= room) continue;
    const keep = [...posted].sort((a, b) => Number(atDepot(b)) - Number(atDepot(a))).slice(0, room);
    for (const s of posted) {
      if (keep.includes(s)) continue;
      delete s.post;
      removed.push({ survivor: s, building: id });
    }
  }
  return removed;
}

/** Those working a building today. */
export function workingAt(state: GameState, id: BuildingId): Survivor[] {
  return postedTo(state, id).filter(canWork);
}

/** The stat a worker practices at their post. */
export function postStat(s: Survivor, post: Post): StatId {
  const workStat = buildingDef(post.building).workStat;
  if (workStat && workStat !== 'any') return workStat;
  return post.stat ?? weakestStat(s);
}

export function weakestStat(s: Survivor): StatId {
  return STAT_IDS.reduce((low, id) => (s.stats[id] < s.stats[low] ? id : low), STAT_IDS[0]);
}

/** Why this post can't be given, or undefined if it can. */
export function postProblem(state: GameState, survivorId: string, post: Post): string | undefined {
  const def = buildingDef(post.building);
  if (!def.workStat) return `Nobody works the ${def.name}.`;
  if (buildingLevel(state, post.building) === 0) return `The ${def.name} isn't built yet.`;
  const others = postedTo(state, post.building).filter((s) => s.id !== survivorId);
  if (others.length >= workerSlots(state, post.building)) return `The ${buildingName(state, post.building)} has no room for another worker.`;
  const s = state.survivors.find((x) => x.id === survivorId);
  if (s && s.post?.building !== post.building && resting(s)) return `${s.firstName} is resting until healed.`;
  return undefined;
}

/**
 * Give a survivor a post, or take it away with `undefined`. A survivor out on a
 * run can be given one; they start when they're back. Someone living at an
 * outpost has to come home first. Throws if it can't be done.
 */
export function assignPost(state: GameState, survivorId: string, post: Post | undefined): void {
  const s = state.survivors.find((x) => x.id === survivorId);
  if (!s) throw new Error(`Unknown survivor: ${survivorId}`);
  if (post && s.outpost) throw new Error(`${s.firstName} lives at the outpost at ${getLocation(s.outpost).name}.`);
  if (!post) {
    delete s.post;
    return;
  }
  const problem = postProblem(state, survivorId, post);
  if (problem) throw new Error(problem);
  const workStat = buildingDef(post.building).workStat;
  s.post = workStat === 'any' ? { building: post.building, stat: post.stat ?? weakestStat(s) } : { building: post.building };
}

/** "Works the Garden", "Trains Aim in the Training Yard", or "No post". */
export function postText(state: GameState, s: Survivor): string {
  if (!s.post) return 'No post';
  const name = buildingName(state, s.post.building);
  return buildingDef(s.post.building).workStat === 'any' ? `Trains ${statName(postStat(s, s.post))} in the ${name}` : `Works the ${name}`;
}

/**
 * Starting posts for a guild that has none: the two sharpest in the Garden and
 * the steadiest by the Firepit, so a new guild feeds itself.
 */
export function defaultPosts(state: GameState): void {
  if (state.survivors.some((s) => s.post)) return;
  const free = state.survivors;
  const byWits = [...free].sort((a, b) => b.stats.wits - a.stats.wits);
  const gardeners = byWits.slice(0, Math.min(workerSlots(state, 'garden') - postedTo(state, 'garden').length, byWits.length));
  for (const s of gardeners) s.post = { building: 'garden' };
  const rest = free.filter((s) => !s.post).sort((a, b) => b.stats.nerve - a.stats.nerve);
  if (rest[0] && workerSlots(state, 'firepit') > postedTo(state, 'firepit').length) rest[0].post = { building: 'firepit' };
}
