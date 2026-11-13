import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, RAID_ARRIVE_MINUTES, RAID_SHORE_COST, RAID_WAIT } from '../constants.ts';
import { createItem } from '../gear.ts';
import { canChangeGear } from '../gear.ts';
import { Rng } from '../rng.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testGame, testPlan } from '../test-utils.ts';
import type { GameState } from '../types.ts';
import { validatePlan } from '../expedition/plan.ts';
import { startRun } from '../expedition/runs.ts';
import { simulateRun } from '../expedition/sim.ts';
import { assignPost } from './buildings.ts';
import {
  canTalk,
  commandRaidRound,
  hideStores,
  lastRaidFight,
  letRaidFight,
  openRaid,
  payRaiders,
  raidAtGate,
  raidFightNow,
  raidPreview,
  raidRegroup,
  raidSeen,
  raidTeam,
  raidToll,
  recallCrew,
  recallPreview,
  regroupRaid,
  scheduleRaid,
  setRaidTeam,
  shoreUpFence,
  stareDown,
  stepRaid,
  takeRaidCommand,
} from './raids.ts';
import type { FightView, RoundOrders } from '../index.ts';
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
      // A second band: everyone still up meets it, fighting on their own.
      const between = raidRegroup(state, now);
      if (between) regroupRaid(state, between.people.filter((p) => !p.down).map((p) => p.id), false, now);
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

describe('back from a run', () => {
  test('tired only keeps them off runs: they work their post and hold the gate', async () => {
    const { canWork, laidUp, resting } = await import('./buildings.ts');
    const { addTrait } = await import('../traits.ts');
    const state = testGame('tired');
    const s = state.survivors[0]!;
    addTrait(s, 'exhausted', { day: 1, rng: new Rng('t') });
    assert.equal(laidUp(s), false);
    assert.equal(canWork(s), true, 'works at the Depot');
    assert.equal(resting(s), false);
    assert.ok(validatePlan(state, { ...testPlan(state, 'maple_street', {}, 1), crew: [s.id] }).some((p) => /exhausted/.test(p)), 'but no runs');
    const raid = atGate(state, 'tired');
    assert.ok(raid.defenders!.includes(s.id), 'and holds the gate');
    addTrait(s, 'wounded', { day: 1, rng: new Rng('w') });
    assert.equal(canWork(s), false, 'a wound lays them up');
  });
});

/** Attack whoever is still up with everyone who can. */
function attackAll(view: FightView): RoundOrders {
  const target = view.enemies.find((e) => e.state === 'up')!.index;
  return { moves: Object.fromEntries(view.crew.filter((m) => m.moves.length > 0).map((m) => [m.id, { move: 'attack' as const, target }])) };
}

/** Raiders seen on the road an hour and a half before they arrive, `at` after the guild began. */
function seenRaid(state: GameState, seed: string, at: number) {
  const day = Math.floor((at - state.createdAt) / DAY_MS) + 1;
  const raid = scheduleRaid(state, day, new Rng(seed), 'raiders')!;
  raid.seen = at;
  raid.arrive = at + 90 * 60_000;
  raid.until = raid.arrive + RAID_WAIT;
  return raid;
}

describe('getting ready', () => {
  test('the fence is shored up for scrap, only while they are on the road, and gives the defenders cover', () => {
    const state = testGame('shore');
    state.resources.scrap = 100;
    const raid = seenRaid(state, 'sh', T0 + 60_000);
    assert.throws(() => shoreUpFence(state, raid.seen! - 1), /No raiders are on the road/);
    shoreUpFence(state, raid.seen!);
    assert.equal(raid.shored, true);
    assert.equal(state.resources.scrap, 100 - RAID_SHORE_COST.scrap);
    assert.throws(() => shoreUpFence(state, raid.seen!), /already/);
    stepRaid(state, raid.arrive);
    assert.throws(() => hideStores(state, raid.arrive), /No raiders are on the road/, 'too late at the gate');
    // Measured: shored up, more raids are held.
    const rate = (shore: boolean): number => {
      let held = 0;
      for (let i = 0; i < 200; i++) {
        const s = testGame(`sr-${i}`);
        const r = scheduleRaid(s, 1, new Rng(`sr${i}`), 'raiders')!;
        if (shore) r.shored = true;
        stepRaid(s, r.arrive);
        letRaidFight(s, r.arrive + 1000);
        if (r.end === 'held') held++;
      }
      return held / 200;
    };
    assert.ok(rate(true) > rate(false) + 0.08);
  });

  test('hidden stores: a break-in finds half as much', () => {
    const lost = (hide: boolean): number => {
      const state = testGame('hide');
      for (const s of state.survivors) s.status = 'away';
      state.resources.scrap = 200;
      const raid = seenRaid(state, 'hd', T0 + 60_000);
      if (hide) {
        state.survivors[0]!.status = 'ready';
        hideStores(state, raid.seen!);
        state.survivors[0]!.status = 'away';
      }
      stepRaid(state, raid.arrive);
      assert.equal(raid.end, 'broken');
      return 200 - state.resources.scrap;
    };
    const all = lost(false);
    const half = lost(true);
    assert.ok(half < all && half > 0, `${half} of ${all}`);
  });

  test('nobody home, nothing gets done', () => {
    const state = testGame('nobody');
    state.resources.scrap = 100;
    const raid = seenRaid(state, 'nb', T0 + 60_000);
    for (const s of state.survivors) s.status = 'away';
    assert.throws(() => shoreUpFence(state, raid.seen!), /Nobody is home/);
  });
});

