import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, MAX_REPORTS, SAVE_VERSION } from '../constants.ts';
import { newGame } from '../game.ts';
import { locationState } from '../locations.ts';
import { adjustRelationship } from '../relationships.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testGame, testPlan } from '../test-utils.ts';
import { addTrait, hasTrait } from '../traits.ts';
import type { GameState, Run } from '../types.ts';
import { planWarnings, rationsNeeded, runDuration, validatePlan } from './plan.ts';
import { completeRun, dueRuns, estimateRisk, startRun, visibleBeats } from './runs.ts';

describe('planning', () => {
  test('a normal plan is valid', () => {
    const state = openGame();
    assert.deepEqual(validatePlan(state, testPlan(state)), []);
  });

  test('undiscovered locations, bad crews and missing supplies are rejected', () => {
    const state = testGame();
    assert.match(validatePlan(state, testPlan(state, 'the_glow'))[0]!, /not been discovered/);
    assert.match(validatePlan(state, testPlan(state, 'nowhere'))[0]!, /Unknown location/);
    assert.match(validatePlan(state, testPlan(state, 'maple_street', { crew: [] }))[0]!, /at least one/);
    const twice = [state.survivors[0]!.id, state.survivors[0]!.id];
    assert.ok(validatePlan(state, testPlan(state, 'maple_street', { crew: twice })).some((p) => /twice/.test(p)));
    assert.ok(validatePlan(state, testPlan(state, 'maple_street', { ammo: 9999 })).some((p) => /ammo/.test(p)));
    state.resources.rations = 0;
    assert.ok(validatePlan(state, testPlan(state)).some((p) => /rations/.test(p)));
  });

  test('the wounded and those already away cannot go', () => {
    const state = openGame();
    addTrait(state.survivors[0]!, 'badly_wounded', { day: 1 });
    assert.match(validatePlan(state, testPlan(state))[0]!, /badly wounded and needs rest/);
    state.survivors[0]!.traits = [];
    state.survivors[1]!.status = 'away';
    assert.match(validatePlan(state, testPlan(state))[0]!, /already out/);
  });

  test('slow crew members and sneaking make runs longer; long runs need more rations', () => {
    const state = openGame();
    for (const s of state.survivors) s.traits = [];
    const base = runDuration(state, testPlan(state, 'kessler_farm'));
    assert.equal(base, 25 * 60_000);
    assert.ok(runDuration(state, testPlan(state, 'kessler_farm', { approach: 'sneaky' })) > base);
    addTrait(state.survivors[0]!, 'bad_leg', { day: 1, force: true });
    assert.ok(runDuration(state, testPlan(state, 'kessler_farm')) > base);
    assert.equal(rationsNeeded(state, testPlan(state, 'rail_yard')), 3);
    assert.equal(rationsNeeded(state, testPlan(state, 'the_glow')), 3 * Math.ceil(runDuration(state, testPlan(state, 'the_glow')) / DAY_MS));
    addTrait(state.survivors[1]!, 'glutton', { day: 1 });
    assert.equal(rationsNeeded(state, testPlan(state, 'rail_yard')), 4);
  });

  test('warnings flag feuds, injuries and empty guns', () => {
    const state = openGame();
    const [a, b] = state.survivors;
    adjustRelationship(state, a!.id, b!.id, -200, { day: 1, silent: true });
    a!.hp = 1;
    a!.equipment.weapon = { uid: 'i900', defId: 'hunting_rifle', quality: 'common' };
    const warnings = planWarnings(state, testPlan(state, 'maple_street', { ammo: 0 }));
    assert.ok(warnings.some((w) => /feuding/.test(w)));
    assert.ok(warnings.some((w) => /is hurt/.test(w)));
    assert.ok(warnings.some((w) => /no ammo/.test(w)));
  });
});

