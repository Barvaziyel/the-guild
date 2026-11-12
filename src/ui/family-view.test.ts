import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ADULT_AGE, PREGNANCY_DAYS, Rng, YEAR_DAYS, becomePartners, birth, dayStart, expecting, addTrait, keepFamilyBed, type GameState, type Survivor } from '../engine/index.ts';
import { bedsLine } from './depot-view.ts';
import { testGame } from '../engine/test-utils.ts';
import { ageText, childOriginLine, childRows, childrenSummary, familyLines, familyNoticeKey, familyNotices, growingLine, noRoomLine, parentsLine, realSpan } from './family-view.ts';

function family(seed: string): { state: GameState; mother: Survivor; father: Survivor } {
  const state = testGame(seed);
  state.buildings.bunks = 3;
  const [mother, father] = state.survivors as [Survivor, Survivor];
  mother.pronouns = 'she';
  father.pronouns = 'he';
  mother.firstName = 'Mara';
  mother.lastName = 'Kell';
  father.firstName = 'Tom';
  father.lastName = 'Voss';
  becomePartners(state, mother, father, 1);
  return { state, mother, father };
}

describe('families on screen', () => {
  test('real time from game days: eight make a real day', () => {
    assert.equal(realSpan(4), 'less than a real day');
    assert.equal(realSpan(8), 'about 1 real day');
    assert.equal(realSpan(80), 'about 10 real days');
    assert.equal(realSpan(270), 'about 5 real weeks');
    assert.equal(realSpan(ADULT_AGE * YEAR_DAYS), 'about 2 real years');
  });

  test('a baby on the way shows on both parents, and a notice is planned for the day', () => {
    const { state, mother, father } = family('due');
    expecting(state, mother, father, 10);
    assert.deepEqual(familyLines(state, mother, 10), ['Expecting a baby, due in about 5 real weeks.']);
    assert.deepEqual(familyLines(state, father, 10), ['Mara is expecting his baby, due in about 5 real weeks.']);
    addTrait(mother, 'nearly_due', { day: 200, silent: true });
    assert.deepEqual(familyLines(state, mother, 200), ['Nearly due, and staying home until the baby comes, in about 10 real days.']);
    assert.deepEqual(familyLines(state, mother, 10 + PREGNANCY_DAYS), ['Nearly due, and staying home until the baby comes, any time now.']);
    const [n] = familyNotices(state);
    assert.equal(n!.at, dayStart(state, 10 + PREGNANCY_DAYS));
    assert.equal(n!.body, "Mara's baby is due at the Depot.");
    assert.notEqual(familyNoticeKey(state), '');
    assert.equal(childrenSummary(state), 'A baby on the way.');
  });

  test('a child: age, parents, when they join, and the lines on the parents', () => {
    const { state, mother, father } = family('child');
    expecting(state, mother, father, 1);
    const c = birth(state, mother, 2, new Rng('b'));
    const word = c.pronouns === 'she' ? 'Daughter' : 'Son';
    assert.equal(ageText(c, 2), 'a newborn');
    assert.equal(ageText(c, 2 + 130), '4 months old');
    assert.equal(childOriginLine(c, 2), 'Depot-Born, newborn');
    assert.equal(childOriginLine(c, 2 + 130), 'Depot-Born, 4 months');
    assert.equal(growingLine(c, 2), 'Joins the guild at 16, in about 2 real years.');
    assert.equal(parentsLine(state, c), `${word} of Mara Kell and Tom Voss.`);
    assert.deepEqual(familyLines(state, mother, 3), [`Mother of ${c.firstName}.`]);
    assert.deepEqual(familyLines(state, father, 3), [`Father of ${c.firstName}.`]);
    const [row] = childRows(state, 3);
    assert.equal(row!.family, `Mara and Tom's ${word.toLowerCase()}`);
    assert.equal(childrenSummary(state), '1 child at the Depot.');
    c.age = 13;
    assert.match(growingLine(c, 3), /^Helps in the Garden\. Joins the guild at 16, in about \d+ real months\.$/);
    // A parent who died is "the late".
    father.status = 'dead';
    state.survivors = state.survivors.filter((s) => s !== father);
    state.memorial.push(father);
    assert.equal(parentsLine(state, c), `${word} of Mara Kell and the late Tom Voss.`);
  });

  test('a child of 15 gets a notice for the day they join', () => {
    const { state, mother, father } = family('grown');
    expecting(state, mother, father, 1);
    const c = birth(state, mother, 2, new Rng('b'));
    assert.equal(familyNotices(state).length, 0);
    c.age = ADULT_AGE - 1;
    const [n] = familyNotices(state);
    assert.equal(n!.title, `${c.firstName} turns 16`);
    assert.equal(n!.at, dayStart(state, c.nextBirthday!));
  });

  test('a couple in a full house is told why there is no baby, and where to make room', () => {
    const { state, mother, father } = family('room');
    mother.age = 30;
    state.buildings.bunks = 1; // four beds, four people
    assert.equal(noRoomLine(state, mother), "Every bed is taken, so there's no room for a baby. The Bunks can keep one free.");
    assert.equal(noRoomLine(state, father), noRoomLine(state, mother));
    assert.equal(noRoomLine(state, state.survivors[2]!), undefined, 'not for someone without a partner');
    keepFamilyBed(state, true);
    assert.equal(bedsLine(state), '4 of 4 beds taken. The next bed to come free will be kept for a family.');
    state.buildings.bunks = 2;
    assert.equal(noRoomLine(state, mother), undefined);
    assert.equal(bedsLine(state), '4 of 8 beds taken. One of the empty beds is kept for a family.');
  });
});
