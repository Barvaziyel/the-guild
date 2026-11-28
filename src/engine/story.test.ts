import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BUILDINGS, FIRST_WEEK, LOCATIONS, VEHICLES, getGear } from './content/index.ts';
import { DAY_MS, STORY_OLD_SAVE_DAYS } from './constants.ts';
import { equipFromStash } from './gear.ts';
import { deserialize, serialize } from './save.ts';
import { claimStory, seenStory, storyProblem, storyProgress, storyStep } from './story.ts';
import { T0, testGame } from './test-utils.ts';
import type { GameState } from './types.ts';

/** Hand out the stash: each item to the first person with that slot empty. */
function kitOut(state: GameState): void {
  for (const item of [...state.stash]) {
    const slot = getGear(item.defId).slot;
    const s = state.survivors.find((x) => !x.equipment[slot]);
    if (s) equipFromStash(state, s, item.uid);
  }
}

/** Make the step under way's goal come true, the way playing would. */
function meet(state: GameState): void {
  const goal = storyStep(state)!.goal;
  switch (goal.kind) {
    case 'kitted':
      return kitOut(state);
    case 'building':
      state.buildings[goal.building] = goal.level;
      return;
    case 'runs': {
      const id = goal.at ?? 'rail_yard';
      state.locations[id]!.runs += goal.count;
      return;
    }
    case 'corners':
      state.corners.searched.push(...['ticket_office', 'signal_box', 'water_tower', 'freight_car'].slice(0, goal.count));
      return;
  }
}

