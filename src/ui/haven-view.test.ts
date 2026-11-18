import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIRST_WEEK, HAVEN_CLUES, HAVEN_DREAMER, LOCATIONS, buyCaravan, claimStory, newGame, setOutForHaven, startHaven, type GameState } from '../engine/index.ts';
import { testSurvivor } from '../engine/test-utils.ts';
import { bellItems } from './bell-view.ts';
import { childrenSummary } from './family-view.ts';
import { fightCard } from './fight-view.ts';
import { discoveredLeadLine, findView, havenReady, havenReport, havenView, leadPlaces, placeLeadLine, planLeadLine, reportGoneLine, reportHavenLine, roadEastView, roadPoints, roadView, smoothPath } from './haven-view.ts';
import { storyEnding } from './story-view.ts';

const T0 = Date.UTC(2026, 10, 16, 8);

/** Heard of Haven; `mapped`, with every place on the map, so no lead is hidden for want of one. */
function heard(seed: string, mapped = true): GameState {
  const state = newGame({ seed, now: T0 });
  startHaven(state, 2);
  if (mapped) for (const loc of LOCATIONS) state.locations[loc.id] = { ...state.locations[loc.id]!, discovered: true };
  return state;
}

function find(state: GameState, ...ids: string[]): void {
  for (const id of ids) state.haven!.found.push({ id, day: 3 });
}

