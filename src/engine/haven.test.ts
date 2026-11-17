import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BUILDINGS, FIRST_WEEK, HAVEN_CLUES, HAVEN_DREAMER, HAVEN_HINTS, HAVEN_ROAD, HAVEN_VULTURES, LOCATIONS } from './content/index.ts';
import { DAY_MS, HAVEN_DREAMER_CLUES, HAVEN_DREAMER_GUILD, HAVEN_DREAMER_WAIT, HAVEN_HINT_GAP } from './constants.ts';
import { startRun } from './expedition/runs.ts';
import { becomePartners } from './relationships.ts';
import { advanceTime } from './depot/time.ts';
import { takeIn } from './depot/recruits.ts';
import { simulateRun } from './expedition/sim.ts';
import { dayAt } from './game.ts';
import {
  applyHavenNews,
  clueFound,
  cluesKnown,
  clueWhere,
  clueReady,
  findChance,
  gateHint,
  havenLeads,
  havenNew,
  havenRoadOpen,
  hiddenLeads,
  leadAt,
  getClue,
  playHavenDay,
  pointsLine,
  pointsTo,
  seenHaven,
  startHaven,
  traderHint,
  workOutClue,
} from './haven.ts';
import { ensureLocationState, locationState } from './locations.ts';
import { Rng } from './rng.ts';
import { fillRoles } from './text.ts';
import { deserialize, serialize } from './save.ts';
import { claimStory } from './story.ts';
import { T0, openGame, testGame, testSurvivor } from './test-utils.ts';
import type { GameState, RunPlan } from './types.ts';
import { addWanderer } from './depot/recruits.ts';

