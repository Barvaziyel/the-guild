import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  BUNKS_CAP,
  DAY_MS,
  FIREPIT_RELIEF,
  HUNGER_STRESS,
  MAX_CATCHUP_DAYS,
  RADIO_ANSWER_CHANCE,
  RECRUIT_WAIT_DAYS,
  SAVE_VERSION,
  TRAINING_PRACTICE,
} from '../constants.ts';
import { BUILDINGS, RECIPES, getGear } from '../content/index.ts';
import { startRun } from '../expedition/runs.ts';
import { dayAt } from '../game.ts';
import { createItem } from '../gear.ts';
import { relationshipScore } from '../relationships.ts';
import { Rng } from '../rng.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testGame, testPlan } from '../test-utils.ts';
import { addTrait, hasTrait } from '../traits.ts';
import type { BuildingPost, GameState } from '../types.ts';
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
  postBuilding,
} from './buildings.ts';
import { dailyUpkeep, emptySummary, gardenYield, playDepotDay } from './day.ts';
import { acceptOffer, declineOffer, offerProblem, rollDepotEvents } from './events.ts';
import { addRadioRecruit, radioAnswerChance, recruitProblem, refreshRecruits, takeIn } from './recruits.ts';
import { advanceTime, dayStart, nextDayAt } from './time.ts';
import { craft, craftProblem, salvage, salvageProblem, salvageSpares, salvageValue, spareGear, upgradeItem, upgradeProblem } from './workshop.ts';

/** How long a game day lasted before save version 6. */
const HOUR = 60 * 60 * 1000;

