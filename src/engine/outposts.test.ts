import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { OUTPOST_RELIEF, OUTPOST_REST_STRESS, OUTPOST_SHORTCUT, SAVE_VERSION } from './constants.ts';
import { getLocation, getTrait } from './content/index.ts';
import { assignPost, atDepot, build } from './depot/buildings.ts';
import { dailyUpkeep, emptySummary, playDepotDay } from './depot/day.ts';
import { canChangeGear } from './gear.ts';
import { completeRun, startRun } from './expedition/runs.ts';
import { footDuration, runDuration, unavailableReason, validatePlan } from './expedition/plan.ts';
import { simulateRun } from './expedition/sim.ts';
import { depthOpen, deepestOpen, exploredAt } from './locations.ts';
import {
  bringHome,
  buildOutpost,
  outpostTrouble,
  buildOutpostProblem,
  findOutpost,
  outpostNear,
  outpostStaff,
  playOutpostsDay,
  raidOutpost,
  repairOutpost,
  station,
  stationProblem,
} from './outposts.ts';
import { Rng } from './rng.ts';
import { maxHp } from './stats.ts';
import { deserialize } from './save.ts';
import { T0, openGame, testGame, testPlan } from './test-utils.ts';
import type { GameState, Resources } from './types.ts';

/** A guild with a Radio Tower, plenty of supplies, and the outskirts of `place` fully explored. */
function ready(seed: string, place = 'maple_street', radio = 1): GameState {
  const state = openGame(seed);
  state.resources = { scrap: 500, rations: 500, meds: 20, ammo: 50, tech: 100, gas: 0 };
  for (let l = 0; l < radio; l++) build(state, 'radio_tower', 1);
  state.locations[place] = { discovered: true, explored: 100, runs: 5 };
  return state;
}

describe('outposts: setting up', () => {
  test('needs the outskirts fully explored, a Radio Tower, and room in its range', () => {
    const state = openGame('rules');
    state.resources = { scrap: 500, rations: 500, meds: 20, ammo: 50, tech: 100, gas: 0 };
    state.locations.maple_street = { discovered: true, explored: 60, runs: 3 };
    assert.match(buildOutpostProblem(state, 'maple_street')!, /Explore the outskirts fully first \(60% so far\)/);
    state.locations.maple_street!.explored = 100;
    assert.match(buildOutpostProblem(state, 'maple_street')!, /Build the Radio Tower first/);
    build(state, 'radio_tower', 1);
    assert.equal(buildOutpostProblem(state, 'maple_street'), undefined);
    buildOutpost(state, 'maple_street', 2);
    assert.match(buildOutpostProblem(state, 'maple_street')!, /already has an outpost/);
    state.locations.rail_yard = { discovered: true, explored: 100, runs: 5 };
    assert.match(buildOutpostProblem(state, 'rail_yard')!, /keep in contact with one outpost/);
    build(state, 'radio_tower', 3);
    assert.equal(buildOutpostProblem(state, 'rail_yard'), undefined);
    assert.equal(state.resources.scrap, 500 - 30 - 40 - 100);
    assert.ok(state.log.some((l) => l.text === 'Set up an outpost at Maple Street.'));
  });

  test('up to three live there, moving out drops their Depot post, and they can come home any time', () => {
    const state = ready('staff');
    buildOutpost(state, 'maple_street', 2);
    const [a, b, c, d] = state.survivors;
    a!.post = { building: 'garden' };
    station(state, a!.id, 'maple_street', 3);
    assert.equal(a!.outpost, 'maple_street');
    assert.equal(a!.post, undefined);
    assert.equal(a!.chronicle.at(-1)!.text, 'Moved out to the outpost at Maple Street.');
    station(state, b!.id, 'maple_street', 3);
    station(state, c!.id, 'maple_street', 3);
    assert.match(stationProblem(state, d!.id, 'maple_street')!, /room for 3/);
    bringHome(state, c!.id, 4);
    assert.equal(c!.outpost, undefined);
    assert.equal(c!.chronicle.at(-1)!.text, 'Came home from the outpost at Maple Street.');
    d!.traits.push({ id: 'badly_wounded', gainedDay: 1, expiresDay: 9 });
    assert.match(stationProblem(state, d!.id, 'maple_street')!, /resting until healed/);
    assert.deepEqual(outpostStaff(state, 'maple_street').map((s) => s.id), [a!.id, b!.id]);
  });

  test('people at an outpost are not at the Depot: no posts, no runs, no gear swaps, but the Depot still feeds them', () => {
    const state = ready('apart');
    buildOutpost(state, 'maple_street', 2);
    const before = dailyUpkeep(state);
    const s = state.survivors[0]!;
    station(state, s.id, 'maple_street', 3);
    assert.equal(atDepot(s), false);
    assert.equal(canChangeGear(s), false);
    assert.equal(dailyUpkeep(state), before);
    assert.throws(() => assignPost(state, s.id, { building: 'garden' }), /lives at the outpost at Maple Street/);
    assert.equal(unavailableReason(s), 'lives at the outpost at Maple Street');
    assert.match(validatePlan(state, testPlan(state)).join(' '), /lives at the outpost/);
  });
});

