import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addChronicle, createItem, ensureLocationState, equipFromStash, type GameState } from '../engine/index.ts';
import { T0, testGame } from '../engine/test-utils.ts';
import { baselineSeen, dots, mapNews, missingGear, newChronicle, newlyBuilt, seeBuilt, seeChronicle, seeMap, seeNews, seePlace, seeStash, seeStores, seenFor, sheetDots, storesNews, todayReasons, urgentItems } from './attention-view.ts';
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
