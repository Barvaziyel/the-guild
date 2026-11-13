import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, RAID_ARRIVE_MINUTES, RAID_WAIT } from '../constants.ts';
import { createItem } from '../gear.ts';
import { canChangeGear } from '../gear.ts';
import { Rng } from '../rng.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testGame, testPlan } from '../test-utils.ts';
import type { GameState } from '../types.ts';
import { validatePlan } from '../expedition/plan.ts';
import { startRun } from '../expedition/runs.ts';
import { assignPost } from './buildings.ts';
import {
  commandRaidRound,
  lastRaidFight,
  letRaidFight,
  openRaid,
  raidAtGate,
  raidFightNow,
  raidPreview,
  raidSeen,
  scheduleRaid,
  stepRaid,
  takeRaidCommand,
} from './raids.ts';
import { advanceTime, dayStart } from './time.ts';

/** A raid on day 1, arrived at the gate. */
function atGate(state: GameState, seed: string, by: 'raiders' | 'vultures' = 'raiders') {
  const raid = scheduleRaid(state, 1, new Rng(seed), by)!;
  stepRaid(state, raid.arrive);
  return raid;
}

const hurt = (s: GameState): number => s.survivors.filter((x) => x.traits.some((t) => t.id === 'wounded' || t.id === 'badly_wounded')).length;

describe('raiders on the way', () => {
  test('they arrive later in the day that brings them; one raid at a time', () => {
    const state = testGame('arrive');
    const raid = scheduleRaid(state, 1, new Rng('a'), 'raiders')!;
    const start = dayStart(state, 1);
    assert.ok(raid.arrive >= start + RAID_ARRIVE_MINUTES[0] * 60_000 && raid.arrive <= start + RAID_ARRIVE_MINUTES[1] * 60_000);
    assert.equal(raid.until, raid.arrive + RAID_WAIT);
    assert.equal(scheduleRaid(state, 1, new Rng('b'), 'raiders'), undefined, 'not while one is on the way');
    assert.equal(raidAtGate(state), undefined, 'not at the gate yet');
  });

  test('the Watchtower may see them coming: more often the higher it is and with lookouts, and sooner', () => {
    const seen = (level: number, lookout: boolean): { share: number; lead: number } => {
      let n = 0;
      let lead = 0;
      for (let i = 0; i < 300; i++) {
        const state = testGame(`spot-${level}-${lookout}-${i % 7}`);
        state.buildings.watchtower = level;
        if (lookout) assignPost(state, state.survivors[0]!.id, { building: 'watchtower' });
        const raid = scheduleRaid(state, 3, new Rng(`s${i}`), 'raiders')!;
        if (raid.seen !== undefined) {
          n++;
          lead += raid.arrive - raid.seen;
          assert.ok(raid.seen >= dayStart(state, 3) && raid.seen < raid.arrive);
        }
      }
      return { share: n / 300, lead: n > 0 ? lead / n : 0 };
    };
    assert.equal(seen(0, false).share, 0, 'no tower, no warning');
    const one = seen(1, false);
    const three = seen(3, true);
    assert.ok(one.share > 0.35 && one.share < 0.65, `level 1: ${one.share}`);
    assert.ok(three.share > 0.85, `level 3 with a lookout: ${three.share}`);
    assert.ok(three.lead > one.lead, 'seen sooner from higher up');
  });

  test('seen on the road before they arrive', () => {
    for (let i = 0; i < 40; i++) {
      const state = testGame(`seen-${i}`);
      state.buildings.watchtower = 3;
      const raid = scheduleRaid(state, 1, new Rng(`x${i}`), 'raiders')!;
      if (raid.seen === undefined) continue;
      assert.equal(raidSeen(state, raid.seen - 1), undefined);
      assert.equal(raidSeen(state, raid.seen), raid);
      stepRaid(state, raid.arrive);
      assert.equal(raidSeen(state, raid.arrive), undefined, 'at the gate now, not on the road');
      return;
    }
    assert.fail('never seen');
  });
});

describe('at the gate', () => {
  test('only those home and fit when they arrive defend; a crew back afterwards stays out of it', () => {
    let checked = 0;
    for (let i = 0; i < 30 && checked < 3; i++) {
      const state = openGame(`order-${i}`);
      const run = startRun(state, testPlan(state, 'maple_street', {}, 1), T0);
      // Raiders that arrive while the crew is still out, and one that arrives after it's back.
      for (const [label, early] of [
        ['before', true],
        ['after', false],
      ] as const) {
        const s = structuredClone(state);
        const day = Math.floor((run.returnAt - s.createdAt) / DAY_MS) + 1;
        const raid = scheduleRaid(s, day, new Rng(`${label}${i}`), 'raiders')!;
        // Put the arrival either side of the crew's return.
        raid.arrive = early ? run.returnAt - 60_000 : run.returnAt + 60_000;
        raid.until = raid.arrive + RAID_WAIT;
        advanceTime(s, raid.arrive + 5_000);
        const r = s.depot.raid!;
        if (r.ended !== undefined) continue;
        const crewIn = r.defenders!.includes(run.plan.crew[0]!);
        assert.equal(crewIn, !early, `${label}: the crew ${early ? 'is not' : 'is'} a defender`);
        checked++;
      }
    }
    assert.ok(checked >= 3, `checked ${checked}`);
  });

  test('nobody sets out while they are at the gate', () => {
    const state = openGame('no-runs');
    const plan = testPlan(state, 'maple_street', {}, 1);
    assert.deepEqual(validatePlan(state, plan), []);
    atGate(state, 'nr');
    assert.ok(validatePlan(state, plan).some((p) => /Raiders are at the gate/.test(p)));
    letRaidFight(state, state.depot.raid!.arrive + 1000);
    assert.deepEqual(validatePlan(state, plan), []);
  });

  test('left alone, they fight it out when the wait runs out', () => {
    const state = testGame('alone');
    const raid = scheduleRaid(state, 1, new Rng('al'), 'raiders')!;
    advanceTime(state, raid.until - 1000);
    assert.ok(raidAtGate(state), 'still waiting');
    advanceTime(state, raid.until + 1000);
    assert.equal(openRaid(state), undefined);
    assert.ok(raid.end === 'held' || raid.end === 'broken');
    assert.equal(raid.ended, raid.until);
    assert.ok(state.log.some((l) => /came for the Depot|broke into the Depot/.test(l.text)));
    assert.ok(state.survivors.some((s) => s.chronicle.some((c) => /the gate/.test(c.text))));
  });

  test('with nobody home they walk in', () => {
    const state = testGame('empty');
    for (const s of state.survivors) s.status = 'away';
    state.resources.scrap = 200;
    atGate(state, 'em');
    const raid = state.depot.raid!;
    assert.equal(raid.end, 'broken');
    assert.ok(state.resources.scrap < 200);
    assert.ok(state.log.some((l) => /Nobody was home to stop them/.test(l.text)));
  });
});