describe('the first week (2.8.0)', () => {
  test('every step is written out, and can be done in a new guild: buildings, places that start known, real vehicles', () => {
    const ids = new Set(FIRST_WEEK.map((s) => s.id));
    assert.equal(ids.size, FIRST_WEEK.length);
    for (const step of FIRST_WEEK) {
      assert.ok(step.title && step.text && step.goalText && step.done && step.gives.length > 0, step.id);
      const g = step.goal;
      if (g.kind === 'building') assert.ok(BUILDINGS.some((b) => b.id === g.building && b.levels.length >= g.level), step.id);
      if (g.kind === 'runs' && g.at) assert.ok(LOCATIONS.find((l) => l.id === g.at)?.startKnown, `${step.id}: ${g.at} is known from the start`);
      for (const gift of step.gives) if (gift.kind === 'vehicle') assert.ok(VEHICLES.some((v) => v.id === gift.defId), step.id);
    }
    // It ends with the first word of Haven, the long goal.
    assert.match(FIRST_WEEK.at(-1)!.done, /Haven/);
  });

  test('a new guild starts on the first step, with the starting gear still in the stash', () => {
    const state = testGame('start');
    assert.equal(storyStep(state)!.id, 'kit_out');
    assert.equal(storyProgress(state).met, false);
    assert.match(storyProblem(state)!, /^Not yet: hand out the gear/);
    assert.throws(() => claimStory(state, T0), /Not yet/);
    kitOut(state);
    assert.equal(storyProgress(state).met, true);
  });

  test('handing out the gear counts even when someone already has that slot filled', () => {
    const state = testGame('full');
    kitOut(state);
    // Everyone with a tool: a spare one in the stash has nowhere to go, so the step is done.
    for (const s of state.survivors) s.equipment.tool ??= { uid: `t-${s.id}`, defId: 'crowbar', quality: 'common' };
    state.stash.push({ uid: 'spare', defId: 'crowbar', quality: 'common' });
    assert.equal(storyProgress(state).met, true);
    // Someone without one: now it fits, so not yet.
    delete state.survivors[0]!.equipment.tool;
    assert.equal(storyProgress(state).met, false);
  });

  test('collecting a reward: the stores, the news, how it went, and the next step', () => {
    const state = testGame('collect');
    kitOut(state);
    const ammo = state.resources.ammo;
    const ending = claimStory(state, T0 + 1000);
    assert.equal(state.resources.ammo, ammo + 6);
    assert.deepEqual(ending.supplies, { ammo: 6 });
    assert.equal(ending.title, 'Kit them out');
    assert.equal(state.story!.last, ending);
    assert.ok(state.log.some((l) => l.text.startsWith('Kit them out:')));
    // The first run comes second since 3.14.0, straight after the opening.
    assert.equal(storyStep(state)!.id, 'first_run');
    seenStory(state);
    assert.equal(state.story!.last!.seen, true);
  });

  test('runs count from when the step began, and a place’s from its own runs', () => {
    const state = testGame('runs');
    // Runs before the step don't count.
    state.locations.rail_yard!.runs = 3;
    state.story!.step = FIRST_WEEK.findIndex((s) => s.id === 'first_run');
    state.story!.base = { runs: 3, at: { rail_yard: 3 } };
    assert.deepEqual(storyProgress(state), { met: false, have: 0, need: 1 });
    state.locations.rail_yard!.runs = 4;
    assert.deepEqual(storyProgress(state), { met: true, have: 1, need: 1 });
    claimStory(state, T0);
    assert.equal(storyStep(state)!.id, 'garden');
    assert.deepEqual(state.story!.base, { runs: 4, at: { rail_yard: 4 } });

    // Maple Street: a run anywhere else doesn't do it.
    state.story!.step = FIRST_WEEK.findIndex((s) => s.id === 'smoke');
    state.locations.rail_yard!.runs = 5;
    assert.equal(storyProgress(state).met, false);
    state.locations.maple_street!.runs = 1;
    assert.equal(storyProgress(state).met, true);
  });

  test('the corners count as searched in all, up to the number asked', () => {
    const state = testGame('corners');
    state.story!.step = FIRST_WEEK.findIndex((s) => s.id === 'corners');
    state.corners.searched.push('ticket_office', 'signal_box');
    assert.deepEqual(storyProgress(state), { met: false, have: 2, need: 3 });
    state.corners.searched.push('water_tower', 'cellar');
    assert.deepEqual(storyProgress(state), { met: true, have: 3, need: 3 });
  });

  test('the whole week: someone at the gate, a motorcycle with gas, Haven, and then nothing more', () => {
    const state = testGame('week');
    const recruits = state.depot.recruits.length;
    const endings = [];
    while (storyStep(state)) {
      meet(state);
      endings.push(claimStory(state, T0 + endings.length * 1000));
    }
    assert.equal(endings.length, FIRST_WEEK.length);
    assert.equal(state.depot.recruits.length, recruits + 1);
    assert.equal(state.depot.recruits.at(-1)!.wanderer, true);
    assert.match(endings.find((e) => e.stepId === 'smoke')!.gifts![0]!, /, at the gate$/);
    const bike = state.vehicles.find((v) => v.defId === 'motorcycle')!;
    assert.equal(bike.condition, 60);
    assert.deepEqual(endings.find((e) => e.stepId === 'wheels')!.gifts, ['a Motorcycle']);
    assert.match(endings.at(-1)!.text, /This is Haven/);
    assert.ok(state.log.some((l) => l.text === 'The guild has found its feet.'));
    assert.equal(storyStep(state), undefined);
    assert.equal(storyProblem(state), 'The guild has found its feet.');
    assert.throws(() => claimStory(state, T0), /found its feet/);
  });

  test('the same guild gets the same person at the gate', () => {
    const a = testGame('same');
    const b = testGame('same');
    for (const s of [a, b]) {
      s.story!.step = FIRST_WEEK.findIndex((x) => x.id === 'smoke');
      s.locations.maple_street!.runs = 1;
      claimStory(s, T0);
    }
    assert.equal(a.depot.recruits.at(-1)!.survivor.firstName, b.depot.recruits.at(-1)!.survivor.firstName);
  });

  test('older saves: a guild in its first two weeks gets the week, counting from its runs so far; an older one doesn’t', () => {
    const state = testGame('old');
    state.locations.rail_yard!.runs = 2;
    const young = structuredClone(state) as unknown as Record<string, unknown>;
    young.version = 24;
    delete young.story;
    young.lastUpdate = T0 + 5 * DAY_MS;
    const loaded = deserialize(JSON.stringify(young));
    assert.deepEqual(loaded.story, { step: 0, base: { runs: 2, at: { rail_yard: 2 } } });

    const old = structuredClone(young);
    old.lastUpdate = T0 + STORY_OLD_SAVE_DAYS * DAY_MS;
    assert.equal(deserialize(JSON.stringify(old)).story, undefined);
    assert.equal(storyStep(deserialize(JSON.stringify(old))), undefined);

    // A save made now keeps where it is.
    state.story!.step = 3;
    assert.equal(deserialize(serialize(state)).story!.step, 3);
  });
});
