import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, completeRun, letThemFight, startRun, takeCommand, type FightMemberView, type FightView, type GameState, type Run } from '../engine/index.ts';
import { T0, openGame, testPlan } from '../engine/test-utils.ts';
import {
  anyoneFighting,
  crewChips,
  fightStatus,
  orderHint,
  targetPrompt,
  tickerLines,
  fightCard,
  fightCards,
  endFrom,
  endLines,
  fightEnd,
  fightNoticeKey,
  fightNoticeRun,
  fightNotices,
  fightWakeTimes,
  hpShare,
  incoming,
  jobPanel,
  cleanChips,
  leadChoices,
  leadMode,
  withLead,
  leadReportLine,
  jobTakenBy,
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
import { clockTime } from './time.ts';
import { noticeRoute } from './radio-view.ts';
import { STAKE_LINES } from './call-lines.ts';

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

describe('the planner’s choice (3.10.0)', () => {
  test('when it matters, every fight or never, and says how long they wait', () => {
    const choices = leadChoices();
    assert.deepEqual(
      choices.map((c) => c.id),
      ['matters', 'every', 'never'],
    );
    assert.match(choices[0]!.description, /up to 30 min for your orders/);
    const plan = testPlan(openGame('switch'), 'old_metro');
    assert.equal(leadMode(plan), 'never');
    assert.equal(withLead(plan, 'matters').lead, 'matters');
    assert.equal(withLead(plan, 'every').lead, true);
    assert.equal('lead' in withLead({ ...plan, lead: true }, 'never'), false);
    assert.equal(leadMode({ ...plan, lead: true }), 'every');
  });

  test('a crew that calls when it matters says it’s in trouble; when someone would die, it says that', () => {
    let seen = 0;
    for (let i = 0; i < 400 && seen < 2; i++) {
      const state = openGame(`trouble-${i % 5}`);
      state.rng = new Rng(`trouble-${i}`).getState();
      const run = startRun(state, { ...testPlan(state, i % 2 ? 'the_glow' : 'checkpoint_bravo', { meds: 0 }), lead: 'matters' }, T0);
      const f = run.lead!.fights[0];
      if (!f) continue;
      const card = fightCard(state, run, f.at + 60_000)!;
      const notice = fightNotices(state).find((n) => n.id.startsWith(`fight-${run.id}`))!;
      if (f.grave) {
        assert.ok([...STAKE_LINES.grave.crew, ...STAKE_LINES.grave.solo].some((l) => card.line.includes(l)), card.line);
        assert.equal(card.chips[0]!.glyph, 'skull');
        assert.match(notice.title, /needs you now/);
      } else {
        assert.ok([...STAKE_LINES.trouble.crew, ...STAKE_LINES.trouble.solo].some((l) => card.line.includes(l)), card.line);
        assert.equal(card.chips[0]!.glyph, 'down');
        assert.match(notice.title, /in trouble/);
      }
      seen++;
    }
    assert.equal(seen, 2);
  });

  test('a clean fight shows what it brought', () => {
    assert.deepEqual(cleanChips(undefined), []);
    assert.equal(cleanChips({ clean: true } as FightView).length, 2);
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
    assert.equal(notice.until, f.until, 'old news once they stop waiting');
    assert.match(notice.title, /^\w+ is in a fight$/);
    assert.ok(notice.body.endsWith(`wait for your orders until ${clockTime(f.until)}.`), 'a time, so a late notice is still right');
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

  test('the end plays from the round the player last saw, if it was the same fight', () => {
    const lines = [1, 2, 3, 4, 5, 6].map((n) => ({ text: `line ${n}` }));
    const seen = { ...view, lines: lines.slice(0, 4), acts: [] };
    const end = { ...view, lines, acts: [{ round: 2, line: 4, by: 'a', at: 0, kind: 'hit' as const, amount: 4 }] };
    assert.equal(endFrom(seen, end), seen);
    assert.equal(endFrom(undefined, end), undefined, 'nothing seen: the stage just shows the end');
    assert.equal(endFrom({ ...seen, enemies: [] }, end), undefined, 'another fight (the other band)');
    assert.equal(endFrom(end, seen), undefined, 'the end can’t come before what was seen');
    assert.deepEqual(endLines(lines, seen, undefined).map((l) => l.text), ['line 5', 'line 6'], 'the last round, once played');
    assert.deepEqual(endLines(lines, seen, 5).map((l) => l.text), ['line 5'], 'in step with the stage');
    assert.deepEqual(endLines(lines, undefined, undefined).map((l) => l.text), ['line 3', 'line 4', 'line 5', 'line 6']);
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

  test('one that strikes twice (the Shepherd, §9.12): both blows in its line, and what it is', () => {
    const shepherd = enemy(0, { name: 'The Shepherd', kind: 'the_shepherd', type: 'hollow', damage: 6, armor: 2, twice: true, heavy: true, named: true, intent: { kind: 'heavy', at: 'a', also: 'b' } });
    const v: FightView = { ...view, enemies: [shepherd] };
    assert.deepEqual(theirMoves(v), ['The Shepherd: winding up a big hit at Mara (up to 12), and a second blow at Kai.']);
    assert.deepEqual(theirMoves({ ...v, enemies: [{ ...shepherd, intent: { kind: 'strike', at: 'a', also: 'a' } }] }), ['The Shepherd: going for Mara, twice.']);
    assert.ok(whatTheyAre(v).includes('The Shepherd: strikes twice a round, the second blow at someone else when it can reach two of you.'));
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

describe('the job a fight came with (2.5.0)', () => {
  const member = (id: string, name: string): FightMemberView => {
    const moves: FightMemberView['moves'] = [
      { move: 'attack', name: 'Strike', detail: '', target: 'enemy', targets: [0] },
      { move: 'job', name: 'Haul the crate', detail: 'No attack.', target: 'none', targets: [] },
    ];
    return { id, name, hp: 10, maxHp: 20, state: 'up', aimed: false, moves, rank: 'front', byRank: { front: moves, back: moves } };
  };
  const scav = { index: 0, name: 'Raider Scav 1', type: 'raider', kind: 'raider_scav', hp: 4, maxHp: 10, state: 'up' as const, stunned: false, named: false, nemesis: false, vulture: false, rank: 'front' as const, damage: 3, armor: 0, rises: false, pack: false, heavy: false, leader: false, fearless: false };
  const goal: NonNullable<FightView['goal']> = { id: 'grab_and_go', title: 'Grab their stash', move: 'Haul the crate', intro: 'Their stash is right there, and they mean to get it away.', detail: '', progress: 1, needed: 2, deadline: 3, state: 'open', doneLine: 'The crate is clear, and it’s ours.', lostLine: 'They get their stash away.' };
  const view: FightView = { round: 2, maxRounds: 6, place: 'Kessler Farm', enemies: [scav], crew: [member('a', 'Mara'), member('b', 'Kai')], meds: 0, ammo: 0, lines: [], acts: [], goal };

  test('none without one', () => {
    assert.equal(jobPanel({ ...view, goal: undefined } as FightView), undefined);
  });

  test('what it is, how long is left, and who is on it', () => {
    const open = jobPanel(view)!;
    assert.equal(open.title, 'Grab their stash');
    assert.deepEqual([open.progress, open.needed, open.state], [1, 2, 'open']);
    assert.deepEqual(open.lines, [goal.intro, 'It has to be done by the end of round 3: this round and the next.', 'Give someone Haul the crate, or one of those left to fight on their own may take it.']);
    assert.equal(jobPanel({ ...view, round: 3 })!.lines[1], 'It has to be done this round, or it’s lost.');
    assert.equal(jobPanel(view, { a: { move: 'job' } })!.lines.at(-1), 'Mara is on it this round.');
    assert.equal(jobPanel(view, { a: { move: 'job' }, b: { move: 'job' } })!.lines.at(-1), 'Mara is on it this round.', 'one at a time');
  });

  test('one on the job a round (Aviel, 2026-11-18): it’s greyed out for the rest, and a second pick is dropped', () => {
    assert.equal(jobTakenBy(view, {}, 'b'), undefined);
    assert.equal(jobTakenBy(view, { a: { move: 'job' } }, 'b'), 'Mara');
    assert.equal(jobTakenBy(view, { a: { move: 'job' } }, 'a'), undefined, 'still hers to keep or drop');
    assert.equal(jobTakenBy(view, { a: { move: 'attack', target: 0 } }, 'b'), undefined);
    assert.deepEqual(livePicks(view, { a: { move: 'job' }, b: { move: 'job' } }), { a: { move: 'job' } });
  });

  test('a door says how many are still behind it', () => {
    const door: FightView = { ...view, enemies: [scav, { ...scav, index: 1, state: 'waiting' }, { ...scav, index: 2, state: 'waiting' }], goal: { ...goal, id: 'hold_door', title: 'Hold the door', move: 'Hold the door', deadline: undefined } as NonNullable<FightView['goal']> };
    delete door.goal!.deadline;
    assert.equal(jobPanel(door)!.lines[1], 'Two more behind the door. Each round nobody holds it, one comes through.');
    assert.deepEqual(whatTheyAre(door), whatTheyAre({ ...door, enemies: [scav] }), 'one behind the door adds nothing');
  });

  test('done or lost, it says so', () => {
    assert.deepEqual(jobPanel({ ...view, goal: { ...goal, progress: 2, state: 'done' } })!.lines, [goal.doneLine]);
    assert.deepEqual(jobPanel({ ...view, goal: { ...goal, state: 'lost' } })!.lines, [goal.lostLine]);
  });
});

describe('the fight on one screen (2.6.0)', () => {
  // Aviel: scrolling up and down, with things opening and closing, was clunky.
  const moves = (target: number[] = [0, 1]): FightMemberView['moves'] => [
    { move: 'attack', name: 'Shoot', detail: 'Go for one of them.', target: 'enemy', targets: target },
    { move: 'cover', name: 'Take cover', detail: 'No attack: harder to hit this round.', target: 'none', targets: [] },
  ];
  const member = (id: string, name: string, extra: Partial<FightMemberView> = {}): FightMemberView => {
    const m = moves();
    return { id, name, hp: 10, maxHp: 20, state: 'up', aimed: false, moves: m, rank: 'front', byRank: { front: m, back: m }, ...extra };
  };
  const foe = (index: number, name: string) => ({ index, name, type: 'raider', kind: 'raider_scav', hp: 4, maxHp: 10, state: 'up' as const, stunned: false, named: false, nemesis: false, vulture: false, rank: 'front' as const, damage: 3, armor: 0, rises: false, pack: false, heavy: false, leader: false, fearless: false });
  const view: FightView = {
    round: 2,
    maxRounds: 6,
    place: 'Kessler Farm',
    enemies: [foe(0, 'Raider Scav 1'), foe(1, 'Raider Scav 2')],
    crew: [member('a', 'Mara'), member('b', 'Kai'), member('c', 'Rhea', { state: 'down', hp: 0, moves: [] })],
    meds: 1,
    ammo: 12,
    lines: [{ text: 'One.' }, { text: 'Two.' }, { text: 'Three.', tone: 'bad' }],
    acts: [],
  };

  test('one line over the stage: the round, the time left, what they carry', () => {
    assert.equal(fightStatus(view, T0 + 27 * 60_000, T0, 'in the packs'), 'Round 2 of 6 · 27 min left · 1 med, 12 ammo in the packs');
    assert.match(fightStatus({ ...view, meds: 3 }, T0, T0, 'in the stores'), / · 1 min left · 3 meds, 12 ammo in the stores$/, 'never less than a minute');
  });

  test('the crew strip: each one’s orders, a move still waiting for its target, and who can’t act', () => {
    const chips = crewChips(view, { a: { move: 'attack', target: 1 }, b: { move: 'attack' } });
    assert.deepEqual(
      chips.map((c) => [c.name, c.label, c.canAct, c.own, c.pending]),
      [
        ['Mara', 'Shoot Raider Scav 2', true, false, false],
        ['Kai', 'Shoot: who?', true, false, true],
        ['Rhea', 'Down', false, false, false],
      ],
    );
    assert.deepEqual(crewChips(view, {}).map((c) => c.label), ['On their own', 'On their own', 'Down']);
  });

  test('the lines under the stage: the end of the last round, else the fight so far, a job first in round 1, or what to do', () => {
    assert.deepEqual(tickerLines(view, [{ text: 'A.' }, { text: 'B.' }, { text: 'C.' }]).map((l) => l.text), ['B.', 'C.']);
    assert.deepEqual(tickerLines(view, []).map((l) => l.text), ['Two.', 'Three.']);
    const goal = { id: 'hold_door', title: 'Hold the door', move: 'Hold the door', intro: 'More of them are coming through a side door.', detail: '', progress: 0, needed: 3, state: 'open' as const, doneLine: '', lostLine: '' };
    assert.deepEqual(tickerLines({ ...view, round: 1, goal }, []).map((l) => l.text), [goal.intro, 'Three.']);
    assert.deepEqual(tickerLines({ ...view, round: 2, goal }, []).map((l) => l.text), ['Two.', 'Three.'], 'only in the first round');
    assert.deepEqual(tickerLines({ ...view, round: 1, lines: [] }, []).map((l) => l.text), ['Round 1: give each of them a move, or leave them to it.']);
  });

  test('the hint under the moves: whom to tap, what the move does, where they stand, or that nothing is in reach', () => {
    const mara = view.crew[0]!;
    assert.equal(orderHint(view, mara, {}, false), 'Tap an enemy for Mara to go after, or pick a move.');
    // What the move does, before it has a target (3.7.1); the targets come in under it.
    const shoot = mara.moves.find((c) => c.move === 'attack')!;
    assert.equal(orderHint(view, mara, { a: { move: 'attack' } }, false), shoot.detail);
    assert.equal(targetPrompt(shoot), 'At whom? Here or on the stage.');
    assert.equal(targetPrompt({ target: 'ally' }), 'Which of the crew? Here or on the stage.');
    assert.equal(orderHint(view, mara, { a: { move: 'attack', target: 0 } }, false), 'Go for one of them.');
    assert.equal(orderHint(view, mara, { a: { move: 'cover' } }, false), 'No attack: harder to hit this round.');
    assert.match(orderHint(view, { ...mara, rank: 'back' }, {}, true), /^At the back:/);
    const blade = member('d', 'Dov', { rank: 'back', moves: moves([]) });
    assert.equal(orderHint(view, blade, {}, false), 'Dov can’t reach any of them from the back. Pick a move, or move them.');
  });
});

describe('their moves, 3.8.0', () => {
  const base = { index: 0, name: 'Raider Gunner', type: 'raider', kind: 'raider_gunner', hp: 8, maxHp: 8, state: 'up' as const, stunned: false, named: false, nemesis: false, vulture: false, rank: 'back' as const, damage: 4, armor: 1, rises: false, pack: false, heavy: false, leader: false, fearless: false };
  const crew = (id: string, name: string, extra: Partial<FightMemberView> = {}): FightMemberView => ({ id, name, hp: 10, maxHp: 12, state: 'up', aimed: false, moves: [], rank: 'front', byRank: { front: [], back: [] }, ...extra });
  const view = (enemies: FightView['enemies'], members = [crew('a', 'Mara'), crew('b', 'Kai')]): FightView => ({ round: 1, maxRounds: 6, place: 'Kessler Farm', enemies, crew: members, meds: 0, ammo: 0, lines: [], acts: [] });

  test('what each means to do, with what it would cost', () => {
    const v = view([
      { ...base, aims: true, intent: { kind: 'aim', at: 'a' } },
      { ...base, index: 1, name: 'Raider Gunner 2', aims: true, intent: { kind: 'shot', at: 'b' } },
      { ...base, index: 2, name: 'Raider Patcher', mends: 6, intent: { kind: 'mend', ally: 0 } },
      { ...base, index: 3, name: 'Raider Firebug', burn: 4, intent: { kind: 'throw', at: 'a', rank: 'front' } },
      { ...base, index: 4, name: 'Hollow', rank: 'front', damage: 3, intent: { kind: 'hold', at: 'b' } },
    ]);
    assert.deepEqual(theirMoves(v), [
      'Raider Gunner: lining up a shot at Mara for next round (up to 8).',
      'Raider Gunner 2: taking the shot it lined up at Kai (up to 8).',
      'Raider Patcher: patching up Raider Gunner (+6).',
      'Raider Firebug: throwing a firebomb at the front (4 each, half in cover).',
      'Hollow: has Kai in its grip (3 a round, no miss).',
    ]);
    assert.ok(whatTheyAre(v).some((l) => l.startsWith('Raider Gunner: lines up a shot a round ahead')));
  });

  test('what is coming at each: the shot, the firebomb on their rank, the bite; next round’s shot apart', () => {
    const v = view([
      { ...base, aims: true, intent: { kind: 'aim', at: 'a' } },
      { ...base, index: 1, intent: { kind: 'shot', at: 'b' } },
      { ...base, index: 2, burn: 4, intent: { kind: 'throw', at: 'a', rank: 'front' } },
    ]);
    assert.deepEqual(incoming(v, 'a'), { amount: 4, drop: false, fire: true, next: true });
    assert.deepEqual(incoming(v, 'b'), { amount: 12, drop: true, fire: true, next: false });
  });

  test('someone in a grip: their chip says who holds them, until they’re told to break free', () => {
    const held = crew('a', 'Mara', { heldBy: 0, moves: [{ move: 'break_free', name: 'Break free', detail: '', target: 'none', targets: [] }] });
    const v = view([{ ...base, name: 'Hollow 1', rank: 'front', intent: { kind: 'hold', at: 'a' }, holding: 'a' }], [held]);
    assert.equal(crewChips(v, {})[0]!.label, 'Held by Hollow 1');
    assert.equal(crewChips(v, { a: { move: 'break_free' } })[0]!.label, 'Break free');
  });
});

test('someone in a grip: the hint says how to get them out', () => {
  const held: FightMemberView = { id: 'a', name: 'Mara', hp: 10, maxHp: 12, state: 'up', aimed: false, heldBy: 0, moves: [{ move: 'break_free', name: 'Break free', detail: 'Wrench out of its grip.', target: 'none', targets: [] }], rank: 'front', byRank: { front: [], back: [] } };
  const v: FightView = { round: 1, maxRounds: 6, place: 'The Old Metro', enemies: [{ index: 0, name: 'Hollow 2', type: 'hollow', kind: 'hollow', hp: 8, maxHp: 8, state: 'up', stunned: false, named: false, nemesis: false, vulture: false, rank: 'front', damage: 3, armor: 0, rises: true, pack: false, heavy: false, leader: false, fearless: true, holding: 'a', intent: { kind: 'hold', at: 'a' } }], crew: [held], meds: 0, ammo: 0, lines: [], acts: [] };
  assert.equal(orderHint(v, held, {}, false), "In Hollow 2's grip. Break free, or have someone shove it off.");
});

describe('the first trip’s fight (3.14.0)', () => {
  test('a new guild’s first fight calls home as a fight to lead, not as trouble', async () => {
    const { newGame } = await import('../engine/index.ts');
    const state = newGame({ seed: 'first-call', now: T0, guided: true });
    const run = startRun(state, testPlan(state, 'rail_yard', {}, 3), T0);
    assert.equal(run.plan.first, true);
    const card = fightCards(state, run.lead!.fights[0]!.at + 1000)[0]!;
    assert.equal(card.urgency, undefined);
    assert.ok(!card.chips.some((c) => c.text === 'if alone'));
    assert.doesNotMatch(card.line, /trouble/);
  });
});
