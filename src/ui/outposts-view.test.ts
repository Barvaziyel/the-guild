import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { build, buildOutpost, findOutpost, getLocation, station } from '../engine/index.ts';
import { openGame, testPlan } from '../engine/test-utils.ts';
import type { GameState } from '../engine/index.ts';
import { postCandidates } from './depot-view.ts';
import {
  mostlyFinds,
  depthChoices,
  depthRows,
  exploredShort,
  outpostChoices,
  outpostLine,
  outpostPlanNote,
  outpostRows,
  outpostView,
  withDepth,
} from './outposts-view.ts';
import { reachMap } from './reach-map.ts';
import { locationView, placeChips } from './runs-view.ts';
import { rosterOrder, survivorStatus } from './view.ts';
import { awayLines, yardModel } from './yard-view.ts';

function explored(seed: string): GameState {
  const state = openGame(seed);
  state.resources = { scrap: 500, rations: 500, meds: 20, ammo: 50, tech: 100, gas: 0 };
  state.locations.maple_street = { discovered: true, explored: 100, runs: 5 };
  return state;
}

describe('levels on screen', () => {
  test('each level says how dangerous it is and how much is explored, or what opens it', () => {
    const state = openGame('levels');
    state.locations.maple_street = { discovered: true, explored: 60, runs: 3 };
    assert.deepEqual(
      depthRows(state, 'maple_street').map((r) => `${r.name}: ${r.line}`),
      ['The outskirts: Danger 1. 60% explored.', 'Deeper in: Opens when the outskirts are fully explored.', 'The heart of it: Opens when deeper in is fully explored.'],
    );
    assert.equal(exploredShort(state, 'maple_street'), '60%');
    assert.deepEqual(depthChoices(state, 'maple_street'), [], 'no choice while only the outskirts are open');

    state.locations.maple_street.explored = 100;
    state.locations.maple_street.depths = [35, 0];
    assert.equal(depthRows(state, 'maple_street')[0]!.line, 'Danger 1. Fully explored.');
    assert.equal(depthRows(state, 'maple_street')[1]!.line, 'Danger 2. 35% explored.');
    assert.equal(exploredShort(state, 'maple_street'), 'Deeper 35%');
    assert.deepEqual(
      depthChoices(state, 'maple_street').map((c) => c.id),
      ['1', '2'],
    );
    assert.match(depthChoices(state, 'maple_street')[1]!.description, /Longer and deadlier, with more to find and better gear\.$/);
  });

  test('a place shows how often the guild has been, and roads nobody has followed (3.6.0)', () => {
    const state = openGame('note');
    state.locations.maple_street = { discovered: true, explored: 60, runs: 3 };
    const v = locationView(state, 'maple_street');
    const chips = placeChips(v);
    assert.deepEqual(chips[0], { glyph: 'pin', text: '3×', label: 'The guild has been here 3 times' });
    assert.equal(chips.length, v.unknownLeads > 0 ? 2 : 1);
    state.locations.maple_street.runs = 0;
    assert.equal(placeChips(locationView(state, 'maple_street'))[0]!.text, 'never');
  });

  test('an outpost in pictures: who lives there, what it sends and eats, the shortcut, the hard life', () => {
    const state = openGame('outpost-chips');
    const v = outpostView(state, 'maple_street');
    const glyphs = v.chips.map((c) => c.glyph);
    assert.deepEqual(glyphs.slice(0, 1), ['seat']);
    assert.ok(glyphs.includes('rations') && glyphs.includes('clock') && glyphs.includes('war'));
    assert.equal(v.chips.find((c) => c.glyph === 'clock')!.text, '−50%');
    assert.deepEqual(v.buildChips.map((c) => c.glyph), ['scrap', 'tech']);
    for (const c of v.chips) assert.ok(c.label && c.label.length > 5, `${c.glyph} says what it means`);
  });

  test('the plan only carries a level when it is past the outskirts', () => {
    const plan = testPlan(openGame('plan'));
    assert.equal(withDepth(plan, 2).depth, 2);
    assert.equal('depth' in withDepth(withDepth(plan, 3), 1), false);
  });
});

