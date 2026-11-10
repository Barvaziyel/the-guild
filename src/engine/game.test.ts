import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, NAME_MAX_LENGTH, SAVE_VERSION, STARTING_SURVIVORS } from './constants.ts';
import { completeRun, startRun } from './expedition/index.ts';
import { dayAt, nameProblem, newGame, renameSurvivor, withRng } from './game.ts';
import { canChangeGear, equipFromStash, unequip } from './gear.ts';
import { pairKey } from './relationships.ts';
import { deserialize, serialize } from './save.ts';
import { T0, openGame, testGame, testPlan } from './test-utils.ts';

describe('newGame', () => {
  test('creates founders with distinct origins and full relationships', () => {
    const state = testGame();
    assert.equal(state.survivors.length, STARTING_SURVIVORS);
    assert.equal(new Set(state.survivors.map((s) => s.origin)).size, STARTING_SURVIVORS);
    const ids = state.survivors.map((s) => s.id);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        assert.ok(state.relationships[pairKey(ids[i]!, ids[j]!)], `missing ${ids[i]}-${ids[j]}`);
      }
    }
    for (const s of state.survivors) {
      assert.equal(s.chronicle[0]!.text, 'Founded the guild at the Depot.');
    }
    assert.equal(state.stash.length, 3);
  });

  test('same seed, same game; different seed, different game', () => {
    assert.deepEqual(testGame('alpha'), testGame('alpha'));
    assert.notDeepEqual(
      testGame('alpha').survivors.map((s) => s.firstName),
      testGame('beta').survivors.map((s) => s.firstName),
    );
  });

  test('ids are unique across survivors and items', () => {
    const state = testGame();
    const ids = [
      ...state.survivors.map((s) => s.id),
      ...state.stash.map((i) => i.uid),
      ...state.survivors.flatMap((s) => Object.values(s.equipment).map((i) => i!.uid)),
    ];
    assert.equal(new Set(ids).size, ids.length);
  });
});

describe('time', () => {
  test('day 1 starts at creation and advances every DAY_MS', () => {
    const state = testGame();
    assert.equal(dayAt(state, T0), 1);
    assert.equal(dayAt(state, T0 + DAY_MS - 1), 1);
    assert.equal(dayAt(state, T0 + DAY_MS), 2);
    assert.equal(dayAt(state, T0 - 5000), 1, 'clock skew never goes below day 1');
  });
});

describe('rng threading', () => {
  test('withRng advances the stored state', () => {
    const state = testGame();
    const before = { ...state.rng };
    withRng(state, (rng) => rng.next());
    assert.notDeepEqual(state.rng, before);
  });
});

describe('save', () => {
  test('round-trips exactly', () => {
    const state = newGame({ seed: 'save', now: T0 });
    assert.deepEqual(deserialize(serialize(state)), state);
  });

  test('rejects saves from the future', () => {
    const json = JSON.stringify({ version: SAVE_VERSION + 1 });
    assert.throws(() => deserialize(json), /newer version/);
  });

  test('rejects text that is not a save, with a readable reason', () => {
    assert.throws(() => deserialize('hello'), /not valid JSON/);
    assert.throws(() => deserialize('[1, 2]'), /not a save/);
    assert.throws(() => deserialize('{"name": "something else"}'), /not a save/);
  });

  test('rejects a damaged save', () => {
    const state = testGame();
    const noSurvivors = { ...JSON.parse(serialize(state)), survivors: 'lost' };
    assert.throws(() => deserialize(JSON.stringify(noSurvivors)), /damaged: survivors is missing/);
    const broken = JSON.parse(serialize(state));
    delete broken.survivors[0].stats;
    assert.throws(() => deserialize(JSON.stringify(broken)), /damaged: .* is missing stats/);
  });
});

describe('renameSurvivor', () => {
  test('tidies and applies the new name', () => {
    const state = testGame();
    const s = state.survivors[0]!;
    renameSurvivor(state, s.id, '  Dex  ', ' Two   Shot ');
    assert.equal(s.firstName, 'Dex');
    assert.equal(s.lastName, 'Two Shot');
  });

  test('the backstory follows the new name', () => {
    const state = testGame();
    const s = state.survivors[0]!;
    s.firstName = 'Cass';
    s.backstory = "Cass has eaten things. Cass's caravan is gone. Cassidy was her sister.";
    renameSurvivor(state, s.id, 'Wren', s.lastName);
    assert.equal(s.backstory, "Wren has eaten things. Wren's caravan is gone. Cassidy was her sister.");
  });

  test('rejects empty and overlong names and leaves the survivor alone', () => {
    const state = testGame();
    const s = state.survivors[0]!;
    const before = `${s.firstName} ${s.lastName}`;
    assert.throws(() => renameSurvivor(state, s.id, '   ', 'Arlo'), /empty/);
    assert.throws(() => renameSurvivor(state, s.id, 'Dex', 'x'.repeat(NAME_MAX_LENGTH + 1)), /characters/);
    assert.equal(`${s.firstName} ${s.lastName}`, before);
    assert.equal(nameProblem('x'.repeat(NAME_MAX_LENGTH)), undefined);
  });

  test('a survivor renamed while out comes home with the new name', () => {
    const state = openGame();
    const run = startRun(state, testPlan(state, 'maple_street', {}, 1), T0);
    const id = run.plan.crew[0]!;
    renameSurvivor(state, id, 'Wren', 'Holloway');
    completeRun(state, run.id, run.returnAt);
    const home = state.survivors.find((x) => x.id === id) ?? state.memorial.find((x) => x.id === id)!;
    assert.equal(home.firstName, 'Wren');
    assert.equal(home.lastName, 'Holloway');
  });
});

describe('gear changes', () => {
  test('only happen at the Depot, so a returning crew never duplicates items', () => {
    const state = openGame();
    const run = startRun(state, testPlan(state, 'maple_street', {}, 1), T0);
    const s = state.survivors.find((x) => x.id === run.plan.crew[0])!;
    const stashBefore = state.stash.length;
    assert.equal(canChangeGear(s), false);
    assert.equal(unequip(state, s, 'weapon'), undefined);
    assert.equal(equipFromStash(state, s, state.stash[0]!.uid), false);
    assert.equal(state.stash.length, stashBefore);

    completeRun(state, run.id, run.returnAt);
    const home = state.survivors.find((x) => x.id === s.id);
    if (!home) return; // died on the run; nothing more to check
    assert.equal(canChangeGear(home), true);
    const weapon = home.equipment.weapon;
    if (weapon) {
      assert.equal(unequip(state, home, 'weapon')?.uid, weapon.uid);
      assert.ok(equipFromStash(state, home, weapon.uid));
      assert.equal(home.equipment.weapon?.uid, weapon.uid);
    }
  });
});