describe('the Haven tab (§9.11)', () => {
  test('nothing before the broadcast', () => {
    assert.equal(havenView(newGame({ seed: 'none', now: T0 })), undefined);
  });

  test('just heard: the broadcast, nothing known, and the leads at places the guild knows', () => {
    const state = heard('fresh', false);
    const v = havenView(state)!;
    assert.match(v.broadcast, /^This is Haven\./);
    assert.equal(v.since, 'First heard on day 2.');
    assert.deepEqual(v.known, []);
    assert.equal(v.road, undefined);
    // Aviel (2.9.1): no lead at a place nobody has found, not even its name.
    assert.deepEqual(v.leads.map((l) => l.id), ['kessler_note']);
    assert.ok(!JSON.stringify(v).includes('Hilltop') && !JSON.stringify(v).includes('Metro'));
    assert.equal(v.hidden, 'There may be more out past the places the guild knows. Scouting turns up new ones.');
    const farm = v.leads[0]!;
    assert.equal(farm.where, 'Kessler Farm, the outskirts');
    assert.equal(farm.from, undefined, 'a first lead comes from the broadcast');
    assert.deepEqual(farm.go, { label: 'Plan a run there', to: { screen: 'plan', locationId: 'kessler_farm' } });
    // Found on a run: there now, and the report says so.
    state.locations.radio_station = { discovered: true, explored: 0, runs: 0 };
    assert.ok(havenView(state)!.leads.some((l) => l.id === 'logbook'));
    assert.equal(discoveredLeadLine(state, 'radio_station'), 'There’s a lead for Haven there: the engineer’s logbook.');
    assert.equal(discoveredLeadLine(state, 'drowned_mall'), undefined);
    state.locations.old_metro = { discovered: true, explored: 0, runs: 0 };
    assert.equal(havenView(state)!.hidden, undefined);
  });

  test('a lead says which find pointed to it', () => {
    const state = heard('from');
    find(state, 'logbook', 'dropped_radio', 'convoy_band', 'intake_list');
    const v = havenView(state)!;
    assert.equal(v.leads.find((l) => l.id === 'gate_code')!.from, 'From the convoy band and the intake list.');
    assert.equal(v.leads.find((l) => l.id === 'ledger')!.from, 'From the intake list.');
    find(state, 'ledger');
    assert.equal(reportHavenLine({ lead: { clue: 'ledger', found: true, by: 'a' } }, { a: 'Briar' }), 'For Haven: Briar found Red Hand’s ledger.');
  });

  test('a find, whole: what it tells, and where it points on to, as each stands', () => {
    const state = heard('next');
    const who = state.survivors[0]!;
    assert.equal(findView(state, 'logbook'), undefined, 'not until it’s filed');
    state.haven!.found.push({ id: 'logbook', day: 3, by: who.id, at: 'radio_station' });
    let log = findView(state, 'logbook')!;
    assert.equal(log.line, `Found by ${who.firstName} at Hilltop Radio Station, day 3.`);
    assert.equal(log.learned, 'The broadcast comes from the east, past the edge of the Reach.');
    assert.deepEqual(log.next, [{ title: 'A convoy’s dropped radio', line: 'The Water Plant: a lead now.', status: 'lead' }]);
    find(state, 'dropped_radio');
    log = findView(state, 'logbook')!;
    assert.deepEqual(log.next, [{ title: 'A convoy’s dropped radio', line: 'The Water Plant: found.', status: 'found' }]);
    assert.deepEqual(findView(state, 'dropped_radio')!.next, [
      { title: 'The convoy band', line: 'The Radio Tower at level 2: a lead now.', status: 'lead' },
      { title: 'The intake list', line: 'Checkpoint Bravo: a lead now.', status: 'lead' },
    ]);
    find(state, 'convoy_band');
    assert.deepEqual(findView(state, 'convoy_band')!.next, [{ title: 'The gate code', line: 'Once the intake list is found too.', status: 'waits' }]);
    assert.deepEqual(findView(state, 'letters'), undefined);
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
    assert.equal(havenView(state)!.road, undefined, 'not without the notebook from the Glow');
    find(state, 'notebook');
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

describe('the road at the top of the tab', () => {
  test('a stop a clue: found first, then open leads, then the rest; the far end unnamed until the bearing', () => {
    const state = heard('road-map');
    let road = roadView(state)!;
    assert.equal(road.total, HAVEN_CLUES.length);
    assert.deepEqual(road.stops.slice(0, 4), ['open', 'open', 'open', 'unknown']);
    assert.equal(road.line, `0 of ${HAVEN_CLUES.length} found.`);
    assert.equal(road.end, 'Haven?');
    find(state, 'kessler_note', 'logbook');
    road = roadView(state)!;
    assert.deepEqual(road.stops.slice(0, 2), ['found', 'found']);
    assert.equal(road.stops.filter((s) => s === 'open').length, havenView(state)!.leads.length);
    assert.equal(road.line, `2 of ${HAVEN_CLUES.length} found.`);
    find(state, 'bearing');
    assert.equal(roadView(state)!.end, 'Corwin Dam');
    find(state, 'gate_code', 'notebook');
    assert.equal(roadView(state)!.line, 'The road is open.');
    assert.ok(roadView(state)!.roadOpen);
  });

  test('the Vultures’ word isn’t a stop on the road', () => {
    const state = heard('road-vultures');
    state.haven!.found.push({ id: 'vultures_word', day: 4 });
    assert.equal(roadView(state)!.found, 0);
  });

  test('the map: the Depot, a stop a clue, Haven, all on the paper', () => {
    const pts = roadPoints(HAVEN_CLUES.length);
    assert.equal(pts.length, HAVEN_CLUES.length + 2);
    for (const p of pts) assert.ok(p.x > 10 && p.x < 330 && p.y > 20 && p.y < 100, `${p.x},${p.y}`);
    for (let i = 1; i < pts.length; i++) assert.ok(pts[i]!.x > pts[i - 1]!.x, 'left to right');
    const d = smoothPath(pts);
    assert.match(d, /^M22 86 C/);
    assert.equal((d.match(/C/g) ?? []).length, pts.length - 1);
  });
});

describe('the scraps', () => {
  test('what came to the Depot says so', () => {
    const state = heard('scrap-lines');
    state.haven!.found.push({ id: 'vultures_word', day: 30 }, { id: 'convoy_band', day: 31 });
    assert.deepEqual(havenView(state)!.found.map((f) => f.line), ['Worked out at the Depot, day 31.', 'At the fence, day 30.']);
  });
});

describe('the one who went (§9.11)', () => {
  /** Someone who walked off east: from the road home from Maple Street, or (`night`) from their bunk. */
  function went(night = false): { state: GameState; first: string } {
    const state = heard('went');
    find(state, 'logbook', 'flyer', 'kessler_note');
    const s = state.survivors[0]!;
    state.survivors.splice(0, 1);
    s.status = 'left';
    state.departed.push(s);
    state.haven!.dreamer = { id: s.id, day: 10, ready: 15, gone: 20 };
    state.haven!.found.push({ id: HAVEN_DREAMER.id, day: 20, ...(night ? {} : { at: 'maple_street' }) });
    return { state, first: s.firstName };
  }

  test('their goodbye is with what was found, and what we know says where they went', () => {
    const { state, first } = went();
    const v = havenView(state, { found: 3, heard: 0 })!;
    assert.deepEqual(v.found[0], {
      id: HAVEN_DREAMER.id,
      title: `${first}’s goodbye`,
      text: `“I’m going to Haven. Don’t come after me. When I’m settled I’ll send for all of you, I promise.” Then ${first} walked east along the old highway, and didn’t look back.`,
      line: 'On the way home from Maple Street, day 20.',
      next: [],
      isNew: true,
    });
    assert.equal(v.known.at(-1), `${first} went east to answer the broadcast, alone.`);
    assert.equal(roadView(state)!.found, 3, 'a goodbye isn’t a clue');
  });

  test('gone in the night, it’s the note on the bunk', () => {
    const { state } = went(true);
    const v = havenView(state)!;
    assert.equal(v.found[0]!.line, 'Gone in the night, day 20.');
    assert.match(v.found[0]!.text, /^Left on (his|her) bunk: “Gone to Haven\./);
  });

  test('the run’s report says it', () => {
    assert.equal(reportGoneLine({ ran: { id: 'a' } }, { a: 'Rook' }), 'Rook went east to Haven, alone.');
    assert.equal(reportGoneLine(undefined, {}), undefined);
  });
});

describe('the road east (§9.12)', () => {
  /** Every clue found, a Cargo Van with gas, and plenty to pay for a caravan. */
  function ready(seed: string): GameState {
    const state = heard(seed);
    for (const c of HAVEN_CLUES) if (!state.haven!.found.some((f) => f.id === c.id)) find(state, c.id);
    state.vehicles.push({ id: 'v-van', defId: 'van', condition: 100, runs: 0 });
    Object.assign(state.resources, { gas: 100, scrap: 500, tech: 50, meds: 8, ammo: 20 });
    return state;
  }

  test('nothing until the guild knows the way', () => {
    assert.equal(roadEastView(heard('no-way')), undefined);
  });

  test('getting ready: who rides, what carries them, and the button', () => {
    const state = ready('east');
    const east = roadEastView(state)!;
    assert.equal(east.stage, 'ready');
    assert.equal(east.title, 'The road east');
    assert.match(east.lines[0]!, /whole guild goes together, children too/);
    assert.match(east.lines[1]!, /2 h 35 min there and back/);
    assert.match(east.lines[1]!, /six fittest go forward/);
    assert.equal(east.lines[2], 'They take everything the Depot has: 8 meds and 20 ammo.');
    assert.equal(east.seats, `${capitalized(state.survivors.length)} to carry. The Cargo Van seats eight.`);
    assert.equal(east.caravan, undefined);
    assert.deepEqual(east.problems, []);
    assert.equal(east.go?.label, 'Set out for Haven');
    assert.match(east.go!.confirm, /no turning back/);
  });

  test('more riders than seats: places in a caravan, then the button', () => {
    const state = ready('caravan');
    for (let i = 0; i < 6; i++) state.children.push(testSurvivor(`kid${i}`, { firstName: `Kid${i}`, age: 7 }));
    const riders = state.survivors.length + 6;
    const short = riders - 8;
    let east = roadEastView(state)!;
    assert.match(east.seats!, /to carry: .* of the guild and six children\. The Cargo Van seats eight\./);
    assert.equal(east.caravan?.label, short === 1 ? 'Buy a place in a caravan' : `Buy ${['', 'one', 'two', 'three', 'four', 'five'][short]} places in a caravan`);
    assert.equal(east.caravan?.cost, `${20 * short} scrap, ${2 * short} tech`);
    assert.equal(east.caravan?.problem, undefined);
    assert.ok(!east.problems.some((p) => p.startsWith('Not everyone has a seat')), 'the caravan explains it');
    assert.equal(east.go, undefined, 'not until everyone has a seat');

    state.resources.scrap = 0;
    assert.match(roadEastView(state)!.caravan!.problem!, /^Not enough/);
    state.resources.scrap = 500;
    buyCaravan(state, T0);
    east = roadEastView(state)!;
    assert.equal(east.caravan, undefined);
    assert.match(east.seats!, /in a trader’s caravan\.$/);
    assert.ok(east.go);
  });

  test('worth knowing before they go: few meds, guns with no ammo, the hurt; and who comes in from an outpost', () => {
    const state = ready('warn');
    state.resources.meds = 1;
    state.resources.ammo = 0;
    const [a, b] = state.survivors;
    a!.equipment.weapon = { uid: 'g1', defId: 'hunting_rifle' } as never;
    b!.hp = 1;
    b!.outpost = 'water_plant';
    const east = roadEastView(state)!;
    assert.ok(east.warnings.includes('Only one med for the whole road.'));
    assert.ok(east.warnings.includes('Some of them carry guns, but there’s no ammo.'));
    assert.ok(east.warnings.includes(`${b!.firstName} is hurt. Everyone comes anyway.`));
    assert.ok(east.lines.includes(`${b!.firstName} comes in from the outposts first.`));
    assert.ok(east.go, 'an outpost doesn’t stop them');
    state.resources.meds = 0;
    assert.ok(roadEastView(state)!.warnings.includes('No meds: nobody gets patched up between the fights.'));
  });

  test('what stops them shows, and there’s no button', () => {
    const state = ready('stop');
    state.vehicles = [];
    const east = roadEastView(state)!;
    assert.match(east.seats!, /The guild has no vehicle that runs\./);
    assert.equal(east.go, undefined);
  });

  test('on the road: the children ride, and the card points at the run', () => {
    const state = ready('out');
    state.children.push(testSurvivor('kid', { firstName: 'Pip', age: 7 }));
    const run = setOutForHaven(state, T0);
    const east = roadEastView(state)!;
    assert.equal(east.stage, 'out');
    assert.equal(east.runId, run.id);
    assert.match(east.lines[0]!, /the child too/);
    assert.equal(childrenSummary(state), '1 child on the road east with the guild.');
    assert.ok(!bellItems(state, T0 + 1000).some((i) => i.id === 'empty'), 'no raid comes while they’re away, so an empty Depot is no warning');
    // The road's fights say where they are, and have their own backdrops.
    const first = run.lead!.fights[0]!;
    assert.equal(first.site, 'haven_toll');
    const card = fightCard(state, run, first.at + 1)!;
    assert.equal(card.place, 'Red Hand’s toll');
    // They wait as long as it takes: no half hour, no radio.
    const late = fightCard(state, run, first.at + 5 * 3_600_000)!;
    assert.match(late.wait, /as long as it takes/);
    assert.match(late.line, /has called a halt/);
  });

  test('how it ended: won, with the freed split between the beds and the Vultures; or lost, and the broadcast goes on', () => {
    const state = ready('over');
    state.haven!.end = { day: 40, won: true, freed: 2, withVultures: 1 };
    let east = roadEastView(state)!;
    assert.equal(east.stage, 'over');
    assert.equal(east.title, 'Haven is finished');
    assert.equal(east.lines[1], 'Of those freed from its wards, two came home with the guild and one went with the Vultures: there wasn’t room for everyone.');
    assert.equal(havenView(state)!.radioOff, 'On the radio, where Haven used to be: nothing.');
    state.haven!.end = { day: 40, won: false, freed: 0, withVultures: 0 };
    east = roadEastView(state)!;
    assert.equal(east.title, 'Haven goes on');
    assert.equal(havenView(state)!.radioOff, undefined, 'the broadcast still comes');
  });

  test('the report: the one shot at the gate, the freed, the Vultures', () => {
    const state = ready('report');
    const shot = testSurvivor('dreamer', { firstName: 'Lio' });
    state.memorial.push(shot);
    state.haven!.end = { day: 40, won: true, freed: 3, withVultures: 0 };
    const freed = [testSurvivor('f1'), testSurvivor('f2'), testSurvivor('f3')];
    const r = havenReport(state, { summary: { havenEnd: { won: true, shot: 'dreamer', vultures: true, freed } } as never })!;
    assert.equal(r.headline, 'Haven is finished');
    assert.deepEqual(
      r.lines.map((l) => l.text),
      [
        'Lio was shot at Haven’s gate, running to warn the guild.',
        'Three freed from Haven’s wards came home with the guild. They’re on the Roster now.',
        'The Vultures fought beside the guild at the gate. They won’t forget it.',
        'Haven is finished. The game goes on.',
      ],
    );
    const lost = havenReport(state, { summary: { havenEnd: { won: false, vultures: false } } as never })!;
    assert.equal(lost.headline, 'Haven goes on');
    assert.equal(havenReport(state, { summary: {} as never }), undefined, 'any other run');
  });
});

function capitalized(n: number): string {
  const w = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'][n] ?? String(n);
  return w;
}
