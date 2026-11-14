import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DAY_MS, LOCATIONS, MAX_CREW, amountOf, completeRun, dayAt, dayStart, startRun, type RiskEstimate } from '../engine/index.ts';
import { clockTime } from './time.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import { DEPOT_SPOT, MAP_SPOTS, mapLabel, reachMap } from './reach-map.ts';
import {
  rationsNote,
  backIn,
  changesByPerson,
  checkLine,
  crewOptions,
  defaultPlan,
  formatCountdown,
  formatDuration,
  joinNames,
  latestBeat,
  locationView,
  lootList,
  noticeNumber,
  noticesFor,
  outcomeHeadline,
  outcomeTone,
  reportItems,
  riskText,
  runOfSurvivor,
  runProgress,
  suggestedAmmo,
  toggleCrew,
  splitReports,
  unreadCount,
} from './runs-view.ts';

describe('words and times', () => {
  test('names and durations read naturally', () => {
    assert.equal(joinNames([]), '');
    assert.equal(joinNames(['Mara']), 'Mara');
    assert.equal(joinNames(['Mara', 'Dex']), 'Mara and Dex');
    assert.equal(joinNames(['Mara', 'Dex', 'Ava']), 'Mara, Dex and Ava');
    assert.equal(formatDuration(20_000), 'under a minute');
    assert.equal(formatDuration(35 * 60_000), '35 min');
    assert.equal(formatDuration(60 * 60_000), '1 h');
    assert.equal(formatDuration(100 * 60_000), '1 h 40 min');
    assert.equal(formatCountdown(245_000), '4:05');
    assert.equal(formatCountdown(3_729_000), '1:02:09');
    assert.equal(formatCountdown(-5), '0:00');
  });

  test('risk is told as what happened in trial runs', () => {
    const risk = (downed: number, death: number): RiskEstimate => ({ label: 'Low', downed, death, cutShort: 0, samples: 50 });
    assert.equal(riskText(risk(0, 0)), 'In 50 tries, nobody went down. Nobody died.');
    assert.equal(riskText(risk(0.02, 0.02)), 'In 50 tries, someone went down once. Someone died once.');
    assert.equal(riskText(risk(0.18, 0.04)), 'In 50 tries, someone went down 9 times. Someone died 2 times.');
  });
});

describe('planning', () => {
  test('starts with nobody picked and a medkit worth of meds', () => {
    const state = testGame();
    const plan = defaultPlan(state, 'maple_street');
    assert.deepEqual(plan.crew, []);
    assert.equal(plan.meds, 1);
    assert.equal(plan.retreat, 'downed');
  });

  test('the crew never grows past the limit', () => {
    let crew: string[] = [];
    for (let i = 0; i < MAX_CREW + 2; i++) crew = toggleCrew(crew, `s${i}`);
    assert.equal(crew.length, MAX_CREW);
    assert.deepEqual(toggleCrew(crew, 's0'), crew.slice(1));
  });

  test('crew options list who can go first and say why others cannot', () => {
    const state = openGame();
    const away = startRun(state, testPlan(state, 'rail_yard', {}, 1), T0);
    const options = crewOptions(state);
    const last = options[options.length - 1]!;
    assert.equal(last.survivor.id, away.plan.crew[0]);
    assert.match(last.reason ?? '', /already out on a run/);
    assert.match(options[0]!.stats, /^Grit \d+, Brawn \d+, Aim \d+, Wits \d+, Nerve \d+$/);
  });

  test('someone back from a run today says when they can go again', () => {
    const state = openGame();
    const run = startRun(state, testPlan(state, 'rail_yard', {}, 1), T0);
    completeRun(state, run.id, run.returnAt);
    const s = state.survivors.find((x) => x.id === run.plan.crew[0])!;
    const option = crewOptions(state).find((o) => o.survivor === s)!;
    const at = clockTime(dayStart(state, dayAt(state, T0) + 1));
    assert.equal(option.reason, `${s.firstName} has been out today, and can go again at ${at}.`);
  });

  test('ammo is suggested only for crews with guns', () => {
    const state = openGame();
    const s = state.survivors[0]!;
    s.equipment.weapon = { uid: 'g', defId: 'hunting_rifle', quality: 'common' };
    assert.equal(suggestedAmmo(state, [s.id]), 10);
    s.equipment.weapon = { uid: 'g', defId: 'crossbow', quality: 'common' };
    assert.equal(suggestedAmmo(state, [s.id]), 0);
  });
});

