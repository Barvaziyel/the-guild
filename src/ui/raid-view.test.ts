import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, RAID_WAIT, Rng, assignPost, buildOutpost, commandRaidRound, createItem, letRaidFight, raidPreview, startRun, stareDown, station, takeRaidCommand, type GameState, type RaidBand, type RaidWant } from '../engine/index.ts';
import { scheduleRaid, stepRaid } from '../engine/depot/raids.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import { stageModel } from './battle-view.ts';
import { noticeRoute } from './radio-view.ts';
import { gateView, raidAlert, raidCard, raidNoticeKey, raidNotices, raidOver, raidWakeTimes, readyView, regroupView, wantLine } from './raid-view.ts';

/** A guild whose Watchtower sees raiders coming. */
function seenComing(seed: string): { state: GameState; raid: NonNullable<ReturnType<typeof scheduleRaid>> } {
  for (let i = 0; i < 50; i++) {
    const state = openGame(`${seed}-${i}`);
    state.buildings.watchtower = 3;
    const raid = scheduleRaid(state, 1, new Rng(`${seed}${i}`), 'raiders')!;
    raid.by = 'raiders';
    delete raid.wants;
    if (raid.seen !== undefined) return { state, raid };
  }
  throw new Error('never seen');
}

describe('raiders on the road', () => {
  test('the card says when they come, who is home, and which crews will be back in time', () => {
    const { state, raid } = seenComing('card');
    startRun(state, testPlan(state, 'maple_street', {}, 1), raid.seen! - 5 * 60_000);
    const card = raidCard(state, raid.seen!)!;
    assert.equal(card.kind, 'seen');
    assert.equal(card.title, 'Raiders on the road');
    assert.match(card.lines[0]!, /^At the gate around .+\.$/);
    assert.equal(card.lines[1], 'They’re after the stores, and a vehicle if one is parked.');
    assert.match(card.lines[2]!, /^Home to hold it now: /);
    assert.ok(card.lines.some((l) => /, back from Maple Street at .+, (will be in time|won’t be)\.$/.test(l)));
    assert.equal(raidCard(state, raid.seen! - 1), undefined, 'not before it is seen');
    assert.equal(raidAlert(state), false, 'nothing to do yet');
  });

  test('notices when they are seen and when they arrive; the app wakes for both and for the end of the wait', () => {
    const { state, raid } = seenComing('notice');
    const notices = raidNotices(state);
    assert.deepEqual(notices.map((n) => n.id), [`raid-seen-${raid.id}`, `raid-${raid.id}`]);
    assert.equal(notices[0]!.at, raid.seen);
    assert.equal(notices[1]!.at, raid.arrive);
    assert.match(notices[1]!.body, /wait 3 h/);
    assert.deepEqual(raidWakeTimes(state, raid.seen! - 1), [raid.seen, raid.arrive, raid.until]);
    assert.deepEqual(noticeRoute(notices[0]!.id), { screen: 'raid' });
    const key = raidNoticeKey(state);
    stepRaid(state, raid.arrive);
    assert.notEqual(raidNoticeKey(state), key, 'arriving plans the notices again');
    assert.deepEqual(raidNotices(state).map((n) => n.id), [`raid-${raid.id}`]);
  });
});

describe('at the gate', () => {
  test('the card: who they are, who holds it, how long they wait; then in command', () => {
    const state = testGame('gate');
    const raid = gateOf(state, 'g');
    const card = raidCard(state, raid.arrive + 60_000)!;
    assert.equal(card.kind, 'gate');
    assert.equal(card.title, 'Raiders at the gate');
    assert.match(card.against!, /^[A-Z].*\.$/);
    assert.match(card.lines[0]!, /^Here to hold it: /);
    assert.match(card.wait!, /^They’ll wait 2 h 59 min more for your orders\./);
    assert.equal(raidAlert(state), true, 'the Depot tab says something needs you');
    takeRaidCommand(state, raid.arrive + 60_000);
    if (state.depot.raid!.ended === undefined) {
      const led = raidCard(state, raid.arrive + 2 * 60_000)!;
      assert.equal(led.inCommand, true);
      assert.match(led.wait!, /^You’re in command\./);
    }
    letRaidFight(state, raid.arrive + 3 * 60_000);
    assert.equal(raidCard(state, raid.arrive + 4 * 60_000), undefined);
    assert.equal(raidAlert(state), false);
  });

  test('on the stage: lookouts up on the Watchtower, and the dog with the people', () => {
    const state = testGame('stage');
    state.buildings.watchtower = 1;
    const look = state.survivors[2]!;
    look.equipment.weapon = createItem(state, 'hunting_rifle');
    assignPost(state, look.id, { building: 'watchtower' });
    state.animals.push({ id: 'a1', kind: 'dog', name: 'Rust', arrivedDay: 1 } as never);
    const raid = scheduleRaid(state, 1, new Rng('st'), 'raiders')!;
    stepRaid(state, raid.arrive);
    const view = raidPreview(state, raid.arrive + 1000)!;
    assert.equal(view.dog, 'Rust');
    assert.equal(view.crew.find((m) => m.id === look.id)!.perch, true);
    assert.ok(view.crew.find((m) => m.id === look.id)!.moves.every((c) => ['attack', 'aim', 'called_shot', 'spray', 'spot'].includes(c.move)), 'up there they can only shoot');
    const m = stageModel(state, { place: 'depot', seed: raid.id }, view, { picks: {} });
    assert.equal(m.place, 'depot');
    assert.equal(m.crew.find((f) => f.key === `c:${look.id}`)!.perch, true);
    const dog = m.crew.find((f) => f.key === 'c:dog')!;
    assert.equal(dog.kind, 'dog');
    assert.equal(dog.maxHp, 0, 'no bar: nobody can hurt it');
  });
});

