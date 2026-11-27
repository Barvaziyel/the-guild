import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NEED_BAR, NEED_KINDS, createItem, learnParts, partAt, type GameState, type StatId } from '../engine/index.ts';
import { openGame, testPlan } from '../engine/test-utils.ts';
import { GLYPHS } from './glyphs.ts';
import { NEED_GLYPHS, UNKNOWN_PART, anyPartKnown, coverChips, deeperChips, levelPart, partCard, perkChips } from './needs-view.ts';
import { APPROACHES } from './runs-view.ts';

function plain(seed: string): GameState {
  const state = openGame(seed);
  for (const s of state.survivors) {
    s.traits = [];
    s.equipment = {};
    for (const k of Object.keys(s.stats) as StatId[]) s.stats[k] = 3;
  }
  return state;
}

describe('places that need the right people, on screen (3.13.0)', () => {
  test('every need has a picture', () => {
    for (const k of NEED_KINDS) assert.ok(NEED_GLYPHS[k] in GLYPHS, k);
    assert.ok(UNKNOWN_PART.glyph in GLYPHS);
  });

  test('before anyone has been, the planner shows the part as not known, and nobody gets a tag', () => {
    const state = plain('unknown');
    state.survivors[0]!.stats.wits = NEED_BAR[0];
    const plan = testPlan(state, 'rail_yard', {}, 2);
    const card = partCard(state, plan)!;
    assert.equal(card.title, undefined);
    assert.deepEqual(card.chips, [UNKNOWN_PART]);
    assert.deepEqual(coverChips(state, state.survivors[0]!, plan), []);
  });

  test('once known, the part is named and its needs light up with whoever covers them', () => {
    const state = plain('known');
    learnParts(state, 'rail_yard', [1, 3]);
    const keen = state.survivors[0]!;
    keen.stats.wits = NEED_BAR[0];
    const plan = testPlan(state, 'rail_yard', {}, 2);
    const card = partCard(state, plan)!;
    assert.equal(card.title, partAt('rail_yard', 1)!.title);
    assert.equal(card.open, true);
    assert.deepEqual(card.chips.map((c) => [c.glyph, c.text, c.tone]), [['lock', keen.firstName, 'good']]);
    assert.deepEqual(coverChips(state, keen, plan).map((c) => c.glyph), ['lock']);
    // Without them, it's dark, and says what it needs.
    const without = partCard(state, { ...plan, crew: [state.survivors[1]!.id] })!;
    assert.equal(without.open, false);
    assert.equal(without.chips[0]!.dim, true);
    assert.match(without.chips[0]!.label!, /someone who can open a lock/);
    // A tool in fair hands is said with the tool.
    const handy = state.survivors[1]!;
    handy.stats.wits = NEED_BAR[0] - 2;
    handy.equipment.tool = createItem(state, 'lockpicks');
    assert.match(partCard(state, { ...plan, crew: [handy.id] })!.chips[0]!.label!, /with the lockpicks/);
  });

  test('two who lift together, and a vehicle that carries the load, are said as such', () => {
    const state = plain('together');
    learnParts(state, 'rail_yard', [3]);
    const [a, b] = state.survivors;
    a!.stats.wits = NEED_BAR[2];
    a!.stats.brawn = NEED_BAR[2] - 1;
    b!.stats.brawn = NEED_BAR[2] - 1;
    const plan = testPlan(state, 'rail_yard', { depth: 3 }, 2);
    const card = partCard(state, plan)!;
    assert.deepEqual(card.chips.map((c) => c.text), [a!.firstName, `${a!.firstName} & ${b!.firstName}`]);
    assert.equal(card.open, true);
  });

  test('a job that doesn’t search, and the market, have no part to show', () => {
    const state = plain('jobs');
    assert.equal(partCard(state, testPlan(state, 'rail_yard', { job: 'scout' })), undefined);
    assert.equal(partCard(state, testPlan(state, 'drive_in', { job: 'trade' })), undefined);
  });

  test('the Reach shows each level’s part once known, and the levels once any is', () => {
    const state = plain('reach');
    assert.equal(anyPartKnown(state, 'old_metro'), false);
    assert.deepEqual(levelPart(state, 'old_metro', 2), { chips: [UNKNOWN_PART] });
    learnParts(state, 'old_metro', [2]);
    assert.equal(anyPartKnown(state, 'old_metro'), true);
    const two = levelPart(state, 'old_metro', 2)!;
    assert.equal(two.title, partAt('old_metro', 2)!.title);
    assert.deepEqual(two.chips.map((c) => c.glyph), ['water']);
    assert.equal(levelPart(state, 'drive_in', 1), undefined);
  });

  test('the press-on card lights what the level further in needs', () => {
    const base = { teaser: 'stash', level: 2, risk: 'Moderate' as const, haul: {}, items: 0, crew: [] };
    assert.deepEqual(deeperChips(base), []);
    assert.deepEqual(deeperChips({ ...base, part: { known: false, needs: [{ kind: 'locked', covered: true }] } }), [UNKNOWN_PART]);
    const chips = deeperChips({ ...base, part: { known: true, needs: [{ kind: 'locked', covered: true }, { kind: 'heavy', covered: false }] } });
    assert.deepEqual(chips.map((c) => [c.glyph, c.tone ?? (c.dim ? 'dim' : '')]), [['lock', 'good'], ['weight', 'dim']]);
  });

  test('a crew’s perks show beside how well it gets on, with the two who make it', () => {
    const state = plain('perks');
    const [a, b] = state.survivors;
    a!.traits = [{ id: 'curious', gainedDay: 1 }];
    b!.traits = [{ id: 'cautious', gainedDay: 1 }];
    const chips = perkChips(state, [a!.id, b!.id]);
    assert.equal(chips.length, 1);
    assert.equal(chips[0]!.text, 'One looks, one checks');
    assert.match(chips[0]!.label!, new RegExp(`^${a!.firstName} and ${b!.firstName}: `));
    assert.deepEqual(perkChips(state, [a!.id]), []);
  });

  test('the aggressive order says it forces its way in', () => {
    const aggressive = APPROACHES.find((a) => a.id === 'aggressive')!;
    assert.ok(aggressive.chips!.some((c) => c.glyph === 'lock' && /best part/.test(c.label!)));
  });
});
