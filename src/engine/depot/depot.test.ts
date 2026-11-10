import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BUNKS_CAP,
  DAY_MS,
  FIREPIT_RELIEF,
  HUNGER_STRESS,
  MAX_CATCHUP_DAYS,
  SAVE_VERSION,
  TRAINING_PRACTICE,
} from '../constants.ts';
import { BUILDINGS, RECIPES, getGear } from '../content/index.ts';
import { startRun } from '../expedition/runs.ts';
import { dayAt } from '../game.ts';
import { relationshipScore } from '../relationships.ts';
import { Rng } from '../rng.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testGame, testPlan } from '../test-utils.ts';
import { addTrait, hasTrait } from '../traits.ts';
import type { GameState } from '../types.ts';
import { BUILDING_IDS } from '../types.ts';
import {
  assignPost,
  build,
  buildProblem,
  buildingLevel,
  buildingName,
  bunksCap,
  postText,
  postedTo,
  workerSlots,
} from './buildings.ts';
import { dailyUpkeep, emptySummary, gardenYield, playDepotDay } from './day.ts';
import { acceptOffer, declineOffer, offerProblem, rollDepotEvents } from './events.ts';
import { boardSize, recruitProblem, refreshRecruits, takeIn } from './recruits.ts';
import { advanceTime, dayStart, nextDayAt } from './time.ts';
import { craft, craftProblem, upgradeItem, upgradeProblem } from './workshop.ts';

const rich = (state: GameState): void => {
  state.resources = { scrap: 500, rations: 500, meds: 50, ammo: 50, tech: 100 };
};

describe('a new Depot', () => {
  test('starts with Bunks, Garden and Firepit, and posts that feed the guild', () => {
    const state = testGame();
    for (const id of BUILDING_IDS) assert.equal(buildingLevel(state, id), id === 'bunks' || id === 'garden' || id === 'firepit' ? 1 : 0, id);
    assert.equal(postedTo(state, 'garden').length, 2);
    assert.equal(postedTo(state, 'firepit').length, 1);
    assert.equal(state.depot.lastDay, 1);
    assert.ok(gardenYield(state) >= dailyUpkeep(state), 'the Garden keeps up with a guild at home');
  });

  test('building effect text matches the numbers', () => {
    const text = (id: string, level: number): string => BUILDINGS.find((b) => b.id === id)!.levels[level - 1]!.effect;
    for (const level of [1, 2, 3]) assert.match(text('bunks', level), new RegExp(`${BUNKS_CAP[level]}`));
    for (const level of [1, 2, 3]) assert.match(text('firepit', level), new RegExp(`${FIREPIT_RELIEF[level]} more stress`));
    for (const level of [1, 2, 3]) assert.match(text('training_yard', level), new RegExp(`${TRAINING_PRACTICE[level]} practice`));
  });

  test('every recipe makes real gear', () => {
    for (const r of RECIPES) assert.ok(getGear(r.gear), r.gear);
  });
});

describe('building', () => {
  test('costs resources, raises the level and can rename the building', () => {
    const state = testGame();
    state.resources.scrap = 100;
    state.resources.tech = 10;
    assert.equal(buildingName(state, 'firepit'), 'Firepit');
    build(state, 'firepit', 3);
    assert.equal(buildingLevel(state, 'firepit'), 2);
    assert.equal(buildingName(state, 'firepit'), 'Bar');
    assert.equal(state.resources.scrap, 70);
    assert.equal(state.resources.tech, 8);
    assert.match(state.log[state.log.length - 1]!.text, /Bar is now level 2/);
  });

  test('refuses what the guild cannot afford and what is already at the top', () => {
    const state = testGame();
    state.resources.scrap = 0;
    assert.match(buildProblem(state, 'infirmary') ?? '', /Needs 25 scrap, 2 tech/);
    assert.throws(() => build(state, 'infirmary', 1));
    rich(state);
    build(state, 'bunks', 1);
    build(state, 'bunks', 1);
    assert.equal(bunksCap(state), 12);
    assert.match(buildProblem(state, 'bunks') ?? '', /as good as it gets/);
  });
});