describe('outposts: day to day', () => {
  test('the people there heal a little, rest a little and send home supplies', () => {
    const state = ready('days');
    buildOutpost(state, 'maple_street', 2);
    const s = state.survivors[0]!;
    station(state, s.id, 'maple_street', 3);
    s.hp = 2;
    s.stress = 40;
    const before = { ...state.resources };
    const summary = emptySummary();
    playDepotDay(state, 4, new Rng('day'), summary);
    assert.ok(s.hp > 2);
    assert.ok(s.stress < 40);
    const sent = Object.values(summary.outposts).reduce((a, b) => a + (b ?? 0), 0);
    assert.ok(sent >= 1);
    const gained = (Object.keys(summary.outposts) as (keyof Resources)[]).every((r) => state.resources[r] >= before[r] + summary.outposts[r]! - 50);
    assert.ok(gained);
  });

  test('over months, more people send home more, and a damaged outpost sends half', () => {
    const perDay = (staff: number, damaged = false): number => {
      let total = 0;
      for (let g = 0; g < 60; g++) {
        const state = ready(`yield-${staff}-${g}`, 'drowned_mall');
        buildOutpost(state, 'drowned_mall', 1);
        findOutpost(state, 'drowned_mall')!.damaged = damaged;
        for (const s of state.survivors.slice(0, staff)) station(state, s.id, 'drowned_mall', 1);
        const sent: Partial<Resources> = {};
        const rng = new Rng(`y-${g}`);
        for (let d = 2; d < 32; d++) {
          playOutpostsDay(state, d, rng, sent);
          if (!findOutpost(state, 'drowned_mall')) break;
          findOutpost(state, 'drowned_mall')!.damaged = damaged;
        }
        total += Object.values(sent).reduce((a, b) => a + (b ?? 0), 0);
      }
      return total / 60 / 30;
    };
    const one = perDay(1);
    const three = perDay(3);
    assert.ok(one > 2.5 && one < 4, `${one.toFixed(2)} a day with one`);
    assert.ok(three > one * 2.4, `${three.toFixed(2)} a day with three`);
    assert.ok(perDay(3, true) < three * 0.7);
  });

  test('raiders damage an outpost, burn a damaged one, and send its people home', () => {
    const state = ready('raid');
    buildOutpost(state, 'maple_street', 2);
    const outpost = findOutpost(state, 'maple_street')!;
    assert.equal(raidOutpost(state, outpost, 3, new Rng('r1')), 'damaged', 'nobody there to hold it');
    repairOutpost(state, 'maple_street', 3);
    assert.equal(outpost.damaged, false);
    const s = state.survivors[0]!;
    station(state, s.id, 'maple_street', 3);
    s.stats.aim = 1;
    let result = 'held';
    for (let i = 0; result !== 'burned' && i < 200; i++) {
      result = raidOutpost(state, outpost, 4, new Rng(`r${i}`));
      s.traits = [];
    }
    assert.equal(result, 'burned');
    assert.equal(findOutpost(state, 'maple_street'), undefined);
    assert.equal(s.outpost, undefined);
    assert.ok(atDepot(s));
    assert.ok(state.log.some((l) => /Raiders burned the outpost at Maple Street\. .* made it home\./.test(l.text)));
  });

  test('well staffed, an outpost near home rarely burns', () => {
    let burned = 0;
    for (let g = 0; g < 100; g++) {
      const state = ready(`hold-${g}`);
      buildOutpost(state, 'maple_street', 1);
      for (const s of state.survivors.slice(0, 3)) station(state, s.id, 'maple_street', 1);
      const rng = new Rng(`h-${g}`);
      for (let d = 2; d < 122; d++) {
        playOutpostsDay(state, d, rng, {});
        const o = findOutpost(state, 'maple_street');
        if (!o) {
          burned += 1;
          break;
        }
      }
    }
    assert.ok(burned < 10, `${burned} of 100 burned in 120 days`);
  });
});

