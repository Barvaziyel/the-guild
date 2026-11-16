import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BUILDINGS, FIRST_WEEK, HAVEN_CLUES, HAVEN_HINTS, HAVEN_ROAD, HAVEN_VULTURES, LOCATIONS } from './content/index.ts';
import { DAY_MS, HAVEN_HINT_GAP } from './constants.ts';
import { advanceTime } from './depot/time.ts';
import { takeIn } from './depot/recruits.ts';
import { simulateRun } from './expedition/sim.ts';
import { dayAt } from './game.ts';
import {
  applyHavenNews,
  clueFound,
  clueReady,
  findChance,
  gateHint,
  havenLeads,
  havenNew,
  havenRoadOpen,
  leadAt,
  playHavenDay,
  seenHaven,
  startHaven,
  traderHint,
  workOutClue,
} from './haven.ts';
import { Rng } from './rng.ts';
import { deserialize, serialize } from './save.ts';
import { claimStory } from './story.ts';
import { T0, testGame } from './test-utils.ts';
import type { GameState, RunPlan } from './types.ts';
import { addWanderer } from './depot/recruits.ts';

/** A guild that has heard the broadcast. */
function heard(seed: string): GameState {
  const state = testGame(seed);
  startHaven(state, 1);
  return state;
}

/** Found, the way a run or a building would file it. */
function find(state: GameState, ...ids: string[]): void {
  for (const id of ids) state.haven!.found.push({ id, day: 1 });
}

function plan(state: GameState, locationId: string, job: RunPlan['job'] = 'scavenge', depth?: number): RunPlan {
  return {
    locationId,
    crew: state.survivors.slice(0, 3).map((s) => s.id),
    job,
    meds: 2,
    ammo: 6,
    approach: 'balanced',
    retreat: 'downed',
    ...(depth ? { depth } : {}),
  };
}

describe('Haven: the content (§9.11)', () => {
  test('every clue is written out, follows on from real clues, and points at a real place or building', () => {
    const ids = new Set(HAVEN_CLUES.map((c) => c.id));
    assert.equal(ids.size, HAVEN_CLUES.length);
    for (const c of HAVEN_CLUES) {
      assert.ok(c.title && c.lead && c.text && c.learned, c.id);
      for (const a of c.after) assert.ok(ids.has(a), `${c.id} follows ${a}`);
      if (c.where.kind === 'run') {
        const w = c.where;
        assert.ok(LOCATIONS.some((l) => l.id === w.locationId), c.id);
        assert.match(c.find ?? '', /\{a\.first\}/, `${c.id}: the run line names who finds it`);
      } else {
        const w = c.where;
        assert.ok(BUILDINGS.some((b) => b.id === w.building && b.levels.length >= w.level), c.id);
        assert.ok(w.action, c.id);
      }
    }
    for (const id of [...HAVEN_ROAD, ...HAVEN_VULTURES.after]) assert.ok(ids.has(id), id);
    assert.ok(HAVEN_CLUES.some((c) => c.where.kind === 'build'), 'some clues are buildings (Aviel)');
    assert.ok(HAVEN_CLUES.filter((c) => c.where.kind === 'run').length >= 8, 'most are found on runs');
  });

  test('every clue can be found: following the leads in turn reaches all of them, and the road', () => {
    const state = heard('all');
    for (let guard = 0; guard < 50 && havenLeads(state).length > 0; guard++) find(state, havenLeads(state)[0]!.id);
    assert.equal(state.haven!.found.length, HAVEN_CLUES.length);
    assert.ok(havenRoadOpen(state));
  });

  test('every hint can be heard, and only names someone when it comes through someone', () => {
    const ids = new Set(HAVEN_HINTS.map((h) => h.id));
    assert.equal(ids.size, HAVEN_HINTS.length);
    for (const h of HAVEN_HINTS) {
      assert.ok(h.tier <= HAVEN_CLUES.length, h.id);
      if (h.needs) assert.ok(HAVEN_CLUES.some((c) => c.id === h.needs), h.id);
      const named = /\{a\.\w+\}/.test(h.text);
      if (h.from === 'trader' || h.from === 'radio' || h.from === 'vultures') assert.ok(!named, `${h.id} has nobody to name`);
      if (h.from === 'gate' || h.from === 'captive') assert.ok(named, `${h.id} names who it came from`);
      for (const m of h.text.matchAll(/\{(\w+)\.(\w+)\}/g)) assert.equal(m[1], 'a', h.id);
    }
    for (const from of ['run', 'gate', 'trader', 'radio', 'fire', 'captive', 'vultures'] as const) {
      assert.ok(HAVEN_HINTS.some((h) => h.from === from && h.tier === 0) || from === 'captive' || from === 'vultures', `${from} has an early hint`);
    }
    // Common enough to keep it interesting (Aviel): dozens, from all over.
    assert.ok(HAVEN_HINTS.length >= 35);
  });
});

