import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PRESS_ON_WAIT } from '../constants.ts';
import { PRESS_ASIDES, PRESS_ON, PRESS_ON_GO, PRESS_ON_HOME, PRESS_ON_PICKS, findTrait, getEnemy } from '../content/index.ts';
import { createItem } from '../gear.ts';
import { exploredAt } from '../locations.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import type { GameState, Run, RunPlan } from '../types.ts';
import { answerRadio, completeRun, pressOnRisk, startRun } from './runs.ts';
import { simulateRun } from './sim.ts';

/** The same group words the solo test looks for. */
const GROUP = /\b(the crew|crew|everyone|the others|each other|together|they bring back|they had to leave)\b/i;
const withoutPlaceholders = (t: string): string => t.replace(/\{[^}]+\}/g, '');

/** A guild of plain people in scrap vests with machetes: comfortable on the outskirts of a danger-2 place, not further in. */
function kitted(seed: string, size = 3): GameState {
  const state = openGame(seed);
  for (const s of state.survivors) s.traits = [];
  for (const s of state.survivors.slice(0, size)) {
    s.equipment.armor = createItem(state, 'scrap_vest');
    s.equipment.weapon = createItem(state, 'machete');
  }
  return state;
}

/** A run that calls about pressing on, sent for real. */
function called(start = 0, orders: Partial<RunPlan> = {}): { state: GameState; run: Run; i: number } {
  for (let i = start; i < start + 60; i++) {
    const state = kitted(`press-${i}`);
    const run = startRun(state, testPlan(state, 'kessler_farm', { approach: 'balanced', retreat: 'downed', meds: 1, ...orders }), T0);
    if (run.radio?.forkId === 'press_on') return { state, run, i };
  }
  throw new Error('No run called about pressing on.');
}

/** A plan for simulating that has already been judged risky further in. */
function risky(state: GameState, orders: Partial<RunPlan> = {}): RunPlan {
  return { ...testPlan(state, 'kessler_farm', { approach: 'balanced', retreat: 'downed', meds: 1, ...orders }), pressOn: 'Moderate' };
}

describe('press on or come home: content (3.11.0)', () => {
  test('picks name real traits and the last always fits; asides too', () => {
    for (const p of PRESS_ON_PICKS) if (p.trait) assert.ok(findTrait(p.trait), p.trait);
    const last = PRESS_ON_PICKS.at(-1)!;
    assert.ok(!last.trait && !last.retreat);
    for (const a of PRESS_ASIDES) assert.ok(findTrait(a.trait), a.trait);
  });

  test('every teaser has lines for a crew and for one person, and the solo ones never talk about a group', () => {
    const pools = [...Object.values(PRESS_ON).flatMap((d) => [d.intro, d.ask]), PRESS_ON_GO, PRESS_ON_HOME];
    for (const pool of pools) {
      assert.ok(pool.crew.length > 0 && pool.solo.length > 0);
      for (const line of pool.solo) assert.doesNotMatch(withoutPlaceholders(line), GROUP, line);
    }
    // Meetings and asides are said the same way for one or many.
    for (const def of Object.values(PRESS_ON)) {
      for (const m of def.meets ?? []) {
        assert.ok(m.weight > 0, m.title);
        for (const o of [m.success, m.failure]) {
          if (!o) continue;
          assert.doesNotMatch(withoutPlaceholders(o.text), GROUP, o.text);
          for (const e of o.effects ?? []) if (e.type === 'fight' && e.enemy) assert.ok(m.enemy === e.enemy, `${m.title}: a fight with ${e.enemy} only where they live`);
        }
        if (m.check) assert.ok(m.failure, `${m.title} has a check but no failure`);
        if (m.enemy) assert.doesNotThrow(() => getEnemy(`${m.enemy}_scav`));
      }
    }
    for (const a of PRESS_ASIDES) for (const line of a.lines) assert.doesNotMatch(line, GROUP, line);
  });
});

describe('press on or come home: when they call (3.11.0)', () => {
  test('never where the next level is easy for the crew, at the deepest level, or on a trade', () => {
    for (let i = 0; i < 6; i++) {
      const state = kitted(`easy-${i}`);
      const run = startRun(state, testPlan(state, 'maple_street', { approach: 'balanced' }), T0);
      assert.equal(run.plan.pressOn, undefined, 'the outskirts of Maple Street are easy for a kitted crew further in too');
      assert.notEqual(run.radio?.forkId, 'press_on');
    }
    const state = kitted('deepest');
    assert.equal(pressOnRisk(state, testPlan(state, 'kessler_farm', { depth: 3 })), undefined, 'nothing deeper than the deepest level');
    assert.equal(pressOnRisk(state, testPlan(state, 'kessler_farm', { job: 'trade' })), undefined);
  });

  test('where the next level is risky for them, most runs call, and the plan says how risky', () => {
    let calls = 0;
    for (let i = 0; i < 12; i++) {
      const state = kitted(`risky-${i}`);
      const run = startRun(state, testPlan(state, 'kessler_farm', { approach: 'balanced', retreat: 'downed', meds: 1 }), T0);
      assert.ok(run.plan.pressOn, 'level 2 of Kessler Farm is a risk for a kitted crew');
      if (run.radio?.forkId === 'press_on') calls += 1;
    }
    assert.ok(calls >= 6, `${calls} of 12 called`);
  });

  test('a run left to itself before the call never makes it', () => {
    const state = kitted('recalled');
    const plan = risky(state);
    for (let i = 0; i < 20; i++) {
      const sim = simulateRun(state, plan, `recalled-${i}`, 0, { recallAt: 1 });
      assert.notEqual(sim.fork?.forkId, 'press_on');
    }
  });
});

