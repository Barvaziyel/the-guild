import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, build, emptySummary, refreshRecruits, startRun } from '../engine/index.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import {
  buildingRow,
  buildingRows,
  candidateStats,
  candidateTraitsLine,
  candidateWait,
  depotNews,
  homeCounts,
  mergeSummaries,
  postCandidates,
  postChoices,
  recipeRows,
  summaryLines,
  upgradeRows,
  workerLine,
} from './depot-view.ts';

describe('buildings on screen', () => {
  test('built ones show live numbers; unbuilt ones show the cost of building', () => {
    const state = testGame();
    const garden = buildingRow(state, 'garden');
    assert.equal(garden.built, true);
    assert.match(garden.status, /^Grows about \d+ rations a day\. The guild at home eats \d+\.$/);
    assert.equal(garden.workers.length, 2);
    assert.equal(garden.slots, 2);
    const infirmary = buildingRow(state, 'infirmary');
    assert.equal(infirmary.built, false);
    assert.equal(infirmary.next?.cost, '25 scrap, 2 tech');
    assert.match(infirmary.next?.problem ?? '', /Needs/);
    assert.equal(buildingRows(state).length, 8);
    assert.match(buildingRow(state, 'bunks').status, /^4 of 4 beds taken\.$/);
  });

  test('workers say why they are not working today', () => {
    const state = openGame();
    const gardener = state.survivors.find((s) => s.post?.building === 'garden')!;
    assert.deepEqual(Object.keys(workerLine(state, gardener)), ['stat']);
    startRun(state, { ...testPlan(state), crew: [gardener.id] }, T0);
    assert.equal(workerLine(state, gardener).away, 'Out on a run.');
  });

  test('posting lists everyone else, and the sheet offers only built buildings with work', () => {
    const state = testGame();
    const options = postCandidates(state, 'firepit');
    assert.equal(options.length, 3);
    assert.ok(options.every((o) => o.survivor.post?.building !== 'firepit'));
    const s = state.survivors[0]!;
    assert.deepEqual(postChoices(state, s).map((c) => c.id), ['garden', 'firepit']);
  });
});

describe('the Workshop on screen', () => {
  test('recipes and improvements say what they cost and why not', () => {
    const state = testGame();
    assert.ok(recipeRows(state).every((r) => r.problem === 'Build the Workshop first.'));
    state.resources = { scrap: 200, rations: 0, meds: 9, ammo: 0, tech: 20 };
    build(state, 'workshop', 1);
    const machete = recipeRows(state).find((r) => r.gear === 'machete')!;
    assert.equal(machete.problem, undefined);
    assert.equal(machete.cost, '8 scrap');
    const ups = upgradeRows(state);
    assert.ok(ups.length > 0);
    assert.ok(ups.some((u) => u.holder), 'carried gear is listed with who carries it');
    assert.ok(ups.every((u) => u.to !== u.name));
  });
});

describe('recruits on screen', () => {
  test('stats are ranges until there is a Radio Tower', () => {
    const state = testGame();
    refreshRecruits(state, 2, new Rng('gate'));
    const c = state.depot.recruits[0]!;
    assert.match(candidateStats(state, c.survivor)[0]!.value, /^\d+ to \d+$/);
    state.resources.scrap = 100;
    state.resources.tech = 10;
    build(state, 'radio_tower', 2);
    assert.match(candidateStats(state, c.survivor)[0]!.value, /^\d+$/);
    assert.equal(candidateWait(c, 2), 'Here today only.');
    assert.equal(candidateTraitsLine(['Tinkerer'], true), 'Tinkerer. And something you’ll only find out about later.');
    assert.equal(candidateTraitsLine(['Brave', 'Calm'], false), 'Brave, Calm.');
    assert.match(candidateTraitsLine([], true), /^Nothing shows yet/);
    assert.equal(candidateWait({ ...c, expiresDay: 6 }, 3), 'Waits at the gate until day 5.');
  });
});

describe('while you were away', () => {
  test('sums up days in plain sentences, and the news leaves out run lines', () => {
    assert.deepEqual(summaryLines(emptySummary()), []);
    const a = { ...emptySummary(), days: 2, grown: 10, eaten: 8, healed: 6 };
    const b = { ...emptySummary(), days: 1, grown: 5, eaten: 4, ammoMade: 3, hungryDays: 1, cured: 1 };
    const lines = summaryLines(mergeSummaries(a, b));
    assert.deepEqual(lines, [
      '3 days passed at the Depot.',
      'The Garden grew 15 rations and the guild ate 12.',
      'The guild went hungry for a day.',
      'The Workshop made 3 ammo.',
      'Rest healed 6 health, and the Infirmary treated one patient.',
    ]);
    const state = testGame();
    state.log.push({ day: 2, text: 'The crew returned from X.', tags: ['run'] }, { day: 2, text: 'A stray dog nosed around.', tags: ['animal'] });
    assert.equal(depotNews(state)[0]!.text, 'A stray dog nosed around.');
    assert.ok(!depotNews(state).some((n) => n.text.includes('returned')));
    assert.deepEqual(homeCounts(state), { home: 4, out: 0, beds: 4, cap: 4 });
  });
});
