import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ADULT_AGE,
  BABY_GAP_DAYS,
  CHILD_GARDEN,
  CHILD_HELP_AGE,
  CHILD_RATIONS,
  DECLINE_FLOOR,
  NEARLY_DUE_DAYS,
  PREGNANCY_DAYS,
  SAVE_VERSION,
  YEAR_DAYS,
} from './constants.ts';
import { bedsTaken, bunksCap, hasEmptyBed, hasFreeBunk, keepFamilyBed } from './depot/buildings.ts';
import { recruitProblem } from './depot/recruits.ts';
import { gardenYield, guildUpkeep } from './depot/day.ts';
import { advanceTime, dayStart } from './depot/time.ts';
import { unavailableReason } from './expedition/plan.ts';
import { birth, childrenOf, dieOfOldAge, expecting, makeChild, oldAgeChance, parentsOf, playFamilyDay } from './family.ts';
import { renameSurvivor } from './game.ts';
import { leaveGuild } from './leaving.ts';
import { becomePartners, relationshipScore } from './relationships.ts';
import { Rng } from './rng.ts';
import { deserialize } from './save.ts';
import { testGame } from './test-utils.ts';
import { hasTrait, removeTrait } from './traits.ts';
import type { GameState, Survivor } from './types.ts';
import { STAT_IDS } from './types.ts';

/** A guild with a couple at home: a woman of 28 and a man of 30, partners, with beds to spare. */
function couple(seed: string): { state: GameState; mother: Survivor; father: Survivor } {
  const state = testGame(seed);
  state.buildings.bunks = 3;
  const [mother, father] = state.survivors as [Survivor, Survivor];
  mother.pronouns = 'she';
  father.pronouns = 'he';
  mother.orientation = father.orientation = 'straight';
  mother.age = 28;
  father.age = 30;
  for (const rel of Object.values(state.relationships)) rel.score = 70;
  becomePartners(state, mother, father, 1);
  return { state, mother, father };
}

describe('ageing', () => {
  test('a birthday every game year, written in the Chronicle; away on a run, it waits until they are home', () => {
    const state = testGame('birthdays');
    const s = state.survivors[0]!;
    s.age = 30;
    s.nextBirthday = 10;
    playFamilyDay(state, 9, new Rng('a'));
    assert.equal(s.age, 30);
    s.status = 'away';
    playFamilyDay(state, 10, new Rng('b'));
    assert.equal(s.age, 30, 'not while away');
    s.status = 'ready';
    playFamilyDay(state, 12, new Rng('c'));
    assert.equal(s.age, 31);
    assert.equal(s.nextBirthday, 10 + YEAR_DAYS);
    assert.equal(s.chronicle.at(-1)!.text, 'Turned 31.');
  });

  test('from 60 the years take a point off Grit, Brawn or Aim now and then, never below the floor', () => {
    let declined = 0;
    for (let i = 0; i < 200; i++) {
      const state = testGame(`old-${i % 5}`);
      const s = state.survivors[0]!;
      s.age = 61;
      s.nextBirthday = 5;
      const before = { ...s.stats };
      playFamilyDay(state, 5, new Rng(`d${i}`));
      const lost = STAT_IDS.filter((k) => s.stats[k] < before[k]);
      if (lost.length > 0) {
        declined++;
        assert.equal(lost.length, 1);
        assert.ok(['grit', 'brawn', 'aim'].includes(lost[0]!));
        assert.ok(s.stats[lost[0]!] >= DECLINE_FLOOR);
        assert.match(s.chronicle.at(-1)!.text, /^Turned 62, and the years are starting to tell: \w+ down to \d+\.$/);
      }
    }
    assert.ok(declined > 70 && declined < 130, `${declined}`);
  });

  test('dying of old age is rare and only for the old: about 10% a year at 70', () => {
    assert.equal(oldAgeChance(64), 0);
    const yearAt70 = 1 - (1 - oldAgeChance(70)) ** YEAR_DAYS;
    assert.ok(yearAt70 > 0.07 && yearAt70 < 0.13, `${yearAt70}`);
    assert.ok(oldAgeChance(80) > oldAgeChance(70) * 3);
  });

  test('a peaceful death at the Depot: the Memorial Wall, the gear to the stash, and grief for those close', () => {
    const state = testGame('peaceful');
    const [s, friend] = state.survivors as [Survivor, Survivor];
    s.age = 74;
    for (const rel of Object.values(state.relationships)) rel.score = 50;
    const gear = Object.values(s.equipment).filter(Boolean).length;
    const stash = state.stash.length;
    dieOfOldAge(state, s, 20, new Rng('p'));
    assert.ok(!state.survivors.includes(s));
    assert.ok(state.memorial.includes(s));
    assert.equal(s.causeOfDeath, 'Died peacefully at the Depot, at 74');
    assert.equal(state.stash.length, stash + gear);
    assert.ok(hasTrait(friend, 'grieving'));
    assert.match(state.log.at(-1)!.text, /died peacefully in (his|her) sleep, at 74\./);
  });
});