describe('calling a crew home', () => {
  /** A guild with a Radio Tower and a Watchtower, a crew out, and raiders seen while they are. */
  function crewOut(seed: string) {
    const state = openGame(seed);
    state.buildings.radio_tower = 1;
    state.buildings.watchtower = 3;
    const run = startRun(state, testPlan(state, 'maple_street', {}, 1), T0);
    const at = run.departAt + Math.round((run.returnAt - run.departAt) * 0.3);
    const raid = seenRaid(state, `${seed}-r`, at);
    return { state, run, at, raid };
  }

  test('a run with a Radio Tower and a Watchtower keeps what it set out with, and plays the same from it', () => {
    const { run } = crewOut('copy');
    assert.ok(run.home);
    const again = simulateRun(run.home.start, run.plan, run.seed, run.departAt, { taken: run.home.taken });
    assert.deepEqual(again.beats, run.beats);
    assert.equal(again.returnAt, run.returnAt);
    const plain = openGame('plain');
    assert.equal(startRun(plain, testPlan(plain, 'maple_street', {}, 1), T0).home, undefined, 'no Radio Tower, no copy');
  });

  test('called home, they turn back: the same run up to then, and back sooner', () => {
    let done = 0;
    for (let i = 0; i < 20 && done < 5; i++) {
      const { state, run, at, raid } = crewOut(`call-${i}`);
      const preview = recallPreview(state, run.id, at);
      if (!preview) continue;
      const was = run.returnAt;
      const before = run.beats.filter((b) => run.departAt + b.at < at);
      recallCrew(state, run.id, at);
      assert.deepEqual(run.beats.filter((b) => run.departAt + b.at < at), before, 'what already happened stays');
      assert.equal(run.returnAt, preview.returnAt);
      assert.ok(run.returnAt < was);
      assert.equal(run.recalled, at);
      assert.ok(run.beats.some((b) => b.title === 'Called home'));
      assert.equal(preview.inTime, run.returnAt <= raid.arrive);
      assert.equal(recallPreview(state, run.id, at + 1000), undefined, 'once is enough');
      // Back in time, they hold the gate.
      advanceTime(state, raid.arrive + 1000);
      if (preview.inTime && state.depot.raid?.defenders) assert.ok(state.depot.raid.defenders.includes(run.plan.crew[0]!));
      done++;
    }
    assert.ok(done >= 5, `called ${done}`);
  });

  test('only with raiders on the road', () => {
    const state = openGame('quiet');
    state.buildings.radio_tower = 1;
    state.buildings.watchtower = 1;
    const run = startRun(state, testPlan(state, 'maple_street', {}, 1), T0);
    assert.equal(recallPreview(state, run.id, T0 + 60_000), undefined);
    assert.throws(() => recallCrew(state, run.id, T0 + 60_000), /No raiders/);
  });
});

