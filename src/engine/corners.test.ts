import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ANIMAL_KINDS } from './types.ts';
import { CORNERS, GEAR, getCorner } from './content/index.ts';
import { cornerStatus, finishSearch, searchDue, searchProblem, searchReason, searchers, startSearch } from './corners.ts';
import { advanceTime } from './depot/time.ts';
import { validatePlan } from './expedition/plan.ts';
import { station } from './outposts.ts';
import { Rng } from './rng.ts';
import { deserialize, serialize } from './save.ts';
import { T0, testGame, testPlan } from './test-utils.ts';
import { fillRoles } from './text.ts';
import type { GameState, Survivor } from './types.ts';

const MIN = 60_000;

/** Search a corner from start to end with `who`, `seed` setting the dice. */
function search(state: GameState, cornerId: string, who: Survivor, seed: string, at = T0 + 1000) {
  state.rng = new Rng(seed).getState();
  startSearch(state, cornerId, who.id, at);
  return finishSearch(state, at + getCorner(cornerId).minutes * MIN);
}

describe('the Depot’s corners (2.7.0)', () => {
  test('every corner is written out: outcomes that end with one that always fits, real gear and animals, keys that exist', () => {
    const ids = new Set(CORNERS.map((c) => c.id));
    assert.equal(ids.size, CORNERS.length);
    for (const c of CORNERS) {
      assert.ok(c.name && c.intro && c.minutes > 0 && c.minutes <= 30, c.id);
      assert.ok(c.outcomes.length >= 2 && c.outcomes.at(-1)!.test === undefined, `${c.id}: the last outcome always fits`);
      if (c.needs) assert.ok(ids.has(c.needs.corner) && c.needs.corner !== c.id && c.needs.locked, c.id);
      for (const o of c.outcomes) {
        assert.ok(!/\{(?!a\.)\w+\.\w+\}/.test(o.text), `${c.id}: only {a.*} in "${o.text}"`);
        for (const g of o.gives) {
          if (g.kind === 'gear') assert.ok(GEAR.some((x) => x.id === g.defId), g.defId);
          if (g.kind === 'animal') assert.ok((ANIMAL_KINDS as readonly string[]).includes(g.animal), g.animal);
        }
      }
    }
  });

  test('a new guild can search all but the locked ones, one at a time', () => {
    const state = testGame('open');
    const locked = CORNERS.filter((c) => c.needs).map((c) => c.id);
    for (const c of CORNERS) assert.equal(cornerStatus(state, c.id), locked.includes(c.id) ? 'locked' : 'open', c.id);
    const [a, b] = state.survivors;
    startSearch(state, 'signal_box', a!.id, T0);
    assert.equal(cornerStatus(state, 'signal_box'), 'searching');
    assert.match(searchProblem(state, 'water_tower', b!.id)!, /already searching the signal box/);
    assert.match(searchProblem(state, 'cellar', b!.id)!, /keys/);
  });

  test('it ends through time passing, like a crew coming home: the finds, a Chronicle line and a line in the news', () => {
    const state = testGame('ends');
    const a = state.survivors[0]!;
    const before = { ...state.resources };
    startSearch(state, 'coal_bunker', a.id, T0 + 1000);
    advanceTime(state, T0 + 1000 + 14 * MIN);
    assert.ok(state.corners.search, 'not yet');
    assert.equal(searchDue(state, T0 + 1000 + 15 * MIN), true);
    advanceTime(state, T0 + 1000 + 15 * MIN);
    assert.equal(state.corners.search, undefined);
    assert.deepEqual(state.corners.searched, ['coal_bunker']);
    const last = state.corners.last!;
    assert.equal(last.by, a.id);
    assert.ok(last.supplies && last.supplies.ammo! > 0, JSON.stringify(last));
    assert.equal(state.resources.ammo - before.ammo, last.supplies!.ammo);
    assert.ok(a.chronicle.some((c) => c.text === 'Searched the coal bunker at the Depot.'));
    assert.ok(state.log.some((l) => l.text.startsWith('The coal bunker: ')));
  });

  test('a corner opens once the one it needs has been searched', () => {
    const state = testGame('keys');
    search(state, 'ticket_office', state.survivors[0]!, 'k');
    assert.equal(cornerStatus(state, 'cellar'), 'open');
    search(state, 'signal_box', state.survivors[0]!, 'k2', T0 + 20 * MIN);
    assert.equal(cornerStatus(state, 'engine_shed'), 'open');
  });

  test('whoever is searching can’t go out or move to an outpost; someone just back from a run can search', () => {
    const state = testGame('busy');
    const [a, b] = state.survivors;
    startSearch(state, 'water_tower', a!.id, T0);
    assert.equal(searchReason(state, a!.id), 'is searching the water tower');
    assert.ok(validatePlan(state, testPlan(state, 'rail_yard', { crew: [a!.id] })).some((p) => /is searching the water tower/.test(p)));
    state.outposts.push({ locationId: 'rail_yard', builtDay: 1, damaged: false });
    assert.throws(() => station(state, a!.id, 'rail_yard', 1), /is searching the water tower/);
    b!.traits.push({ id: 'exhausted', gainedDay: 1 });
    finishSearch(state, T0 + 60 * MIN);
    assert.equal(searchProblem(state, 'freight_car', b!.id), undefined, 'tired from a run is fine');
    b!.traits = [{ id: 'wounded', gainedDay: 1 }];
    assert.match(searchProblem(state, 'freight_car', b!.id) ?? '', /resting/);
    b!.status = 'away';
    assert.match(searchProblem(state, 'freight_car', b!.id) ?? '', /out on a run/);
    assert.ok(!searchers(state, 'freight_car').includes(b!));
  });

  test('every outcome of every corner can happen', () => {
    for (const c of CORNERS) {
      const seen = new Set<number>();
      for (let i = 0; i < 80 && seen.size < c.outcomes.length; i++) {
        const state = testGame(`all-${c.id}-${i % 4}`);
        const who = state.survivors[0]!;
        who.stats[c.stat] = i % 2 === 0 ? 9 : 1;
        if (c.needs) state.corners.searched.push(c.needs.corner);
        const r = search(state, c.id, who, `${c.id}-${i}`)!;
        const k = c.outcomes.findIndex((o) => r.text.startsWith(fillRoles(o.text, { a: who })));
        assert.ok(k >= 0, `${c.id}: "${r.text}"`);
        seen.add(k);
      }
      assert.equal(seen.size, c.outcomes.length, `${c.id}: outcomes ${[...seen].join(',')}`);
    }
  });

  test('the freight car’s dog stays with whoever found it, unless the guild has a dog already', () => {
    const state = testGame('dog');
    const who = state.survivors[0]!;
    const r = search(state, 'freight_car', who, 'dog')!;
    const dog = state.animals.find((a) => a.kind === 'dog')!;
    assert.equal(dog.keeper, who.id);
    assert.match(r.text, new RegExp(`calls it ${dog.name}\\.$`));
    const again = testGame('dog2');
    again.animals.push({ id: 'a1', kind: 'dog', name: 'Rust', sinceDay: 1 });
    assert.match(search(again, 'freight_car', again.survivors[0]!, 'dog')!.text, /already a dog at the Depot/);
    assert.equal(again.animals.length, 1);
  });

  test('the stranger in the stationmaster’s house joins with a bed free, and waits at the gate without one', () => {
    let joined = 0;
    let waited = 0;
    for (let i = 0; i < 40 && (joined === 0 || waited === 0); i++) {
      const state = testGame(`house-${i}`);
      const who = state.survivors[0]!;
      who.stats.nerve = 10;
      const full = i % 2 === 1;
      // A new guild's beds are all taken: Bunks 2 makes room.
      if (!full) state.buildings.bunks = 2;
      const count = state.survivors.length;
      const r = search(state, 'stationmaster', who, `house-${i}`)!;
      if (state.survivors.length > count) {
        joined++;
        assert.match(r.text, /joins the guild\.$/);
      } else if (state.depot.recruits.length > 0) {
        waited++;
        assert.match(r.text, /no bed free/);
      }
    }
    assert.ok(joined > 0 && waited > 0, `${joined} joined, ${waited} waited`);
  });

  test('someone gone before the search ends leaves the corner for someone else', () => {
    const state = testGame('gone');
    const a = state.survivors[0]!;
    startSearch(state, 'signal_box', a.id, T0);
    state.survivors = state.survivors.filter((s) => s !== a);
    assert.equal(finishSearch(state, T0 + 10 * MIN), undefined);
    assert.equal(state.corners.search, undefined);
    assert.equal(cornerStatus(state, 'signal_box'), 'open');
  });

  test('older saves get the corners, none searched', () => {
    const state = testGame('old');
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    old.version = 23;
    delete old.corners;
    assert.deepEqual(deserialize(JSON.stringify(old)).corners, { searched: [] });
    assert.deepEqual(deserialize(serialize(state)).corners, { searched: [] });
  });
});