describe('press on or come home: the call (3.11.0)', () => {
  const { state, run } = called();
  const call = run.radio!;

  test('they wait half the run, in five minutes, from five to thirty', () => {
    const wait = call.until - call.at;
    assert.ok(wait >= PRESS_ON_WAIT[0] && wait <= PRESS_ON_WAIT[1], `${wait / 60_000} minutes`);
    assert.equal(wait % 300_000, 0);
  });

  test('they show the next level, how risky it is, what they carry and how they are', () => {
    const view = call.deeper!;
    assert.equal(view.level, 2);
    assert.equal(view.risk, run.plan.pressOn);
    assert.deepEqual(view.crew.map((c) => c.id).sort(), [...run.plan.crew].sort());
    for (const c of view.crew) assert.ok(c.hp <= c.maxHp);
    assert.ok(Object.values(view.haul).every((n) => (n ?? 0) > 0));
  });

  test('pressing on goes a level deeper and takes longer; coming home doesn’t', () => {
    const press = call.branches!.press!;
    const home = call.branches!.home!;
    assert.equal(press.result.deeper, 2);
    assert.equal(home.result.deeper, undefined);
    assert.ok(press.returnAt > home.returnAt);
  });

  test('answered, the run before the call stays as it was, and what they explored deeper in counts once the level is open', () => {
    // One that comes back on its feet from deeper in (a routed crew explores nothing).
    let found = called();
    while (found.run.radio!.branches!.press!.result.exploredGain === 0) found = called(found.i + 1);
    const s = structuredClone(found.state);
    const c = found.run.radio!;
    s.locations.kessler_farm!.explored = 100;
    const r = s.runs.find((x) => x.id === found.run.id)!;
    const before = structuredClone(r.beats.slice(0, c.fromBeat));
    answerRadio(s, r.id, 'press', c.at + 60_000);
    assert.deepEqual(r.beats.slice(0, c.fromBeat), before);
    assert.equal(r.result.deeper, 2);
    completeRun(s, r.id, r.returnAt);
    assert.ok(exploredAt(s, 'kessler_farm', 2) > 0);
  });
});

describe('press on or come home: left to them (3.11.0)', () => {
  /** What a crew does unasked, with everyone given a trait (or none) and these orders. */
  function unasked(trait: string | undefined, orders: Partial<RunPlan> = {}): boolean[] {
    const out: boolean[] = [];
    for (let i = 0; i < 40 && out.length < 4; i++) {
      const state = kitted(`unasked-${trait ?? 'none'}-${i}`);
      if (trait) for (const s of state.survivors) s.traits = [{ id: trait, gainedDay: 0, hidden: false }];
      const sim = simulateRun(state, risky(state, orders), `u-${i}`, 0);
      if (sim.fork?.forkId === 'press_on') out.push(sim.result.deeper !== undefined);
    }
    assert.ok(out.length > 0, `no call with ${trait ?? 'no trait'}`);
    return out;
  }

  test('a hothead or the brave press on; the cowardly and the cautious come home', () => {
    assert.ok(unasked('hothead').every(Boolean));
    assert.ok(unasked('brave').every(Boolean));
    assert.ok(unasked('cowardly').every((p) => !p));
    assert.ok(unasked('cautious').every((p) => !p));
  });

  test('otherwise the crew’s orders: told never to turn back, they go on; else they come home', () => {
    assert.ok(unasked(undefined, { retreat: 'never' }).every(Boolean));
    assert.ok(unasked(undefined).every((p) => !p));
  });
});

describe('press on or come home: further in (3.11.0)', () => {
  test('whoever was further in turns out to be each of the meetings, now and then', () => {
    const titles = new Set<string>();
    const meets = new Set(PRESS_ON.voice.meets!.map((m) => m.title));
    for (let i = 0; i < 300 && titles.size < meets.size; i++) {
      const state = kitted(`meet-${i % 4}`);
      const sim = simulateRun(state, risky(state, { job: 'scout' }), `meet-${i}`, 0, { answer: 'press' });
      for (const b of sim.beats) if (meets.has(b.title)) titles.add(b.title);
    }
    assert.deepEqual([...titles].sort(), [...meets].sort());
  });

  test('alone, nothing said on the radio or deeper in talks about a group', () => {
    let seen = 0;
    for (let i = 0; i < 120 && seen < 12; i++) {
      const state = kitted(`solo-${i % 4}`, 1);
      const plan = risky(state, { crew: [state.survivors[0]!.id] });
      for (const answer of ['press', 'home'] as const) {
        const sim = simulateRun(state, plan, `solo-press-${i}`, 0, { answer });
        if (sim.fork?.forkId !== 'press_on') continue;
        seen += 1;
        for (const beat of sim.beats.slice(sim.fork.fromBeat - 1)) {
          // Another crew met on the road is allowed, as in the solo test.
          for (const line of beat.lines) if (!line.text.startsWith('Another crew')) assert.doesNotMatch(line.text, GROUP, line.text);
        }
      }
    }
    assert.ok(seen > 0);
  });
});