/** A guild that has heard the broadcast. */
function heard(seed: string): GameState {
  const state = testGame(seed);
  startHaven(state, 1);
  // Every place on the map, so a lead is never hidden for want of one (that's tested on its own).
  for (const loc of LOCATIONS) ensureLocationState(state, loc.id).discovered = true;
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
    // Aviel: one clue the road needs can only be had by going into the Glow, the danger-5 place.
    const glow = HAVEN_CLUES.filter((c) => c.where.kind === 'run' && LOCATIONS.find((l) => l.id === (c.where as { locationId: string }).locationId)!.danger === 5);
    assert.ok(glow.some((c) => HAVEN_ROAD.includes(c.id)), 'the road goes through the Glow');
  });

  test('every clue can be found: following the leads in turn reaches all of them, and the road', () => {
    const state = heard('all');
    for (let guard = 0; guard < 50 && havenLeads(state).length > 0; guard++) find(state, havenLeads(state)[0]!.id);
    assert.equal(state.haven!.found.length, HAVEN_CLUES.length);
    assert.ok(havenRoadOpen(state));
  });

  test('the leads that start out somewhere unknown are the only places to scout for: every find puts the next place on the map', () => {
    const state = testGame('map');
    startHaven(state, 1);
    const unknown = (c: (typeof HAVEN_CLUES)[number]) => c.where.kind === 'run' && !locationState(state, c.where.locationId).discovered;
    const starting = HAVEN_CLUES.filter((c) => c.after.length === 0 && unknown(c));
    assert.equal(hiddenLeads(state), starting.length);
    // Scouting turns up those places; from there on, nothing needs finding by hand.
    for (const c of starting) if (c.where.kind === 'run') ensureLocationState(state, c.where.locationId).discovered = true;
    assert.equal(hiddenLeads(state), 0);
    const by = state.survivors[0]!;
    for (let guard = 0; guard < 50 && havenLeads(state).length > 0; guard++) {
      const c = havenLeads(state)[0]!;
      if (c.where.kind === 'build') {
        state.buildings[c.where.building] = c.where.level;
        workOutClue(state, c.id, T0 + DAY_MS);
      } else {
        applyHavenNews(state, { lead: { clue: c.id, found: true, by: by.id } }, c.where.locationId, 5);
      }
      assert.equal(hiddenLeads(state), 0, `after ${c.id}`);
    }
    assert.equal(state.haven!.found.length, HAVEN_CLUES.length);
    assert.ok(state.log.some((l) => l.text === 'The engineer’s logbook points the way to the Water Plant. It’s on the map now.'));
  });

  test('a find says where it points on to', () => {
    const state = heard('points');
    assert.equal(pointsLine(state, 'logbook'), 'It points on to the Water Plant.');
    find(state, 'logbook', 'dropped_radio');
    assert.equal(pointsLine(state, 'intake_list'), 'It points on to Red Hand Camp, Blackwater Swamp, deeper in and the Glow.');
    // The gate code needs the convoy band too.
    assert.equal(pointsLine(state, 'convoy_band'), undefined);
    find(state, 'intake_list');
    assert.equal(pointsLine(state, 'convoy_band'), 'It points on to the Water Plant, deeper in.');
    assert.equal(pointsLine(state, 'dropped_radio'), 'It points on to the Radio Tower at level 2.', 'not the list: that one is found');
    assert.equal(pointsLine(state, 'letters'), undefined, 'the letters point nowhere');
    assert.deepEqual(pointsTo('logbook').map((c) => c.id), ['dropped_radio']);
    assert.equal(clueWhere(getClue('convoy_band')), 'the Radio Tower at level 2');
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
    // Only what's on the map (2.9.1): the radio station and the metro wait to be found.
    assert.deepEqual(havenLeads(state).map((c) => c.id), ['kessler_note']);
    assert.equal(hiddenLeads(state), 2);
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
      for (const loc of LOCATIONS) ensureLocationState(without, loc.id).discovered = true;
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

describe('Haven: the one who goes (§9.11)', () => {
  /** A guild of six that has heard it, has known its people a while, and has found `clues` clues. */
  function guild(seed: string, clues = HAVEN_DREAMER_CLUES): GameState {
    const state = openGame(seed);
    state.survivors.push(testSurvivor('extra0', { firstName: 'Wren' }), testSurvivor('extra1', { firstName: 'Ash', pronouns: 'he' }));
    for (const s of state.survivors) s.joinedDay = 0;
    startHaven(state, 1);
    find(state, ...HAVEN_CLUES.slice(0, clues).map((c) => c.id));
    return state;
  }

  /** Ready to go: someone picked, every line about them heard. */
  function ready(state: GameState, index = 0): string {
    const id = state.survivors[index]!.id;
    state.haven!.dreamer = { id, day: 5, ready: 6 };
    return id;
  }

  test('the content: three lines in order, each once, and nothing left unfilled', () => {
    const tiers = HAVEN_DREAMER.lines.map((l) => l.tier);
    assert.deepEqual(tiers, [...tiers].sort((a, b) => a - b));
    assert.equal(tiers[0], HAVEN_DREAMER_CLUES, 'the first comes as soon as they start listening');
    for (const l of HAVEN_DREAMER.lines) assert.ok(!HAVEN_HINTS.some((h) => h.id === l.id), l.id);
    const someone = testSurvivor('d', { firstName: 'Rook', pronouns: 'he' });
    for (const t of [...HAVEN_DREAMER.lines.map((l) => l.text), HAVEN_DREAMER.run, HAVEN_DREAMER.night, HAVEN_DREAMER.title, HAVEN_DREAMER.said, HAVEN_DREAMER.note, HAVEN_DREAMER.learned, HAVEN_DREAMER.saw]) {
      const filled = fillRoles(t, { a: someone });
      assert.doesNotMatch(filled, /[{}]/, t);
    }
  });

  test('nobody listens before the guild knows a little, or while it’s small', () => {
    const early = guild('early', HAVEN_DREAMER_CLUES - 1);
    for (let d = 10; d < 60; d++) playHavenDay(early, d);
    assert.equal(early.haven!.dreamer, undefined);
    const small = guild('small');
    small.survivors.length = HAVEN_DREAMER_GUILD - 1;
    for (let d = 10; d < 60; d++) playHavenDay(small, d);
    assert.equal(small.haven!.dreamer, undefined);
    const now = guild('now');
    playHavenDay(now, 10);
    assert.ok(now.survivors.some((s) => s.id === now.haven!.dreamer?.id));
    assert.equal(cluesKnown(now), HAVEN_DREAMER_CLUES);
  });

  test('never someone new, or with a partner or a child', () => {
    for (let i = 0; i < 20; i++) {
      const state = guild(`who-${i}`);
      const [a, b, c] = state.survivors;
      becomePartners(state, a!, b!, 2);
      for (const s of state.survivors.slice(3)) s.joinedDay = 9; // new on day 10
      playHavenDay(state, 10);
      assert.equal(state.haven!.dreamer?.id, c!.id, 'the only one it can be');
    }
  });

  test('three lines at the fire name them, one at a time and in order; then, kept home, they go in the night', () => {
    let gone = 0;
    for (let i = 0; i < 10; i++) {
      const state = guild(`lines-${i}`, 8);
      let day = 10;
      for (; day < 400 && state.haven!.dreamer?.gone === undefined; day++) playHavenDay(state, day);
      const d = state.haven!.dreamer!;
      const who = state.departed.find((s) => s.id === d.id) ?? state.survivors.find((s) => s.id === d.id)!;
      const lines = state.haven!.heard.filter((h) => h.id.startsWith('dreamer_'));
      assert.deepEqual(lines.map((h) => h.id), HAVEN_DREAMER.lines.map((l) => l.id));
      for (const h of lines) {
        assert.equal(h.source, 'fire');
        assert.ok(h.text.includes(who.firstName), h.text);
      }
      for (let j = 1; j < state.haven!.heard.length; j++) assert.ok(state.haven!.heard[j]!.day - state.haven!.heard[j - 1]!.day >= HAVEN_HINT_GAP, 'they keep the hints’ gap');
      assert.equal(d.ready, lines.at(-1)!.day);
      if (d.gone === undefined) continue;
      gone++;
      assert.ok(d.gone - d.ready! >= HAVEN_DREAMER_WAIT);
      assert.ok(!state.survivors.includes(who) && who.status === 'left');
      assert.equal(who.leftReason, HAVEN_DREAMER.reason);
      assert.deepEqual(state.haven!.found.at(-1), { id: HAVEN_DREAMER.id, day: d.gone });
      assert.ok(state.log.some((l) => l.text.startsWith(`In the night, ${who.firstName} slipped away`)));
      assert.equal(cluesKnown(state), 8, 'a goodbye isn’t a clue');
    }
    assert.equal(gone, 10);
  });

  test('the lines wait for what the guild knows', () => {
    const state = guild('wait');
    for (let d = 10; d < 300; d++) playHavenDay(state, d);
    const lines = state.haven!.heard.filter((h) => h.id.startsWith('dreamer_')).map((h) => h.id);
    assert.deepEqual(lines, ['dreamer_radio']);
    assert.equal(state.haven!.dreamer!.ready, undefined);
    // Once the road is open, they don't wait for the rest.
    find(state, ...HAVEN_ROAD);
    playHavenDay(state, 300);
    assert.equal(state.haven!.dreamer!.ready, 300);
  });

  test('ready, on a run with someone else, they walk off east on the way home; the rest of the run comes out the same', () => {
    let ran = 0;
    for (let i = 0; i < 30; i++) {
      const withIt = guild(`walk-${i}`);
      const without = guild(`walk-${i}`);
      const id = ready(withIt);
      const a = simulateRun(withIt, plan(withIt, 'maple_street'), `w-${i}`, T0 + DAY_MS);
      const b = simulateRun(without, plan(without, 'maple_street'), `w-${i}`, T0 + DAY_MS);
      assert.deepEqual(a.beats.filter((x) => x.title !== 'The highway east'), b.beats);
      assert.deepEqual(a.result.loot, b.result.loot);
      assert.equal(a.returnAt, b.returnAt);
      const left = a.result.haven?.ran;
      if (!left) continue;
      ran++;
      assert.equal(left.id, id);
      // Those on their feet see them go (someone knocked down doesn't).
      assert.ok(left.saw.length >= 1 && !left.saw.includes(id) && left.saw.every((x) => plan(withIt, 'maple_street').crew.includes(x)));
      const beat = a.beats.find((x) => x.title === 'The highway east')!;
      assert.match(beat.lines[0]!.text, new RegExp(`^Where the old highway turns east, ${withIt.survivors[0]!.firstName} stops`));
    }
    assert.ok(ran >= 25, `${ran} of 30`);
  });

  test('alone, they don’t go: there’s nobody to see it', () => {
    for (let i = 0; i < 20; i++) {
      const state = guild(`solo-${i}`);
      ready(state);
      const sim = simulateRun(state, { ...plan(state, 'maple_street'), crew: [state.survivors[0]!.id] }, `so-${i}`, T0 + DAY_MS);
      assert.equal(sim.result.haven?.ran, undefined);
    }
  });

  test('home again, they’ve left the guild with what they carried, the goodbye is filed, and the crew remembers it', () => {
    let checked = 0;
    for (let i = 0; i < 10 && checked < 3; i++) {
      const state = guild(`home-${i}`);
      const id = ready(state);
      const run = startRun(state, plan(state, 'maple_street'), T0 + 1000);
      advanceTime(state, run.returnAt + 1000);
      const news = state.reports[0]!.summary.haven?.ran;
      if (!news) continue;
      checked++;
      const who = state.departed.find((s) => s.id === id)!;
      assert.ok(who && !state.survivors.some((s) => s.id === id));
      assert.equal(who.chronicle.at(-1)!.text, HAVEN_DREAMER.reason);
      const day = state.haven!.dreamer!.gone!;
      assert.deepEqual(state.haven!.found.at(-1), { id: HAVEN_DREAMER.id, day, at: 'maple_street' });
      for (const o of news.saw) assert.ok(state.survivors.find((s) => s.id === o)!.chronicle.some((c) => c.text === `Watched ${who.firstName} walk east to Haven, and couldn’t stop ${who.pronouns === 'he' ? 'him' : 'her'}.`));
      // Gone means gone: nothing more about them.
      const heard = state.haven!.heard.length;
      for (let d = day + 1; d < day + 40; d++) playHavenDay(state, d);
      assert.ok(!state.haven!.heard.slice(heard).some((h) => h.id.startsWith('dreamer_')));
      assert.equal(state.haven!.dreamer!.id, id);
    }
    assert.equal(checked, 3);
  });

  test('if they die first, it may get hold of someone else', () => {
    const state = guild('died');
    playHavenDay(state, 10);
    const first = state.haven!.dreamer!.id;
    const s = state.survivors.find((x) => x.id === first)!;
    state.survivors.splice(state.survivors.indexOf(s), 1);
    s.status = 'dead';
    state.memorial.push(s);
    playHavenDay(state, 11);
    assert.ok(state.haven!.dreamer && state.haven!.dreamer.id !== first);
  });

  test('it all survives a save', () => {
    const state = guild('save', 8);
    for (let d = 10; d < 400 && state.haven!.dreamer?.gone === undefined; d++) playHavenDay(state, d);
    assert.deepEqual(deserialize(serialize(state)).haven, state.haven);
  });
});
