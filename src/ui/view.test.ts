import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { STAT_MAX, STRESS_HIGH, practiceNeeded } from '../engine/index.ts';
import { testGame, testSurvivor } from '../engine/test-utils.ts';
import {
  chronicleByDay,
  daysSurvived,
  flagText,
  headlineTraits,
  hiddenTraitCount,
  itemStats,
  lifeSummary,
  rosterOrder,
  statRows,
  survivorStatus,
  traitGroups,
  traitView,
} from './view.ts';

describe('survivor status', () => {
  test('says why someone can or cannot go out', () => {
    assert.deepEqual(survivorStatus(testSurvivor()), { label: 'Ready', tone: 'ready' });
    assert.equal(survivorStatus(testSurvivor('x', { status: 'away' })).tone, 'away');
    assert.deepEqual(survivorStatus(testSurvivor('x', { traits: [{ id: 'badly_wounded', gainedDay: 3, expiresDay: 9 }] })), {
      label: 'Badly wounded, heals on day 9',
      tone: 'hurt',
    });
    const wounded = testSurvivor('x', { traits: [{ id: 'wounded', gainedDay: 3, expiresDay: 9 }] });
    assert.equal(survivorStatus(wounded, 8).label, 'Wounded, heals on day 9');
    assert.equal(survivorStatus(wounded, 9).label, 'Wounded', 'no date in the past');
    assert.equal(survivorStatus(testSurvivor('x', { stress: STRESS_HIGH })).label, 'Close to breaking');
    assert.equal(survivorStatus(testSurvivor('x', { status: 'dead', diedDay: 14 })).label, 'Died on day 14');
  });
});

describe('traits', () => {
  test('hidden traits never show, but are counted', () => {
    const s = testSurvivor('x', {
      traits: [
        { id: 'brave', gainedDay: 1 },
        { id: 'unlucky', gainedDay: 1, hidden: true },
        { id: 'veteran', gainedDay: 20, source: 'ten runs and still breathing' },
        { id: 'grieving', gainedDay: 21, expiresDay: 25 },
      ],
    });
    const groups = traitGroups(s);
    assert.deepEqual(
      groups.map((g) => [g.kind, g.traits.map((t) => t.id)]),
      [
        ['condition', ['grieving']],
        ['personality', ['brave']],
        ['earned', ['veteran']],
      ],
    );
    assert.equal(hiddenTraitCount(s), 1);
    assert.deepEqual(headlineTraits(s), ['Veteran', 'Brave']);
  });

  test('explain when and why a trait was gained', () => {
    const view = traitView({ id: 'veteran', gainedDay: 20, source: 'ten runs and still breathing' });
    assert.equal(view.gained, 'Day 20: Ten runs and still breathing.');
    assert.equal(traitView({ id: 'grieving', gainedDay: 21, expiresDay: 25 }).expires, 'Wears off on day 25.');
    assert.equal(traitView({ id: 'vengeful', gainedDay: 5, target: 'raider' }).name, 'Vengeful (Raiders)');
  });
});

describe('stats', () => {
  test('show the effective value, the base and progress to the next point', () => {
    const s = testSurvivor('x', { practice: { grit: 7, brawn: 0, aim: 0, wits: 0, nerve: 0 } });
    s.stats.wits = STAT_MAX;
    s.equipment.trinket = { uid: 'i1', defId: 'dog_tags', quality: 'common' };
    const rows = statRows(s);
    const grit = rows.find((r) => r.id === 'grit')!;
    assert.deepEqual([grit.value, grit.base, grit.practice, grit.needed], [5, 5, 7, practiceNeeded(5)]);
    const nerve = rows.find((r) => r.id === 'nerve')!;
    assert.deepEqual([nerve.value, nerve.base, nerve.mod], [6, 5, 1]);
    assert.equal(rows.find((r) => r.id === 'wits')!.maxed, true);
  });
});

describe('bonds', () => {
  test('describe special ties from each side', () => {
    const mara = testSurvivor('a', { firstName: 'Mara', pronouns: 'she' });
    const dex = testSurvivor('b', { firstName: 'Dex', pronouns: 'he' });
    const flag = { kind: 'owesLife', debtor: 'a' } as const;
    assert.equal(flagText(flag, mara, dex), 'Owes Dex a life.');
    assert.equal(flagText(flag, dex, mara), 'Mara owes him a life.');
    assert.equal(flagText({ kind: 'mentor', mentor: 'b' }, dex, mara), 'Mentor to Mara.');
    assert.equal(flagText({ kind: 'mentor', mentor: 'b' }, mara, dex), 'Learning from Dex.');
  });
});

describe('chronicle and memorial', () => {
  test('groups a life by day, oldest first', () => {
    const s = testSurvivor('x', {
      chronicle: [
        { day: 1, text: 'Joined the guild.' },
        { day: 4, text: 'First run.' },
        { day: 4, text: 'Wits rose to 6.' },
      ],
    });
    assert.deepEqual(chronicleByDay(s), [
      { day: 1, entries: ['Joined the guild.'] },
      { day: 4, entries: ['First run.', 'Wits rose to 6.'] },
    ]);
    const veteran = testSurvivor('x');
    Object.assign(veteran.counters, { runs: 12, kills: 1, timesDowned: 2, alliesSaved: 1 });
    assert.deepEqual(lifeSummary(veteran), ['12 runs', '1 kill', 'downed twice', '1 ally saved']);
    assert.deepEqual(lifeSummary(testSurvivor('y')), ['0 runs']);
    assert.equal(daysSurvived(testSurvivor('x', { joinedDay: 3, diedDay: 12 }), 40), 10);
    assert.equal(daysSurvived(testSurvivor('x', { joinedDay: 3 }), 5), 3);
  });
});

describe('gear', () => {
  test('sums up an item in a few words', () => {
    assert.equal(itemStats({ uid: 'i', defId: 'hunting_rifle', quality: 'solid' }), '6 damage, ranged, +1 to hit, uses ammo');
    assert.equal(itemStats({ uid: 'i', defId: 'scrap_vest', quality: 'rusty' }), 'armor 1');
    assert.equal(itemStats({ uid: 'i', defId: 'crowbar', quality: 'common' }), '');
  });
});

describe('roster', () => {
  test('lists people who can go out first', () => {
    const state = testGame();
    state.survivors[0]!.status = 'away';
    const order = rosterOrder(state);
    assert.equal(order[order.length - 1]!.id, state.survivors[0]!.id);
  });
});
