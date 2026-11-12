import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ORIENTATION_PER_MILLE, PARTNER_DAILY_CHANCE, PARTNER_GUILD_FACTOR, PARTNER_RELIEF, PARTNER_SECOND_FACTOR } from './constants.ts';
import { emptySummary, playDepotDay } from './depot/day.ts';
import { generateSurvivor, orientationFor } from './generator.ts';
import { adjustRelationship, arePartners, becomePartners, drawnTo, getRelationship, initRelationships, partnerOf, romanceChance, couplesIn } from './relationships.ts';
import { Rng } from './rng.ts';
import { testGame } from './test-utils.ts';
import { addTrait } from './traits.ts';
import type { GameState, Orientation, Survivor } from './types.ts';

/** A new guild where everyone is Bonded with everyone. */
function closeGuild(seed: string): GameState {
  const state = testGame(seed);
  for (const rel of Object.values(state.relationships)) rel.score = 80;
  return state;
}

const manAndWoman = (a: Survivor, b: Survivor): boolean => a.pronouns !== b.pronouns;

/** The first two people of a new guild, made the given sexes (and straight, unless said otherwise). */
function pair(state: GameState, a: 'he' | 'she', b: 'he' | 'she', ao: Orientation = 'straight', bo: Orientation = 'straight'): [Survivor, Survivor] {
  const [x, y] = state.survivors as [Survivor, Survivor];
  x.pronouns = a;
  y.pronouns = b;
  x.orientation = ao;
  y.orientation = bo;
  return [x, y];
}