describe('posts', () => {
  test('need a built building with room', () => {
    const state = testGame();
    const [a, b, c, d] = state.survivors;
    assert.throws(() => assignPost(state, a!.id, { building: 'infirmary' }), /isn't built/);
    assert.throws(() => assignPost(state, a!.id, { building: 'bunks' }), /Nobody works/);
    // The Garden is full with two; moving someone else in needs a free slot.
    const free = [a, b, c, d].find((s) => s!.post?.building !== 'garden')!;
    assert.throws(() => assignPost(state, free.id, { building: 'garden' }), /no room/);
    const gardener = postedTo(state, 'garden')[0]!;
    assignPost(state, gardener.id, undefined);
    assignPost(state, free.id, { building: 'garden' });
    assert.equal(postText(state, free), 'Works the Garden');
    assert.equal(postText(state, gardener), 'No post');
  });

  test('the Training Yard trains a chosen stat, the weakest by default', () => {
    const state = testGame();
    rich(state);
    build(state, 'training_yard', 1);
    const s = state.survivors.find((x) => !x.post)!;
    assignPost(state, s.id, { building: 'training_yard' });
    assert.ok(s.post?.stat);
    assignPost(state, s.id, { building: 'training_yard', stat: 'aim' });
    assert.equal(postText(state, s), 'Trains Aim in the Training Yard');
    const before = s.practice.aim + s.stats.aim * 100;
    playDepotDay(state, 2, new Rng('train'), emptySummary());
    assert.ok(s.practice.aim + s.stats.aim * 100 > before, 'practiced Aim');
    assert.equal(workerSlots(state, 'training_yard'), 2);
  });
});

describe('a Depot day', () => {
  test('people eat, heal, rest and practice at their posts', () => {
    const state = testGame();
    const s = state.survivors[0]!;
    s.hp = 1;
    s.stress = 50;
    const gardener = postedTo(state, 'garden')[0]!;
    const practiceBefore = gardener.practice.wits + gardener.stats.wits * 100;
    const rationsBefore = state.resources.rations;
    const summary = emptySummary();
    playDepotDay(state, 2, new Rng('day'), summary);

    assert.ok(s.hp > 1);
    assert.ok(s.stress < 50);
    assert.ok(gardener.practice.wits + gardener.stats.wits * 100 > practiceBefore);
    assert.equal(state.resources.rations, rationsBefore + summary.grown - summary.eaten);
    assert.equal(summary.eaten, dailyUpkeep(state));
    assert.ok(state.survivors.every((x) => x.counters.daysAtDepot === 1));
  });

  test('going hungry adds stress instead of rest, and the log says when it starts and ends', () => {
    const state = testGame();
    for (const s of state.survivors) delete s.post;
    state.resources.rations = 0;
    const s = state.survivors[0]!;
    s.stress = 20;
    playDepotDay(state, 2, new Rng('hungry'), emptySummary());
    assert.ok(s.stress > 20 && s.stress <= 20 + HUNGER_STRESS);
    assert.equal(state.depot.hungry, true);
    assert.match(state.log[state.log.length - 1]!.text, /rations ran out/);
    state.resources.rations = 100;
    playDepotDay(state, 3, new Rng('fed'), emptySummary());
    assert.equal(state.depot.hungry, undefined);
    assert.match(state.log[state.log.length - 1]!.text, /food on the table/);
  });

  test('conditions wear off, and a staffed Infirmary treats fever with meds', () => {
    const state = testGame();
    rich(state);
    build(state, 'infirmary', 1);
    const medic = state.survivors.find((x) => !x.post)!;
    assignPost(state, medic.id, { building: 'infirmary' });
    const [a, b] = state.survivors.filter((x) => x !== medic);
    addTrait(a!, 'wounded', { day: 1, rng: new Rng('w') });
    a!.traits.find((t) => t.id === 'wounded')!.expiresDay = 3;
    addTrait(b!, 'feverish', { day: 1, rng: new Rng('f') });
    const meds = state.resources.meds;

    playDepotDay(state, 2, new Rng('care'), emptySummary());
    assert.equal(hasTrait(b!, 'feverish'), false, 'treated');
    assert.equal(state.resources.meds, meds - 1);
    playDepotDay(state, 3, new Rng('care2'), emptySummary());
    assert.equal(hasTrait(a!, 'wounded'), false, 'healed');
  });

  test('people who are out on a run neither eat nor work at home', () => {
    const state = openGame();
    const run = startRun(state, testPlan(state, 'kessler_farm', {}, 3), T0);
    const home = state.survivors.filter((s) => !run.plan.crew.includes(s.id));
    assert.equal(dailyUpkeep(state), home.length);
    playDepotDay(state, 2, new Rng('away'), emptySummary());
    for (const s of state.survivors) assert.equal(s.counters.daysAtDepot, run.plan.crew.includes(s.id) ? 0 : 1);
  });
});

describe('time', () => {
  test('each day is played once, at most a week at a time', () => {
    const state = testGame();
    assert.equal(advanceTime(state, T0 + 1000).depot.days, 0, 'still day 1');
    assert.equal(advanceTime(state, T0 + 3 * DAY_MS).depot.days, 3);
    assert.equal(advanceTime(state, T0 + 3 * DAY_MS + 10).depot.days, 0);
    const long = advanceTime(state, T0 + 40 * DAY_MS);
    assert.equal(long.depot.days, MAX_CATCHUP_DAYS);
    assert.equal(long.skippedDays, 41 - 4 - MAX_CATCHUP_DAYS);
    assert.equal(state.depot.lastDay, 41);
    assert.equal(nextDayAt(state, T0 + 40 * DAY_MS + 5), dayStart(state, 42));
  });

  test('crews come home before the day they were back for, and the log gathers the news', () => {
    const state = openGame('crew-day');
    const run = startRun(state, testPlan(state, 'rail_yard', {}, 2), T0);
    const result = advanceTime(state, T0 + 3 * DAY_MS);
    assert.deepEqual(result.reports.map((r) => r.id), [run.id]);
    for (const id of run.plan.crew) {
      const s = state.survivors.find((x) => x.id === id);
      if (s) assert.ok(s.counters.daysAtDepot >= 2, 'home for the days after');
    }
    assert.ok(result.depot.news.some((n) => n.text.includes('returned from')));
  });

  test('is deterministic and survives a save', () => {
    const a = testGame('same');
    const b = testGame('same');
    advanceTime(a, T0 + 6 * DAY_MS);
    advanceTime(b, T0 + 6 * DAY_MS);
    assert.deepEqual(a, b);
    assert.deepEqual(deserialize(serialize(a)), a);
  });
});

describe('recruits', () => {
  test('a fresh board each day, more with a Radio Tower; wanderers wait a few days', () => {
    const state = testGame();
    const rng = new Rng('board');
    refreshRecruits(state, 2, rng);
    assert.equal(state.depot.recruits.length, boardSize(state));
    const firstIds = state.depot.recruits.map((c) => c.survivor.id);
    refreshRecruits(state, 3, rng);
    assert.ok(state.depot.recruits.every((c) => !firstIds.includes(c.survivor.id)), 'yesterday’s recruits moved on');
    rich(state);
    build(state, 'radio_tower', 3);
    refreshRecruits(state, 4, rng);
    assert.equal(state.depot.recruits.length, 3);
  });

  test('taking someone in needs a free bed and makes them part of the guild', () => {
    const state = testGame();
    refreshRecruits(state, 2, new Rng('gate'));
    const c = state.depot.recruits[0]!;
    assert.match(recruitProblem(state, c.survivor.id) ?? '', /beds are taken/);
    rich(state);
    build(state, 'bunks', 2);
    const s = takeIn(state, c.survivor.id, new Rng('in'), 2);
    assert.ok(state.survivors.includes(s));
    assert.ok(!state.depot.recruits.some((x) => x.survivor.id === s.id));
    assert.equal(s.joinedDay, 2);
    assert.match(s.chronicle[s.chronicle.length - 1]!.text, /joined the guild/);
    for (const other of state.survivors) if (other !== s) assert.equal(typeof relationshipScore(state, s.id, other.id), 'number');
    assert.match(recruitProblem(state, s.id) ?? '', /moved on/);
  });
});

describe('the Workshop', () => {
  test('makes gear by level and cost, and improves it a step at a time', () => {
    const state = testGame();
    assert.match(craftProblem(state, 'machete') ?? '', /Build the Workshop/);
    rich(state);
    build(state, 'workshop', 1);
    assert.match(craftProblem(state, 'hunting_rifle') ?? '', /level 2/);
    assert.match(craftProblem(state, 'lucky_coin') ?? '', /can't make/);
    const scrap = state.resources.scrap;
    const machete = craft(state, 'machete', 2);
    assert.equal(machete.quality, 'common');
    assert.equal(state.resources.scrap, scrap - 8);
    assert.ok(state.stash.includes(machete));

    upgradeItem(state, machete.uid, 2);
    assert.equal(machete.quality, 'solid');
    assert.match(upgradeProblem(state, machete.uid) ?? '', /level 2/);
    build(state, 'workshop', 2);
    upgradeItem(state, machete.uid, 2);
    assert.equal(machete.quality, 'prime');
    assert.match(upgradeProblem(state, machete.uid) ?? '', /can't be improved/);
    build(state, 'workshop', 2);
    assert.equal(craft(state, 'pipe', 2).quality, 'solid', 'a level 3 Workshop makes Solid gear');
  });

  test('only weapons and armor can be improved, since quality does nothing for the rest', () => {
    const state = testGame();
    rich(state);
    build(state, 'workshop', 1);
    const crowbar = craft(state, 'crowbar', 2);
    assert.match(upgradeProblem(state, crowbar.uid) ?? '', /can't be improved/);
  });

  test('can improve what someone at the Depot is carrying', () => {
    const state = testGame();
    rich(state);
    build(state, 'workshop', 1);
    const s = state.survivors[0]!;
    const weapon = s.equipment.weapon!;
    weapon.quality = 'rusty';
    upgradeItem(state, weapon.uid, 2);
    assert.equal(s.equipment.weapon!.quality, 'common');
  });
});

describe('Depot events', () => {
  test('every kind of event happens, and nobody dies at the Depot', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400 && seen.size < 6; i++) {
      const state = testGame(`events-${i}`);
      const count = state.survivors.length;
      for (let d = 2; d < 12; d++) for (const k of rollDepotEvents(state, d, new Rng(`ev-${i}-${d}`))) seen.add(k);
      assert.equal(state.survivors.length, count);
      assert.ok(state.survivors.every((s) => s.status === 'ready'));
    }
    assert.deepEqual([...seen].sort(), ['celebration', 'raid', 'sickness', 'stray', 'trader', 'wanderer']);
  });

  test('feuding survivors at home come to blows', () => {
    const state = testGame();
    const [a, b] = state.survivors;
    state.relationships[[a!.id, b!.id].sort().join('|')]!.score = -80;
    let fights = 0;
    for (let d = 2; d < 40 && fights === 0; d++) {
      rollDepotEvents(state, d, new Rng(`feud-${d}`));
      fights = state.log.filter((e) => e.tags?.includes('fight')).length;
    }
    assert.ok(fights > 0);
    assert.ok(hasTrait(a!, 'wounded') || hasTrait(b!, 'wounded'));
  });

  test('a trade can be taken if the guild can pay, or turned down', () => {
    const state = testGame();
    state.depot.offers.push({ id: 'o1', give: { scrap: 10 }, get: { rations: 15 }, expiresDay: 5 });
    state.depot.offers.push({ id: 'o2', give: { tech: 99 }, get: { meds: 1 }, expiresDay: 5 });
    assert.match(offerProblem(state, 'o2') ?? '', /Needs 99 tech/);
    const rations = state.resources.rations;
    acceptOffer(state, 'o1', 2);
    assert.equal(state.resources.rations, rations + 15);
    assert.equal(state.resources.scrap, 10);
    declineOffer(state, 'o2');
    assert.equal(state.depot.offers.length, 0);
  });
});

describe('the economy over time (Monte Carlo)', () => {
  test('a new guild that stays home is fed and calm for two months of days', () => {
    for (let i = 0; i < 60; i++) {
      const state = testGame(`stay-${i}`);
      for (let d = 1; d <= 60; d++) {
        const r = advanceTime(state, T0 + d * DAY_MS);
        assert.equal(r.depot.hungryDays, 0, `guild ${i} went hungry on day ${dayAt(state, T0 + d * DAY_MS)}`);
      }
      assert.ok(state.survivors.every((s) => s.stress < 70), `guild ${i} is stressed`);
      assert.equal(state.survivors.length, 4, 'nobody leaves or dies at home');
    }
  });

  test('a full Bunks of 8 is fed by an improved Garden with three gardeners', () => {
    for (let i = 0; i < 30; i++) {
      const state = testGame(`eight-${i}`);
      state.resources = { scrap: 200, rations: 30, meds: 5, ammo: 15, tech: 20 };
      build(state, 'bunks', 1);
      build(state, 'garden', 1);
      for (let n = 0; n < 4; n++) {
        refreshRecruits(state, 1, new Rng(`r-${i}-${n}`));
        takeIn(state, state.depot.recruits[0]!.survivor.id, new Rng(`t-${i}-${n}`), 1);
      }
      const third = state.survivors.find((s) => !s.post)!;
      assignPost(state, third.id, { building: 'garden' });
      let hungry = 0;
      for (let d = 1; d <= 40; d++) hungry += advanceTime(state, T0 + d * DAY_MS).depot.hungryDays;
      assert.equal(hungry, 0, `guild ${i} of 8 went hungry`);
    }
  });
});

describe('save migration', () => {
  test('a version 4 save gets the Depot with the starting buildings and posts', () => {
    const state = testGame('v4');
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    old.version = 4;
    delete old.buildings;
    delete old.depot;
    for (const s of old.survivors as Record<string, unknown>[]) delete s.post;
    old.lastUpdate = T0 + 5 * DAY_MS + 10;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.equal(buildingLevel(loaded, 'garden'), 1);
    assert.equal(loaded.depot.lastDay, 6);
    assert.equal(postedTo(loaded, 'garden').length, 2);
  });
});