describe('a run while raiders wait', () => {
  test('a crew can’t be sent', () => {
    const state = openGame('send');
    const raid = scheduleRaid(state, 1, new Rng('se'), 'raiders')!;
    stepRaid(state, raid.arrive);
    assert.throws(() => startRun(state, testPlan(state, 'maple_street', {}, 1), T0 + 1));
  });
});

describe('getting ready', () => {
  test('crews out: back in time or not, and called home over the radio', () => {
    for (let i = 0; i < 20; i++) {
      const state = openGame(`ready-${i}`);
      state.buildings.radio_tower = 1;
      state.buildings.watchtower = 3;
      state.resources.scrap = 50;
      const run = startRun(state, testPlan(state, 'maple_street', {}, 1), T0);
      const at = run.departAt + Math.round((run.returnAt - run.departAt) * 0.3);
      const raid = scheduleRaid(state, Math.floor((at - state.createdAt) / DAY_MS) + 1, new Rng(`rd${i}`), 'raiders')!;
      raid.seen = at;
      raid.arrive = at + 90 * 60_000;
      raid.until = raid.arrive + RAID_WAIT;
      // Make sure the crew would be back too late without a call.
      if (run.returnAt <= raid.arrive) raid.arrive = run.returnAt - 60_000;
      const ready = readyView(state, at)!;
      assert.match(ready.when, /^At the gate around .+\.$/);
      const row = ready.crews[0]!;
      assert.match(row.who, /, at Maple Street$/);
      assert.match(row.back, /too late to hold the gate\.$/);
      if (!row.call) continue;
      assert.match(row.call.label, /^Back by .+, (in time|still too late)\.$/);
      assert.equal(ready.shore.problem, undefined);
      assert.match(ready.shore.label, /^Shore it up \(20 scrap\)$/);
      assert.equal(ready.hide.done, false);
      return;
    }
    assert.fail('no crew to call home');
  });

  test('without a Radio Tower, crews can’t be called', () => {
    const state = openGame('noradio');
    state.buildings.watchtower = 3;
    const run = startRun(state, testPlan(state, 'maple_street', {}, 1), T0);
    const at = run.departAt + 60_000;
    const raid = scheduleRaid(state, 1, new Rng('nr'), 'raiders')!;
    raid.seen = at;
    raid.arrive = run.returnAt - 60_000;
    raid.until = raid.arrive + RAID_WAIT;
    const row = readyView(state, at)!.crews[0]!;
    assert.equal(row.call, undefined);
    assert.match(row.note!, /takes a Radio Tower/);
  });
});

/** Raiders of `band` scheduled and at the gate, wanting `wants` (or nothing). */
function gateOf(state: GameState, seed: string, band: RaidBand = 'raiders', wants?: RaidWant, outpost?: string) {
  const raid = scheduleRaid(state, 1, new Rng(seed), 'raiders', outpost)!;
  raid.by = band;
  delete raid.wants;
  if (wants) raid.wants = wants;
  stepRaid(state, raid.arrive);
  return raid;
}

