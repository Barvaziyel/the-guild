import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, commandRound, startRun, takeCommand, type FightMemberView, type FightView, type GameState, type Run } from '../engine/index.ts';
import { T0, openGame, testPlan } from '../engine/test-utils.ts';
import { crewKey, enemyKey, roundFrames, shortName, stageHint, stageModel, stageTargets, tapOnStage } from './battle-view.ts';

const PLACES = ['kessler_farm', 'old_metro', 'drowned_mall', 'st_judes'];

/** A guild with a crew in a fight under command. */
function commanded(seed: string): { state: GameState; run: Run; view: FightView } {
  for (let i = 0; i < 500; i++) {
    const state = openGame(`${seed}-${i % 5}`);
    state.buildings.radio_tower = 1;
    state.rng = new Rng(`${seed}-${i}`).getState();
    const run = startRun(state, { ...testPlan(state, PLACES[i % PLACES.length]!, { job: 'hunt', meds: 2 }), lead: true }, T0);
    const f = run.lead!.fights[0];
    if (!f) continue;
    const view = takeCommand(state, run.id, f.at + 1000);
    if (view && view.enemies.length >= 2) return { state, run: state.runs.find((r) => r.id === run.id)!, view };
  }
  throw new Error('no commanded fight');
}

const member = (id: string, moves: FightMemberView['moves']): FightMemberView => ({ id, name: id === 'a' ? 'Mara' : 'Kai', hp: 10, maxHp: 20, state: 'up', aimed: false, moves });
const VIEW: FightView = {
  round: 2,
  maxRounds: 6,
  place: 'Kessler Farm',
  enemies: [
    { index: 0, name: 'Raider Scav 1', type: 'raider', kind: 'raider_scav', hp: 4, maxHp: 10, state: 'up', stunned: false, named: false, nemesis: false, vulture: false },
    { index: 1, name: 'Raider Scav 2', type: 'raider', kind: 'raider_scav', hp: 6, maxHp: 10, state: 'up', stunned: false, named: false, nemesis: false, vulture: false },
  ],
  crew: [
    member('a', [
      { move: 'attack', name: 'Shoot', detail: '', target: 'enemy', targets: [0, 1] },
      { move: 'called_shot', name: 'Called shot', detail: '', target: 'enemy', targets: [0, 1] },
      { move: 'cover', name: 'Take cover', detail: '', target: 'none', targets: [] },
      { move: 'patch', name: 'Patch up', detail: '', target: 'ally', targets: ['b'] },
    ]),
    member('b', [{ move: 'attack', name: 'Strike', detail: '', target: 'enemy', targets: [0, 1] }]),
  ],
  meds: 1,
  ammo: 12,
  lines: [],
  acts: [],
};