describe('run lifecycle', () => {
  function start(seed = 'life', location = 'maple_street'): { state: GameState; run: Run } {
    const state = openGame(seed);
    const run = startRun(state, testPlan(state, location), T0);
    return { state, run };
  }

  test('starting a run takes supplies, marks the crew away and fixes the outcome', () => {
    const state = openGame('life');
    const before = structuredClone(state);
    const plan = testPlan(state);
    const run = startRun(state, plan, T0);
    assert.equal(state.resources.rations, before.resources.rations - rationsNeeded(before, plan));
    assert.equal(state.resources.meds, before.resources.meds - 2);
    assert.equal(state.resources.ammo, before.resources.ammo - 12);
    for (const id of plan.crew) assert.equal(state.survivors.find((s) => s.id === id)!.status, 'away');
    assert.equal(state.survivors[3]!.status, 'ready');
    assert.deepEqual(state.runs, [run]);
    assert.ok(run.returnAt > T0 && run.returnAt <= T0 + runDuration(before, plan));
    assert.notDeepEqual(state.rng, before.rng, 'the seed came from the game rng');
    // Away survivors are untouched until the crew is back.
    assert.deepEqual(
      state.survivors.slice(0, 3).map((s) => ({ ...s, status: 'ready' })),
      before.survivors.slice(0, 3),
    );
    assert.throws(() => startRun(state, plan, T0), /already out/);
  });

  test('the log is revealed as time passes', () => {
    const { run } = start();
    assert.equal(visibleBeats(run, T0).length, 1);
    assert.equal(visibleBeats(run, run.returnAt - 1).length, run.beats.length - 1);
    assert.equal(visibleBeats(run, run.returnAt).length, run.beats.length);
  });

  test('a run cannot be completed before the crew is back', () => {
    const { state, run } = start();
    assert.deepEqual(dueRuns(state, run.returnAt - 1), []);
    assert.throws(() => completeRun(state, run.id, run.returnAt - 1), /not back yet/);
    assert.deepEqual(dueRuns(state, run.returnAt), [run]);
  });

  test('completing a run applies exactly what was decided at departure', () => {
    const { state, run } = start('apply', 'drowned_mall');
    const before = structuredClone(state);
    const report = completeRun(state, run.id, run.returnAt + 5000);
    const r = run.result;

    assert.equal(state.runs.length, 0);
    assert.deepEqual(state.reports[0], report);
    assert.equal(report.summary.outcome, r.outcome);
    for (const after of r.crew) {
      if (after.status === 'dead') continue;
      const s = state.survivors.find((x) => x.id === after.id)!;
      assert.equal(s.status, 'ready');
      assert.equal(s.counters.runs, 1);
    }
    assert.equal(state.resources.scrap, before.resources.scrap + r.loot.scrap);
    assert.equal(state.resources.meds, before.resources.meds + r.loot.meds + r.medsLeft);
    assert.equal(state.resources.ammo, before.resources.ammo + r.loot.ammo + r.ammoLeft);
    assert.equal(state.stash.length, before.stash.length + r.items.length + r.deaths.length * 0);
    assert.equal(locationState(state, 'drowned_mall').runs, 1);
    assert.equal(locationState(state, 'drowned_mall').explored, r.exploredGain);
    assert.throws(() => completeRun(state, run.id, run.returnAt), /Unknown run/);
    // Nothing breaks when the state goes through a save.
    assert.deepEqual(deserialize(serialize(state)), state);
  });

  test('item ids found on runs never collide', () => {
    const state = openGame('ids');
    const seen = new Set<string>();
    let now = T0;
    for (let i = 0; i < 40; i++) {
      for (const s of state.survivors) {
        s.hp = 30;
        s.traits = s.traits.filter((t) => t.id !== 'wounded' && t.id !== 'badly_wounded');
      }
      if (state.survivors.length < 3) break;
      const run = startRun(state, testPlan(state, 'checkpoint_bravo', { approach: 'sneaky' }), now);
      now = run.returnAt;
      completeRun(state, run.id, now);
      assert.ok(!seen.has(run.id));
      seen.add(run.id);
    }
    const uids = [...state.stash.map((i) => i.uid), ...state.survivors.flatMap((s) => Object.values(s.equipment).map((i) => i!.uid))];
    assert.equal(new Set(uids).size, uids.length);
    assert.ok(state.stash.length > 3, 'found some gear along the way');
    assert.ok(state.reports.length <= MAX_REPORTS);
  });

  test('scouting discovers new places', () => {
    const state = testGame('scout');
    state.resources.rations = 9999;
    let now = T0;
    for (let i = 0; i < 30 && !locationState(state, 'drowned_mall').discovered; i++) {
      for (const s of state.survivors) {
        s.hp = 30;
        s.traits = s.traits.filter((t) => t.id !== 'wounded' && t.id !== 'badly_wounded');
      }
      const run = startRun(state, { ...testPlan(state, 'maple_street'), job: 'scout', approach: 'sneaky', meds: 0, ammo: 0 }, now);
      now = run.returnAt;
      completeRun(state, run.id, now);
    }
    assert.ok(locationState(state, 'drowned_mall').discovered || locationState(state, 'st_judes').discovered);
    assert.ok(state.log.some((l) => /^Discovered /.test(l.text)));
    assert.ok(locationState(state, 'maple_street').explored >= 10);
  });
});

