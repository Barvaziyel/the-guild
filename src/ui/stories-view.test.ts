import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createItem, getLocation, planWarnings, type Nemesis } from '../engine/index.ts';
import { openGame, testPlan } from '../engine/test-utils.ts';
import { nemesesAt, nemesisRows, scoresToSettle } from './stories-view.ts';
import { itemView, nameWithNickname } from './view.ts';

function nemesis(over: Partial<Nemesis>): Nemesis {
  return { id: 'n1', name: 'Old Notch', enemyId: 'rad_hound', locationId: 'kessler_farm', status: 'atLarge', downed: [], killed: [], escapes: 1, bornDay: 3, history: [], ...over };
}

describe('nemeses on screen', () => {
  test('the list puts those still out there first, with what they have done', () => {
    const state = openGame('rows');
    const [a, b, c] = state.survivors;
    state.nemeses = [
      nemesis({ id: 'n1', name: 'Dead One', status: 'dead', diedDay: 9, killedBy: c!.id, downed: [a!.id], history: [{ day: 2, text: 'Put someone down.' }] }),
      nemesis({ id: 'n2', name: 'Old Notch', downed: [a!.id, b!.id], killed: [b!.id], escapes: 3 }),
    ];
    const rows = nemesisRows(state);
    assert.deepEqual(
      rows.map((r) => r.name),
      ['Old Notch', 'Dead One'],
    );
    assert.equal(rows[0]!.kind, 'a Rad-hound');
    assert.equal(rows[0]!.status, `Haunts ${getLocation('kessler_farm').name}.`);
    assert.equal(rows[0]!.record, `Put ${a!.firstName} down. Killed ${b!.firstName}. Got away 3 times.`);
    assert.equal(rows[1]!.status, `Killed by ${c!.firstName} ${c!.lastName} on day 9.`);
    assert.deepEqual(rows[1]!.story, ['Day 2: Put someone down.']);
    assert.deepEqual(
      nemesesAt(state, 'kessler_farm').map((r) => r.name),
      ['Old Notch'],
      'only the living haunt a place',
    );
    assert.deepEqual(nemesesAt(state, 'maple_street'), []);
  });

  test('a survivor sees the scores they have to settle', () => {
    const state = openGame('scores');
    const [a, b] = state.survivors;
    state.nemeses = [nemesis({ downed: [a!.id] }), nemesis({ id: 'n2', name: 'Gone', status: 'dead', killedBy: a!.id, downed: [a!.id] })];
    const place = getLocation('kessler_farm').name;
    assert.deepEqual(scoresToSettle(state, a!), [
      { name: 'Old Notch', kind: 'a Rad-hound', line: `Put ${a!.firstName} down at ${place}. Still out there.` },
      { name: 'Gone', kind: 'a Rad-hound', line: `Put ${a!.firstName} down at ${place}. ${a!.firstName} saw to that.` },
    ]);
    assert.deepEqual(scoresToSettle(state, b!), []);
  });

  test('the planner warns about a nemesis at the place, and who has a score to settle', () => {
    const state = openGame('plan-warn');
    const plan = testPlan(state, 'kessler_farm');
    const [a] = plan.crew;
    state.nemeses = [nemesis({ downed: [a!] })];
    const name = state.survivors.find((s) => s.id === a)!.firstName;
    assert.ok(planWarnings(state, plan).includes(`Old Notch, a Rad-hound the guild knows by name, haunts this place. ${name} has a score to settle.`));
    assert.ok(!planWarnings(state, testPlan(state, 'maple_street')).some((w) => w.includes('Old Notch')));
  });
});

describe('names on screen', () => {
  test('a nickname sits between first and last name', () => {
    const s = openGame('nick').survivors[0]!;
    assert.equal(nameWithNickname(s), `${s.firstName} ${s.lastName}`);
    s.nickname = 'Two-Shot';
    assert.equal(nameWithNickname(s), `${s.firstName} “Two-Shot” ${s.lastName}`);
  });

  test('a named weapon shows what it is, its kills and its story', () => {
    const state = openGame('named-view');
    const w = createItem(state, 'machete', 'solid');
    assert.equal(itemView(w).kind, undefined);
    assert.deepEqual(itemView(w).story, []);
    w.kills = 3;
    assert.match(itemView(w).stats, /, 3 kills$/);
    w.kills = 12;
    w.name = 'Bonebreaker';
    w.history = [{ day: 14, text: 'Named after its tenth kill.' }];
    const v = itemView(w);
    assert.equal(v.name, 'Bonebreaker');
    assert.equal(v.kind, 'Solid Machete');
    assert.match(v.stats, /12 kills$/);
    assert.deepEqual(v.story, ['Day 14: Named after its tenth kill.']);
  });
});
