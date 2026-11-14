import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, completeRun, letThemFight, startRun, takeCommand, type FightMemberView, type FightView, type GameState, type Run } from '../engine/index.ts';
import { T0, openGame, testPlan } from '../engine/test-utils.ts';
import {
  anyoneFighting,
  fightCard,
  fightCards,
  fightEnd,
  fightNoticeKey,
  fightNoticeRun,
  fightNotices,
  fightWakeTimes,
  hpShare,
  leadChoice,
  leadReportLine,
  livePicks,
  memberState,
  needsTarget,
  nerveLine,
  pickLabel,
  rankHelp,
  roundOrders,
  targetName,
  theirMoves,
  whatTheyAre,
  withRanks,
} from './fight-view.ts';
import { noticeRoute } from './radio-view.ts';

const PLACES = ['kessler_farm', 'old_metro', 'drowned_mall', 'st_judes'];

/** A guild with a Radio Tower and a led crew out that will stop at a fight. */
function fighting(seed: string): { state: GameState; run: Run } {
  for (let i = 0; i < 500; i++) {
    const state = openGame(`${seed}-${i % 5}`);
    state.buildings.radio_tower = 1;
    state.rng = new Rng(`${seed}-${i}`).getState();
    const run = startRun(state, { ...testPlan(state, PLACES[i % PLACES.length]!, { job: 'hunt', meds: 2 }), lead: true }, T0);
    if (run.lead!.fights.length > 0) return { state, run };
  }
  throw new Error('no led run came to a fight');
}

describe('the planner switch', () => {
  test('is there from the start, and says how long they wait', () => {
    const state = openGame('switch');
    state.buildings.radio_tower = 0;
    const on = leadChoice(state);
    assert.equal(on.can, true);
    assert.match(on.help, /up to 30 min for your orders/);
  });
});

