import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, assignPost, createItem, letRaidFight, raidPreview, startRun, takeRaidCommand, type GameState } from '../engine/index.ts';
import { scheduleRaid, stepRaid } from '../engine/depot/raids.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import { stageModel } from './battle-view.ts';
import { noticeRoute } from './radio-view.ts';
import { raidAlert, raidCard, raidNoticeKey, raidNotices, raidWakeTimes } from './raid-view.ts';

/** A guild whose Watchtower sees raiders coming. */
function seenComing(seed: string): { state: GameState; raid: NonNullable<ReturnType<typeof scheduleRaid>> } {
  for (let i = 0; i < 50; i++) {
    const state = openGame(`${seed}-${i}`);
    state.buildings.watchtower = 3;
    const raid = scheduleRaid(state, 1, new Rng(`${seed}${i}`), 'raiders')!;
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
    assert.match(card.lines[0]!, /^Seen from the Watchtower\. At the gate around .+\.$/);
    assert.match(card.lines[1]!, /^Home to hold it now: /);
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
    const raid = scheduleRaid(state, 1, new Rng('g'), 'raiders')!;
    stepRaid(state, raid.arrive);
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
