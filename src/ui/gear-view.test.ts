import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { build, createItem, equipFromStash, itemName, startRun } from '../engine/index.ts';
import { T0, testGame, testPlan } from '../engine/test-utils.ts';
import { carriedRows, gearTakers, salvageButton, sparesPanel, stashGroups, stashLine } from './gear-view.ts';

describe('gear screen', () => {
  test('the stash is grouped by slot, best first, without empty groups', () => {
    const state = testGame('gear-groups');
    state.stash = [createItem(state, 'crowbar', 'rusty'), createItem(state, 'lockpicks'), createItem(state, 'machete', 'solid')];
    const groups = stashGroups(state);
    assert.deepEqual(
      groups.map((g) => g.title),
      ['Weapons', 'Tools'],
    );
    assert.equal(groups[1]!.items[0]!.name, 'Lockpicks', 'a common tool before a rusty one');
    assert.equal(groups[1]!.items.length, 2);
  });

  test('the Depot line names one or two pieces and counts more', () => {
    const state = testGame('gear-line');
    state.stash = [];
    assert.equal(stashLine(state), 'The stash is empty.');
    state.stash.push(createItem(state, 'lockpicks'));
    assert.equal(stashLine(state), 'Lockpicks in the stash.');
    state.stash.push(createItem(state, 'crowbar', 'rusty'));
    assert.equal(stashLine(state), `Lockpicks and ${itemName(state.stash[1]!)} in the stash.`);
    state.stash.push(createItem(state, 'medkit'));
    assert.equal(stashLine(state), '3 pieces of gear in the stash.');
  });

  test('anyone at the Depot can take a piece; people out on a run are listed last and can not', () => {
    const state = testGame('gear-takers');
    const picks = createItem(state, 'lockpicks');
    state.stash.push(picks);
    const [a, b] = state.survivors;
    a!.equipment.tool = createItem(state, 'crowbar', 'rusty');
    delete b!.equipment.tool;
    b!.status = 'away';

    const takers = gearTakers(state, picks.uid);
    assert.equal(takers.length, state.survivors.length);
    const last = takers[takers.length - 1]!;
    assert.equal(last.survivor.id, b!.id);
    assert.equal(last.problem, 'Out on a run');
    assert.equal(last.current, 'No tool');
    const withA = takers.find((t) => t.survivor.id === a!.id)!;
    assert.equal(withA.problem, undefined);
    assert.equal(withA.current, `Carrying ${itemName(a!.equipment.tool!)}`);
    assert.deepEqual(gearTakers(state, 'no-such-item'), []);
  });

  test('giving a piece moves it from the stash to the person, and their old one back', () => {
    const state = testGame('gear-give');
    const picks = createItem(state, 'lockpicks');
    state.stash = [picks];
    const s = state.survivors[0]!;
    const old = createItem(state, 'crowbar', 'rusty');
    s.equipment.tool = old;
    assert.ok(equipFromStash(state, s, picks.uid));
    assert.equal(s.equipment.tool?.uid, picks.uid);
    assert.deepEqual(
      state.stash.map((i) => i.uid),
      [old.uid],
    );
    const row = carriedRows(state).find((r) => r.survivor.id === s.id)!;
    assert.ok(row.items.includes('Lockpicks'));
  });

  test('carried gear lists people in name order, in slot order, and marks who is out', () => {
    const state = testGame('gear-carried');
    for (const s of state.survivors) s.equipment = {};
    const [a, b] = state.survivors;
    a!.equipment.trinket = createItem(state, 'lucky_coin');
    a!.equipment.weapon = createItem(state, 'pipe');
    b!.equipment.tool = createItem(state, 'medkit');
    startRun(state, testPlan(state, 'rail_yard', { crew: [b!.id] }), T0);
    const rows = carriedRows(state);
    assert.equal(rows.length, 2, 'people with nothing are left out');
    assert.deepEqual(
      rows.map((r) => r.survivor.firstName),
      [a!.firstName, b!.firstName].sort((x, y) => x.localeCompare(y)),
    );
    const rowA = rows.find((r) => r.survivor.id === a!.id)!;
    assert.deepEqual(rowA.items, ['Pipe', 'Lucky Coin']);
    assert.equal(rowA.away, false);
    assert.equal(rows.find((r) => r.survivor.id === b!.id)!.away, true);
  });
});

describe('salvage on the Gear screen', () => {
  test('each piece says what taking it apart gives, or why not; spares can go all at once', () => {
    const state = testGame('salvage-view');
    state.stash = [];
    const pipe = createItem(state, 'pipe', 'rusty');
    const named = { ...createItem(state, 'sledge', 'solid'), name: 'Old Faithful' };
    state.stash.push(pipe, named);
    assert.deepEqual(salvageButton(state, pipe.uid), { label: 'Take apart for 1 scrap', problem: 'Build the Workshop first.' });
    assert.deepEqual(sparesPanel(state), { text: 'With a Workshop, spare gear can be taken apart for scrap.' });
    state.resources.scrap = 100;
    build(state, 'workshop', 1);
    assert.deepEqual(salvageButton(state, pipe.uid), { label: 'Take apart for 1 scrap' });
    assert.equal(salvageButton(state, named.uid).problem, 'Nobody will take apart Old Faithful.');
    assert.deepEqual(sparesPanel(state), { text: 'One Rusty or Common piece of gear in the stash would come to 1 scrap in the Workshop.', button: 'Take it apart' });
    state.stash.push(createItem(state, 'leather_jacket', 'common'));
    assert.equal(sparesPanel(state)?.button, 'Take them all apart');
    state.stash = [named];
    assert.equal(sparesPanel(state), undefined, 'nothing spare');
  });
});
