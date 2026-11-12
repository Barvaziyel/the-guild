/**
 * Projects (§9.6): big works at the Depot that change the game for good.
 * A project has three stages. The player pays for a stage, and its crew
 * works it off day by day; only one stage is under way at a time. Being on a
 * project's crew is a post, like working a building. What each finished
 * project does is read where it matters: the Line in `shortcut` (plan.ts),
 * the Wall in `raidDefense`, the Clinic and the Memorial Garden in the Depot
 * day, the Relay in `outpostLimit`.
 */
import { addChronicle, addGuildLog } from './chronicle.ts';
import {
  CLINIC_HEAL_MULT,
  LINE_TIME,
  MEMORIAL_RELIEF,
  PROJECT_CREW,
  PROJECT_CREW_RATIONS,
  PROJECT_WORK_BASE,
  PROJECT_WORK_PER_STAT,
  RELAY_OUTPOSTS,
  WALL_DEFENSE,
  WORK_PRACTICE,
} from './constants.ts';
import { LINE_STOPS, LOCATIONS, PROJECTS, getProject, type ProjectDef, type ProjectStage } from './content/index.ts';
import { atDepot, buildingDef, buildingLevel, canAfford, canWork, costText, payCost, resting } from './depot/buildings.ts';
import { ensureLocationState } from './locations.ts';
import { addPractice, effectiveStat } from './stats.ts';
import type { GameState, Post, ProjectId, ProjectState, Survivor } from './types.ts';

export { CLINIC_HEAL_MULT, LINE_TIME, MEMORIAL_RELIEF, RELAY_OUTPOSTS, WALL_DEFENSE };

export function projectState(state: GameState, id: ProjectId): ProjectState {
  return state.projects[id] ?? { done: 0 };
}

export function projectStages(id: ProjectId): number {
  return getProject(id).stages.length;
}

/** Finished: every stage done, and what it does is in force. */
export function projectDone(state: GameState, id: ProjectId): boolean {
  return projectState(state, id).done >= projectStages(id);
}

/** The project with a stage under way, if any. */
export function projectUnderWay(state: GameState): ProjectId | undefined {
  return PROJECTS.find((p) => state.projects[p.id]?.work !== undefined)?.id;
}

/** The next stage to pay for or finish, or undefined once it's done. */
export function currentStage(state: GameState, id: ProjectId): ProjectStage | undefined {
  return getProject(id).stages[projectState(state, id).done];
}

/** What has to happen before a project can start, or undefined if nothing. */
export function projectNeeds(state: GameState, id: ProjectId): string | undefined {
  const { needs } = getProject(id);
  if (needs.building) {
    const [b, level] = needs.building;
    if (buildingLevel(state, b) < level) return `Needs a level ${level} ${buildingDef(b).name}.`;
  }
  if (needs.memorial && state.memorial.length === 0) return 'For when someone has died.';
  return undefined;
}

/** Why the next stage can't be started now, or undefined if it can. */
export function stageProblem(state: GameState, id: ProjectId): string | undefined {
  const stage = currentStage(state, id);
  if (!stage) return `${getProject(id).name} is finished.`;
  const needs = projectNeeds(state, id);
  if (needs) return needs;
  const busy = projectUnderWay(state);
  if (busy === id) return 'This stage is under way.';
  if (busy) return `One project at a time: ${getProject(busy).name} is under way.`;
  if (!canAfford(state, stage.cost)) return `Needs ${costText(stage.cost)}.`;
  return undefined;
}

/** Pay for the next stage and set its crew to work. Throws if it can't be done. */
export function startStage(state: GameState, id: ProjectId, day: number): void {
  const problem = stageProblem(state, id);
  if (problem) throw new Error(problem);
  const def = getProject(id);
  const ps = (state.projects[id] ??= { done: 0 });
  payCost(state, def.stages[ps.done]!.cost);
  ps.work = 0;
  ps.startedDay ??= day;
  // One project at a time, so there's one crew: whoever was on a paused one comes along.
  const room = PROJECT_CREW - projectCrew(state, id).length;
  const idle = PROJECTS.filter((p) => p.id !== id).flatMap((p) => projectCrew(state, p.id));
  for (const s of idle.slice(0, Math.max(0, room))) s.post = { project: id };
  addGuildLog(state, day, `Work began on ${def.name}: stage ${ps.done + 1} of ${def.stages.length}.`, ['project', id]);
}

/** Everyone on a project's crew, home or not. */
export function projectCrew(state: GameState, id: ProjectId): Survivor[] {
  return state.survivors.filter((s) => s.post !== undefined && 'project' in s.post && s.post.project === id);
}

/** The project a survivor's post is on, if it's a project. */
export function postProject(post: Post | undefined): ProjectId | undefined {
  return post && 'project' in post ? post.project : undefined;
}

