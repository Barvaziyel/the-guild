import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { BONDED_CHECK_BONUS, STRESS_RIVAL_PER_BEAT, becomePartners, getRelationship } from '../engine/index.ts';
import { testGame } from '../engine/test-utils.ts';
import { BOND_KEY, bondChips, bondGlyph, crewChips, pairChips } from './bonds-view.ts';

const set = (state: ReturnType<typeof testGame>, a: string, b: string, score: number): void => {
  getRelationship(state, a, b)!.score = score;
};

describe('what getting on does, in pictures (3.6.0)', () => {
  test('each tie has its picture, and neutral has none', () => {
    assert.equal(bondGlyph('bonded'), 'hearts');
    assert.equal(bondGlyph('friend'), 'heart');
    assert.equal(bondGlyph('neutral'), undefined);
    assert.equal(bondGlyph('rival'), 'bolt');
    assert.equal(bondGlyph('feud'), 'war');
    assert.equal(bondGlyph('bonded', true), 'ring');
  });

  test('the Bonds tab says what each tie does, with the game’s numbers', () => {
    const bonded = bondChips('bonded');
    assert.deepEqual(bonded[0], { glyph: 'dice', text: `+${BONDED_CHECK_BONUS} rolls`, tone: 'good', label: `On a run together: plus ${BONDED_CHECK_BONUS} to every roll` });
    assert.ok(bonded.every((c) => c.label), 'every picture is read out');
    assert.deepEqual(bondChips('neutral'), []);
    assert.ok(bondChips('rival').some((c) => c.glyph === 'stress' && c.text === `+${STRESS_RIVAL_PER_BEAT}` && c.tone === 'bad'));
    assert.ok(bondChips('feud').some((c) => c.glyph === 'swords'), 'a feud can come to blows at home');
    // Partners are calmer at home and safer when hurt than a bonded pair, and take a fall harder.
    const partners = bondChips('bonded', true);
    const home = (cs: typeof partners) => Number(cs.find((c) => c.glyph === 'home')!.text.replace('−', ''));
    assert.ok(home(partners) > home(bonded));
    assert.ok(partners.some((c) => c.glyph === 'stress' && c.tone === 'bad'));
  });

  test('the key explains every picture the Bonds tab uses', () => {
    const used = new Set((['bonded', 'friend', 'rival', 'feud'] as const).flatMap((l) => bondChips(l).map((c) => c.glyph)));
    for (const k of BOND_KEY) assert.ok(used.has(k.glyph), `${k.glyph} is used`);
  });

  test('the crew picker shows who gets on with those already picked', () => {
    const state = testGame();
    const [a, b, c, d] = state.survivors.map((s) => s.id) as [string, string, string, string];
    for (const r of Object.values(state.relationships)) r.score = 0;
    set(state, a, b, 70);
    set(state, a, c, -40);
    assert.deepEqual(pairChips(state, a, []), []);
    const chips = pairChips(state, a, [b, c, d]);
    const name = (id: string) => state.survivors.find((s) => s.id === id)!.firstName;
    assert.deepEqual(
      chips.map((x) => [x.glyph, x.text, x.tone]),
      [
        ['hearts', name(b), 'good'],
        ['bolt', name(c), 'bad'],
      ],
      'the neutral one is left out',
    );
    assert.deepEqual(pairChips(state, a, [a]), [], 'not with themselves');
    becomePartners(state, state.survivors[0]!, state.survivors[1]!, 1);
    assert.equal(pairChips(state, a, [b])[0]!.glyph, 'ring');
  });

  test('the crew as a whole: how well they get on, bonded pairs and rivals', () => {
    const state = testGame();
    const [a, b, c] = state.survivors.map((s) => s.id) as [string, string, string];
    for (const r of Object.values(state.relationships)) r.score = 0;
    assert.deepEqual(crewChips(state, [a]), [], 'nobody to get on with');
    assert.deepEqual(crewChips(state, [a, b]).map((x) => x.text), ['±0 together']);
    set(state, a, b, 80);
    const close = crewChips(state, [a, b]);
    assert.equal(close[0]!.tone, 'good');
    assert.ok(close.some((x) => x.glyph === 'hearts'));
    set(state, a, c, -80);
    set(state, b, c, -80);
    const tense = crewChips(state, [a, b, c]);
    assert.equal(tense[0]!.tone, 'bad');
    assert.ok(tense.some((x) => x.glyph === 'stress' && x.tone === 'bad'));
  });
});
