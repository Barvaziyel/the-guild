import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { captiveProblem, decideCaptive, playCaptivesDay, questionChance, takeCaptive } from './captives.ts';
import { dayStart } from './depot/time.ts';
import { Rng } from './rng.ts';
import { deserialize, serialize } from './save.ts';
import { testGame } from './test-utils.ts';
import { playVulturesDay } from './vultures.ts';

describe('captives', () => {
  test('held at the Depot: fed scraps every other day, and now and then one slips out', () => {
    const state = testGame('held');
    const c = takeCaptive(state, 'raiders', 2, new Rng('c'));
    assert.equal(state.captives.length, 1);
    assert.equal(c.since, 2);
    const rations = state.resources.rations;
    playCaptivesDay(state, 3, new Rng('d3'));
    playCaptivesDay(state, 4, new Rng('d4'));
    assert.equal(state.resources.rations, rations - 1, 'one ration in two days');
    let gone = 0;
    for (let i = 0; i < 200; i++) {
      const s = testGame(`slip-${i}`);
      takeCaptive(s, 'raiders', 1, new Rng(`c${i}`));
      for (let d = 2; d <= 30; d++) playCaptivesDay(s, d, new Rng(`s${i}-${d}`));
      if (s.captives.length === 0) gone++;
    }
    // About 2% a day: some 40% are gone in a month.
    assert.ok(gone > 40 && gone < 130, `${gone} of 200 slipped out`);
  });

  test('questioned once: a cache of their band’s, or nothing', () => {
    let told = 0;
    for (let i = 0; i < 40; i++) {
      const state = testGame(`ask-${i}`);
      const c = takeCaptive(state, 'raiders', 1, new Rng(`q${i}`));
      const before = state.resources.scrap;
      const result = decideCaptive(state, c.person.id, 'question', dayStart(state, 2));
      assert.ok(result.check);
      if (result.check.success) {
        told++;
        assert.ok(state.resources.scrap > before);
        assert.match(result.text, /told of a cache/);
      } else assert.match(result.text, /gave up nothing/);
      assert.equal(captiveProblem(state, c.person.id, 'question'), 'They’ve told all they will.');
    }
    assert.ok(told > 3 && told < 37, `${told} of 40 talked`);
    assert.ok(questionChance(testGame('odds')) > 0);
  });

  test('asked to join: some say yes and join the guild; a no is final', () => {
    let joined = 0;
    for (let i = 0; i < 60; i++) {
      const state = testGame(`join-${i}`);
      state.buildings.bunks = 3;
      const c = takeCaptive(state, 'raiders', 1, new Rng(`j${i}`));
      const n = state.survivors.length;
      const result = decideCaptive(state, c.person.id, 'recruit', dayStart(state, 2));
      if (/joined the guild/.test(result.text)) {
        joined++;
        assert.equal(state.survivors.length, n + 1);
        assert.equal(state.captives.length, 0);
      } else {
        assert.equal(captiveProblem(state, c.person.id, 'recruit'), 'They said no.');
      }
    }
    assert.ok(joined > 5 && joined < 30, `${joined} of 60 joined`);
  });

  test('let go, they walk off; the Vultures take it kindly', () => {
    const state = testGame('free');
    state.vultures.arriveDay = 1;
    playVulturesDay(state, 1, new Rng('arrive'));
    const c = takeCaptive(state, 'vultures', 1, new Rng('v'));
    const standing = state.vultures.standing;
    assert.match(decideCaptive(state, c.person.id, 'release', dayStart(state, 2)).text, /was let go/);
    assert.equal(state.captives.length, 0);
    assert.ok(state.vultures.standing > standing);
  });

  test('older saves start with nobody held', () => {
    const state = testGame('old');
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    old.version = 21;
    delete old.captives;
    assert.deepEqual(deserialize(JSON.stringify(old)).captives, []);
    assert.deepEqual(deserialize(serialize(state)).captives, []);
  });
});