describe('outposts: a hard posting', () => {
  test('it heals a third as fast as the Depot, and the more dangerous the place, the more the watch wears on people', () => {
    const calm = ready('calm');
    buildOutpost(calm, 'maple_street', 2);
    const a = calm.survivors[0]!;
    station(calm, a.id, 'maple_street', 3);
    a.stress = 30;
    a.hp = 1;
    playOutpostsDay(calm, 4, new Rng('quiet'), {});
    assert.ok(a.hp <= 1 + Math.ceil(maxHp(a) * 0.05), `healed ${a.hp - 1}`);
    assert.ok(a.stress < 30 && a.stress >= 30 - OUTPOST_RELIEF - 4, `stress ${a.stress}`);

    // Two months at a danger 4 place, with nobody to share the watch: stress climbs.
    let climbed = 0;
    for (let g = 0; g < 40; g++) {
      const state = ready(`watch-${g}`, 'checkpoint_bravo');
      buildOutpost(state, 'checkpoint_bravo', 2);
      const s = state.survivors[0]!;
      station(state, s.id, 'checkpoint_bravo', 3);
      s.stress = 20;
      s.traits = s.traits.filter((t) => getTrait(t.id).kind !== 'personality');
      const rng = new Rng(`w-${g}`);
      for (let d = 4; d < 64 && findOutpost(state, 'checkpoint_bravo'); d++) {
        playOutpostsDay(state, d, rng, {});
        findOutpost(state, 'checkpoint_bravo')!.damaged = false;
      }
      if (s.stress > 20 || s.chronicle.some((c) => /breaking point/.test(c.text))) climbed += 1;
    }
    assert.ok(climbed >= 28, `${climbed} of 40 more stressed`);
  });

  test('on a hungry day at the Depot, the outposts go hungry too', () => {
    const state = ready('hungry');
    buildOutpost(state, 'maple_street', 2);
    const s = state.survivors[0]!;
    station(state, s.id, 'maple_street', 3);
    s.stress = 30;
    playOutpostsDay(state, 4, new Rng('h'), {}, true);
    assert.ok(s.stress >= 30 + 3, `stress ${s.stress}`);
    s.stress = 69;
    playOutpostsDay(state, 5, new Rng('h2'), {}, true);
    assert.ok(s.stress <= 70, `hunger alone stops at 70, not ${s.stress}`);
  });

  test('trouble comes calling: prowlers, long nights, accidents and, where there is any, radiation', () => {
    const seen = new Set<string>();
    let hurt = 0;
    for (let i = 0; i < 300; i++) {
      const state = ready(`trouble-${i}`, 'blackwater');
      buildOutpost(state, 'blackwater', 2);
      for (const s of state.survivors.slice(0, 2)) station(state, s.id, 'blackwater', 3);
      const before = state.survivors.slice(0, 2).map((s) => s.hp);
      const kind = outpostTrouble(state, findOutpost(state, 'blackwater')!, 4, new Rng(`t-${i}`))!;
      seen.add(kind);
      const staff = state.survivors.slice(0, 2);
      if (staff.some((s, j) => s.hp < before[j]!)) hurt += 1;
      for (const s of staff) assert.ok(s.hp >= 1, 'nobody dies of it');
    }
    assert.deepEqual([...seen].sort(), ['accident', 'long night', 'prowlers', 'prowlers held', 'radiation']);
    assert.ok(hurt > 30 && hurt < 150, `${hurt} of 300 hurt someone`);
    const empty = ready('empty', 'blackwater');
    buildOutpost(empty, 'blackwater', 2);
    assert.equal(outpostTrouble(empty, findOutpost(empty, 'blackwater')!, 4, new Rng('e')), undefined, 'nobody there, nothing happens');
  });
});

