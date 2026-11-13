import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, assignPost, becomePartners, birth, expecting, build, emptySummary, gardenYield, guildUpkeep, postProblem, addRadioRecruit, startRun, postBuilding } from '../engine/index.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import type { Survivor } from '../engine/index.ts';
import {
  bedsLine,
  foodWarning,
  newMouthNote,
  buildingRow,
  buildingRows,
  candidateStats,
  candidateTraitsLine,
  candidateNote,
  candidateWait,
  depotNews,
  homeCounts,
  mergeSummaries,
  postCandidates,
  postChoices,
  recipeRows,
  summaryLines,
  upgradeRows,
  upkeepLines,
  workerLine,
} from './depot-view.ts';

describe('buildings on screen', () => {
  test('built ones show live numbers; unbuilt ones show the cost of building', () => {
    const state = testGame();
    const garden = buildingRow(state, 'garden');
    assert.equal(garden.built, true);
    assert.match(garden.status, /^Grows about [\d.]+ rations a day\. The guild at home eats \d+\.$/);
    assert.equal(garden.workers.length, 2);
    assert.equal(garden.slots, 2);
    const infirmary = buildingRow(state, 'infirmary');
    assert.equal(infirmary.built, false);
    assert.equal(infirmary.next?.cost, '25 scrap, 2 meds');
    assert.equal(infirmary.next?.problem ?? '', '', 'a new guild can afford its Infirmary (1.7.2)');
    state.resources.scrap = 0;
    assert.match(buildingRow(state, 'infirmary').next?.problem ?? '', /Needs/);
    assert.equal(buildingRows(state).length, 8);
    assert.match(buildingRow(state, 'bunks').status, /^4 of 4 beds taken\.$/);
  });

  test('workers say why they are not working today', () => {
    const state = openGame();
    const gardener = state.survivors.find((s) => postBuilding(s.post) === 'garden')!;
    assert.deepEqual(Object.keys(workerLine(state, gardener)), ['stat']);
    startRun(state, { ...testPlan(state), crew: [gardener.id] }, T0);
    assert.equal(workerLine(state, gardener).away, 'Out on a run.');
  });

  test('posting lists everyone else, and the sheet offers only built buildings with work', () => {
    const state = testGame();
    const options = postCandidates(state, 'firepit');
    assert.equal(options.length, 3);
    assert.ok(options.every((o) => postBuilding(o.survivor.post) !== 'firepit'));
    const s = state.survivors[0]!;
    assert.deepEqual(postChoices(state, s).map((c) => c.id), ['garden', 'firepit']);
  });

  test('people resting until healed are not offered a post, and keep the one they have', () => {
    const state = testGame();
    const hurt = state.survivors.find((s) => postBuilding(s.post) !== 'firepit')!;
    hurt.traits.push({ id: 'badly_wounded', gainedDay: 1, expiresDay: 6 });
    assert.ok(postCandidates(state, 'firepit').every((o) => o.survivor.id !== hurt.id));
    assert.equal(postProblem(state, hurt.id, { building: 'firepit' }), `${hurt.firstName} is resting until healed.`);
    assert.throws(() => assignPost(state, hurt.id, { building: 'firepit' }), /resting until healed/);
    if (hurt.post && 'building' in hurt.post) {
      assert.equal(postProblem(state, hurt.id, hurt.post), undefined);
      assert.equal(workerLine(state, hurt).away, 'Resting until healed.');
    }
    hurt.traits = [];
    assert.ok(postCandidates(state, 'firepit').some((o) => o.survivor.id === hurt.id));
  });
});

describe('the Workshop on screen', () => {
  test('recipes and improvements say what they cost and why not', () => {
    const state = testGame();
    assert.ok(recipeRows(state).every((r) => r.problem === 'Build the Workshop first.'));
    state.resources = { scrap: 200, rations: 0, meds: 9, ammo: 0, tech: 20, gas: 0 };
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
    addRadioRecruit(state, 2, new Rng('gate'));
    const c = { ...state.depot.recruits[0]!, expiresDay: 3 };
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
    const wanderer = { ...c, wanderer: true, survivor: { ...c.survivor, pronouns: 'she' as const } };
    assert.equal(candidateNote(wanderer, 2), 'Came on her own. Here today only.');
    assert.equal(candidateNote({ ...c, wanderer: false }, 2), 'Here today only.');
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
    assert.deepEqual(homeCounts(state), { home: 4, out: 0, outposts: 0, beds: 4, cap: 4 });
  });

  test('beds: partners share, a baby sleeps with them, and the summary counts nights on the floor', () => {
    const state = testGame('beds');
    state.buildings.bunks = 3;
    const [m, f] = state.survivors as [Survivor, Survivor];
    m.pronouns = 'she';
    f.pronouns = 'he';
    becomePartners(state, m, f, 1);
    assert.equal(bedsLine(state), '3 of 12 beds taken.');
    expecting(state, m, f, 1);
    birth(state, m, 2, new Rng('b'));
    assert.equal(bedsLine(state), '3 of 12 beds taken.');
    assert.equal(homeCounts(state).beds, 3);
    const s = { ...emptySummary(), days: 2, floorNights: 3 };
    assert.ok(summaryLines(s).includes('For want of a bed, someone slept on the floor 3 nights.'));
  });
});

