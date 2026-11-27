import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { T0, openGame } from '../engine/test-utils.ts';
import type { LedFight, Run } from '../engine/index.ts';
import { STAKE_LINES, TRAIT_ASIDES, callSpeech, type CallStakes } from './call-lines.ts';

function call(crew: number, at = T0): { run: Run; fight: LedFight } {
  const state = openGame('calls-say');
  const run = { id: 'r7', plan: { crew: state.survivors.slice(0, crew).map((s) => s.id), lead: 'matters' } } as unknown as Run;
  return { run, fight: { at, by: state.survivors[0]!.id } as LedFight };
}

describe('what a crew says when it calls (3.10.0)', () => {
  test('one alone never talks like a crew, and every pool has lines', () => {
    for (const [stakes, pools] of Object.entries(STAKE_LINES)) {
      assert.ok(pools.crew.length > 0 && pools.solo.length > 0, stakes);
      for (const line of pools.solo) assert.doesNotMatch(line, /\b(we|us|our|we’re|we’ve)\b/i, `${stakes}: ${line}`);
    }
  });

  test('the same fight always says the same thing; different fights vary', () => {
    const { run, fight } = call(3);
    const said = callSpeech(run, fight, 'trouble', undefined);
    assert.equal(callSpeech(run, fight, 'trouble', undefined), said);
    assert.match(said, /^“.+”$/);
    const lines = new Set<string>();
    for (let k = 0; k < 40; k++) lines.add(callSpeech(run, { ...fight, at: T0 + k * 60_000 }, 'trouble', undefined));
    assert.ok(lines.size >= 3, `${lines.size} different lines`);
  });

  test('alone, they say it alone', () => {
    const { run, fight } = call(1);
    for (const stakes of ['grave', 'trouble', 'contact'] as CallStakes[]) {
      const said = callSpeech(run, fight, stakes, undefined).slice(1, -1);
      assert.ok(STAKE_LINES[stakes].solo.some((l) => said.startsWith(l)), said);
    }
  });

  test('a caller with a voice sometimes adds an aside of their own; a hidden trait never speaks', () => {
    const state = openGame('calls-voice');
    const caller = state.survivors[0]!;
    caller.traits = [{ id: 'cynic' } as never];
    const asides = TRAIT_ASIDES.find((a) => a.trait === 'cynic')!.lines;
    let spoke = 0;
    for (let k = 0; k < 40; k++) {
      const { run, fight } = call(3, T0 + k * 60_000);
      if (asides.some((a) => callSpeech(run, fight, 'trouble', caller).includes(a))) spoke++;
    }
    assert.ok(spoke > 10 && spoke < 35, `${spoke} of 40 with an aside`);
    caller.traits = [{ id: 'cynic', hidden: true } as never];
    for (let k = 0; k < 40; k++) {
      const { run, fight } = call(3, T0 + k * 60_000);
      assert.ok(!asides.some((a) => callSpeech(run, fight, 'trouble', caller).includes(a)));
    }
  });
});
