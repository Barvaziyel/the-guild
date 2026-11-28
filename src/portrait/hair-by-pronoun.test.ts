import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HAIR_STYLE_COUNT, LONG_HAIR_STYLES, Rng, generateSurvivor, mensHair } from '../engine/index.ts';
import { testGame } from '../engine/test-utils.ts';
import { HAIR_STYLES } from './hair.ts';
import { portraitLook } from './portrait.ts';

const LONG = new Set(['long', 'ponytail', 'braids', 'locks', 'wild']);

describe('hair and beards by whether someone is a man or a woman (3.15.0)', () => {
  test('the engine knows the portrait’s hair styles: how many, and which are long', () => {
    assert.equal(HAIR_STYLE_COUNT, HAIR_STYLES.length);
    assert.deepEqual(
      HAIR_STYLES.map((_, i) => i).filter((i) => LONG.has(HAIR_STYLES[i]!)),
      [...LONG_HAIR_STYLES],
    );
  });

  test('a man’s long hair is mostly cut short; anything else stays as rolled', () => {
    for (let roll = 0; roll < 100; roll++) {
      const style = HAIR_STYLES[mensHair(roll) % HAIR_STYLE_COUNT]!;
      if (!LONG.has(HAIR_STYLES[roll % HAIR_STYLE_COUNT]!)) assert.equal(mensHair(roll), roll);
      else if (LONG.has(style)) assert.equal(mensHair(roll), roll);
    }
  });

  test('over many people: men have long hair far less often than women, and no woman has a beard', () => {
    const state = testGame('hair');
    const rng = new Rng('hair');
    const long = { he: 0, she: 0 };
    const all = { he: 0, she: 0 };
    for (let i = 0; i < 2000; i++) {
      const s = generateSurvivor(state, rng, { day: 1 });
      if (s.age < 16) continue;
      const look = portraitLook(s);
      all[s.pronouns]++;
      if (LONG.has(look.hairStyle)) long[s.pronouns]++;
      if (s.pronouns === 'she') assert.equal(look.facialHair, 0, `${s.firstName} has a beard`);
    }
    const he = long.he / all.he;
    const she = long.she / all.she;
    assert.ok(she > 0.3 && she < 0.42, `women with long hair: ${she.toFixed(2)}`);
    assert.ok(he < 0.15, `men with long hair: ${he.toFixed(2)}`);
  });
});
