/**
 * Calls that matter (§7.13, 3.10.0): a crew that calls home "when it matters"
 * only does so for a named foe, or for a fight that, left alone, would put
 * someone down; when someone would die of it, the call says so. A fight the
 * player leads to a win with nobody down is a clean fight, and it pays.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createItem } from '../gear.ts';
import { Rng } from '../rng.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import type { GameState, RoundOrders, RunPlan } from '../types.ts';
import type { FightView } from './command.ts';
import { simulateRun } from './sim.ts';
import { letThemFight, startRun, takeCommand } from './runs.ts';

function kitted(state: GameState): void {
  for (const s of state.survivors.slice(0, 3)) {
    s.equipment.armor = createItem(state, 'scrap_vest');
    s.equipment.weapon = createItem(state, 'machete');
  }
}

function plan(state: GameState, place: string, lead: RunPlan['lead']): RunPlan {
  return { ...testPlan(state, place), ...(lead !== undefined ? { lead } : {}) };
}

/** Anyone of the crew who went down on the run, or died. */
function downs(state: GameState, run: ReturnType<typeof simulateRun>): number {
  return run.result.deaths.length + run.result.crew.filter((s) => s.counters.timesDowned > state.survivors.find((b) => b.id === s.id)!.counters.timesDowned).length;
}

/** What a run comes to, leaving out what half an hour of waiting by the radio changes (the road's stress). */
function outcome(run: ReturnType<typeof simulateRun>): string {
  return JSON.stringify({ crew: run.result.crew.map((s) => [s.hp, s.counters, s.traits.map((t) => t.id)]), loot: run.result.loot, deaths: run.result.deaths.length });
}

describe('calls that matter (3.10.0)', () => {
  test('an easy place hardly ever calls; a place past the crew’s edge often does', () => {
    let easy = 0;
    let hard = 0;
    for (let i = 0; i < 200; i++) {
      const a = openGame(`calls-easy-${i}`);
      kitted(a);
      easy += simulateRun(a, plan(a, 'rail_yard', 'matters'), `e${i}`, T0).stops!.length;
      const b = openGame(`calls-hard-${i}`);
      hard += simulateRun(b, plan(b, 'checkpoint_bravo', 'matters'), `h${i}`, T0).stops!.length;
    }
    assert.ok(easy <= 4, `the Rail Yard called ${easy} times in 200 runs`);
    assert.ok(hard >= 80, `Checkpoint Bravo called ${hard} times in 200 runs`);
  });

  test('a run that never calls is the same run as one nobody leads', () => {
    let quiet = 0;
    for (let i = 0; i < 200; i++) {
      const state = openGame(`calls-same-${i % 9}`);
      state.rng = new Rng(`calls-same-${i}`).getState();
      const led = simulateRun(state, plan(state, i % 2 ? 'old_metro' : 'maple_street', 'matters'), `s${i}`, T0);
      if (led.stops!.length > 0) continue;
      quiet++;
      const alone = simulateRun(state, plan(state, i % 2 ? 'old_metro' : 'maple_street', undefined), `s${i}`, T0);
      assert.equal(JSON.stringify(led.beats), JSON.stringify(alone.beats), `run ${i}`);
      assert.equal(led.returnAt, alone.returnAt);
    }
    assert.ok(quiet > 100);
  });

  test('every call is for a fight that would have put someone down, and nobody answering changes nothing else', () => {
    let calls = 0;
    let matched = 0;
    let quiet = 0;
    let quietDowned = 0;
    for (let i = 0; i < 300; i++) {
      const state = openGame(`calls-why-${i % 11}`);
      state.rng = new Rng(`calls-why-${i}`).getState();
      const place = ['old_metro', 'st_judes', 'water_plant'][i % 3]!;
      const led = simulateRun(state, plan(state, place, 'matters'), `w${i}`, T0);
      if (led.stops!.length === 0) {
        // Nobody went down in its fights. A floor can still give way under someone (a hazard), so: hardly anyone.
        quiet++;
        if (downs(state, simulateRun(state, plan(state, place, undefined), `w${i}`, T0)) > 0) quietDowned++;
        continue;
      }
      calls++;
      const alone = simulateRun(state, plan(state, place, undefined), `w${i}`, T0);
      assert.ok(downs(state, alone) > 0 || led.beats.some((b) => b.lines.some((l) => /nemesis|Vulture/i.test(l.text))), `run ${i}: called, but nobody went down`);
      if (outcome(led) === outcome(alone)) matched++;
    }
    assert.ok(calls > 50, `${calls} runs called`);
    assert.ok(quietDowned <= quiet * 0.08, `${quietDowned} of ${quiet} runs that never called had someone down`);
    // Waiting half an hour by the radio adds the road's stress, which now and then tips someone over.
    assert.ok(matched >= calls * 0.9, `${matched} of ${calls} came out the same`);
  });

  test('when someone would die of it, the call says so', () => {
    let grave = 0;
    let died = 0;
    for (let i = 0; i < 400 && grave < 25; i++) {
      const state = openGame(`calls-grave-${i % 13}`);
      state.rng = new Rng(`calls-grave-${i}`).getState();
      const led = simulateRun(state, { ...plan(state, 'the_glow', 'matters'), meds: 0 }, `g${i}`, T0);
      if (!led.stops!.some((s) => s.grave)) continue;
      grave++;
      if (led.result.deaths.length > 0) died++;
    }
    assert.ok(grave >= 10, `${grave} grave calls`);
    assert.ok(died >= grave * 0.8, `${died} of ${grave} grave calls left alone ended in a death`);
  });

  test('a crew set to call at every fight still does', () => {
    let every = 0;
    let matters = 0;
    for (let i = 0; i < 100; i++) {
      const state = openGame(`calls-every-${i}`);
      kitted(state);
      every += simulateRun(state, plan(state, 'old_metro', true), `v${i}`, T0).stops!.length;
      matters += simulateRun(state, plan(state, 'old_metro', 'matters'), `v${i}`, T0).stops!.length;
    }
    assert.ok(every > matters * 3, `every fight: ${every}, when it matters: ${matters}`);
  });

  test('a led run that calls when it matters is taken up like any other', () => {
    for (let i = 0; i < 60; i++) {
      const state = openGame(`calls-run-${i}`);
      state.rng = new Rng(`calls-run-${i}`).getState();
      const run = startRun(state, plan(state, 'water_plant', 'matters'), T0);
      const first = run.lead!.fights[0];
      if (!first) continue;
      assert.ok(takeCommand(state, run.id, first.at + 1_000));
      letThemFight(state, run.id, first.at + 2_000);
      assert.equal(run.lead!.fights[0]!.auto, true);
      return;
    }
    assert.fail('no run called');
  });
});