describe('outposts on screen', () => {
  test('before there is one: what it does, what it costs, and what stands in the way', () => {
    const state = explored('before');
    const v = outpostView(state, 'maple_street');
    assert.equal(v.built, false);
    assert.match(v.pitch, /^A camp out here, and a hard posting\. Up to three people live at it, keep watch, and send home a share of what Maple Street gives up every day\./);
    assert.match(v.hardship, /^Out here people heal a third as fast as at home and rest only a little\. Trouble comes calling: prowlers at the fence, long nights, accidents\. Raiders/);
    assert.match(outpostView(state, 'checkpoint_bravo').hardship, /keeping watch wears on them: about 2 more stress a day than they shed, less with a close friend out here\..*accidents, radiation\./);
    assert.match(outpostView(state, 'kessler_farm').hardship, /keeping watch wears on them about as fast as they rest, unless they have a close friend out here\./);
    assert.equal(v.buildCost, '40 scrap, 6 tech');
    assert.match(v.buildProblem!, /Radio Tower first/);
    assert.equal(v.contactLine, 'Outposts need the Radio Tower to keep in contact.');
    build(state, 'radio_tower', 1);
    const after = outpostView(state, 'maple_street');
    assert.equal(after.buildProblem, undefined);
    assert.equal(after.contactLine, 'The Radio Tower keeps in contact with one outpost. The guild has none yet.');
  });

  test('once set up: who lives there, who could, what it sends home, and which runs start from it', () => {
    const state = explored('after');
    build(state, 'radio_tower', 1);
    buildOutpost(state, 'maple_street', 2);
    state.locations.drowned_mall = { discovered: true, explored: 0, runs: 0 };
    const [a, b] = state.survivors;
    a!.post = { building: 'garden' };
    let v = outpostView(state, 'maple_street');
    assert.equal(v.room, '0 of 3');
    assert.equal(v.candidates.length, state.survivors.length);
    assert.equal(v.candidates.find((c) => c.survivor.id === a!.id)!.where, 'Works the Garden');
    assert.match(v.candidates[0]!.aim, /^Aim \d+$/);
    assert.match(v.yieldLine, /^Each person living here sends home 2 to 3 supplies a day, mostly \w+ and \w+, and eats a ration from the Depot's stores\.$/);
    assert.match(v.nearLine, /^Runs to Maple Street, .*The Drowned Mall.* set out from here and take half the time, and crews stop here to rest on the way home\.$/);
    assert.ok(!v.nearLine.includes('Kessler Farm'), 'only places next to it');

    station(state, a!.id, 'maple_street', 3);
    station(state, b!.id, 'maple_street', 3);
    v = outpostView(state, 'maple_street');
    assert.deepEqual(
      v.staff.map((p) => p.survivor.id),
      [a!.id, b!.id],
    );
    assert.equal(v.room, '2 of 3');
    assert.equal(v.full, false);
    assert.ok(!v.candidates.some((c) => c.survivor.id === a!.id));

    findOutpost(state, 'maple_street')!.damaged = true;
    v = outpostView(state, 'maple_street');
    assert.match(v.yieldLine, /, half while it is damaged, and eats a ration/);
    assert.equal(v.repairCost, '15 scrap');
    assert.equal(v.repairProblem, undefined);
  });

  test('people at an outpost read as away: on the roster, the sheet, the Depot, the yard and the map', () => {
    const state = explored('away');
    build(state, 'radio_tower', 1);
    buildOutpost(state, 'maple_street', 2);
    const s = state.survivors[0]!;
    station(state, s.id, 'maple_street', 3);
    assert.deepEqual(survivorStatus(s), { label: 'At the outpost at Maple Street', tone: 'away' });
    assert.equal(rosterOrder(state).at(-1)!.id, s.id);
    assert.equal(outpostLine(s), 'Lives at the outpost at Maple Street.');
    assert.deepEqual(outpostRows(state), [{ id: 'maple_street', text: `The outpost at Maple Street: ${s.firstName} lives there.`, damaged: false }]);
    assert.ok(awayLines(state).includes(`${s.firstName} lives at the outpost at Maple Street.`));
    assert.ok(!yardModel(state, 12).people.some((p) => p.id === s.id));
    assert.equal(reachMap(state).nodes.find((n) => n.id === 'maple_street')!.outpost, 'ok');
    assert.equal(reachMap(state).nodes.find((n) => n.id === 'kessler_farm')?.outpost, undefined);
    const garden = postCandidates(state, 'garden').find((c) => c.survivor.id === s.id)!;
    assert.equal(garden.problem, `${s.firstName} lives at the outpost at Maple Street.`);
    assert.deepEqual(outpostChoices(state, s), [{ id: 'maple_street', name: 'The outpost at Maple Street' }]);
  });

  test('the planner says when a run sets out from an outpost', () => {
    const state = explored('plan');
    const plan = testPlan(state, 'maple_street');
    assert.equal(outpostPlanNote(state, plan), undefined);
    build(state, 'radio_tower', 1);
    buildOutpost(state, 'maple_street', 2);
    assert.equal(outpostPlanNote(state, plan), 'They set out from the outpost at Maple Street, which cuts the trip to half the time, and stop there to rest on the way home.');
  });

  test('what a place mostly gives up: everything at least half as common as the most', () => {
    const at = (id: string): string => mostlyFinds(getLocation(id));
    assert.equal(at('rail_yard'), 'scrap');
    // Scrap counts for more everywhere since 3.4.0.
    assert.equal(at('kessler_farm'), 'rations and scrap');
    assert.equal(at('maple_street'), 'scrap and rations');
    assert.equal(at('old_metro'), 'scrap');
    assert.equal(at('radio_station'), 'scrap and tech');
  });
});
