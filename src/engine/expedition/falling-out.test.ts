/**
 * 1.6.2: people fall out too. Runs together no longer warm every pair, the
 * Greedy and quick-tempered argue over shares, and a death can leave blame.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { REL_BLAME } from '../constants.ts';
import { relationshipScore, traitAffinity } from '../relationships.ts';
import { Rng } from '../rng.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import { addTrait } from '../traits.ts';
import { completeRun, startRun } from './runs.ts';
import { simulateRun } from './sim.ts';

const lines = (sim: ReturnType<typeof simulateRun>): string[] => sim.beats.flatMap((b) => b.lines.map((l) => l.text));

describe('falling out', () => {
  test('two who grate on each other drift apart on the road, even through a fight', () => {
    let cooled = 0;
    let runs = 0;
    for (let i = 0; i < 200; i++) {
      const state = openGame(`grate-${i}`);
      const [a, b] = state.survivors;
      for (const s of [a!, b!]) {
        s.traits = s.traits.filter((t) => t.id !== 'calm');
        addTrait(s, 'hothead', { day: 1, silent: true, force: true });
      }
      if (traitAffinity(a!, b!) >= 0) continue;
      runs += 1;
      const sim = simulateRun(state, testPlan(state, 'drowned_mall', {}, 2), `g${i}`, T0);
      const after = sim.result.relationships.find((r) => [r.a, r.b].includes(a!.id) && [r.a, r.b].includes(b!.id))!;
      if (after.score < relationshipScore(state, a!.id, b!.id)) cooled += 1;
    }
    assert.ok(runs > 100);
    assert.ok(cooled / runs > 0.8, `${cooled} of ${runs} runs cooled them`);
  });

  test('the Greedy and quick-tempered argue over the shares', () => {
    let argued = 0;
    for (let i = 0; i < 300; i++) {
      const state = openGame(`shares-${i}`);
      addTrait(state.survivors[0]!, 'greedy', { day: 1, silent: true, force: true });
      const sim = simulateRun(state, testPlan(state, 'rail_yard'), `s${i}`, T0);
      if (lines(sim).some((l) => /argue over the shares the whole way home/.test(l))) argued += 1;
    }
    assert.ok(argued > 40 && argued < 160, `${argued} of 300 runs`);
  });

  test('after a death, the one closest to the dead may blame someone who came back', () => {
    let blamed = 0;
    for (let i = 0; i < 2000 && blamed < 3; i++) {
      const state = openGame(`blame-${i}`);
      for (const rel of Object.values(state.relationships)) rel.score = 70;
      state.rng = new Rng(`b${i}`).getState();
      const run = startRun(state, testPlan(state, 'the_glow', { retreat: 'never', approach: 'aggressive' }), T0);
      if (run.result.deaths.length === 0) continue;
      const back = run.result.crew.filter((s) => s.status !== 'dead').map((s) => s.id);
      completeRun(state, run.id, run.returnAt);
      const blamer = state.survivors.find((s) => s.chronicle.some((c) => c.text.startsWith('Blames ')));
      if (!blamer) continue;
      blamed += 1;
      const line = blamer.chronicle.find((c) => c.text.startsWith('Blames '))!.text;
      assert.match(line, new RegExp(`for ${run.result.deaths[0]!.name}'s death\\.$`));
      const target = state.survivors.find((s) => s.chronicle.some((c) => c.text.startsWith(`Blamed by `)))!;
      assert.ok(back.includes(target.id), 'only someone who was there');
      assert.ok(relationshipScore(state, blamer.id, target.id) <= 70 + REL_BLAME + 10);
    }
    assert.equal(blamed, 3);
  });
});