const rich = (state: GameState): void => {
  state.resources = { scrap: 500, rations: 500, meds: 50, ammo: 50, tech: 100, gas: 0 };
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
    state.resources.rations = 50;
    // The Bar: 60 scrap, 6 tech, 40 rations (1.7.1).
    assert.equal(buildingName(state, 'firepit'), 'Firepit');
    build(state, 'firepit', 3);
    assert.equal(buildingLevel(state, 'firepit'), 2);
    assert.equal(buildingName(state, 'firepit'), 'Bar');
    assert.equal(state.resources.scrap, 40);
    assert.equal(state.resources.tech, 4);
    assert.equal(state.resources.rations, 10, 'stocking the Bar takes rations too');
    assert.match(state.log[state.log.length - 1]!.text, /Bar is now level 2/);
  });

  test('refuses what the guild cannot afford and what is already at the top', () => {
    const state = testGame();
    state.resources.scrap = 0;
    assert.match(buildProblem(state, 'infirmary') ?? '', /Needs 25 scrap, 2 meds/);
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
    const free = [a, b, c, d].find((s) => postBuilding(s!.post) !== 'garden')!;
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
    assert.ok((s.post as BuildingPost | undefined)?.stat);
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
  test('now and then someone answers the radio, more often with a Radio Tower, and waits a few days', () => {
    const count = (level: number): number => {
      const state = testGame(`radio-${level}`);
      for (let l = 0; l < level; l++) {
        rich(state);
        build(state, 'radio_tower', 1);
      }
      let heard = 0;
      for (let day = 2; day < 2002; day++) {
        state.depot.recruits = [];
        refreshRecruits(state, day, new Rng(`r${level}-${day}`));
        heard += state.depot.recruits.length;
      }
      return heard / 2000;
    };
    const none = count(0);
    const best = count(3);
    assert.ok(Math.abs(none - RADIO_ANSWER_CHANCE[0]) < 0.02, `${none}`);
    assert.ok(Math.abs(best - RADIO_ANSWER_CHANCE[3]) < 0.03, `${best}`);
    const state = testGame();
    const c = addRadioRecruit(state, 5, new Rng('one'));
    assert.equal(c.expiresDay, 5 + RECRUIT_WAIT_DAYS);
    assert.match(state.log.at(-1)!.text, /answered the radio and is waiting at the gate/);
    refreshRecruits(state, 5 + RECRUIT_WAIT_DAYS - 1, new Rng('a'));
    assert.ok(state.depot.recruits.includes(c));
    refreshRecruits(state, 5 + RECRUIT_WAIT_DAYS, new Rng('b'));
    assert.ok(!state.depot.recruits.includes(c), 'moved on');
    assert.equal(radioAnswerChance(state), RADIO_ANSWER_CHANCE[0]);
  });

  test('taking someone in needs a free bed and makes them part of the guild', () => {
    const state = testGame();
    addRadioRecruit(state, 2, new Rng('gate'));
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

describe('salvage', () => {
  function withWorkshop(): GameState {
    const state = testGame('salvage');
    state.resources = { scrap: 500, rations: 50, meds: 5, ammo: 5, tech: 50, gas: 0 };
    build(state, 'workshop', 1);
    state.resources = { scrap: 0, rations: 50, meds: 5, ammo: 5, tech: 0, gas: 0 };
    state.stash = [];
    return state;
  }

  test('gives back a share of the recipe by quality, tech from guns, and a little scrap for a trinket', () => {
    const state = withWorkshop();
    assert.deepEqual(salvageValue(createItem(state, 'pipe', 'rusty')), { scrap: 1 });
    assert.deepEqual(salvageValue(createItem(state, 'machete', 'common')), { scrap: 3 });
    assert.deepEqual(salvageValue(createItem(state, 'hunting_rifle', 'solid')), { scrap: 10, tech: 2 });
    assert.deepEqual(salvageValue(createItem(state, 'riot_gear', 'prime')), { scrap: 18, tech: 4 });
    assert.deepEqual(salvageValue(createItem(state, 'old_photo', 'common')), { scrap: 2 });
  });

  test('only gear in the stash, only at a Workshop, and never relics, named weapons, Medkits or a cherished trinket', () => {
    const none = testGame('no-workshop');
    const pipe = createItem(none, 'pipe', 'rusty');
    none.stash.push(pipe);
    assert.equal(salvageProblem(none, pipe.uid), 'Build the Workshop first.');
    const state = withWorkshop();
    const carried = state.survivors[0]!.equipment.weapon;
    if (carried) assert.equal(salvageProblem(state, carried.uid), 'Only gear in the stash can be taken apart.');
    const relic = createItem(state, 'machete', 'relic');
    const named = { ...createItem(state, 'sledge', 'solid'), name: 'Old Faithful' };
    const kit = createItem(state, 'medkit', 'common');
    const photo = { ...createItem(state, 'old_photo', 'common'), cherishedBy: state.survivors[1]!.id };
    state.stash.push(relic, named, kit, photo);
    assert.equal(salvageProblem(state, relic.uid), 'A relic is worth more whole.');
    assert.equal(salvageProblem(state, named.uid), 'Nobody will take apart Old Faithful.');
    assert.equal(salvageProblem(state, kit.uid), 'A Medkit is worth more used.');
    assert.equal(salvageProblem(state, photo.uid), `${state.survivors[1]!.firstName} would never forgive it.`);
  });

  test('taking apart adds the parts to the stores and says so; the spares go all at once', () => {
    const state = withWorkshop();
    const rifle = createItem(state, 'hunting_rifle', 'solid');
    state.stash.push(rifle);
    salvage(state, rifle.uid, 4);
    assert.equal(state.resources.scrap, 10);
    assert.equal(state.resources.tech, 2);
    assert.equal(state.stash.some((i) => i.uid === rifle.uid), false);
    assert.match(state.log.at(-1)!.text, /^Took apart a Solid Hunting Rifle in the Workshop: 10 scrap, 2 tech\.$/);
    const spares = [createItem(state, 'pipe', 'rusty'), createItem(state, 'leather_jacket', 'common'), createItem(state, 'machete', 'solid'), createItem(state, 'crowbar', 'rusty')];
    state.stash.push(...spares);
    assert.deepEqual(spareGear(state).map((i) => i.defId), ['pipe', 'leather_jacket'], 'Rusty and Common weapons and armor only');
    const { count } = salvageSpares(state, 5);
    assert.equal(count, 2);
    assert.deepEqual(state.stash.map((i) => i.defId).sort(), ['crowbar', 'machete']);
    assert.match(state.log.at(-1)!.text, /^Took apart 2 pieces of spare gear in the Workshop: \d+ scrap\.$/);
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
    const scrap = state.resources.scrap;
    acceptOffer(state, 'o1', 2);
    assert.equal(state.resources.rations, rations + 15);
    assert.equal(state.resources.scrap, scrap - 10);
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
      state.resources = { scrap: 200, rations: 30, meds: 5, ammo: 15, tech: 20, gas: 0 };
      build(state, 'bunks', 1);
      build(state, 'garden', 1);
      for (let n = 0; n < 4; n++) {
        addRadioRecruit(state, 1, new Rng(`r-${i}-${n}`));
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
    old.lastUpdate = T0 + 5 * HOUR + 10;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.equal(buildingLevel(loaded, 'garden'), 1);
    assert.equal(loaded.depot.lastDay, 6);
    assert.equal(dayAt(loaded, loaded.lastUpdate), 6);
    assert.equal(postedTo(loaded, 'garden').length, 2);
  });

  test('a version 5 save, from when a day was an hour, stays on the same day', () => {
    const state = testGame('v5');
    // Played up to 40% of the way through day 35, an hour a day.
    const last = T0 + 34 * HOUR + 0.4 * HOUR;
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    old.version = 5;
    old.lastUpdate = last;
    (old.depot as { lastDay: number }).lastDay = 35;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.lastUpdate, last);
    assert.equal(dayAt(loaded, last), 35);
    assert.equal(loaded.depot.lastDay, 35);
    // 40% through the day: the next one starts 60% of a (now 3-hour) day later.
    assert.equal(dayStart(loaded, 36) - last, Math.round(0.6 * DAY_MS));
    // Six real hours later is two days on, not six.
    assert.equal(dayAt(loaded, last + 6 * HOUR), 37);
    assert.equal(advanceTime(loaded, last + 6 * HOUR).depot.days, 2);
  });
});
