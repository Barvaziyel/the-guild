import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIRST_WEEK, claimStory, newGame, startHaven, type GameState } from '../engine/index.ts';
import { bellItems } from './bell-view.ts';
import { havenReady, havenView, leadPlaces, placeLeadLine, planLeadLine, reportHavenLine } from './haven-view.ts';
import { storyEnding } from './story-view.ts';

const T0 = Date.UTC(2026, 10, 16, 8);

function heard(seed: string): GameState {
  const state = newGame({ seed, now: T0 });
  startHaven(state, 2);
  return state;
}

function find(state: GameState, ...ids: string[]): void {
  for (const id of ids) state.haven!.found.push({ id, day: 3 });
}

describe('the Haven tab (§9.11)', () => {
  test('nothing before the broadcast', () => {
    assert.equal(havenView(newGame({ seed: 'none', now: T0 })), undefined);
  });

  test('just heard: the broadcast, nothing known, and three leads with where to go about them', () => {
    const state = heard('fresh');
    const v = havenView(state)!;
    assert.match(v.broadcast, /^This is Haven\./);
    assert.equal(v.since, 'First heard on day 2.');
    assert.deepEqual(v.known, []);
    assert.equal(v.road, undefined);
    assert.deepEqual(v.leads.map((l) => l.id), ['logbook', 'flyer', 'kessler_note']);
    const farm = v.leads.find((l) => l.id === 'kessler_note')!;
    assert.equal(farm.where, 'Kessler Farm, the outskirts');
    assert.deepEqual(farm.go, { label: 'Plan a run there', to: { screen: 'plan', locationId: 'kessler_farm' } });
    const station = v.leads.find((l) => l.id === 'logbook')!;
    // Not found yet: where the road to it leads from.
    state.locations.radio_station = { discovered: false, explored: 0, runs: 0 };
    const unknown = havenView(state)!.leads.find((l) => l.id === 'logbook')!;
    assert.equal(unknown.note, 'Nobody has found Hilltop Radio Station yet. A road leads there from Kessler Farm: scouting there is the best way to find it.');
    assert.deepEqual(unknown.go, { label: 'Plan a run to Kessler Farm', to: { screen: 'plan', locationId: 'kessler_farm' } });
    assert.ok(station);
  });

  test('found: newest first, who found it and where, and new since the player last looked', () => {
    const state = heard('found');
    const who = state.survivors[0]!;
    state.haven!.found.push({ id: 'logbook', day: 3, by: who.id, at: 'radio_station' });
    state.haven!.found.push({ id: 'flyer', day: 5, by: who.id, at: 'old_metro' });
    const v = havenView(state, { found: 1, heard: 0 })!;
    assert.deepEqual(v.found.map((f) => f.id), ['flyer', 'logbook']);
    assert.equal(v.found[0]!.line, `Found by ${who.firstName} at the Old Metro, day 5.`);
    assert.deepEqual(v.found.map((f) => f.isNew), [true, false]);
    assert.equal(v.known.length, 2);
    assert.ok(!v.leads.some((l) => l.id === 'logbook'));
    assert.ok(v.leads.some((l) => l.id === 'dropped_radio'), 'the logbook opens the next lead');
  });

  test('heard: where it came from, newest first', () => {
    const state = heard('heard');
    state.haven!.heard.push({ id: 'chalk', day: 4, text: 'An arrow.', source: 'run', at: 'old_metro' });
    state.haven!.heard.push({ id: 'buys', day: 6, text: 'A trader says.', source: 'trader' });
    const v = havenView(state, { found: 0, heard: 1 })!;
    assert.deepEqual(v.heard.map((h) => h.line), ['From a trader, day 6.', 'On a run to the Old Metro, day 4.']);
    assert.deepEqual(v.heard.map((h) => h.isNew), [true, false]);
  });

  test('a building lead: what it waits on, then the button', () => {
    const state = heard('build');
    find(state, 'logbook', 'dropped_radio');
    state.buildings.radio_tower = 1;
    let band = havenView(state)!.leads.find((l) => l.id === 'convoy_band')!;
    assert.equal(band.where, 'The Radio Tower, level 2');
    assert.equal(band.note, 'Once the Radio Tower is at level 2.');
    assert.equal(band.action, undefined);
    assert.deepEqual(havenReady(state), []);
    state.buildings.radio_tower = 2;
    band = havenView(state)!.leads.find((l) => l.id === 'convoy_band')!;
    assert.equal(band.action, 'Listen in');
    assert.deepEqual(havenReady(state), ['convoy_band']);
    const bell = bellItems(state, T0).find((i) => i.id === 'haven-convoy_band')!;
    assert.equal(bell.text, 'For Haven: the Radio Tower is up. Listen in.');
    assert.deepEqual(bell.to, { screen: 'haven' });
  });

  test('a lead deeper in waits for that level to open; one tried before says so', () => {
    const state = heard('deep');
    find(state, 'logbook', 'dropped_radio', 'intake_list');
    state.locations.blackwater = { discovered: true, explored: 40, runs: 2 };
    const map = havenView(state)!.leads.find((l) => l.id === 'truck_map')!;
    assert.equal(map.where, 'Blackwater Swamp, deeper in');
    assert.match(map.note!, /^Deeper in isn’t open yet/);
    state.locations.kessler_farm!.discovered = true;
    state.haven!.tries.kessler_note = 2;
    assert.equal(havenView(state)!.leads.find((l) => l.id === 'kessler_note')!.note, '2 crews looked and came back without it. Scouting looks harder.');
  });

  test('the road, once they know where it is and how to get in', () => {
    const state = heard('road');
    find(state, 'bearing', 'gate_code');
    assert.equal(havenView(state)!.road, 'They know where Haven is, and how to get in.');
  });
});

