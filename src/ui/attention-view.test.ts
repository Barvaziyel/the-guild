import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MAX_LOG, addChronicle, addGuildLog, createItem, ensureLocationState, equipFromStash, type GameState } from '../engine/index.ts';
import { T0, testGame } from '../engine/test-utils.ts';
import { baselineSeen, dots, latestNews, mapNews, missingGear, newChronicle, newlyBuilt, seeBuilt, seeChronicle, seeGear, seeMap, seeNews, seePlace, seeStash, seeStores, seenFor, sheetDots, storesNews, todayReasons, urgentItems } from './attention-view.ts';
import { slotViews } from './gear-view.ts';

function bare(state: GameState): void {
  for (const s of state.survivors) for (const slot of ['weapon', 'armor', 'tool', 'trinket'] as const) delete s.equipment[slot];
  state.stash = [];
}

describe('where to look (3.5.0)', () => {
  test('the first look counts everything there is as seen; a new guild starts over', () => {
    const state = testGame('seen');
    // A new guild's stash has gear nobody has on yet (the first week's first step): those people get a dot.
    const kitted = dots(state, T0, seenFor(state, undefined)).survivors;
    assert.ok(Object.keys(kitted).length > 0 && Object.keys(kitted).every((id) => missingGear(state, state.survivors.find((x) => x.id === id)!).length > 0));
    bare(state);
    const seen = seenFor(state, undefined);
    assert.deepEqual(seen, baselineSeen(state));
    const d = dots(state, T0, seen);
    assert.deepEqual(d.places, {}, 'no place is new to begin with');
    assert.deepEqual(d.survivors, {});
    assert.equal(d.depot.news, undefined);
    const other = testGame('another guild');
    assert.notEqual(seenFor(other, seen), seen, 'another guild is seen afresh');
  });

  test('news, Chronicle lines and places are new until looked at, and then not', () => {
    const state = testGame('new');
    bare(state);
    let seen = baselineSeen(state);
    state.log.push({ day: 2, text: 'A trader came by.' });
    assert.equal(dots(state, T0, seen).depot.news, true);
    assert.equal(dots(state, T0, seen).tabs.depot, true);
    seen = seeNews(state, seen);
    assert.equal(dots(state, T0, seen).depot.news, undefined);

    const a = state.survivors[0]!;
    addChronicle(a, 2, 'Stood her ground at the gate.');
    assert.ok(newChronicle(state, seen, a.id) > 0);
    assert.deepEqual(sheetDots(state, seen, a.id), { story: true });
    assert.equal(dots(state, T0, seen).survivors[a.id], true);
    assert.equal(dots(state, T0, seen).tabs.roster, true);
    seen = seeChronicle(state, seen, a.id);
    assert.equal(dots(state, T0, seen).tabs.roster, undefined);

    ensureLocationState(state, 'old_metro').discovered = true;
    assert.equal(dots(state, T0, seen).places.old_metro, true);
    assert.equal(dots(state, T0, seen).tabs.reach, true);
    seen = seePlace(seen, 'old_metro');
    assert.equal(dots(state, T0, seen).tabs.reach, undefined);
  });

  test('gear: an empty weapon or armor slot the stash could fill, and new gear in the stash', () => {
    const state = testGame('gear');
    bare(state);
    let seen = baselineSeen(state);
    const a = state.survivors[0]!;
    assert.deepEqual(missingGear(state, a), [], 'nothing in the stash, nothing to point at');
    state.stash.push(createItem(state, 'machete'));
    assert.deepEqual(missingGear(state, a), ['weapon']);
    assert.equal(dots(state, T0, seen).tabs.gear, true);
    assert.equal(sheetDots(state, seen, a.id).stats, true);
    const slots = slotViews(state, a);
    assert.deepEqual(slots.map((s) => [s.slot, s.wanting]), [['weapon', true], ['armor', false], ['tool', false], ['trinket', false]]);
    seen = seeStash(state, seen);
    equipFromStash(state, a, state.stash[0]!.uid);
    assert.equal(slotViews(state, a)[0]!.item?.defId, 'machete');
    assert.equal(dots(state, T0, seen).tabs.gear, undefined, 'everyone who could take one has one');
  });

  /** Everyone but the first armed, so a spare weapon in the stash isn't a dot for someone going without. */
  const armAll = (state: GameState): void => {
    for (const s of state.survivors.slice(1)) s.equipment.weapon = createItem(state, 'pipe');
  };

  test('a piece taken off someone for a new one is not new in the stash', () => {
    const state = testGame('swap');
    bare(state);
    armAll(state);
    const a = state.survivors[0]!;
    state.stash.push(createItem(state, 'machete'));
    equipFromStash(state, a, state.stash[0]!.uid);
    let seen = baselineSeen(state);
    // A new one comes in: a dot.
    state.stash.push(createItem(state, 'sledge'));
    assert.equal(dots(state, T0, seen).tabs.gear, true);
    seen = seeStash(state, seen);
    // Handed out, the machete comes off into the stash: still no dot (3.7.5: it had one).
    const old = a.equipment.weapon!.uid;
    equipFromStash(state, a, state.stash.find((i) => i.defId === 'sledge')!.uid);
    assert.ok(state.stash.some((i) => i.uid === old));
    assert.equal(dots(state, T0, seen).tabs.gear, undefined);
  });

  test('gear moved by hand is seen, even if it came in after the last look', () => {
    const state = testGame('by-hand');
    bare(state);
    armAll(state);
    const a = state.survivors[0]!;
    let seen = baselineSeen(state);
    state.stash.push(createItem(state, 'machete'));
    const uid = state.stash[0]!.uid;
    equipFromStash(state, a, uid);
    // Put on from a sheet, never shown on the Gear tab.
    seen = seeGear(seen, [uid, undefined]);
    const sledge = createItem(state, 'sledge');
    state.stash.push(sledge);
    equipFromStash(state, a, sledge.uid);
    seen = seeGear(seen, [sledge.uid, uid]);
    assert.equal(dots(state, T0, seen).tabs.gear, undefined, 'the machete came off into the stash');
    assert.equal(seeGear(seen, [uid]), seen, 'nothing to add');
  });

  test('the Today tab: what there is to deal with, and nothing when it is quiet', () => {
    const state = testGame('today');
    state.depot.recruits = [];
    state.depot.offers = [];
    state.resources.rations = 200;
    assert.deepEqual(todayReasons(state, T0), []);
    assert.equal(dots(state, T0, baselineSeen(state)).depot.today, undefined);
    state.depot.offers.push({ id: 'o1', give: { scrap: 5 }, get: { rations: 10 }, expiresDay: 9 });
    assert.deepEqual(todayReasons(state, T0), ['trader']);
    assert.equal(dots(state, T0, baselineSeen(state)).tabs.depot, true);
  });

  test('unread reports put a dot on Runs; nothing urgent, no strip', () => {
    const state = testGame('runs');
    assert.deepEqual(urgentItems(state, T0), []);
    assert.equal(dots(state, T0, baselineSeen(state)).tabs.runs, undefined);
  });
});