describe('taking command at the gate', () => {
  test('round by round, then it’s over and the Depot pays for the ammo used', () => {
    let done = 0;
    for (let i = 0; i < 10 && done < 4; i++) {
      const state = testGame(`cmd-${i}`);
      state.survivors[0]!.equipment.weapon = createItem(state, 'hunting_rifle');
      state.resources.ammo = 40;
      const raid = atGate(state, `c${i}`);
      const preview = raidPreview(state, raid.arrive + 1000)!;
      const saved = serialize(state);
      assert.ok(preview.enemies.length > 0);
      assert.equal(serialize(state), saved, 'a preview changes nothing');
      let now = raid.arrive + 60_000;
      let view = takeRaidCommand(state, now);
      assert.throws(() => takeRaidCommand(state, now), /in command already/);
      // Gear can't change in the middle of it.
      assert.equal(canChangeGear(state.survivors[0]!, state), !raid.start!.survivors.some((s) => s.id === state.survivors[0]!.id));
      while (view) {
        assert.deepEqual(raidFightNow(state, now), view, 'the same fight every time it is played');
        now += 20_000;
        const attack = view.crew.filter((m) => m.moves.length > 0).map((m) => [m.id, { move: 'attack' as const, target: view!.enemies.find((e) => e.state === 'up')!.index }]);
        view = commandRaidRound(state, { moves: Object.fromEntries(attack) }, now);
      }
      assert.equal(openRaid(state), undefined);
      assert.ok(raid.end === 'held' || raid.end === 'broken');
      assert.ok(state.resources.ammo <= 40, 'ammo spent comes out of the stores');
      const end = lastRaidFight(state)!;
      assert.ok(end.over, 'the end of the fight, for the screen after it');
      assert.ok(state.log.some((l) => /under your command|broke into/.test(l.text)));
      assert.ok(canChangeGear(state.survivors[0]!, state));
      done++;
    }
    assert.ok(done >= 4);
  });

  test('a raid at the gate survives saving and loading', () => {
    const state = testGame('save');
    const raid = atGate(state, 'sv');
    takeRaidCommand(state, raid.arrive + 1000);
    const loaded = deserialize(serialize(state));
    assert.deepEqual(raidFightNow(loaded, raid.arrive + 2000), raidFightNow(state, raid.arrive + 2000));
  });

  test('the Vultures come led by one of their named people', () => {
    const state = testGame('vul');
    state.vultures.arrived = true as never;
    const raid = atGate(state, 'v', 'vultures');
    assert.ok(raid.enemies!.every((id) => id.startsWith('vulture_')));
    if (raid.leadId) {
      assert.equal(raid.enemies![0], 'vulture_lieutenant');
      const view = raidPreview(state, raid.arrive + 1000)!;
      assert.ok(view.enemies[0]!.vulture && view.enemies[0]!.named);
    }
  });
});

describe('raids, measured', () => {
  test('a new guild holds about half; a lookout on the Watchtower helps; nobody dies at the gate', () => {
    const rate = (setup: (s: GameState) => void, n: number): { held: number; hurt: number } => {
      let held = 0;
      let wounds = 0;
      for (let i = 0; i < n; i++) {
        const state = testGame(`m-${i}`);
        setup(state);
        const before = hurt(state);
        const raid = atGate(state, `m${i}`);
        letRaidFight(state, raid.arrive + 1000);
        if (raid.end === 'held') held++;
        wounds += hurt(state) - before;
        assert.equal(state.survivors.length, 4, 'nobody dies at the gate');
      }
      return { held: held / n, hurt: wounds / n };
    };
    const fresh = rate(() => {}, 300);
    const lookout = rate((s) => {
      s.buildings.watchtower = 1;
      const p = s.survivors[3]!;
      p.equipment.weapon = createItem(s, 'hunting_rifle');
      assignPost(s, p.id, { building: 'watchtower' });
    }, 300);
    assert.ok(fresh.held > 0.35 && fresh.held < 0.65, `fresh guild holds ${fresh.held}`);
    assert.ok(fresh.hurt < 0.8, `hurt per raid ${fresh.hurt}`);
    assert.ok(lookout.held > fresh.held + 0.1, `with a lookout ${lookout.held}`);
  });
});
