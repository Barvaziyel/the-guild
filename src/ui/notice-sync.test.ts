import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LATE_MS, heldAt, staleNotice, syncNotices, type HeldNotice } from './notice-sync.ts';
import { noticeNumber, type PlannedNotice } from './runs-view.ts';

const NOW = Date.UTC(2026, 10, 25, 7, 13);
const H = 3_600_000;

function notice(id: string, at: number): PlannedNotice {
  return { id, at, title: id, body: '' };
}

/** As the system hands one back: its date as Java writes it, and our own copy of the time. */
function held(n: PlannedNotice, at = n.at, javaDate = 'Wed Nov 25 09:13:00 GMT+02:00 2026'): HeldNotice {
  return { id: noticeNumber(n.id), schedule: { at: javaDate }, extra: { runId: n.id, at } };
}

describe('keeping the phone’s notices in step', () => {
  test('what is wanted and still to come is scheduled; what is past is not', () => {
    const plan = syncNotices([], [notice('r1', NOW + H), notice('r2', NOW - H)], NOW);
    assert.deepEqual(plan.schedule.map((n) => n.id), ['r1']);
    assert.deepEqual(plan.cancel, []);
  });

  test('one held as it stands is left alone, fired or not', () => {
    const soon = notice('r1', NOW + H);
    const fired = notice('dilemma-due-12', NOW - H);
    const plan = syncNotices([held(soon), held(fired)], [soon, fired], NOW);
    assert.deepEqual(plan, { cancel: [], schedule: [] }, 'a fired one still wanted never fires again');
  });

  test('one no longer wanted is dropped, and one that moved is dropped and planned again', () => {
    const gone = notice('dilemma-due-12', NOW + H);
    const moved = notice('r1', NOW + H);
    const plan = syncNotices([held(gone), held(moved)], [{ ...moved, at: NOW + 2 * H }], NOW);
    assert.deepEqual(plan.cancel, [noticeNumber(gone.id), noticeNumber(moved.id)]);
    assert.deepEqual(plan.schedule.map((n) => [n.id, n.at]), [['r1', NOW + 2 * H]]);
  });

  test('our own copy of the time wins over the system’s date, which some phones write unreadably', () => {
    const moved = notice('r1', NOW + H);
    // "IST" means nothing to a browser: read as is, the move went unseen and the notice fired at the old time.
    const plan = syncNotices([held(moved, NOW + H, 'Wed Nov 25 10:13:00 IST 2026')], [{ ...moved, at: NOW + 2 * H }], NOW);
    assert.deepEqual(plan.cancel, [noticeNumber(moved.id)]);
    assert.equal(heldAt(held(moved, NOW + H, 'Wed Nov 25 10:13:00 IST 2026')), NOW + H);
  });

  test('one from before 3.7.4, without our copy, is read from the system’s date; unreadable, it is planned again', () => {
    const n = notice('r1', Date.UTC(2026, 10, 25, 8, 13));
    const old: HeldNotice = { id: noticeNumber(n.id), schedule: { at: 'Wed Nov 25 10:13:00 GMT+02:00 2026' }, extra: { runId: n.id } };
    assert.equal(heldAt(old), n.at);
    assert.deepEqual(syncNotices([old], [n], NOW), { cancel: [], schedule: [] });
    const unreadable: HeldNotice = { ...old, schedule: { at: 'Wed Nov 25 10:13:00 IST 2026' } };
    assert.equal(heldAt(unreadable), undefined);
    const plan = syncNotices([unreadable], [n], NOW);
    assert.deepEqual(plan.cancel, [noticeNumber(n.id)]);
    assert.deepEqual(plan.schedule.map((x) => x.id), ['r1']);
  });

  test('one Android held back past the end of what it was about is old news', () => {
    // The tester, back after a day: a fight, a decision and runs, all at once.
    const fight = { runId: 'fight-r9-0', at: NOW - 24 * H, until: NOW - 24 * H + 30 * 60_000 };
    assert.equal(staleNotice(fight, NOW), true);
    assert.equal(staleNotice(fight, fight.at + 60_000), false, 'on time');
    assert.equal(staleNotice(fight, fight.until - 1), false, 'late, but they still wait');
    const back = { runId: 'r9', at: NOW - 2 * H };
    assert.equal(staleNotice(back, NOW), true, 'no end of its own: old news after an hour');
    assert.equal(staleNotice(back, back.at + LATE_MS - 1), false);
    assert.equal(staleNotice({ runId: 'r9' }, NOW), false, 'scheduled before 3.7.4: kept');
    assert.equal(staleNotice(undefined, NOW), false);
  });
});
