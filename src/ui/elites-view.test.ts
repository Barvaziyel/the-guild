import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GLYPHS } from './glyphs.ts';
import { ELITES } from '../engine/index.ts';
import { T0, openGame, testPlan } from '../engine/test-utils.ts';
import { eliteCard, eliteChips, eliteChoice, eliteTag, prizeChip, withElite, withJobElite } from './elites-view.ts';

describe('elites on screen (3.12.0)', () => {
  test('nothing shows until someone has seen it; then its card, its tag in the list, and its prize', () => {
    const state = openGame('cards');
    assert.equal(eliteCard(state, 'kessler_farm'), undefined);
    assert.equal(eliteCard(state, 'drive_in'), undefined, 'none at the market');
    state.elites = { the_butcher: { seen: 2, status: 'atLarge', fights: 0 } };
    const card = eliteCard(state, 'kessler_farm')!;
    assert.equal(card.name, 'The Butcher');
    assert.equal(card.state, 'atLarge');
    assert.deepEqual(card.prize, { item: 'machete', name: 'The Butcher’s Cleaver', what: 'Relic Machete' });
    assert.deepEqual(card.chips.map((c) => c.glyph), ['bolt', 'hurt']);
    assert.equal(eliteTag(state, 'kessler_farm'), 'The Butcher');
    void T0;
  });

  test('once dead, who brought it down and when, and no tag', () => {
    const state = openGame('dead');
    state.elites = { the_switchman: { seen: 1, status: 'dead', fights: 2, diedDay: 9, killedBy: { id: 'x', name: 'Mara' } } };
    const card = eliteCard(state, 'rail_yard')!;
    assert.equal(card.state, 'dead');
    assert.equal(card.line, 'Brought down by Mara on day 9.');
    assert.equal(eliteTag(state, 'rail_yard'), undefined);
  });

  test('the planner offers going after it only while it’s at large, on a job that goes looking', () => {
    const state = openGame('planner');
    state.elites = { the_butcher: { seen: 2, status: 'atLarge', fights: 0 } };
    const plan = testPlan(state, 'kessler_farm');
    assert.ok(eliteChoice(state, plan));
    assert.equal(eliteChoice(state, { ...plan, job: 'rescue' }), undefined);
    const going = withElite(plan, true);
    assert.equal(going.elite, true);
    assert.equal(withElite(going, false).elite, undefined);
    assert.equal(withJobElite({ ...going, job: 'trade' }).elite, undefined, 'a job that does not go looking drops it');
    assert.equal(withJobElite({ ...going, job: 'hunt' }).elite, true);
    state.elites.the_butcher!.status = 'dead';
    assert.equal(eliteChoice(state, plan), undefined);
  });

  test('every elite’s tags use glyphs the game has, and its prize reads out in full', () => {
    for (const e of ELITES) {
      for (const c of eliteChips(e)) assert.ok(c.glyph in GLYPHS && c.label, `${e.id}: ${c.glyph}`);
      assert.match(prizeChip(e.id).label!, /^Bring down .+ for .+, a Relic /);
    }
  });
});