describe('talking first', () => {
  test('paid off, they go: nobody hurt, the toll comes out of the stores', () => {
    const state = testGame('pay');
    state.resources.scrap = 150;
    state.resources.rations = 150;
    const raid = atGate(state, 'p');
    const toll = raidToll(state, raid);
    assert.ok((toll.scrap ?? 0) > 0 && (toll.rations ?? 0) > 0);
    payRaiders(state, raid.arrive + 1000);
    assert.equal(raid.end, 'paid');
    assert.equal(state.resources.scrap, 150 - toll.scrap!);
    assert.equal(hurt(state), 0);
    assert.equal(openRaid(state), undefined);
    assert.ok(state.log.some((l) => /paid them/.test(l.text)));
  });

  test('without the stores to pay, they can’t be paid', () => {
    const state = testGame('broke');
    for (const r of ['scrap', 'rations', 'ammo', 'gas'] as const) state.resources[r] = 0;
    const raid = atGate(state, 'b');
    assert.throws(() => payRaiders(state, raid.arrive + 1000), /doesn’t have it/);
  });

  test('stared down they go; if not, they strike first and there is no more talking', () => {
    let went = 0;
    let stayed = 0;
    for (let i = 0; i < 40; i++) {
      const state = testGame(`stare-${i}`);
      const raid = atGate(state, `st${i}`);
      const now = raid.arrive + 1000;
      if (stareDown(state, now)) {
        went++;
        assert.equal(raid.end, 'stared');
        assert.ok(state.survivors.some((s) => s.chronicle.some((c) => /Stared down/.test(c.text))));
        continue;
      }
      stayed++;
      assert.equal(raid.talk?.how === 'stare' && raid.talk.ok, false);
      assert.equal(canTalk(state, now), false);
      assert.throws(() => payRaiders(state, now), /past talking/);
      // They strike first: the defenders' first orders are for the second round.
      assert.equal(takeRaidCommand(state, now)?.round ?? 2, 2);
    }
    assert.ok(went > 5 && stayed > 5, `went ${went}, stayed ${stayed}`);
  });
});

describe('who holds the gate, and a second band', () => {
  test('the player picks who meets the first band', () => {
    const state = testGame('team');
    const raid = atGate(state, 'tm');
    const one = state.survivors[1]!.id;
    setRaidTeam(state, [one], raid.arrive + 1000);
    assert.deepEqual(raidTeam(state), [one]);
    assert.deepEqual(raidPreview(state, raid.arrive + 1000)!.crew.map((m) => m.id), [one]);
    assert.throws(() => setRaidTeam(state, [], raid.arrive + 1000), /Someone has to/);
    setRaidTeam(state, state.survivors.map((s) => s.id), raid.arrive + 1000);
    assert.equal(raid.team, undefined, 'everyone again');
  });

  test('some raids come in two bands; under command the player picks who meets the second', () => {
    let regrouped = 0;
    let bands = 0;
    for (let i = 0; i < 120 && regrouped < 3; i++) {
      const state = testGame(`band-${i}`);
      const raid = atGate(state, `bd${i}`);
      if (raid.waves !== 2) continue;
      bands++;
      assert.ok((raid.enemies2 ?? []).length > 0);
      let now = raid.arrive + 1000;
      let view = takeRaidCommand(state, now);
      while (view) {
        now += 10_000;
        view = commandRaidRound(state, attackAll(view), now);
      }
      if (openRaid(state) === undefined) continue; // the first band got in
      const between = raidRegroup(state, now)!;
      assert.ok(between, 'waiting on the player between the bands');
      const up = between.people.filter((p) => !p.down);
      assert.ok(up.length > 0);
      view = regroupRaid(state, [up[0]!.id], true, now);
      while (view) {
        assert.deepEqual(view.crew.map((m) => m.id), [up[0]!.id], 'only the one picked meets the second band');
        now += 10_000;
        view = commandRaidRound(state, attackAll(view), now);
      }
      assert.equal(openRaid(state), undefined);
      assert.ok(raid.end === 'held' || raid.end === 'broken');
      regrouped++;
    }
    assert.ok(bands > 0 && regrouped >= 3, `bands ${bands}, regrouped ${regrouped}`);
  });

  test('left alone, everyone fit meets the second band', () => {
    for (let i = 0; i < 80; i++) {
      const state = testGame(`band-auto-${i}`);
      const raid = atGate(state, `ba${i}`);
      if (raid.waves !== 2) continue;
      letRaidFight(state, raid.arrive + 1000);
      if (raid.end !== 'held') continue;
      assert.ok(state.log.some((l) => /drove both bands off/.test(l.text)));
      return;
    }
    assert.fail('no two-band raid held');
  });
});
