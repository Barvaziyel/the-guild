/**
 * Building and staffing the Depot: levels, costs, beds and who works where.
 */
import { addGuildLog } from '../chronicle.ts';
import { BUILDING_UPKEEP, BUNKS_CAP, MAX_BUILDING_LEVEL, SHARE_BED_AGE, WORKER_SLOTS } from '../constants.ts';
import { BUILDINGS, getLocation, getProject, getTrait, type BuildingDef, type BuildingLevel } from '../content/index.ts';
import { partnerOf } from '../relationships.ts';
import { statName } from '../stats.ts';
import type { BuildingId, BuildingPost, GameState, Post, ResourceId, Resources, StatId, Survivor } from '../types.ts';
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

/**
 * The level a building works at today: one lower when its upkeep couldn't be
 * paid (1.6.2). Effects use this; building and the screens use the real level.
 */
export function workingLevel(state: GameState, id: BuildingId): number {
  const level = buildingLevel(state, id);
  return state.depot.unpaid?.includes(id) ? Math.max(0, level - 1) : level;
}

/** What a building uses up a day at its level, on average: "1 ration", "0.25 meds". Nothing for most. */
export function upkeepOf(state: GameState, id: BuildingId): { res: ResourceId; amount: number } | undefined {
  const u = BUILDING_UPKEEP[id];
  const amount = u?.perLevel[buildingLevel(state, id)] ?? 0;
  return u && amount > 0 ? { res: u.res, amount } : undefined;
}

/** Beds in the Bunks: how many survivors the guild can hold. */
export function bunksCap(state: GameState): number {
  return BUNKS_CAP[Math.min(buildingLevel(state, 'bunks'), MAX_BUILDING_LEVEL)] ?? 0;
}

/** A bed for someone new to join. */
export function hasFreeBunk(state: GameState): boolean {
  return bedsTaken(state) < bunksCap(state);
}

/**
 * Beds the guild needs (§9.1): one each, but partners share one, and children
 * under 6 sleep in a parent's bed. People out on runs or at an outpost keep
 * theirs. More than the Bunks hold, and someone sleeps on the floor.
 */
export function bedsTaken(state: GameState): number {
  const ids = new Set(state.survivors.map((s) => s.id));
  let couples = 0;
  for (const s of state.survivors) {
    const p = partnerOf(state, s.id);
    if (p && ids.has(p.id) && p.id > s.id) couples++;
  }
  const kids = (state.children ?? []).filter((c) => !sharesParentsBed(state, c)).length;
  return state.survivors.length - couples + kids;
}

/** A child under 6 with a parent still in the guild sleeps in that parent's bed. */
export function sharesParentsBed(state: GameState, child: Survivor): boolean {
  if (child.age >= SHARE_BED_AGE || !child.parents) return false;
  const { mother, father } = child.parents;
  return state.survivors.some((s) => s.id === mother || s.id === father);
}

/** At the Depot today (not out on a run). */
export function atDepot(s: Survivor): boolean {
  return s.status === 'ready' && s.outpost === undefined;
}

/** Laid up: a condition that keeps them in bed, not only off runs (a wound, not being tired from one). */
export function laidUp(s: Survivor): boolean {
  return s.traits.some((t) => {
    const def = getTrait(t.id);
    return def.blocksRuns === true && def.onlyRuns !== true;
  });
}

/** At the Depot and fit to work (serious wounds keep people in bed; back from a run today is fine). */
export function canWork(s: Survivor): boolean {
  return atDepot(s) && !laidUp(s);
}

/** At the Depot but in bed until healed: no work, and no new post until then. */
export function resting(s: Survivor): boolean {
  return atDepot(s) && !canWork(s);
}

export function workerSlots(state: GameState, id: BuildingId): number {
  if (!buildingDef(id).workStat) return 0;
  return WORKER_SLOTS[Math.min(buildingLevel(state, id), MAX_BUILDING_LEVEL)] ?? 0;
}

/** The building a post is at, or undefined for a project's crew. */
export function postBuilding(post: Post | undefined): BuildingId | undefined {
  return post && 'building' in post ? post.building : undefined;
}

/** Everyone posted to a building, home or not. */
export function postedTo(state: GameState, id: BuildingId): Survivor[] {
  return state.survivors.filter((s) => postBuilding(s.post) === id);
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
export function postStat(s: Survivor, post: BuildingPost): StatId {
  const workStat = buildingDef(post.building).workStat;
  if (workStat && workStat !== 'any') return workStat;
  return post.stat ?? weakestStat(s);
}

export function weakestStat(s: Survivor): StatId {
  return STAT_IDS.reduce((low, id) => (s.stats[id] < s.stats[low] ? id : low), STAT_IDS[0]);
}

/** Why this post can't be given, or undefined if it can. */
export function postProblem(state: GameState, survivorId: string, post: BuildingPost): string | undefined {
  const def = buildingDef(post.building);
  if (!def.workStat) return `Nobody works the ${def.name}.`;
  if (buildingLevel(state, post.building) === 0) return `The ${def.name} isn't built yet.`;
  const others = postedTo(state, post.building).filter((s) => s.id !== survivorId);
  if (others.length >= workerSlots(state, post.building)) return `The ${buildingName(state, post.building)} has no room for another worker.`;
  const s = state.survivors.find((x) => x.id === survivorId);
  if (s && postBuilding(s.post) !== post.building && resting(s)) return `${s.firstName} is resting until healed.`;
  return undefined;
}

/**
 * Give a survivor a post, or take it away with `undefined`. A survivor out on a
 * run can be given one; they start when they're back. Someone living at an
 * outpost has to come home first. Throws if it can't be done.
 */
export function assignPost(state: GameState, survivorId: string, post: BuildingPost | undefined): void {
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

/** "Works the Garden", "Trains Aim in the Training Yard", "Works on the Wall", or "No post". */
export function postText(state: GameState, s: Survivor): string {
  if (!s.post) return 'No post';
  if ('project' in s.post) return `Works on ${projectTitle(s.post.project)}`;
  const name = buildingName(state, s.post.building);
  return buildingDef(s.post.building).workStat === 'any' ? `Trains ${statName(postStat(s, s.post))} in the ${name}` : `Works the ${name}`;
}

/** "the Wall", "the Memorial Garden": a project's name inside a sentence. */
export function projectTitle(id: Parameters<typeof getProject>[0]): string {
  const name = getProject(id).name;
  return name.startsWith('The ') ? `the ${name.slice(4)}` : name;
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