/** Those working a project today: on its crew, fit and at home, with a stage under way. */
export function workingOnProject(state: GameState, id: ProjectId): Survivor[] {
  if (state.projects[id]?.work === undefined) return [];
  return projectCrew(state, id).filter(canWork);
}

/** Work one crew member adds in a day. */
export function workADay(s: Survivor, def: ProjectDef): number {
  return PROJECT_WORK_BASE + PROJECT_WORK_PER_STAT * effectiveStat(s, def.workStat);
}

/** Why someone can't join a project's crew, or undefined if they can. */
export function crewProblem(state: GameState, survivorId: string, id: ProjectId): string | undefined {
  const def = getProject(id);
  if (projectDone(state, id)) return `${def.name} is finished.`;
  if (!state.projects[id]) return `${def.name} hasn't been started.`;
  const s = state.survivors.find((x) => x.id === survivorId);
  if (!s) return 'Unknown survivor.';
  if (s.outpost) return `${s.firstName} lives at an outpost.`;
  if (postProject(s.post) === id) return undefined;
  if (projectCrew(state, id).length >= PROJECT_CREW) return `${def.name} has a full crew.`;
  if (resting(s)) return `${s.firstName} is resting until healed.`;
  return undefined;
}

/** Put someone on a project's crew (leaving any other post). Throws if they can't join. */
export function joinProject(state: GameState, survivorId: string, id: ProjectId): void {
  const problem = crewProblem(state, survivorId, id);
  if (problem) throw new Error(problem);
  const s = state.survivors.find((x) => x.id === survivorId)!;
  s.post = { project: id };
}

/** Rations the crews eat on top of everyone's share: hard work (§9.6). */
export function crewRations(state: GameState): number {
  const id = projectUnderWay(state);
  if (!id) return 0;
  return projectCrew(state, id).filter(atDepot).length * PROJECT_CREW_RATIONS;
}

/**
 * A Depot day on the project under way: each crew member at home and fit adds
 * work and practices the project's stat; a stage finishes when its work is
 * done. Returns the news of finished stages.
 */
export function workOnProjects(state: GameState, day: number): string[] {
  const id = projectUnderWay(state);
  if (!id) return [];
  const def = getProject(id);
  const ps = state.projects[id]!;
  const stage = def.stages[ps.done]!;
  for (const s of workingOnProject(state, id)) {
    ps.work = (ps.work ?? 0) + workADay(s, def);
    addPractice(s, def.workStat, WORK_PRACTICE, day);
  }
  if ((ps.work ?? 0) < stage.work) return [];
  return finishStage(state, id, day);
}

function finishStage(state: GameState, id: ProjectId, day: number): string[] {
  const def = getProject(id);
  const ps = state.projects[id]!;
  const news = [def.stages[ps.done]!.news];
  addGuildLog(state, day, news[0]!, ['project', id]);
  ps.done += 1;
  delete ps.work;
  if (ps.done < def.stages.length) return news;

  ps.finishedDay = day;
  const crew = projectCrew(state, id);
  for (const s of crew) {
    addChronicle(s, day, def.chronicle, ['project', id]);
    delete s.post;
  }
  if (id === 'the_relay') {
    const found = LOCATIONS.filter((l) => !ensureLocationState(state, l.id).discovered);
    for (const l of found) ensureLocationState(state, l.id).discovered = true;
    if (found.length > 0) {
      const line = `Over the Relay comes word of places nobody had found: ${found.map((l) => l.name).join(', ')}.`;
      addGuildLog(state, day, line, ['project', id]);
      news.push(line);
    }
  }
  return news;
}

// ---------------------------------------------------------------- what finished projects do

/** The share of a run's time left on the Line (1 if it doesn't reach there). */
export function lineShare(state: GameState, locationId: string): number {
  return projectDone(state, 'the_line') && LINE_STOPS.includes(locationId) ? LINE_TIME : 1;
}

export function wallDefense(state: GameState): number {
  return projectDone(state, 'the_wall') ? WALL_DEFENSE : 0;
}

export function clinicHealMult(state: GameState): number {
  return projectDone(state, 'the_clinic') ? CLINIC_HEAL_MULT : 1;
}

export function relayOutposts(state: GameState): number {
  return projectDone(state, 'the_relay') ? RELAY_OUTPOSTS : 0;
}

export function memorialRelief(state: GameState): number {
  return projectDone(state, 'memorial_garden') ? MEMORIAL_RELIEF : 0;
}

/** Conditions that pass faster with a finished project: wounds with the Clinic, grief with the Memorial Garden. */
export function fasterHealing(state: GameState, s: Survivor, day: number): void {
  const quick = [...(projectDone(state, 'the_clinic') ? ['wounded', 'badly_wounded'] : []), ...(projectDone(state, 'memorial_garden') ? ['grieving'] : [])];
  if (quick.length === 0) return;
  for (const t of s.traits) if (quick.includes(t.id) && t.expiresDay !== undefined && t.expiresDay > day + 1) t.expiresDay -= 1;
}