describe('leads elsewhere', () => {
  test('the planner, the Reach and the map', () => {
    const state = heard('elsewhere');
    assert.match(planLeadLine(state, { locationId: 'kessler_farm' })!, /^A lead for Haven here: a note on the Kesslers’ door\./);
    assert.equal(planLeadLine(state, { locationId: 'rail_yard' }), undefined);
    assert.equal(placeLeadLine(state, 'kessler_farm'), 'A lead for Haven: a note on the Kesslers’ door.');
    assert.ok(leadPlaces(state).has('old_metro'));
    find(state, 'logbook', 'dropped_radio', 'intake_list');
    assert.equal(planLeadLine(state, { locationId: 'blackwater', depth: 1 }), 'A lead for Haven here, deeper in: the driver’s map.');
    assert.match(planLeadLine(state, { locationId: 'blackwater', depth: 2 })!, /^A lead for Haven here: the driver’s map\./);
    assert.equal(placeLeadLine(state, 'blackwater'), 'A lead for Haven: the driver’s map (deeper in).');
  });

  test('a report names who found it, or says there was no sign', () => {
    assert.equal(reportHavenLine({ lead: { clue: 'logbook', found: true, by: 's1' } }, { s1: 'Briar' }), 'For Haven: Briar found the engineer’s logbook.');
    assert.equal(reportHavenLine({ lead: { clue: 'logbook', found: false } }, {}), 'For Haven: no sign of the engineer’s logbook this time.');
    assert.equal(reportHavenLine(undefined, {}), undefined);
    assert.equal(reportHavenLine({}, {}), undefined);
  });

  test('the first week’s last card points at the new tab', () => {
    const state = newGame({ seed: 'week-end', now: T0 });
    state.story = { step: FIRST_WEEK.length - 1, base: { runs: 0, at: {} } };
    state.buildings.radio_tower = 1;
    claimStory(state, T0);
    const card = storyEnding(state)!;
    assert.ok(card.last);
    assert.match(card.haven!, /Haven tab/);
  });
});
