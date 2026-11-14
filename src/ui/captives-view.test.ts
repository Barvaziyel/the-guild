import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng, decideCaptive, takeCaptive } from '../engine/index.ts';
import { dayStart } from '../engine/depot/time.ts';
import { testGame } from '../engine/test-utils.ts';
import { captiveRows } from './captives-view.ts';

describe('captives on the Roster', () => {
  test('who they are, where from, and what can be done with them', () => {
    const state = testGame('cv');
    takeCaptive(state, 'raiders', 3, new Rng('a'));
    const v = takeCaptive(state, 'vultures', 5, new Rng('b'));
    const rows = captiveRows(state);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.id, v.person.id, 'newest first');
    assert.equal(rows[0]!.from, 'Left behind by the Vultures on day 5.');
    assert.equal(rows[1]!.from, 'Left behind by raiders on day 3.');
    for (const r of rows) {
      assert.match(r.question, /^Question (him|her): \w+ leans on (him|her), about \d+% (he|she) tells of a cache\.$/);
      assert.match(r.recruit, /^Ask (him|her) to join: about 25% (he|she) says yes\.$/);
    }
    decideCaptive(state, v.person.id, 'question', dayStart(state, 6));
    assert.equal(captiveRows(state)[0]!.questionProblem, 'They’ve told all they will.');
  });
});