describe('tapping the stage', () => {
  test('an enemy: the open person attacks it, or their targeted move goes at it', () => {
    let o = tapOnStage(VIEW, { picks: {}, open: 'a' }, enemyKey(1));
    assert.deepEqual(o.picks, { a: { move: 'attack', target: 1 } });
    o = tapOnStage(VIEW, { picks: { a: { move: 'called_shot' } }, open: 'a' }, enemyKey(0));
    assert.deepEqual(o.picks.a, { move: 'called_shot', target: 0 });
    // A move with no target: a tap on an enemy means attack it instead.
    o = tapOnStage(VIEW, { picks: { a: { move: 'cover' } }, open: 'a' }, enemyKey(0));
    assert.deepEqual(o.picks.a, { move: 'attack', target: 0 });
    // Nobody's orders open: nothing.
    assert.deepEqual(tapOnStage(VIEW, { picks: {} }, enemyKey(0)), { picks: {} });
  });

  test('one of the crew: the target of a move that helps, or else their orders open', () => {
    let o = tapOnStage(VIEW, { picks: { a: { move: 'patch' } }, open: 'a' }, crewKey('b'));
    assert.deepEqual(o.picks.a, { move: 'patch', target: 'b' });
    o = tapOnStage(VIEW, { picks: {}, open: 'a' }, crewKey('b'));
    assert.equal(o.open, 'b');
    assert.deepEqual(o.picks, {});
  });

  test('the rings: what a tap can target now, and what was picked', () => {
    assert.deepEqual(stageTargets(VIEW, { picks: {}, open: 'a' }), { targets: ['e:0', 'e:1'] });
    assert.deepEqual(stageTargets(VIEW, { picks: { a: { move: 'patch' } }, open: 'a' }), { targets: ['c:b'] });
    assert.deepEqual(stageTargets(VIEW, { picks: { a: { move: 'attack', target: 1 } }, open: 'a' }), { targets: ['e:0', 'e:1'], picked: 'e:1' });
    assert.deepEqual(stageTargets(VIEW, { picks: { a: { move: 'cover' } }, open: 'a' }), { targets: [] });
    assert.deepEqual(stageTargets(VIEW, { picks: {} }), { targets: [] });
  });

  test('the line under the stage says what a tap does', () => {
    assert.equal(stageHint(VIEW, undefined), 'Tap one of the crew to give their orders.');
    assert.equal(stageHint(VIEW, 'a'), 'Tap an enemy for Mara to go after.');
    assert.equal(stageHint(VIEW, 'a', { a: { move: 'patch' } }), 'Tap who Mara should help.');
    assert.equal(stageHint(VIEW, 'a', { a: { move: 'cover' } }), 'Mara: take cover. Tap someone else to give their orders.');
  });

  test('short names: the faction word goes', () => {
    assert.equal(shortName('Raider Scav 2'), 'Scav 2');
    assert.equal(shortName('Vulture Shot'), 'Shot');
    assert.equal(shortName('Rad-hound'), 'Rad-hound');
    assert.equal(shortName('Old Notch'), 'Old Notch');
    assert.equal(shortName('Raider'), 'Raider');
  });
});

describe('a round on the stage', () => {
  test('the stage shows the crew in their own colors and gear, and the enemies as they stand', () => {
    const { state, run, view } = commanded('model');
    const m = stageModel(state, run, view, { picks: {}, open: view.crew[0]!.id });
    assert.equal(m.place, run.plan.locationId);
    assert.equal(m.crew.length, view.crew.length);
    assert.ok(m.crew.every((f) => f.look !== undefined));
    assert.equal(m.giving, crewKey(view.crew[0]!.id));
    assert.deepEqual(m.enemies.map((e) => e.kind), view.enemies.map((e) => e.kind));
    assert.ok(m.targets.length > 0);
  });

  test('played back act by act, it ends where the fight stands', () => {
    let checked = 0;
    for (let k = 0; k < 8; k++) {
      const { state, run, view } = commanded(`frames-${k}`);
      const next = commandRound(state, run.id, { moves: {} }, run.lead!.fights[0]!.at + 5000);
      if (!next) continue;
      const frames = roundFrames(view, next);
      assert.equal(frames.length, next.acts.length - view.acts.length);
      const last = frames.at(-1)!;
      for (const e of next.enemies) {
        assert.equal(last.hp[enemyKey(e.index)], e.hp, `${e.name} hp`);
        assert.equal(last.state[enemyKey(e.index)], e.state, `${e.name} state`);
      }
      for (const c of next.crew) assert.equal(last.state[crewKey(c.id)], c.state === 'dead' ? 'down' : c.state, `${c.name} state`);
      for (const f of frames) {
        assert.ok(f.effect.by.startsWith('c:') || f.effect.by.startsWith('e:'));
        assert.ok(f.line >= view.lines.length && f.line <= next.lines.length, 'its line is in this round');
      }
      const m = stageModel(state, run, next, { picks: {} }, frames[0]);
      assert.ok(m.effect && m.targets.length === 0, 'no rings while a round plays');
      checked++;
    }
    assert.ok(checked >= 5, `rounds checked: ${checked}`);
  });

  test('nothing to play when the fight hasn’t moved on', () => {
    assert.deepEqual(roundFrames(VIEW, VIEW), []);
  });
});