describe('Haven: hearing of it', () => {
  test('the first week ends with the broadcast, and the Haven file starts there', () => {
    const state = testGame('week');
    state.story = { step: FIRST_WEEK.length - 1, base: { runs: 0, at: {} } };
    state.buildings.radio_tower = 1;
    assert.equal(state.haven, undefined);
    claimStory(state, T0 + DAY_MS);
    assert.ok(state.haven);
    assert.deepEqual(havenLeads(state).map((c) => c.id), ['logbook', 'flyer', 'kessler_note']);
  });

  test('a guild without the first week hears it on a Depot day once it has a Radio Tower', () => {
    const state = testGame('no-week');
    delete state.story;
    playHavenDay(state, 2);
    assert.equal(state.haven, undefined, 'no tower, nothing');
    state.buildings.radio_tower = 1;
    playHavenDay(state, 3);
    assert.equal((state as GameState).haven?.day, 3);
    assert.ok(state.log.some((l) => /This is Haven/.test(l.text)));
  });

  test('a guild still in its first week waits for its last step', () => {
    const state = testGame('mid-week');
    state.buildings.radio_tower = 1;
    playHavenDay(state, 2);
    assert.equal(state.haven, undefined);
  });

  test('an older save past its first week has heard it; one in the middle of it hasn’t', () => {
    const done = testGame('save-done');
    done.story = { step: FIRST_WEEK.length, base: { runs: 0, at: {} } };
    const mid = testGame('save-mid');
    for (const state of [done, mid]) {
      const old = JSON.parse(serialize(state));
      old.version = 25;
      delete old.haven;
      state.haven = deserialize(JSON.stringify(old)).haven;
    }
    assert.ok(done.haven);
    assert.equal(mid.haven, undefined);
  });
});