describe('outposts: runs nearby', () => {
  test('runs to the place, and the places next to it, start from the outpost', () => {
    const state = ready('near', 'maple_street');
    buildOutpost(state, 'maple_street', 2);
    const next = getLocation('maple_street').leadsTo[0]!;
    state.locations[next] = { discovered: true, explored: 0, runs: 0 };
    assert.ok(outpostNear(state, 'maple_street'));
    assert.ok(outpostNear(state, next));
    const plan = testPlan(state, 'maple_street');
    assert.equal(runDuration(state, plan), Math.round((footDuration(state, plan) * OUTPOST_SHORTCUT) / 60_000) * 60_000);
    const far = 'the_glow';
    assert.equal(outpostNear(state, far), undefined);
  });

  test('a crew stops at the outpost on the way home to rest and get patched up', () => {
    for (let i = 0; i < 40; i++) {
      const state = ready(`rest-${i}`);
      const plan = testPlan(state, 'maple_street');
      const without = simulateRun(state, plan, 'x', T0);
      buildOutpost(state, 'maple_street', 2);
      const withStop = simulateRun(state, plan, 'x', T0);
      if (without.result.outcome !== 'completed' || withStop.result.outcome !== 'completed') continue;
      const lines = withStop.beats.flatMap((b) => b.lines.map((l) => l.text));
      assert.ok(lines.some((l) => /stops at the outpost at Maple Street to rest/.test(l)));
      const stress = (r: typeof without): number => r.result.crew.reduce((n, s) => n + s.stress, 0);
      assert.ok(stress(withStop) <= stress(without) - OUTPOST_REST_STRESS, `${stress(withStop)} vs ${stress(without)}`);
      return;
    }
    assert.fail('no completed run');
  });
});

describe('deeper levels', () => {
  test('each level opens when the one above it is fully explored', () => {
    const state = openGame('depths');
    assert.equal(depthOpen(state, 'maple_street', 2), false);
    assert.match(validatePlan(state, { ...testPlan(state), depth: 2 }).join(' '), /Deeper in opens once the outskirts are fully explored/);
    state.locations.maple_street = { discovered: true, explored: 100, runs: 5 };
    assert.equal(deepestOpen(state, 'maple_street'), 2);
    assert.deepEqual(validatePlan(state, { ...testPlan(state), depth: 2 }), []);
    state.locations.maple_street.depths = [100, 20];
    assert.equal(deepestOpen(state, 'maple_street'), 3);
    assert.equal(exploredAt(state, 'maple_street', 3), 20);
    assert.match(validatePlan(state, { ...testPlan(state), depth: 4 }).join(' '), /does not exist/);
  });

  test('deeper takes longer, and a run explores the level it went to', () => {
    const state = openGame('deeper');
    state.locations.maple_street = { discovered: true, explored: 100, runs: 5 };
    const plan = { ...testPlan(state), depth: 2, job: 'scout' as const };
    assert.ok(runDuration(state, plan) > runDuration(state, testPlan(state)));
    const run = startRun(state, plan, T0);
    completeRun(state, run.id, run.returnAt);
    assert.equal(state.locations.maple_street!.explored, 100);
    assert.equal(exploredAt(state, 'maple_street', 2), run.result.exploredGain);
  });

  test('fully exploring the outskirts says the way deeper and an outpost are open', () => {
    const state = openGame('news');
    state.locations.maple_street = { discovered: true, explored: 99, runs: 5 };
    for (let i = 0; i < 20; i++) {
      const run = startRun(state, testPlan(state, 'maple_street', { job: 'scout' }), T0 + i * 3_600_000);
      completeRun(state, run.id, run.returnAt);
      if (state.locations.maple_street!.explored >= 100) break;
    }
    assert.ok(state.log.some((l) => l.text === 'The outskirts of Maple Street are fully explored. The way deeper in is open, and the guild could set up an outpost here.'));
  });

  test('deeper in is deadlier, and gives up more when a crew comes back with it', () => {
    let deaths = [0, 0];
    let loot = [0, 0];
    let completed = [0, 0];
    for (let i = 0; i < 500; i++) {
      for (const depth of [1, 2]) {
        const state = openGame(`deep-${i}`);
        state.locations.drowned_mall = { discovered: true, explored: 100, runs: 5 };
        const r = simulateRun(state, { ...testPlan(state, 'drowned_mall', {}, 4), depth }, `d${i}`, T0);
        deaths[depth - 1]! += r.result.deaths.length;
        if (r.result.outcome === 'completed') {
          completed[depth - 1]! += 1;
          loot[depth - 1]! += Object.values(r.result.loot).reduce((a, b) => a + b, 0);
        }
      }
    }
    assert.ok(deaths[1]! > deaths[0]! * 1.5, `deaths ${deaths[0]} then ${deaths[1]}`);
    const each = loot.map((l, i) => l / completed[i]!);
    assert.ok(each[1]! > each[0]! * 1.2, `loot per completed run ${each[0]!.toFixed(1)} then ${each[1]!.toFixed(1)}`);
  });

  test('a save from before version 12 gets an empty list of outposts', () => {
    const state = testGame('v11');
    const old = structuredClone(state) as unknown as Partial<GameState> & { version: number };
    delete old.outposts;
    old.version = 11;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.deepEqual(loaded.outposts, []);
  });
});