describe('at the gate, before the fight', () => {
  test('who holds it, what they want, and the odds of staring them down', () => {
    const state = testGame('gv');
    const raid = gateOf(state, 'gv');
    const gate = gateView(state, raid.arrive + 1000)!;
    assert.equal(gate.team.length, 4);
    assert.ok(gate.team.every((p) => p.in));
    assert.match(gate.talk!.pay!.text, /^They want .+ to go away\.$/);
    assert.equal(gate.talk!.pay!.label, 'Pay them off');
    assert.match(gate.talk!.stare, /^\w+ does the talking: about \d+% they back off\. If not, they strike first\.$/);
    for (let i = 0; i < 30; i++) {
      const s = testGame(`gv-${i}`);
      const r = gateOf(s, `gv${i}`);
      if (stareDown(s, r.arrive + 1000)) continue;
      const after = gateView(s, r.arrive + 2000)!;
      assert.equal(after.talk, undefined, 'no more talking');
      assert.match(after.said!, /They’ll strike first\.$/);
      return;
    }
    assert.fail('every stare worked');
  });

  test('between the bands: who is up, who is down, who is fresh', () => {
    for (let i = 0; i < 120; i++) {
      const state = testGame(`rg-${i}`);
      const raid = gateOf(state, `rg${i}`);
      if (raid.waves !== 2) continue;
      let now = raid.arrive + 1000;
      let view = takeRaidCommand(state, now);
      while (view) {
        now += 10_000;
        const target = view.enemies.find((e) => e.state === 'up')!.index;
        view = commandRaidRound(state, { moves: Object.fromEntries(view.crew.filter((m) => m.moves.length > 0).map((m) => [m.id, { move: 'attack' as const, target }])) }, now);
      }
      const between = regroupView(state, now);
      if (!between) continue;
      assert.match(between.against, /^Coming up the road: .+\.$/);
      assert.ok(between.people.every((p) => (p.can ? /^\d+\/\d+ HP/.test(p.state) : p.state === 'Down')));
      return;
    }
    assert.fail('never between the bands');
  });
});

describe('who comes and what they want', () => {
  test('a band there’s no talking to says so, and what it’s after', () => {
    const state = testGame('mute');
    const raid = gateOf(state, 'm', 'ferals');
    const card = raidCard(state, raid.arrive + 1000)!;
    assert.equal(card.title, 'A feral pack at the gate');
    assert.ok(card.lines.includes('They’re after food.'));
    const gate = gateView(state, raid.arrive + 1000)!;
    assert.equal(gate.talk, undefined);
    assert.equal(gate.mute, 'There’s no talking to them.');
  });

  test('what they came for, on the card and in the talking', () => {
    const state = testGame('wants');
    state.vehicles.push({ id: 'v1', defId: 'pickup', condition: 100, runs: 0 });
    const raid = gateOf(state, 'w', 'raiders', { what: 'vehicle', vehicleId: 'v1', name: 'Pickup' });
    assert.equal(wantLine(raid), 'They want the Pickup.');
    assert.ok(raidCard(state, raid.arrive + 1000)!.lines.includes('They want the Pickup.'));
    const pay = gateView(state, raid.arrive + 1000)!.talk!.pay!;
    assert.equal(pay.text, 'Hand over the Pickup, and they go.');
    assert.equal(pay.label, 'Hand it over');

    const marked = state.survivors[1]!;
    const score = testGame('score');
    const r2 = gateOf(score, 's', 'raiders', { what: 'score', id: score.survivors[1]!.id, name: marked.firstName, kills: 7 });
    assert.match(wantLine(r2)!, /^They want \w+, who has killed 7 of theirs\. In a fight they’ll go for \w+\.$/);
    const talk = gateView(score, r2.arrive + 1000)!.talk!;
    assert.equal(talk.pay, undefined);
    assert.match(talk.refused!, /^They won’t take anything for \w+\.$/);

    const gone = testGame('gone');
    const r3 = gateOf(gone, 'g', 'raiders', { what: 'vehicle', vehicleId: 'nope', name: 'Van' });
    assert.equal(wantLine(r3), 'They came for the Van. It isn’t here, so they’ll take what they can.');
  });

  test('at an outpost: the place in the title, and those who live there hold it', () => {
    const state = openGame('outpost-card');
    state.resources = { scrap: 500, rations: 500, meds: 20, ammo: 50, tech: 100, gas: 0 };
    state.buildings.radio_tower = 1;
    state.locations.maple_street = { discovered: true, explored: 100, runs: 5 };
    buildOutpost(state, 'maple_street', 1);
    const s = state.survivors[0]!;
    station(state, s.id, 'maple_street', 1);
    const raid = gateOf(state, 'o', 'raiders', undefined, 'maple_street');
    const card = raidCard(state, raid.arrive + 1000)!;
    assert.equal(card.title, 'Raiders at the outpost at Maple Street');
    assert.ok(card.lines.includes(`There to hold it: ${s.firstName}.`));
    assert.match(card.wait!, /whoever is there fights them on their own\.$/);
    assert.equal(raidNotices(state)[0]!.title, 'Raiders at the outpost at Maple Street');
  });

  test('the end: the news of it, and a captive to see in the Roster', () => {
    for (let i = 0; i < 200; i++) {
      const state = testGame(`over-${i}`);
      for (const p of state.survivors) p.stats.aim = p.stats.brawn = 9;
      const raid = gateOf(state, `ov${i}`);
      letRaidFight(state, raid.arrive + 1000);
      const over = raidOver(state)!;
      assert.ok(over.lines.length > 0);
      assert.match(over.lines[0]!, /^Raiders came for the Depot\./);
      if (!over.captive) continue;
      assert.ok(over.lines.some((l) => l.includes(over.captive!.name)));
      return;
    }
    assert.fail('no captive in 200 raids');
  });
});