describe('babies and children', () => {
  test('partners at home find a baby on the way now and then: about one in 100 days together', () => {
    const { state, mother } = couple('conceive');
    let found = 0;
    for (let day = 2; day < 5002; day++) {
      playFamilyDay(state, day, new Rng(`c${day}`));
      if (!mother.expecting) continue;
      found++;
      if (found === 1) {
        assert.ok(hasTrait(mother, 'expecting'));
        assert.match(state.log.at(-1)!.text, /are expecting a baby\./);
      }
      delete mother.expecting;
      removeTrait(mother, 'expecting', day);
    }
    assert.ok(found > 30 && found < 75, `${found} in 5000 days`);
  });

  test('no baby without a bed, a woman and a man, both at home', () => {
    const { state, mother, father } = couple('none');
    state.buildings.bunks = 1; // four beds, four people
    for (let day = 2; day < 3000; day++) playFamilyDay(state, day, new Rng(`n${day}`));
    assert.equal(mother.expecting, undefined, 'no bed');
    state.buildings.bunks = 3;
    father.status = 'away';
    for (let day = 3000; day < 6000; day++) playFamilyDay(state, day, new Rng(`m${day}`));
    assert.equal(mother.expecting, undefined, 'not with him away');
  });

  test('a bed kept free for a family: nobody new takes it, and a couple can use it', () => {
    const { state, mother } = couple('family-bed');
    state.buildings.bunks = 2; // eight beds
    while (state.survivors.length < 7) state.survivors.push(structuredClone({ ...state.survivors[2]!, id: `x${state.survivors.length}` }));
    assert.ok(hasFreeBunk(state));
    keepFamilyBed(state, true);
    assert.ok(!hasFreeBunk(state), 'the last bed is kept');
    assert.ok(hasEmptyBed(state));
    state.depot.recruits.push({ survivor: { ...structuredClone(state.survivors[2]!), id: 'gate' }, expiresDay: 9 });
    assert.equal(recruitProblem(state, 'gate'), 'All 8 beds are taken or kept for a family. Improve the Bunks to make room.');
    let day = 2;
    for (; day < 4000 && !mother.expecting; day++) playFamilyDay(state, day, new Rng(`f${day}`));
    assert.ok(mother.expecting, 'the couple had a baby on the way in the kept bed');
    keepFamilyBed(state, false);
    assert.equal(state.depot.familyBed, undefined);
  });

  test('a pregnancy: a bed kept, home for the last stretch, then the birth', () => {
    const { state, mother, father } = couple('birth');
    const beds = bedsTaken(state);
    expecting(state, mother, father, 10);
    assert.equal(bedsTaken(state), beds + 1, 'a bed is kept for the baby');
    const due = 10 + PREGNANCY_DAYS;
    playFamilyDay(state, due - NEARLY_DUE_DAYS - 1, new Rng('a'));
    assert.equal(unavailableReason(mother), undefined);
    playFamilyDay(state, due - NEARLY_DUE_DAYS, new Rng('b'));
    assert.match(unavailableReason(mother) ?? '', /nearly due/);
    playFamilyDay(state, due, new Rng('c'));
    assert.equal(mother.expecting, undefined);
    assert.ok(!hasTrait(mother, 'expecting') && !hasTrait(mother, 'nearly_due'));
    const [child] = state.children;
    assert.ok(child);
    assert.equal(child.age, 0);
    assert.equal(child.lastName, father.lastName);
    assert.deepEqual(child.parents, { mother: mother.id, father: father.id });
    assert.deepEqual(parentsOf(state, child), { mother, father });
    assert.deepEqual(childrenOf(state, mother.id), [child]);
    assert.equal(bedsTaken(state), beds + 1);
    assert.ok(mother.chronicle.some((c) => /^Had a (son|daughter), /.test(c.text)));
    assert.ok(father.chronicle.some((c) => /^Became a father: a (son|daughter), /.test(c.text)));
    assert.equal(child.chronicle[0]!.text, `Born at the Depot to ${mother.firstName} ${mother.lastName} and ${father.firstName} ${father.lastName}.`);
    assert.ok(!state.survivors.includes(child), 'children are not survivors yet');
  });

  test('a child takes after the parents: a mixed face, leaning stats, sometimes their ways', () => {
    const { state, mother, father } = couple('looks');
    for (const k of STAT_IDS) {
      mother.stats[k] = 7;
      father.stats[k] = 7;
    }
    let inherited = 0;
    for (let i = 0; i < 60; i++) {
      const c = makeChild(state, mother, father, 5, new Rng(`k${i}`));
      for (const key of ['hairColor', 'faceShape', 'eyes', 'nose', 'mouth'] as const) assert.ok([mother.appearance[key], father.appearance[key]].includes(c.appearance[key]), key);
      assert.equal(c.appearance.skinTone, Math.round((mother.appearance.skinTone + father.appearance.skinTone) / 2));
      assert.deepEqual(c.equipment, {});
      if (c.traits.some((t) => mother.traits.some((m) => m.id === t.id) || father.traits.some((f) => f.id === t.id))) inherited++;
    }
    assert.ok(inherited > 10, `${inherited} of 60 took after a parent`);
  });

  test('children eat, take a bed, ease everyone at home, help in the Garden from 12, and join the guild at 16', () => {
    const { state, mother, father } = couple('grow');
    const upkeep = guildUpkeep(state);
    const garden = gardenYield(state);
    expecting(state, mother, father, 1);
    const child = birth(state, mother, 2, new Rng('b'));
    renameSurvivor(state, child.id, 'Nico', child.lastName);
    assert.equal(child.firstName, 'Nico', 'parents can name the baby');
    assert.equal(guildUpkeep(state), upkeep + CHILD_RATIONS);
    child.age = CHILD_HELP_AGE;
    assert.equal(gardenYield(state), garden + CHILD_GARDEN);
    child.age = ADULT_AGE - 1;
    child.nextBirthday = 50;
    playFamilyDay(state, 50, new Rng('g'));
    assert.equal(state.children.length, 0);
    assert.ok(state.survivors.includes(child));
    assert.equal(child.age, ADULT_AGE);
    assert.equal(child.equipment.weapon?.defId, 'pipe');
    assert.ok(relationshipScore(state, child.id, mother.id) >= 40);
    assert.match(state.log.at(-1)!.text, /born at the Depot, is 16 and joins the guild\./);
  });

  test('a couple waits a while after one baby before the next', () => {
    const { state, mother, father } = couple('gap');
    expecting(state, mother, father, 1);
    birth(state, mother, 2, new Rng('b'));
    for (let day = 3; day < 2 + BABY_GAP_DAYS; day++) playFamilyDay(state, day, new Rng(`g${day}`));
    assert.equal(mother.expecting, undefined);
  });

  test('losing a parent is remembered', () => {
    const { state, mother, father } = couple('loss');
    expecting(state, mother, father, 1);
    const child = birth(state, mother, 2, new Rng('b'));
    child.age = 6;
    leaveGuild(state, father, 9, 'Left.', new Rng('l'));
    assert.match(child.chronicle.at(-1)!.text, /^Watched (his|her) father, .+, walk out of the Depot, at 6\.$/);
    mother.age = 80;
    dieOfOldAge(state, mother, 10, new Rng('d'));
    assert.match(child.chronicle.at(-1)!.text, /^Lost (his|her) mother, .+, at 6\.$/);
  });

  test('time plays it all, and old saves get birthdays', () => {
    const { state } = couple('time');
    advanceTime(state, dayStart(state, 7));
    assert.ok(state.survivors.every((s) => s.nextBirthday !== undefined));
    assert.ok(hasFreeBunk(state));
    assert.ok(bunksCap(state) > 0);
    const old = JSON.parse(JSON.stringify(testGame('old'))) as Record<string, unknown>;
    old.version = 16;
    delete old.children;
    for (const s of old.survivors as Record<string, unknown>[]) delete s.nextBirthday;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.deepEqual(loaded.children, []);
    for (const s of loaded.survivors) assert.ok(s.nextBirthday! > loaded.depot.lastDay && s.nextBirthday! <= loaded.depot.lastDay + YEAR_DAYS);
  });
});
