/**
 * Projects on screen (§9.6): the Depot's Projects tab, who can join a crew,
 * and the post picker on a survivor's sheet.
 */
import {
  PROJECTS,
  PROJECT_CREW,
  atDepot,
  buildingName,
  costText,
  crewProblem,
  currentStage,
  effectiveStat,
  getProject,
  postBuilding,
  postProject,
  postText,
  projectCrew,
  projectDone,
  projectNeeds,
  projectState,
  projectUnderWay,
  resting,
  stageProblem,
  statName,
  workADay,
  type GameState,
  type ProjectId,
  type Survivor,
} from '../engine/index.ts';

export interface ProjectRow {
  id: ProjectId;
  name: string;
  description: string;
  effect: string;
  /** "Not started", "Stage 2 of 3: 40% done", "Waiting for stage 3", "Finished on day 212". */
  status: string;
  state: 'locked' | 'ready' | 'working' | 'waiting' | 'done';
  /** 0..1 through the whole project, for a bar. */
  progress: number;
  /** The next stage to pay for: its cost, and why it can't start now. */
  next?: { label: string; cost: string; problem?: string };
  /** What's needed before it can start at all. */
  needs?: string;
  crew: { survivor: Survivor; line: string; away?: string }[];
  crewRoom: number;
  /** "Brawn": what the crew works with. */
  workStat: string;
  /** "About 2 real days left at this pace", while a stage is under way. */
  eta?: string;
}

export function projectRows(state: GameState): ProjectRow[] {
  return PROJECTS.map((p) => projectRow(state, p.id));
}

export function projectRow(state: GameState, id: ProjectId): ProjectRow {
  const def = getProject(id);
  const ps = projectState(state, id);
  const total = def.stages.length;
  const stage = currentStage(state, id);
  const needs = projectNeeds(state, id);
  const working = ps.work !== undefined;
  const done = projectDone(state, id);
  const crew = projectCrew(state, id).map((s) => ({
    survivor: s,
    line: `${statName(def.workStat)} ${effectiveStat(s, def.workStat)}`,
    ...(!atDepot(s) ? { away: 'Out on a run.' } : resting(s) ? { away: 'Resting until healed.' } : {}),
  }));
  const stageShare = stage && working ? Math.min(1, (ps.work ?? 0) / stage.work) : 0;
  const progress = (ps.done + stageShare) / total;
  const status = done
    ? `Finished on day ${ps.finishedDay}`
    : working
      ? `Stage ${ps.done + 1} of ${total}: ${Math.round(stageShare * 100)}% done`
      : ps.done > 0
        ? `${ps.done} of ${total} stages done. The next one isn't paid for.`
        : needs
          ? 'Not yet'
          : 'Not started';
  const rowState: ProjectRow['state'] = done ? 'done' : working ? 'working' : needs ? 'locked' : ps.done > 0 ? 'waiting' : 'ready';
  const problem = stageProblem(state, id);
  const pace = projectCrew(state, id)
    .filter((s) => atDepot(s) && !resting(s))
    .reduce((a, s) => a + workADay(s, def), 0);
  const eta = working && stage ? etaText(stage.work - (ps.work ?? 0), pace) : undefined;
  return {
    id,
    name: def.name,
    description: def.description,
    effect: def.effect,
    status,
    state: rowState,
    progress,
    ...(!done && stage && !working ? { next: { label: ps.done === 0 ? 'Start' : `Start stage ${ps.done + 1}`, cost: costText(stage.cost), ...(problem ? { problem } : {}) } } : {}),
    ...(needs && !done ? { needs } : {}),
    crew,
    crewRoom: done || !state.projects[id] ? 0 : PROJECT_CREW - crew.length,
    workStat: statName(def.workStat),
    ...(eta ? { eta } : {}),
  };
}

/** "About 2 real days left at this pace", or a nudge when nobody is working. Eight Depot days make a real day. */
export function etaText(workLeft: number, perDay: number): string {
  if (perDay <= 0) return 'Nobody is working on it. Put a crew on it.';
  const realDays = workLeft / perDay / 8;
  if (realDays < 0.5) return 'Done within half a day at this pace.';
  const n = Math.max(1, Math.round(realDays));
  return `About ${n} real ${n === 1 ? 'day' : 'days'} left at this pace.`;
}

/** Everyone who could join a project's crew, with why not if they can't. Those resting until healed aren't offered. */
export function crewCandidates(state: GameState, id: ProjectId): { survivor: Survivor; current: string; stat: string; problem?: string }[] {
  const def = getProject(id);
  return state.survivors
    .filter((s) => postProject(s.post) !== id && !resting(s))
    .map((s) => {
      const problem = crewProblem(state, s.id, id);
      return {
        survivor: s,
        current: s.outpost ? 'At an outpost' : s.post ? postText(state, s) : 'No post',
        stat: `${statName(def.workStat)} ${effectiveStat(s, def.workStat)}`,
        ...(problem ? { problem } : {}),
      };
    })
    .sort((a, b) => Number(Boolean(a.survivor.post)) - Number(Boolean(b.survivor.post)) || effectiveStat(b.survivor, def.workStat) - effectiveStat(a.survivor, def.workStat));
}

/** Projects someone could join from their sheet: started and not finished. */
export function projectChoices(state: GameState, s: Survivor): { id: ProjectId; name: string; problem?: string }[] {
  return PROJECTS.filter((p) => state.projects[p.id] && !projectDone(state, p.id)).map((p) => {
    const problem = crewProblem(state, s.id, p.id);
    return { id: p.id, name: p.name, ...(problem ? { problem } : {}) };
  });
}

/** The value of a survivor's post in the sheet's picker: a building id, "project:the_wall", or "outpost:rail_yard". */
export function postValue(s: Survivor): string {
  if (s.outpost) return `outpost:${s.outpost}`;
  const project = postProject(s.post);
  if (project) return `project:${project}`;
  return postBuilding(s.post) ?? '';
}

/** Where "Go to …" on the sheet leads, and what it says. */
export function postLink(state: GameState, s: Survivor): { label: string; to: { screen: 'building'; id: string } | { screen: 'depot'; tab: 'projects' } } | undefined {
  const project = postProject(s.post);
  if (project) return { label: `Go to ${getProject(project).name.replace(/^The /, 'the ')}`, to: { screen: 'depot', tab: 'projects' } };
  const b = postBuilding(s.post);
  if (b) return { label: `Go to the ${buildingName(state, b)}`, to: { screen: 'building', id: b } };
  return undefined;
}

/** A line for the Depot's Today tab while a project is under way or waiting: "The Wall: stage 2 of 3, 40% done." */
export function projectNote(state: GameState): string | undefined {
  const id = projectUnderWay(state);
  if (id) return `${getProject(id).name}: ${projectRow(state, id).status.toLowerCase().replace(/^stage/, 'stage')}.`;
  return undefined;
}
