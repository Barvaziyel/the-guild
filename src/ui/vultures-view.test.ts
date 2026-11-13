import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, applyVultureNews, freeLieutenants, getLocation, neighbours, playVulturesDay, vultureBoss, type GameState } from '../engine/index.ts';
import { openGame } from '../engine/test-utils.ts';
import { parseRoute, routeHash, tabFor } from './route.ts';
import { assaultChoice, prisonerRows, strengthWord, vulturePeople, vulturePlaceLine, vultureReportLines, vulturesSummary, vulturesView, vultureTag } from './vultures-view.ts';

function arrived(seed: string): GameState {
  const state = openGame(seed);
  state.vultures.arriveDay = 1;
  playVulturesDay(state, 1, new Rng(`a-${seed}`));
  return state;
}

const home = (state: GameState): string => state.vultures.camps[0]!.locationId;

describe('the Vultures on screen', () => {
  test('before they come: a rumour, and no screen to open', () => {
    const state = openGame('rumour');
    assert.equal(vulturesSummary(state), 'Another crew works the far side of the Reach. Nobody here has met them yet.');
    const v = vulturesView(state, 5);
    assert.equal(v.arrived, false);
    assert.match(v.note!, /Nobody here has met them yet/);
  });

  test('once here: how things stand, what it means, what they do to the guild', () => {
    const state = arrived('here');
    const v = vulturesView(state, 2);
    assert.equal(v.bandName, 'Wary');
    assert.match(v.meaning, /standoffs/);
    assert.equal(v.strength, 'A crew to reckon with (40 of 100)');
    assert.ok(v.effects.some((l) => l.includes(getLocation(home(state)).name) && l.includes('20% thinner')), v.effects.join(' | '));
    assert.ok(v.effects.includes('Caravans pay 10% less while they\'re this strong.'));
    assert.equal(vulturesSummary(state), 'Wary. A crew to reckon with, with one camp.');
    assert.deepEqual(['Scattered', 'A crew to reckon with', 'Strong', 'At their strongest'], [10, 40, 60, 90].map(strengthWord));
  });

  test('their people: the boss by name from the start, lieutenants once met, prisoners with what can be done', () => {
    const state = arrived('people');
    const rows = vulturePeople(state);
    assert.equal(rows[0]!.role, 'Their boss');
    assert.equal(rows[0]!.name, `${vultureBoss(state)!.person.firstName} ${vultureBoss(state)!.person.lastName}`);
    assert.ok(rows.slice(1).every((r) => r.name === 'Not met yet' && !r.person));
    const lt = freeLieutenants(state)[0]!;
    applyVultureNews(state, { standing: 0, strength: 0, met: [lt.person.id], killed: [], captured: [lt.person.id], history: [] }, 3, new Rng('c'));
    const row = vulturePeople(state).find((r) => r.id === lt.person.id)!;
    assert.equal(row.where, 'The guild\'s prisoner.');
    assert.ok(row.person);
    const [p] = prisonerRows(state);
    assert.equal(p!.id, lt.person.id);
    assert.match(p!.recruit, /^Ask (him|her) to join: about \d+% (he|she) says yes\./);
  });

  test('places: their camp and turf on the Reach, the planner\'s job, and the report', () => {
    const state = arrived('places');
    const camp = home(state);
    const next = neighbours(camp)[0]!;
    assert.equal(vultureTag(state, camp), 'Vulture camp');
    assert.equal(vultureTag(state, next), 'Vultures');
    assert.match(vulturePlaceLine(state, camp)!, /^The Vultures have a camp here, held by .+\. Finds are 20% thinner/);
    assert.equal(vulturePlaceLine(state, next), 'The Vultures work here: finds are 20% thinner, and crews may meet them.');
    assert.match(assaultChoice(state, camp)!.description, /It means war with the Vultures\.$/);
    assert.equal(assaultChoice(state, next), undefined);
    const boss = vultureBoss(state)!;
    const lines = vultureReportLines(state, { vultures: { standing: -20, strength: -15, met: [], killed: [], captured: [boss.person.id], history: [], campTaken: camp } } as never);
    assert.deepEqual(lines, [`Took the Vultures' camp at ${getLocation(camp).name}.`, `Brought ${boss.person.firstName} ${boss.person.lastName} of the Vultures home as a prisoner.`]);
  });

  test('their screen has a route, under the Reach', () => {
    assert.deepEqual(parseRoute('#/vultures'), { screen: 'vultures' });
    assert.equal(routeHash({ screen: 'vultures' }), '#/vultures');
    assert.equal(tabFor({ screen: 'vultures' }), 'reach');
  });
});