describe('food on the Depot', () => {
  /** A guild whose Garden grows `grow` a day against `eat` mouths, with `stored` rations. */
  function guild(stored: number, extraMouths: number) {
    const state = testGame('food');
    for (const s of state.survivors) s.traits = s.traits.filter((t) => t.id !== 'glutton' && t.id !== 'drinker');
    for (let i = 0; i < extraMouths; i++) state.survivors.push({ ...structuredClone(state.survivors[0]!), id: `extra${i}`, post: undefined });
    state.resources.rations = stored;
    return state;
  }

  test('no warning while the Garden keeps up', () => {
    const state = guild(0, 0);
    assert.ok(gardenYield(state) >= guildUpkeep(state), 'a new guild feeds itself');
    assert.equal(foodWarning(state), undefined);
  });

  test('a warning, with how long the stores last, once the Garden falls behind', () => {
    const state = guild(6, 3);
    const short = guildUpkeep(state) - gardenYield(state);
    assert.ok(short > 0);
    const days = Math.floor(6 / short);
    assert.match(foodWarning(state)!, new RegExp(`^Food is running short\\. The guild eats ${guildUpkeep(state)} rations a day .* lasts about ${days === 0 ? 'a day' : `${days} more days?`}\\. Hunting runs`));
    state.resources.rations = 500;
    assert.equal(foodWarning(state), undefined, 'no nagging with plenty stored');
  });

  test('when the rations are gone, it says crews can still go out', () => {
    const state = guild(0, 3);
    assert.match(foodWarning(state)!, /^The rations are gone\..*Crews can still go out, hungry\./);
  });

  test('a note at the gate when another person would outgrow the Garden', () => {
    const plenty = guild(0, 0);
    plenty.buildings.garden = 3;
    assert.equal(newMouthNote(plenty), undefined);
    const tight = guild(0, 2);
    assert.ok(gardenYield(tight) < guildUpkeep(tight) + 1);
    assert.match(newMouthNote(tight)!, /^Another person eats at least a ration a day\. The guild already eats \d+, and the Garden grows about [\d.]+\.$/);
  });
});

describe('upkeep on screen', () => {
  test('says what an upper level uses, and warns when the stores run out', () => {
    const state = testGame('upkeep-view');
    state.resources = { scrap: 500, rations: 100, meds: 50, ammo: 50, tech: 50, gas: 0 };
    assert.deepEqual(upkeepLines(state, 'firepit'), {}, 'a level 1 Firepit costs nothing to run');
    build(state, 'firepit', 1);
    assert.deepEqual(upkeepLines(state, 'firepit'), { upkeep: 'Uses 1 ration a day.' });
    for (let i = 0; i < 2; i++) build(state, 'infirmary', 1);
    assert.deepEqual(upkeepLines(state, 'infirmary'), { upkeep: 'Uses a med about every 4 days.' });
    state.resources.meds = 0;
    assert.equal(upkeepLines(state, 'infirmary').unpaid, "Out of meds: it works as level 1 on days it can't be kept going.");
    state.depot.unpaid = ['infirmary'];
    assert.equal(upkeepLines(state, 'infirmary').unpaid, 'Ran out of meds on the last day, so it worked as level 1.');
  });

  test('the note says what the buildings used and which ran short', () => {
    const state = testGame('upkeep-note');
    const s = { ...emptySummary(), days: 2, upkeep: { rations: 2 }, unpaid: ['firepit' as const] };
    build(Object.assign(state, { resources: { ...state.resources, scrap: 99, tech: 9, rations: 99 } }), 'firepit', 1);
    const lines = summaryLines(s, state);
    assert.ok(lines.includes('Keeping the buildings going used 2 rations.'));
    assert.ok(lines.includes('The Bar ran short and worked a level lower.'));
  });
});