describe('death', () => {
  /** Send close friends somewhere deadly until one of them dies. */
  function fatalRun(): { state: GameState; run: Run } {
    for (let i = 0; i < 400; i++) {
      const state = openGame(`fatal-${i}`);
      const ids = state.survivors.map((s) => s.id);
      for (let a = 0; a < ids.length; a++) {
        for (let b = a + 1; b < ids.length; b++) {
          adjustRelationship(state, ids[a]!, ids[b]!, 200, { day: 1, silent: true, useTraitMult: false });
        }
      }
      const run = startRun(state, testPlan(state, 'red_hand_camp', { retreat: 'never', job: 'hunt' }), T0);
      if (run.result.deaths.length === 1 && run.result.outcome !== 'lost') return { state, run };
    }
    throw new Error('no fatal run found');
  }

  test('the dead go to the Memorial, their gear comes home, and their friends are changed', () => {
    const { state, run } = fatalRun();
    const death = run.result.deaths[0]!;
    const gearCount = Object.keys(run.result.crew.find((s) => s.id === death.survivorId)!.equipment).length;
    const stashBefore = state.stash.length;
    const report = completeRun(state, run.id, run.returnAt);

    assert.ok(!state.survivors.some((s) => s.id === death.survivorId));
    const fallen = state.memorial.find((s) => s.id === death.survivorId)!;
    assert.equal(fallen.status, 'dead');
    assert.match(fallen.causeOfDeath!, /Killed by .* at Red Hand Camp/);
    assert.match(fallen.chronicle.at(-1)!.text, /^Died at Red Hand Camp/);
    assert.deepEqual(fallen.equipment, {});
    assert.equal(state.stash.length, stashBefore + gearCount + run.result.items.length);
    assert.equal(report.crewNames[death.survivorId], death.name);

    // Everyone was Bonded with them, including the one who stayed home.
    assert.equal(state.survivors.length, 3);
    for (const s of state.survivors) {
      assert.ok(hasTrait(s, 'grieving'), `${s.firstName} grieves`);
      assert.ok(hasTrait(s, 'haunted') || hasTrait(s, 'vengeful'), `${s.firstName} is marked by it`);
      const vengeful = s.traits.find((t) => t.id === 'vengeful');
      if (vengeful) assert.equal(vengeful.target, death.enemyType);
      assert.ok(s.chronicle.some((c) => c.text === `Mourned ${death.name}.`));
    }
    assert.ok(state.log.some((l) => l.text === `${death.name} died at Red Hand Camp.`));
  });
});

describe('risk estimate', () => {
  test('ranks places sensibly and leaves the state alone', () => {
    const state = openGame('risk');
    const before = structuredClone(state);
    const safe = estimateRisk(state, testPlan(state, 'rail_yard'), 80);
    const deadly = estimateRisk(state, testPlan(state, 'the_glow', { retreat: 'never' }), 80);
    assert.deepEqual(state, before);
    assert.equal(safe.label, 'Low');
    assert.ok(deadly.label === 'Deadly' || deadly.label === 'High', deadly.label);
    assert.ok(deadly.downed > safe.downed + 0.3);
    assert.deepEqual(estimateRisk(state, testPlan(state, 'rail_yard'), 80), safe, 'same plan, same estimate');
  });
});

describe('save migration', () => {
  test('a version 1 save gains locations, runs and reports', () => {
    const state = newGame({ seed: 'old', now: T0 });
    const old: Record<string, unknown> = { ...structuredClone(state), version: 1 };
    delete old.locations;
    delete old.runs;
    delete old.reports;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.deepEqual(loaded.runs, []);
    assert.deepEqual(loaded.reports, []);
    assert.equal(locationState(loaded, 'rail_yard').discovered, true);
    assert.equal(locationState(loaded, 'the_glow').discovered, false);
    assert.deepEqual(loaded.survivors, state.survivors);
  });
});
