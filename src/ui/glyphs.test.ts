import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { AGGRESSIVE_ATTACK_BONUS, RESOURCE_IDS, SNEAKY_AMBUSH_BONUS } from '../engine/index.ts';
import { GLYPHS, problemNote, supplyChips } from './glyphs.ts';
import { APPROACHES, JOBS, RETREATS } from './runs-view.ts';

describe('pictures for the UI (3.6.0)', () => {
  test('every supply has one', () => {
    for (const id of RESOURCE_IDS) assert.ok(GLYPHS[id], id);
  });

  test('every glyph a screen or view names exists', () => {
    const dir = new URL('.', import.meta.url).pathname;
    const files = [...readdirSync(dir).filter((f) => f.endsWith('.ts')), ...readdirSync(join(dir, 'screens')).map((f) => `screens/${f}`), ...readdirSync(join(dir, 'components')).map((f) => `components/${f}`)];
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8');
      for (const m of src.matchAll(/glyph: '([a-z]+)'|<Glyph name="([a-z]+)"/g)) {
        const name = m[1] ?? m[2]!;
        assert.ok(name in GLYPHS, `${f} uses a glyph called ${name}`);
      }
    }
  });

  test('a cost marks what the guild is short of, in the header’s order', () => {
    const chips = supplyChips({ tech: 4, scrap: 30 }, { have: { scrap: 50, tech: 1 } });
    assert.deepEqual(
      chips.map((c) => [c.glyph, c.text, c.tone ?? '']),
      [
        ['scrap', '30', ''],
        ['tech', '4', 'bad'],
      ],
    );
    assert.equal(chips[1]!.label, '4 tech, only 1 at the Depot');
    assert.deepEqual(supplyChips({ scrap: 0 }), [], 'nothing of nothing');
  });

  test('a haul is signed: what came in is good, what went is bad', () => {
    assert.deepEqual(
      supplyChips({ scrap: 6, rations: -2 }, { sign: true }).map((c) => [c.text, c.tone]),
      [
        ['+6', 'good'],
        ['−2', 'bad'],
      ],
    );
  });

  test('being short is said by the cost, so only other problems are said in words', () => {
    assert.equal(problemNote('Needs 30 scrap, 4 tech.'), undefined);
    assert.equal(problemNote('Not enough scrap: it takes 10 scrap.'), undefined);
    assert.equal(problemNote('Needs a level 3 Workshop.'), 'Needs a level 3 Workshop.');
    assert.equal(problemNote('Build the Workshop first.'), 'Build the Workshop first.');
    assert.equal(problemNote(undefined), undefined);
  });

  test('approaches, jobs and when to pull out show what they do, with the game’s numbers', () => {
    for (const c of [...APPROACHES, ...JOBS, ...RETREATS]) {
      assert.ok(c.chips && c.chips.length > 0, `${c.id} has pictures`);
      for (const chip of c.chips) assert.ok(chip.label, `${c.id}: ${chip.glyph} is read out`);
    }
    const sneaky = APPROACHES.find((a) => a.id === 'sneaky')!.chips!;
    assert.equal(sneaky[0]!.text, `+${SNEAKY_AMBUSH_BONUS}`);
    assert.equal(sneaky.find((c) => c.glyph === 'clock')!.text, '+15%');
    const aggressive = APPROACHES.find((a) => a.id === 'aggressive')!.chips!;
    assert.equal(aggressive[0]!.text, `+${AGGRESSIVE_ATTACK_BONUS}`);
    assert.equal(aggressive[1]!.tone, 'bad');
    // Balanced and aggressive look different at a glance (Aviel's playtest).
    assert.notDeepEqual(
      APPROACHES.find((a) => a.id === 'balanced')!.chips!.map((c) => c.glyph),
      aggressive.map((c) => c.glyph),
    );
  });
});