describe('crews out and reports', () => {
  test('progress, latest beat, who is out and the notice for their return', () => {
    const state = openGame('out');
    const run = startRun(state, testPlan(state, 'kessler_farm', {}, 2), T0);
    assert.equal(runProgress(run, T0), 0);
    assert.equal(runProgress(run, run.returnAt + 1), 1);
    assert.equal(latestBeat(run, T0)?.kind, 'depart');
    assert.equal(runOfSurvivor(state, run.plan.crew[0]!)?.id, run.id);
    assert.equal(runOfSurvivor(state, state.survivors[3]!.id), undefined);
    assert.match(backIn(run, T0), /^back in \d+ min$/);
    assert.equal(backIn(run, run.returnAt), 'due back now');

    assert.equal(noticeNumber('r12'), noticeNumber('r12'));
    assert.notEqual(noticeNumber('r12'), noticeNumber('r13'));
    for (const id of ['r1', 'r999999', 'a-very-long-run-id-indeed']) {
      const n = noticeNumber(id);
      assert.ok(Number.isInteger(n) && n > 0 && n < 2 ** 31, `${id} -> ${n}`);
    }
    const [notice] = noticesFor(state);
    assert.equal(notice!.at, run.returnAt);
    assert.match(notice!.title, / and .* are due back$/);
    assert.match(notice!.body, /Kessler Farm/);
    assert.equal(locationView(state, 'kessler_farm').crewsOut.length, 1);
  });

  test('a report becomes a headline, loot and what changed for each person', () => {
    const state = openGame('report');
    const run = startRun(state, testPlan(state, 'drowned_mall'), T0);
    completeRun(state, run.id, run.returnAt);
    const [item] = reportItems(state);
    assert.ok(item);
    assert.equal(unreadCount(state), 1);
    assert.match(item.headline, /Drowned Mall/);
    assert.equal(item.day, 1 + Math.floor((run.returnAt - T0) / DAY_MS));
    const report = item.report;
    const groups = changesByPerson(report);
    assert.ok(groups.length > 0);
    for (const g of groups) assert.ok(report.plan.crew.includes(g.survivorId));
    const loot = lootList(report.summary);
    for (const r of ['scrap', 'rations', 'meds', 'ammo', 'tech'] as const) {
      if (report.summary.loot[r] > 0) assert.ok(loot.includes(amountOf(r, report.summary.loot[r])));
    }
    assert.deepEqual(lootList({ ...report.summary, loot: { scrap: 4, rations: 1, meds: 1, ammo: 0, tech: 0, gas: 0 }, items: [] }), ['4 scrap', '1 ration', '1 med']);
    const check = report.beats.flatMap((b) => b.lines).find((l) => l.check)?.check;
    if (check) assert.match(checkLine(check, { [check.who]: 'Mara' }), /^Mara: \w+ /);
  });

  test('outcomes have headlines and tones', () => {
    assert.equal(outcomeHeadline('completed', 'Maple Street'), 'Back from Maple Street');
    assert.equal(outcomeHeadline('lost', 'The Glow'), 'Lost at The Glow');
    const base = { loot: { scrap: 0, rations: 0, meds: 0, ammo: 0, tech: 0, gas: 0 }, items: [], leftBehind: 0, medsLeft: 0, ammoLeft: 0, exploredGain: 0, discovered: [], deaths: [], highlights: [], events: [] };
    assert.equal(outcomeTone({ ...base, outcome: 'completed' }), 'good');
    assert.equal(outcomeTone({ ...base, outcome: 'turnedBack' }), 'mixed');
    assert.equal(outcomeTone({ ...base, outcome: 'completed', deaths: [{ survivorId: 'a', name: 'A', cause: 'x' }] }), 'bad');
  });
});

describe('Reach map', () => {
  test('every location has a spot inside the map, and no two crowd each other', () => {
    const spots = [DEPOT_SPOT, ...LOCATIONS.map((l) => MAP_SPOTS[l.id])];
    for (const [i, s] of spots.entries()) {
      assert.ok(s, `${LOCATIONS[i - 1]?.id} has no spot`);
      assert.ok(s.x >= 4 && s.x <= 96 && s.y >= 4 && s.y <= 96, `spot ${i} is off the map`);
    }
    for (let i = 0; i < spots.length; i++) {
      for (let j = i + 1; j < spots.length; j++) {
        const d = Math.hypot(spots[i]!.x - spots[j]!.x, spots[i]!.y - spots[j]!.y);
        assert.ok(d >= 14, `spots ${i} and ${j} are ${d.toFixed(1)} apart`);
      }
    }
  });

  test('labels are short', () => {
    assert.deepEqual(mapLabel('The Rail Yard'), ['Rail Yard']);
    assert.deepEqual(mapLabel('The Glow'), ['The Glow']);
    assert.deepEqual(mapLabel('Hilltop Radio Station'), ['Hilltop', 'Radio Station']);
    for (const loc of LOCATIONS) for (const line of mapLabel(loc.name)) assert.ok(line.length <= 14, line);
  });

  test('a new guild sees three places and question marks one step beyond', () => {
    const map = reachMap(testGame());
    const known = map.nodes.filter((n) => n.known).map((n) => n.id).sort();
    assert.deepEqual(known, ['kessler_farm', 'maple_street', 'rail_yard']);
    const unknown = map.nodes.filter((n) => !n.known);
    assert.equal(unknown.length, 6);
    assert.ok(unknown.every((n) => n.label.length === 0), 'unknown places have no name');
    assert.equal(map.roads.filter((r) => r.known).length, 3);
  });
});

test('the planner says what rations go, and what happens when the Depot is short', () => {
  const state = testGame('ration-note');
  for (const s of state.survivors) s.traits = s.traits.filter((t) => t.id !== 'glutton' && t.id !== 'drinker');
  const plan = testPlan(state, 'rail_yard');
  assert.equal(rationsNote(state, { ...plan, crew: [] }), 'Rations are packed for each person automatically.');
  state.resources.rations = 10;
  assert.equal(rationsNote(state, plan), '3 rations packed.');
  assert.equal(rationsNote(state, { ...plan, crew: plan.crew.slice(0, 1) }), '1 ration packed.');
  state.resources.rations = 2;
  assert.equal(rationsNote(state, plan), 'Only 2 of the 3 rations the crew needs: all the Depot has.');
  state.resources.rations = 0;
  assert.equal(rationsNote(state, plan), 'No rations at the Depot. The crew can still go, hungry.');
});

describe('the Runs screen’s report list', () => {
  test('the newest few and anything unread up front, the rest folded', () => {
    const item = (id: string, read: boolean) => ({ id, report: { read } });
    const items = [item('a', true), item('b', false), item('c', true), item('d', true), item('e', false)];
    const { recent, older } = splitReports(items, 2);
    assert.deepEqual(recent.map((i) => i.id), ['a', 'b', 'e']);
    assert.deepEqual(older.map((i) => i.id), ['c', 'd']);
  });
});