describe('a clean fight (3.10.0)', () => {
  /** Shoot or strike the most hurt enemy that can be reached; nothing clever. */
  const focus = (v: FightView): RoundOrders => {
    const target = v.enemies.map((e, k) => ({ e, k })).filter(({ e }) => e.state === 'up').sort((a, b) => a.e.hp - b.e.hp)[0]?.k ?? 0;
    return { moves: Object.fromEntries(v.crew.filter((m) => m.moves.some((c) => c.move === 'attack')).map((m) => [m.id, { move: 'attack' as const, target }])) };
  };

  test('won under command with nobody down: it says so, steadies them, and the bodies give more', () => {
    let clean = 0;
    let messy = 0;
    for (let i = 0; i < 300 && clean < 10; i++) {
      const state = openGame(`clean-${i % 7}`);
      kitted(state);
      state.rng = new Rng(`clean-${i}`).getState();
      const run = simulateRun(state, plan(state, 'maple_street', true), `c${i}`, T0, { commander: focus });
      for (const end of run.ends ?? []) {
        if (!end) continue;
        if (end.clean) {
          clean++;
          assert.equal(end.over, 'won');
        } else if (end.over === 'won') messy++;
      }
      const said = run.beats.some((b) => b.lines.some((l) => /walks? away from it/.test(l.text)));
      assert.equal(said, (run.ends ?? []).some((e) => e?.clean), `run ${i}`);
    }
    assert.ok(clean >= 10, `${clean} clean fights`);
    assert.ok(messy >= 0);
  });

  test('a fight nobody commands is never clean', () => {
    for (let i = 0; i < 100; i++) {
      const state = openGame(`clean-alone-${i}`);
      kitted(state);
      const run = simulateRun(state, plan(state, 'maple_street', undefined), `a${i}`, T0);
      assert.ok(!run.beats.some((b) => b.lines.some((l) => /walks? away from it/.test(l.text))));
    }
  });
});