describe('the News dot (3.7.1)', () => {
  test('a crew coming home doesn’t light it: the Runs tab has that', () => {
    const state = testGame('news-runs');
    let seen = baselineSeen(state);
    state.log.push({ day: 3, text: 'The crew returned from the Rail Yard.', tags: ['run'] });
    assert.equal(dots(state, T0, seen).depot.news, undefined);
    state.log.push({ day: 3, text: 'A stray dog nosed around.', tags: ['animal'] });
    assert.equal(dots(state, T0, seen).depot.news, true);
    seen = seeNews(state, seen);
    state.log.push({ day: 4, text: 'The crew returned from Maple Street.', tags: ['run'] });
    assert.equal(dots(state, T0, seen).depot.news, undefined);
  });

  test('with the log full, a new line still lights it', () => {
    const state = testGame('news-full');
    for (let i = 0; i < MAX_LOG; i++) addGuildLog(state, 1, `Line ${i}.`);
    let seen = seeNews(state, baselineSeen(state));
    assert.equal(state.log.length, MAX_LOG);
    addGuildLog(state, 2, 'A trader came by.');
    assert.equal(state.log.length, MAX_LOG, 'still full');
    assert.equal(dots(state, T0, seen).depot.news, true);
    seen = seeNews(state, seen);
    assert.equal(dots(state, T0, seen).depot.news, undefined);
  });

  test('marks from before 3.7.1 count the news as read up to now', () => {
    const state = testGame('news-old');
    const { newsKey: _gone, ...old } = baselineSeen(state);
    state.log.push({ day: 2, text: 'A trader came by.' });
    const seen = seenFor(state, old);
    assert.equal(seen.newsKey, latestNews(state));
    assert.equal(dots(state, T0, seen).depot.news, undefined);
    assert.equal(seenFor(state, seen), seen, 'once filled in, the same marks');
  });
});

describe('what moved since the last look (3.7.0)', () => {
  test('the map: a place first drawn now, and rings explored further', () => {
    const state = testGame('map-news');
    let seen = baselineSeen(state);
    assert.deepEqual(mapNews(state, seen), { fresh: [], from: {} }, 'nothing at first');
    const known = Object.keys(seen.mapped!)[0]!;
    const was = state.locations[known]!.explored;
    state.locations[known]!.explored = Math.min(100, was + 20);
    ensureLocationState(state, 'old_metro').discovered = true;
    const news = mapNews(state, seen);
    assert.deepEqual(news.fresh, ['old_metro']);
    assert.deepEqual(news.from, { [known]: was });
    seen = seeMap(state, seen);
    assert.deepEqual(mapNews(state, seen), { fresh: [], from: {} });
    assert.equal(seeMap(state, seen), seen, 'the same marks when nothing changed');
    const { mapped: _old, ...before } = seen;
    assert.deepEqual(mapNews(state, before), { fresh: [], from: {} }, 'marks from before 3.7.0: nothing moves');
  });

  test('the yard: buildings put up or improved since; the header: supplies that changed', () => {
    const state = testGame('yard-news');
    let seen = baselineSeen(state);
    assert.deepEqual(newlyBuilt(state, seen), []);
    state.buildings.watchtower = 1;
    state.buildings.garden = (state.buildings.garden ?? 0) + 1;
    assert.deepEqual(newlyBuilt(state, seen).sort(), ['garden', 'watchtower']);
    seen = seeBuilt(state, seen);
    assert.deepEqual(newlyBuilt(state, seen), []);

    const before = state.resources.scrap;
    state.resources.scrap += 12;
    assert.deepEqual(storesNews(state, seen), { scrap: before });
    seen = seeStores(state, seen);
    assert.deepEqual(storesNews(state, seen), {});
    assert.equal(seeStores(state, seen), seen);
  });
});
