import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HEAL_BASE, PROJECT_CREW, SAVE_VERSION, WALL_DEFENSE } from './constants.ts';
import { LINE_STOPS, LOCATIONS, PROJECTS, getProject } from './content/index.ts';
import { build, postBuilding, postText, postedTo } from './depot/buildings.ts';
import { dailyUpkeep, emptySummary, healRate, playDepotDay } from './depot/day.ts';
import { raidDefense } from './depot/events.ts';
import { runDuration } from './expedition/plan.ts';
import { outpostLimit } from './outposts.ts';
import {
  crewProblem,
  joinProject,
  lineShare,
  projectCrew,
  projectDone,
  projectNeeds,
  projectState,
  projectUnderWay,
  stageProblem,
  startStage,
  workADay,
} from './projects.ts';
import { Rng } from './rng.ts';
import { deserialize } from './save.ts';
import { openGame, testGame, testPlan } from './test-utils.ts';
import type { GameState, ProjectId } from './types.ts';
import { PROJECT_IDS } from './types.ts';

function rich(state: GameState): void {
  state.resources = { scrap: 20000, rations: 20000, meds: 20000, ammo: 20000, tech: 20000, gas: 20000 };
}

function ready(state: GameState, id: ProjectId): void {
  rich(state);
  const need = getProject(id).needs;
  if (need.building) while ((state.buildings[need.building[0]] ?? 0) < need.building[1]) build(state, need.building[0], 1);
  if (need.memorial) state.memorial.push(structuredClone(state.survivors[0]!));
}

/** Play Depot days until the stage under way is done (or give up). */
function workOff(state: GameState, from: number, max = 400): number {
  let day = from;
  const id = projectUnderWay(state)!;
  const done = projectState(state, id).done;
  while (projectState(state, id).done === done && day < from + max) playDepotDay(state, ++day, new Rng(`d${day}`), emptySummary());
  return day;
}

describe('projects: content', () => {
  test('every project has three stages of work, an effect, a crew stat and a Chronicle line without a subject', () => {
    assert.deepEqual(
      PROJECTS.map((p) => p.id),
      [...PROJECT_IDS],
    );
    for (const p of PROJECTS) {
      assert.equal(p.stages.length, 3, p.id);
      for (const s of p.stages) {
        assert.ok(s.work > 0 && Object.values(s.cost).some((n) => (n ?? 0) > 0), p.id);
        assert.match(s.news, /\.$/, p.id);
      }
      assert.match(p.chronicle, /^[A-Z][a-z]+ .*\.$/, p.id);
      assert.doesNotMatch(p.chronicle, /^(He|She|They|I) /, p.id);
    }
    for (const stop of LINE_STOPS) assert.ok(LOCATIONS.some((l) => l.id === stop), stop);
  });
});