describe('partners', () => {
  test('only Bonded adults who are not grieving can fall for each other', () => {
    const state = testGame('rules');
    const [a, b] = pair(state, 'he', 'she');
    getRelationship(state, a.id, b.id)!.score = 50;
    assert.equal(romanceChance(state, a, b), 0, 'friends are not enough');
    getRelationship(state, a.id, b.id)!.score = 80;
    assert.equal(romanceChance(state, a, b), PARTNER_DAILY_CHANCE);
    addTrait(b, 'grieving', { day: 1, rng: new Rng('g') });
    assert.equal(romanceChance(state, a, b), 0, 'not while grieving');
    b.traits = [];
    b.age = 17;
    assert.equal(romanceChance(state, a, b), 0, 'adults only');
  });

  test('people fall only for those they are drawn to, and both ways', () => {
    const state = closeGuild('drawn');
    const cases: [Survivor['pronouns'], Orientation, Survivor['pronouns'], Orientation, boolean][] = [
      ['he', 'straight', 'she', 'straight', true],
      ['he', 'straight', 'he', 'straight', false],
      ['he', 'gay', 'he', 'gay', true],
      ['she', 'gay', 'she', 'bi', true],
      ['she', 'bi', 'he', 'straight', true],
      ['he', 'gay', 'she', 'straight', false],
      ['he', 'gay', 'he', 'straight', false],
      ['she', 'bi', 'she', 'straight', false],
    ];
    for (const [as, ao, bs, bo, can] of cases) {
      const [a, b] = pair(state, as, bs, ao, bo);
      assert.equal(drawnTo(a, b) && drawnTo(b, a), can, `${ao} ${as} and ${bo} ${bs}`);
      assert.equal(romanceChance(state, a, b), can ? PARTNER_DAILY_CHANCE : 0, `${ao} ${as} and ${bo} ${bs}`);
    }
  });

  test('someone with a partner is far less likely to find another', () => {
    const state = closeGuild('second');
    const [a, b] = pair(state, 'she', 'he');
    const c = state.survivors[2]!;
    c.pronouns = 'she';
    c.orientation = 'straight';
    becomePartners(state, a, b, 3);
    assert.equal(romanceChance(state, a, b), 0, 'already partners');
    assert.equal(romanceChance(state, b, c), PARTNER_DAILY_CHANCE * PARTNER_SECOND_FACTOR * PARTNER_GUILD_FACTOR);
  });

  test('every couple in the guild makes the next one less likely', () => {
    const state = closeGuild('couples');
    const [a, b] = pair(state, 'she', 'he');
    const before = romanceChance(state, a, b);
    assert.equal(before, PARTNER_DAILY_CHANCE);
    const [c, d] = [state.survivors[2]!, state.survivors[3]!];
    c.pronouns = 'she';
    d.pronouns = 'he';
    c.orientation = d.orientation = 'straight';
    becomePartners(state, c, d, 3);
    assert.equal(couplesIn(state), 1);
    assert.equal(romanceChance(state, a, b), PARTNER_DAILY_CHANCE * PARTNER_GUILD_FACTOR);
  });

  test('most people are straight, some gay, some bi', () => {
    const rng = new Rng('orientation');
    const counts: Record<Orientation, number> = { straight: 0, gay: 0, bi: 0 };
    for (let i = 0; i < 20000; i++) counts[orientationFor(rng.seed32())] += 1;
    for (const o of ['straight', 'gay', 'bi'] as const) {
      const share = (counts[o] / 20000) * 1000;
      assert.ok(Math.abs(share - ORIENTATION_PER_MILLE[o]) < 10, `${o}: ${share.toFixed(0)} per 1000`);
    }
  });

  test('about 96% of couples are a man and a woman', () => {
    let couples = 0;
    let manWoman = 0;
    for (let g = 0; g < 300; g++) {
      // A guild of 8 where everyone is Bonded, at home for four months.
      const state = testGame(`share-${g}`);
      const rng = new Rng(`share-${g}`);
      while (state.survivors.length < 8) {
        const newcomer = generateSurvivor(state, rng, { day: 1 });
        initRelationships(state, newcomer, rng);
        state.survivors.push(newcomer);
      }
      for (const rel of Object.values(state.relationships)) rel.score = 80;
      const s = state.survivors;
      state.resources.rations = 1000;
      for (let day = 2; day <= 121; day++) playDepotDay(state, day, rng, emptySummary());
      for (let i = 0; i < s.length; i++) {
        for (let j = i + 1; j < s.length; j++) {
          if (!arePartners(state, s[i]!.id, s[j]!.id)) continue;
          couples += 1;
          if (manAndWoman(s[i]!, s[j]!)) manWoman += 1;
        }
      }
    }
    const share = manWoman / couples;
    assert.ok(couples > 600, `${couples} couples`);
    assert.ok(share > 0.935 && share < 0.985, `${(share * 100).toFixed(1)}% of ${couples}`);
  });

  test('becoming partners is in both Chronicles and the news', () => {
    const state = closeGuild('news');
    const [a, b] = pair(state, 'he', 'she');
    becomePartners(state, a, b, 4);
    assert.ok(arePartners(state, a.id, b.id));
    assert.equal(partnerOf(state, a.id)?.id, b.id);
    assert.equal(a.chronicle.at(-1)!.text, `Became partners with ${b.firstName} ${b.lastName}.`);
    assert.equal(b.chronicle.at(-1)!.text, `Became partners with ${a.firstName} ${a.lastName}.`);
    assert.equal(state.log.at(-1)!.text, `${a.firstName} and ${b.firstName} are together now.`);
  });

  test('partners who stop being friends split up', () => {
    const state = closeGuild('split');
    const [a, b] = pair(state, 'he', 'she');
    becomePartners(state, a, b, 4);
    adjustRelationship(state, a.id, b.id, -30, { day: 5 });
    assert.ok(arePartners(state, a.id, b.id), 'a quarrel is not the end');
    adjustRelationship(state, a.id, b.id, -40, { day: 6 });
    assert.ok(!arePartners(state, a.id, b.id));
    assert.equal(partnerOf(state, a.id), undefined);
    assert.ok(a.chronicle.some((c) => c.text === `Split up with ${b.firstName} ${b.lastName}.`));
    assert.ok(state.log.some((l) => l.text === `${a.firstName} and ${b.firstName} have split up.`));
  });

  test('a partner at home helps more with stress than a friend', () => {
    const state = testGame('rest');
    for (const rel of Object.values(state.relationships)) rel.score = 0;
    const [a, b] = pair(state, 'he', 'she');
    getRelationship(state, a.id, b.id)!.score = 80;
    for (const s of state.survivors) s.stress = 60;
    const together = structuredClone(state);
    becomePartners(together, together.survivors[0]!, together.survivors[1]!, 1);
    playDepotDay(state, 2, new Rng('rest'), emptySummary());
    playDepotDay(together, 2, new Rng('rest'), emptySummary());
    assert.equal(state.survivors[0]!.stress - together.survivors[0]!.stress, PARTNER_RELIEF);
  });

  test('Bonded people at home together often become partners over two months, nearly always one each', () => {
    let couples = 0;
    let withTwo = 0;
    for (let g = 0; g < 100; g++) {
      const state = closeGuild(`months-${g}`);
      const rng = new Rng(`months-${g}`);
      for (let day = 2; day <= 61; day++) playDepotDay(state, day, rng, emptySummary());
      const s = state.survivors;
      for (let i = 0; i < s.length; i++) {
        let partners = 0;
        for (let j = 0; j < s.length; j++) {
          if (i === j || !arePartners(state, s[i]!.id, s[j]!.id)) continue;
          partners += 1;
          if (j > i) couples += 1;
        }
        if (partners > 1) withTwo += 1;
      }
    }
    assert.ok(couples >= 50 && couples <= 130, `${couples} couples in 100 guilds`);
    assert.ok(withTwo <= 4, `${withTwo} of 400 people with two partners`);
  });
});