describe('a crew at a fight', () => {
  test('a card while they wait, then while in command; gone once the fight is over', () => {
    const { state, run } = fighting('card');
    const f = run.lead!.fights[0]!;
    assert.equal(fightCard(state, run, f.at - 1), undefined, 'not before the fight');
    assert.equal(anyoneFighting(state, f.at - 1), false);
    const card = fightCard(state, run, f.at + 6 * 60_000)!;
    assert.equal(card.inCommand, false);
    assert.equal(card.caller?.id, f.by);
    assert.equal(card.against, f.against);
    assert.match(card.wait, /will hold 24 more minutes for your orders\. After that, (they fight on their own|\w+ fights on alone)\./);
    assert.equal(fightCards(state, f.at + 60_000).length, 1);
    assert.equal(anyoneFighting(state, f.at + 60_000), true);
    const view = takeCommand(state, run.id, f.at + 60_000);
    if (view) {
      const led = fightCard(state, state.runs.find((r) => r.id === run.id)!, f.at + 2 * 60_000)!;
      assert.equal(led.inCommand, true);
      assert.match(led.wait, /^You're in command\. 28 more minutes to finish it/);
    }
    assert.equal(fightCard(state, run, f.until), undefined, 'gone once the wait is over');
  });

  test('the app wakes when the fight starts and when the wait runs out; a notice opens the fight', () => {
    const { state, run } = fighting('wake');
    const f = run.lead!.fights[0]!;
    const times = fightWakeTimes(state, T0);
    assert.ok(times.includes(f.at) && times.includes(f.until));
    assert.ok(!fightWakeTimes(state, f.at + 1).includes(f.at));
    const notice = fightNotices(state)[0]!;
    assert.equal(notice.id, `fight-${run.id}-0`);
    assert.equal(notice.at, f.at);
    assert.match(notice.title, /^\w+ is in a fight$/);
    assert.match(notice.body, /wait 30 min for your orders\.$/);
    assert.equal(fightNoticeRun(notice.id), run.id);
    assert.equal(fightNoticeRun(`radio-${run.id}`), undefined);
    assert.deepEqual(noticeRoute(notice.id), { screen: 'fight', id: run.id });
  });

  test('letting them fight drops the notice and changes the key', () => {
    const { state, run } = fighting('let');
    const f = run.lead!.fights[0]!;
    const key = fightNoticeKey(state);
    letThemFight(state, run.id, f.at + 1000);
    assert.notEqual(fightNoticeKey(state), key);
    assert.ok(!fightNotices(state).some((n) => n.id === `fight-${run.id}-0`));
  });

  test("the report says whether you led the fights", () => {
    const { state, run } = fighting('report');
    const report = completeRun(state, run.id, run.returnAt);
    const line = leadReportLine(report)!;
    assert.match(line, /^Nobody took command of the/);
    assert.equal(leadReportLine({ ...report, lead: { fights: 1, commanded: 1 } }), 'You led the fight over the radio.');
    assert.equal(leadReportLine({ ...report, lead: { fights: 3, commanded: 3 } }), 'You led all 3 fights over the radio.');
    assert.equal(leadReportLine({ ...report, lead: { fights: 3, commanded: 2 } }), 'You led 2 of the 3 fights over the radio.');
    assert.equal(leadReportLine({ ...report, lead: { fights: 0, commanded: 0 } }), undefined);
    const { lead: _drop, ...plain } = report;
    assert.equal(leadReportLine(plain), undefined);
  });
});

describe('the fight screen', () => {
  const SHOOTER: FightMemberView['moves'] = [
    { move: 'attack', name: 'Shoot', detail: '', target: 'enemy', targets: [0] },
    { move: 'cover', name: 'Take cover', detail: '', target: 'none', targets: [] },
    { move: 'patch', name: 'Patch up', detail: '', target: 'ally', targets: ['b'] },
  ];
  const member = (id: string, extra: Partial<FightMemberView> = {}): FightMemberView => ({
    id,
    name: id === 'a' ? 'Mara' : 'Kai',
    hp: 10,
    maxHp: 20,
    state: 'up',
    aimed: false,
    moves: SHOOTER,
    rank: 'front',
    byRank: { front: SHOOTER, back: SHOOTER },
    ...extra,
  });
  const view: FightView = {
    round: 2,
    maxRounds: 8,
    place: 'Kessler Farm',
    enemies: [
      { index: 0, name: 'Raider Scav 1', type: 'raider', kind: 'raider_scav', hp: 4, maxHp: 10, state: 'up', stunned: false, named: false, nemesis: false, vulture: false, rank: 'front', damage: 3, armor: 0, rises: false, pack: false, heavy: false, leader: false, fearless: false },
      { index: 1, name: 'Raider Scav 2', type: 'raider', kind: 'raider_scav', hp: 0, maxHp: 10, state: 'dead', stunned: false, named: false, nemesis: false, vulture: false, rank: 'front', damage: 3, armor: 0, rises: false, pack: false, heavy: false, leader: false, fearless: false },
    ],
    crew: [member('a'), member('b', { state: 'down', hp: 0, moves: [] })],
    meds: 1,
    ammo: 12,
    lines: [],
    acts: [],
  };

  test('labels picks with their target, and "On their own" without one', () => {
    const a = view.crew[0]!;
    assert.equal(pickLabel(view, a, undefined), 'On their own');
    assert.equal(pickLabel(view, a, { move: 'attack', target: 0 }), 'Shoot Raider Scav 1');
    assert.equal(pickLabel(view, a, { move: 'patch', target: 'b' }), 'Patch up Kai');
    assert.equal(pickLabel(view, a, { move: 'cover' }), 'Take cover');
    assert.equal(targetName(view, 1), 'Raider Scav 2');
    assert.equal(targetName(view, 'nobody'), 'them');
    assert.equal(needsTarget(a, 'attack'), true);
    assert.equal(needsTarget(a, 'cover'), false);
  });

  test('drops picks that no longer fit: a dead target, a move they lost, someone who is down', () => {
    const picks = {
      a: { move: 'attack' as const, target: 1 },
      b: { move: 'cover' as const },
    };
    assert.deepEqual(livePicks(view, picks), {}, 'the target is not in the list any more, and Kai is down');
    const live = { a: { move: 'attack' as const, target: 0 } };
    assert.deepEqual(livePicks(view, live), live);
    assert.deepEqual(roundOrders(view, live, false), { moves: live });
    assert.deepEqual(roundOrders(view, {}, true), { moves: {}, pullOut: true });
  });

  test('the end of a fight: what came after the last round shown, or its last lines', () => {
    const lines = [1, 2, 3, 4, 5, 6].map((n) => ({ text: `line ${n}` }));
    assert.deepEqual(fightEnd(lines, 4).map((l) => l.text), ['line 5', 'line 6']);
    assert.deepEqual(fightEnd(lines, 0).map((l) => l.text), ['line 3', 'line 4', 'line 5', 'line 6']);
    assert.deepEqual(fightEnd(lines, 6).map((l) => l.text), ['line 3', 'line 4', 'line 5', 'line 6'], 'nothing new: the last lines');
  });

  test('bars and states in words', () => {
    assert.equal(hpShare(5, 20), 0.25);
    assert.equal(hpShare(-3, 20), 0);
    assert.equal(hpShare(30, 20), 1);
    assert.equal(hpShare(1, 0), 0);
    assert.equal(memberState(view.crew[0]!), '10 of 20 HP');
    assert.equal(memberState(view.crew[1]!), 'Down');
    assert.equal(memberState({ ...view.crew[0]!, state: 'fled' }), 'Ran');
    assert.equal(memberState({ ...view.crew[0]!, state: 'dead' }), 'Dead');
  });
});

describe('their moves, and where people stand (2.3.0)', () => {
  const STRIKE: FightMemberView['moves'] = [
    { move: 'attack', name: 'Strike', detail: '', target: 'enemy', targets: [0] },
    { move: 'cover', name: 'Take cover', detail: '', target: 'none', targets: [] },
  ];
  const BACK: FightMemberView['moves'] = [{ move: 'cover', name: 'Take cover', detail: '', target: 'none', targets: [] }];
  const enemy = (index: number, extra: Partial<FightView['enemies'][number]> = {}): FightView['enemies'][number] => ({
    index,
    name: `Raider Scav ${index + 1}`,
    type: 'raider',
    kind: 'raider_scav',
    hp: 7,
    maxHp: 7,
    state: 'up',
    stunned: false,
    named: false,
    nemesis: false,
    vulture: false,
    rank: 'front',
    damage: 3,
    armor: 0,
    rises: false,
    pack: false,
    heavy: false,
    leader: false,
    fearless: false,
    ...extra,
  });
  const view: FightView = {
    round: 1,
    maxRounds: 6,
    place: 'Maple Street',
    enemies: [
      enemy(0, { name: 'Raider Brute', kind: 'raider_brute', damage: 5, intent: { kind: 'heavy', at: 'a' } }),
      enemy(1, { intent: { kind: 'strike', at: 'b' } }),
      enemy(2, { name: 'Raider Gunner', rank: 'back', intent: { kind: 'strike', at: 'a' } }),
      enemy(3, { hp: 2, intent: { kind: 'run' } }),
      enemy(4, { stunned: true }),
      enemy(5, { state: 'dead', hp: 0 }),
    ],
    crew: [
      { id: 'a', name: 'Mara', hp: 9, maxHp: 18, state: 'up', aimed: false, moves: STRIKE, rank: 'front', byRank: { front: STRIKE, back: BACK } },
      { id: 'b', name: 'Kai', hp: 16, maxHp: 16, state: 'up', aimed: false, moves: STRIKE, rank: 'front', byRank: { front: STRIKE, back: BACK } },
    ],
    meds: 0,
    ammo: 0,
    lines: [],
    acts: [],
    nerve: 64,
  };

  test('what each of them means to do, in a line', () => {
    assert.deepEqual(theirMoves(view), [
      'Raider Brute: winding up a big hit at Mara (up to 10).',
      'Raider Scav 2: going for Kai.',
      'Raider Gunner: shooting at Mara.',
      'Raider Scav 4: looking for a way out: it runs at the end of the round.',
      'Raider Scav 5: stunned, and loses its turn.',
    ]);
    assert.match(nerveLine(view), /^Their nerve: 64 of 100, shaken\./);
    assert.match(nerveLine({ ...view, nerve: undefined }), /won’t break/);
  });

  test('a hollow on the ground, a pack, and what each kind of them is (2.4.0)', () => {
    const v: FightView = {
      ...view,
      enemies: [
        enemy(0, { name: 'Hollow 1', type: 'hollow', kind: 'hollow', state: 'down', hp: 0, rises: true }),
        enemy(1, { name: 'Rad-hound 1', type: 'feral', kind: 'rad_hound', pack: true, intent: { kind: 'strike', at: 'b' } }),
        enemy(2, { name: 'Rad-hound 2', type: 'feral', kind: 'rad_hound', pack: true, intent: { kind: 'strike', at: 'b' } }),
        enemy(3, { name: 'Raider Brute', kind: 'raider_brute', armor: 3, heavy: true, intent: { kind: 'strike', at: 'a' } }),
      ],
    };
    assert.deepEqual(theirMoves(v), [
      'Hollow 1: on the ground. It gets back up at the end of the round unless someone finishes it.',
      'Rad-hound 1: going for Kai with the pack (+1 to hit).',
      'Rad-hound 2: going for Kai with the pack (+1 to hit).',
      'Raider Brute: going for Mara.',
    ]);
    const kinds = whatTheyAre(v);
    assert.equal(kinds.length, 4);
    assert.match(kinds[0]!, /^Hollow: drops, then gets back up/);
    assert.match(kinds[1]!, /^Rad-hound: hunts as a pack/);
    assert.match(kinds[2]!, /^Raider Brute: armored, so 3 comes off every hit/);
    assert.match(kinds[3]!, /^Raider Brute: winds up big hits/);
  });

  test('moving someone to the back shows what they can do from there, and the orders say they moved', () => {
    const moved = withRanks(view, { a: 'back' });
    const mara = moved.crew.find((m) => m.id === 'a')!;
    assert.equal(mara.rank, 'back');
    assert.deepEqual(mara.moves, BACK, 'a blade reaches nothing from the back');
    assert.equal(withRanks(view, {}), view);
    const orders = roundOrders(moved, { a: { move: 'cover' }, b: { move: 'attack', target: 0 } }, false, { a: 'back', b: 'front' }, view);
    assert.deepEqual(orders.ranks, { a: 'back' }, 'only who moved');
    // A strike picked before the move no longer fits.
    assert.deepEqual(roundOrders(moved, { a: { move: 'attack', target: 0 } }, false, { a: 'back' }, view).moves, {});
    assert.match(rankHelp(mara, 'back'), /can’t reach anything to hit/);
    // The brute and the gunner had Mara in mind: the brute's blade can't reach her at the back now; the gunner's shot still can.
    const lines = theirMoves(moved);
    assert.equal(lines[0], 'Raider Brute: winding up a big hit for Mara, who is out of reach at the back now: it turns to someone in front.');
    assert.equal(lines[2], 'Raider Gunner: shooting at Mara.');
    assert.match(rankHelp(mara, 'front'), /in reach of every blow/);
  });
});