describe('Haven: clues', () => {
  test('a lead opens once what it follows on from is found', () => {
    const state = heard('leads');
    assert.ok(!havenLeads(state).some((c) => c.id === 'letters'));
    find(state, 'kessler_note');
    assert.ok(havenLeads(state).some((c) => c.id === 'letters'));
    assert.equal(leadAt(state, 'maple_street', 1)?.id, 'letters');
    assert.equal(leadAt(state, 'rail_yard', 1), undefined);
  });

  test('a lead deeper in is followed only that deep', () => {
    const state = heard('deep');
    find(state, 'logbook', 'dropped_radio', 'intake_list');
    assert.equal(leadAt(state, 'blackwater', 1), undefined);
    assert.equal(leadAt(state, 'blackwater', 2)?.id, 'truck_map');
    assert.equal(leadAt(state, 'blackwater', 3)?.id, 'truck_map');
  });

  test('a run there finds it more often with each try, and scouting finds it sooner', () => {
    assert.ok(findChance(0, false) < findChance(0, true));
    assert.ok(findChance(0, false) < findChance(1, false));
    assert.equal(findChance(5, false), 1);
  });

  test('crews at a lead’s place find it now and then; one that does names who found it, and it goes in the file', () => {
    let found = 0;
    let tried = 0;
    const N = 120;
    for (let i = 0; i < N; i++) {
      const state = heard(`run-${i}`);
      state.haven!.lastHint = 1; // no hints, so only the lead counts
      const sim = simulateRun(state, plan(state, 'radio_station'), `rs-${i}`, T0 + DAY_MS);
      const news = sim.result.haven;
      if (sim.result.outcome !== 'completed') {
        assert.equal(news?.lead, undefined, 'only a crew that made it there looks');
        continue;
      }
      assert.equal(news?.lead?.clue, 'logbook');
      if (news!.lead!.found) {
        found++;
        assert.ok(sim.beats.some((b) => b.title === 'For Haven' && /logbook/.test(b.lines[0]!.text)));
        applyHavenNews(state, news, 'radio_station', 3);
        assert.ok(clueFound(state, 'logbook'));
        assert.ok(state.haven!.found[0]!.by && state.haven!.found[0]!.at === 'radio_station');
        assert.ok(state.log.some((l) => /^For Haven: .+ found the engineer’s logbook at Hilltop Radio Station\.$/.test(l.text)));
      } else {
        tried++;
        applyHavenNews(state, news, 'radio_station', 3);
        assert.equal(state.haven!.tries.logbook, 1);
      }
    }
    const share = found / (found + tried);
    assert.ok(share > 0.25 && share < 0.55, `found ${found} of ${found + tried}`);
  });

  test('a building clue is worked out from the file once the building is up', () => {
    const state = heard('build');
    const band = HAVEN_CLUES.find((c) => c.id === 'convoy_band')!;
    assert.throws(() => workOutClue(state, 'convoy_band', T0), /nothing to work out/);
    find(state, 'logbook', 'dropped_radio');
    state.buildings.radio_tower = 1;
    assert.equal(clueReady(state, band), false);
    assert.throws(() => workOutClue(state, 'convoy_band', T0), /isn’t up/);
    state.buildings.radio_tower = 2;
    assert.ok(clueReady(state, band));
    workOutClue(state, 'convoy_band', T0);
    assert.ok(clueFound(state, 'convoy_band'));
  });

  test('Haven’s rolls have their own dice: a run comes out the same with the file or without, but for what it turned up', () => {
    for (let i = 0; i < 30; i++) {
      const without = testGame(`same-${i}`);
      const withIt = heard(`same-${i}`);
      const a = simulateRun(without, plan(without, 'radio_station'), `s-${i}`, T0 + DAY_MS);
      const b = simulateRun(withIt, plan(withIt, 'radio_station'), `s-${i}`, T0 + DAY_MS);
      const strip = (beats: typeof a.beats) => beats.filter((x) => x.title !== 'For Haven' && x.title !== 'On the road');
      assert.deepEqual(strip(b.beats), strip(a.beats));
      assert.deepEqual(b.result.loot, a.result.loot);
      assert.equal(b.returnAt, a.returnAt);
      assert.equal(a.result.haven, undefined);
    }
  });

  test('a crew sent before the broadcast turns up nothing about Haven, and nothing breaks', () => {
    const state = testGame('before');
    const sim = simulateRun(state, plan(state, 'radio_station'), 'b', T0 + DAY_MS);
    applyHavenNews(state, sim.result.haven, 'radio_station', 2);
    assert.equal(state.haven, undefined);
  });
});