describe('projects: starting and crews', () => {
  test('a project waits for what it needs; the Memorial Garden for a loss', () => {
    const state = testGame('needs');
    assert.match(projectNeeds(state, 'the_wall') ?? '', /level 3 Watchtower/);
    assert.match(projectNeeds(state, 'memorial_garden') ?? '', /someone has died/);
    ready(state, 'memorial_garden');
    assert.equal(projectNeeds(state, 'memorial_garden'), undefined);
  });

  test('a stage is paid for when it starts, and one stage is under way at a time', () => {
    const state = testGame('start');
    ready(state, 'the_line');
    ready(state, 'the_wall');
    const scrap = state.resources.scrap;
    startStage(state, 'the_line', 3);
    assert.equal(state.resources.scrap, scrap - (getProject('the_line').stages[0]!.cost.scrap ?? 0));
    assert.equal(projectUnderWay(state), 'the_line');
    assert.match(stageProblem(state, 'the_wall') ?? '', /One project at a time: The Line is under way/);
    assert.ok(state.log.some((l) => l.text === 'Work began on The Line: stage 1 of 3.'));
    state.resources.scrap = 0;
    state.projects.the_line!.work = undefined;
    assert.match(stageProblem(state, 'the_wall') ?? '', /^Needs \d+ scrap/);
  });

  test('a crew holds three, leaves their old post, and the sheet says where they work', () => {
    const state = testGame('crew');
    ready(state, 'the_line');
    assert.match(crewProblem(state, state.survivors[0]!.id, 'the_line') ?? '', /hasn't been started/);
    startStage(state, 'the_line', 1);
    while (state.survivors.length < 5) state.survivors.push({ ...structuredClone(state.survivors[0]!), id: `x${state.survivors.length}` });
    const a = state.survivors.find((s) => postBuilding(s.post) === 'garden')!;
    const [b, c, d] = state.survivors.filter((s) => s !== a);
    for (const s of [a, b!, c!]) joinProject(state, s.id, 'the_line');
    assert.equal(postedTo(state, 'garden').includes(a), false, 'left the Garden');
    assert.deepEqual(a.post, { project: 'the_line' });
    assert.equal(postText(state, a), 'Works on the Line');
    assert.equal(projectCrew(state, 'the_line').length, PROJECT_CREW);
    assert.match(crewProblem(state, d!.id, 'the_line') ?? '', /full crew/);
    d!.traits.push({ id: 'badly_wounded', gainedDay: 1, expiresDay: 9 });
    assert.match(crewProblem(state, d!.id, 'the_wall') ?? '', /hasn't been started/);
  });

  test('starting another project brings the crew along from one that is paused', () => {
    const state = testGame('moves');
    ready(state, 'the_line');
    ready(state, 'the_wall');
    startStage(state, 'the_line', 1);
    const crew = state.survivors.slice(0, 3);
    for (const s of crew) joinProject(state, s.id, 'the_line');
    workOff(state, 1);
    assert.equal(projectUnderWay(state), undefined);
    assert.equal(projectCrew(state, 'the_line').length, 3, 'the crew waits on the Line between stages');
    rich(state); // the rations from the start have long gone off
    startStage(state, 'the_wall', 40);
    assert.deepEqual(
      projectCrew(state, 'the_wall').map((s) => s.id),
      crew.map((s) => s.id),
    );
    assert.equal(projectCrew(state, 'the_line').length, 0);
  });
});

describe('projects: work', () => {
  test('the crew works a stage off day by day, then waits for the next to be paid for; finishing writes the Chronicle and frees the crew', () => {
    const state = testGame('work');
    ready(state, 'the_wall');
    startStage(state, 'the_wall', 1);
    const crew = state.survivors.slice(0, 3);
    for (const s of crew) joinProject(state, s.id, 'the_wall');
    const perDay = crew.reduce((a, s) => a + workADay(s, getProject('the_wall')), 0);
    playDepotDay(state, 2, new Rng('w'), emptySummary());
    assert.ok(Math.abs((state.projects.the_wall!.work ?? 0) - perDay) < 1e-9, 'one day of work from the three');
    const day = workOff(state, 2);
    assert.equal(projectState(state, 'the_wall').done, 1);
    assert.equal(projectUnderWay(state), undefined, 'the next stage is not paid for yet');
    assert.ok(state.log.some((l) => l.text === 'The first stretch of the wall is up.'));
    const expected = Math.ceil(getProject('the_wall').stages[0]!.work / perDay);
    assert.ok(Math.abs(day - 2 - (expected - 1)) <= 2, `took ${day - 1} days, expected about ${expected}`);
    // Waiting: nobody works, nobody eats extra.
    playDepotDay(state, day + 1, new Rng('idle'), emptySummary());
    assert.equal(state.projects.the_wall!.work, undefined);
    let at = day + 1;
    for (let stage = 2; stage <= 3; stage++) {
      rich(state); // the rations from the start have long gone off
      startStage(state, 'the_wall', at);
      at = workOff(state, at);
    }
    assert.ok(projectDone(state, 'the_wall'));
    assert.equal(state.projects.the_wall!.finishedDay, at);
    for (const s of crew) {
      assert.equal(s.post, undefined, 'the crew is free');
      assert.ok(s.chronicle.some((c) => c.text === 'Helped build the Wall.'));
    }
    assert.match(stageProblem(state, 'the_wall') ?? '', /finished/);
  });

  test('a crew at work eats a ration more each', () => {
    const state = testGame('eat');
    ready(state, 'the_line');
    const before = dailyUpkeep(state);
    startStage(state, 'the_line', 1);
    joinProject(state, state.survivors[0]!.id, 'the_line');
    joinProject(state, state.survivors[1]!.id, 'the_line');
    assert.equal(dailyUpkeep(state), before + 2);
  });
});

describe('projects: what they do', () => {
  function finish(state: GameState, id: ProjectId): void {
    ready(state, id);
    state.projects[id] = { done: 3, startedDay: 1, finishedDay: 2 };
  }

  test('the Line halves the time to its stops, and nowhere else', () => {
    const state = openGame('line');
    for (const l of ['the_glow', 'rail_yard']) state.locations[l] = { discovered: true, explored: 50, runs: 1 };
    const glow = runDuration(state, testPlan(state, 'the_glow'));
    const yard = runDuration(state, testPlan(state, 'rail_yard'));
    finish(state, 'the_line');
    assert.equal(lineShare(state, 'the_glow'), 0.5);
    assert.ok(Math.abs(runDuration(state, testPlan(state, 'the_glow')) - glow / 2) <= 60_000);
    assert.equal(runDuration(state, testPlan(state, 'rail_yard')), yard);
  });

  test('the Wall helps hold off raids', () => {
    const state = testGame('wall');
    ready(state, 'the_wall');
    const before = raidDefense(state);
    finish(state, 'the_wall');
    assert.equal(raidDefense(state), before + WALL_DEFENSE);
  });

  test('the Clinic doubles healing and closes wounds sooner', () => {
    const state = testGame('clinic');
    finish(state, 'the_clinic');
    const s = state.survivors[0]!;
    s.hp = 1;
    s.traits.push({ id: 'wounded', gainedDay: 1, expiresDay: 10 });
    playDepotDay(state, 2, new Rng('c'), emptySummary());
    assert.equal(s.traits.find((t) => t.id === 'wounded')!.expiresDay, 9);
    assert.ok(healRate(state) > HEAL_BASE);
  });

  test('the Relay gives two more outposts and word of every place not yet found', () => {
    const state = testGame('relay');
    ready(state, 'the_relay');
    const before = outpostLimit(state);
    startStage(state, 'the_relay', 1);
    for (const s of state.survivors.slice(0, 3)) joinProject(state, s.id, 'the_relay');
    let day = workOff(state, 1);
    for (let i = 0; i < 2; i++) {
      rich(state);
      startStage(state, 'the_relay', day);
      day = workOff(state, day);
    }
    assert.ok(projectDone(state, 'the_relay'));
    assert.equal(outpostLimit(state), before + 2);
    assert.ok(Object.values(state.locations).every((l) => l.discovered));
    assert.ok(state.log.some((l) => /Over the Relay comes word of places nobody had found/.test(l.text)));
  });

  test('the Memorial Garden eases stress and grief', () => {
    const calm = (garden: boolean): { stress: number; grief: number } => {
      const state = testGame('garden');
      if (garden) finish(state, 'memorial_garden');
      const s = state.survivors[0]!;
      s.stress = 60;
      s.traits.push({ id: 'grieving', gainedDay: 1, expiresDay: 20 });
      playDepotDay(state, 2, new Rng('g'), emptySummary());
      return { stress: s.stress, grief: s.traits.find((t) => t.id === 'grieving')?.expiresDay ?? 0 };
    };
    assert.ok(calm(true).stress < calm(false).stress);
    assert.equal(calm(true).grief, calm(false).grief - 1);
  });
});

describe('projects: saves', () => {
  test('a save from before version 15 gets an empty list of projects', () => {
    const state = testGame('v14');
    const old = structuredClone(state) as unknown as Omit<GameState, 'projects'> & { version: number; projects?: unknown };
    delete old.projects;
    old.version = 14;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.deepEqual(loaded.projects, {});
  });
});