describe('Haven: hints', () => {
  test('on Depot days, hints come now and then, never closer together than the gap, and darken only as clues are found', () => {
    const state = heard('days');
    state.buildings.radio_tower = 1;
    for (let day = 2; day < 200; day++) playHavenDay(state, day);
    // Nothing found yet: only the first hints, and the Depot's are the radio's and the fire's.
    const early = HAVEN_HINTS.filter((h) => h.tier === 0 && (h.from === 'radio' || h.from === 'fire'));
    assert.deepEqual(state.haven!.heard.map((h) => h.id).sort(), early.map((h) => h.id).sort());
    // More found, more to hear.
    find(state, 'logbook', 'flyer', 'kessler_note', 'letters', 'dropped_radio');
    state.vultures.arrived = true;
    state.haven!.found.push({ id: HAVEN_VULTURES.id, day: 1 }); // so the Vultures' word doesn't take a day
    for (let day = 200; day < 500; day++) playHavenDay(state, day);
    const heardList = state.haven!.heard;
    assert.ok(heardList.length >= 8, `heard ${heardList.length}`);
    for (let i = 1; i < heardList.length; i++) assert.ok(heardList[i]!.day - heardList[i - 1]!.day >= HAVEN_HINT_GAP);
    assert.ok(heardList.every((h) => HAVEN_HINTS.find((x) => x.id === h.id)!.tier <= 5), 'no darker than five clues allow');
    assert.ok(heardList.every((h) => !/\{/.test(h.text)), 'names filled in');
    assert.ok(state.log.some((l) => l.tags?.includes('haven') && l.text === heardList[0]!.text), 'in the news');
  });

  test('the radio needs a Radio Tower, and a hint that needs a clue waits for it', () => {
    const state = heard('radio');
    for (let day = 2; day < 400; day++) playHavenDay(state, day);
    assert.ok(!state.haven!.heard.some((h) => h.source === 'radio'));
    const later = heard('radio-2');
    later.buildings.radio_tower = 1;
    find(later, 'logbook', 'flyer', 'kessler_note', 'letters');
    for (let day = 2; day < 600; day++) playHavenDay(later, day);
    assert.ok(!later.haven!.heard.some((h) => h.id === 'not_fit'), 'the convoy band needs the dropped radio');
  });

  test('newcomers and traders bring hints sometimes', () => {
    let gate = 0;
    let trader = 0;
    for (let i = 0; i < 60; i++) {
      const state = heard(`talk-${i}`);
      const c = addWanderer(state, 2, new Rng(`w-${i}`));
      if (gateHint(state, c.survivor, 5)) gate++;
      const other = heard(`trade-${i}`);
      if (traderHint(other, 5)) trader++;
    }
    assert.ok(gate > 20 && gate < 55, `gate ${gate}`);
    assert.ok(trader > 20 && trader < 55, `trader ${trader}`);
  });

  test('taking someone in can bring one, filled in with their name', () => {
    for (let i = 0; i < 40; i++) {
      const state = heard(`in-${i}`);
      state.buildings.bunks = 3;
      const c = addWanderer(state, 2, new Rng(`in-${i}`));
      takeIn(state, c.survivor.id, new Rng(`take-${i}`), 4);
      const h = state.haven!.heard[0];
      if (!h) continue;
      assert.equal(h.source, 'gate');
      assert.ok(h.text.includes(c.survivor.firstName), h.text);
      return;
    }
    assert.fail('no newcomer said anything');
  });

  test('the Vultures come about the list once it’s found and they’re in the Reach', () => {
    const state = heard('vultures');
    find(state, 'logbook', 'dropped_radio', 'intake_list');
    for (let day = 2; day < 30; day++) playHavenDay(state, day);
    assert.ok(!clueFound(state, HAVEN_VULTURES.id), 'not before they arrive');
    state.vultures.arrived = true;
    for (let day = 30; day < 60; day++) playHavenDay(state, day);
    assert.ok(clueFound(state, HAVEN_VULTURES.id));
    assert.ok(state.log.some((l) => l.text === HAVEN_VULTURES.text));
  });

  test('what’s new since the player last looked', () => {
    const state = heard('new');
    find(state, 'logbook');
    state.haven!.heard.push({ id: 'chalk', day: 2, text: 'x', source: 'run' });
    assert.equal(havenNew(state), 2);
    seenHaven(state);
    assert.equal(havenNew(state), 0);
  });
});

describe('Haven: in play', () => {
  test('a guild that has heard it hears more as the days go by', () => {
    const state = heard('play');
    state.buildings.radio_tower = 1;
    // A day at a time: a long absence only plays the last few.
    for (let d = 1; d <= 60; d++) advanceTime(state, T0 + d * DAY_MS);
    assert.ok(dayAt(state, T0 + 60 * DAY_MS) > 60);
    assert.ok(state.haven!.heard.length > 0, 'the radio or the fire');
  });
});
