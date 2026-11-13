import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { RADIO_WAIT, SAVE_VERSION } from '../constants.ts';
import { FORKS, LOCATIONS, findLocation, findTrait, type ForkDef } from '../content/index.ts';
import { advanceTime } from '../depot/time.ts';
import { Rng } from '../rng.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import type { GameState, RunJob, RunPlan } from '../types.ts';
import { RESOURCE_IDS, STAT_IDS } from '../types.ts';
import { playVulturesDay } from '../vultures.ts';
import { answerRadio, completeRun, radioWaiting, settleRadio, startRun } from './runs.ts';
import { simulateRun } from './sim.ts';

const JOB_FOR: Record<ForkDef['kind'], RunJob> = { travel: 'scout', hazard: 'scout', discovery: 'scout' };

/** A guild with a Radio Tower (or without), a plain crew, and every place known. */
function guild(seed: string, radio = true): GameState {
  const state = openGame(seed);
  state.buildings.radio_tower = radio ? 1 : 0;
  for (const s of state.survivors) s.traits = [];
  return state;
}

function placeFor(fork: ForkDef, i: number): string {
  if (fork.locations) return fork.locations[i % fork.locations.length]!;
  const fits = LOCATIONS.filter((l) => (fork.minDanger ?? 1) <= l.danger && l.danger <= (fork.maxDanger ?? 5) && (!fork.needsRadiation || l.radiation > 0));
  return fits[i % fits.length]!.id;
}

/** Look for a run that comes to this fork (or any fork), with a radio. */
function findForked(fork: ForkDef | undefined, start = 0, orders: Partial<RunPlan> = {}): { state: GameState; plan: RunPlan; seed: string } | undefined {
  for (let i = start; i < start + 4000; i++) {
    const state = guild(`fork-${i % 5}`);
    const location = fork ? placeFor(fork, i) : LOCATIONS[i % 6]!.id;
    const plan = testPlan(state, location, { job: fork ? JOB_FOR[fork.kind] : 'scout', approach: 'balanced', meds: 3, ...orders });
    const seed = `f${fork?.id ?? 'any'}-${i}`;
    const run = simulateRun(state, plan, seed, 0);
    if (run.fork && (!fork || run.fork.forkId === fork.id)) return { state, plan, seed };
  }
  return undefined;
}

describe('fork content', () => {
  test('ids are unique, orders are 2 to 4 with their own ids, and the last pick always fits', () => {
    assert.equal(new Set(FORKS.map((f) => f.id)).size, FORKS.length);
    for (const f of FORKS) {
      assert.ok(f.orders.length >= 2 && f.orders.length <= 4, f.id);
      assert.equal(new Set(f.orders.map((o) => o.id)).size, f.orders.length, f.id);
      for (const p of f.picks) {
        assert.ok(f.orders.some((o) => o.id === p.order), `${f.id}: pick for ${p.order}`);
        if (p.trait) assert.ok(findTrait(p.trait), `${f.id}: trait ${p.trait}`);
      }
      const last = f.picks.at(-1)!;
      assert.ok(!last.trait && !last.approach && !last.retreat, `${f.id}: the last pick must always fit`);
      for (const id of f.locations ?? []) assert.ok(findLocation(id), `${f.id}: location ${id}`);
      for (const stat of [f.a.best, f.a.worst]) if (stat) assert.ok(STAT_IDS.includes(stat), f.id);
      for (const o of f.orders) {
        if (o.check) assert.ok(o.failure, `${f.id}/${o.id} has a check but no failure`);
        else assert.equal(o.failure, undefined, `${f.id}/${o.id}: failure without a check never happens`);
        for (const fx of [o.success, o.failure].flatMap((x) => x?.effects ?? [])) {
          if (fx.type === 'loot' && fx.resource !== 'any') assert.ok(RESOURCE_IDS.includes(fx.resource), f.id);
          if (fx.type === 'trait') assert.ok(findTrait(fx.trait), `${f.id}: trait ${fx.trait}`);
          if ('amount' in fx && Array.isArray(fx.amount)) assert.ok(fx.amount[0] <= fx.amount[1], `${f.id}: range`);
        }
      }
    }
  });

  test('text only uses placeholders a fork can fill', () => {
    const known = /^(first|last|name|they|them|their|theirs|themself|is|was|has|does)$/i;
    for (const f of FORKS) {
      const texts = [f.intro, f.ask, ...f.orders.flatMap((o) => [o.label, o.success.text, ...(o.failure ? [o.failure.text] : [])])];
      for (const o of f.orders) for (const fx of [o.success, o.failure].flatMap((x) => x?.effects ?? [])) if (fx.type === 'chronicle') texts.push(fx.text);
      for (const t of texts) {
        for (const m of t.matchAll(/\{([^}]*)\}/g)) {
          const token = m[1]!;
          if (token === 'loc') continue;
          const [role, key] = token.split('.');
          assert.ok(role === 'a', `${f.id}: {${token}}: forks only cast a`);
          assert.ok(key && known.test(key), `${f.id}: unknown placeholder {${token}}`);
        }
      }
    }
  });
});

describe('forks in play', () => {
  test('every fork happens, and every order and each of its outcomes can come of an answer', () => {
    for (const fork of FORKS) {
      const seen = new Map<string, { success: boolean; failure: boolean }>(fork.orders.map((o) => [o.id, { success: false, failure: !o.failure }]));
      const done = (): boolean => [...seen.values()].every((x) => x.success && x.failure);
      let found = 0;
      for (let i = 0; i < 30_000 && !done() && found < 300; i++) {
        const state = guild(`fork-${i % 5}`);
        const plan = testPlan(state, placeFor(fork, i), { job: JOB_FOR[fork.kind], meds: 3 });
        const seed = `f-${fork.id}-${i}`;
        if (simulateRun(state, plan, seed, 0).fork?.forkId !== fork.id) continue;
        found++;
        for (const order of fork.orders) {
          const replay = simulateRun(state, plan, seed, 0, { answer: order.id });
          assert.equal(replay.fork?.forkId, fork.id);
          for (const b of replay.beats) for (const line of b.lines) assert.ok(!/[{}]|undefined|NaN/.test(line.text), `${fork.id}: ${line.text}`);
          const after = replay.beats.slice(replay.fork!.fromBeat);
          assert.equal(after[0]!.title, 'Word from home');
          assert.ok(after[0]!.lines[0]!.text.startsWith(`Word from home: ${order.label.charAt(0).toLowerCase()}`), after[0]!.lines[0]!.text);
          // The outcome follows the answer, after the time the order takes.
          const line = order.minutes ? after[1]!.lines[0]! : after[0]!.lines[1]!;
          const s = seen.get(order.id)!;
          if (!order.check || line.tone === 'good') s.success = true;
          else if (line.tone === 'bad') s.failure = true;
          if (order.minutes) assert.equal(after[1]!.at - after[0]!.at, order.minutes * 60_000);
        }
      }
      assert.ok(found > 0, `${fork.id} never happened`);
      for (const [id, s] of seen) {
        assert.ok(s.success, `${fork.id}/${id}: success never happened`);
        assert.ok(s.failure, `${fork.id}/${id}: failure never happened`);
      }
    }
  });

  test('without a Radio Tower the crew decides on the spot and loses no time', () => {
    let checked = 0;
    for (let i = 0; i < 3000 && checked < 10; i++) {
      const state = guild(`noradio-${i % 4}`, false);
      const plan = testPlan(state, LOCATIONS[i % 8]!.id, { job: 'scout' });
      const run = simulateRun(state, plan, `nr${i}`, 0);
      if (!run.fork) continue;
      checked++;
      assert.equal(run.fork.called, false);
      const lines = run.beats.flatMap((b) => b.lines.map((l) => l.text));
      assert.ok(lines.some((t) => /makes the call|decides:/.test(t)));
      assert.ok(!lines.some((t) => /on the radio|word from home/i.test(t)));
      assert.ok(!run.beats.some((b) => b.title === 'No word from home'));
    }
    assert.equal(checked, 10);
  });

  test('forks come up on a fair share of runs, at most once each', () => {
    let forked = 0;
    const total = 600;
    for (let i = 0; i < total; i++) {
      const state = guild(`share-${i % 6}`);
      const loc = LOCATIONS[i % LOCATIONS.length]!;
      const run = simulateRun(state, testPlan(state, loc.id, { job: (['scavenge', 'scout', 'hunt'] as const)[i % 3] }), `sh${i}`, 0);
      const calls = run.beats.filter((b) => b.title === 'No word from home').length;
      assert.ok(calls <= 1);
      if (run.fork) forked++;
    }
    assert.ok(forked > total * 0.08 && forked < total * 0.4, `${forked} of ${total} runs came to a fork`);
  });
});

describe('a crew on the radio', () => {
  function sendForked(seedStart = 0): { state: GameState; runId: string } {
    const hit = findForked(undefined, seedStart)!;
    // startRun draws its own seed from the guild's dice: try until a run forks.
    for (let i = 0; i < 400; i++) {
      const state = structuredClone(hit.state);
      state.rng = new Rng(`send-${seedStart}-${i}`).getState();
      const run = startRun(state, hit.plan, T0);
      if (run.radio) return { state, runId: run.id };
    }
    throw new Error('no run came to a fork');
  }

  test('every order is played at departure; unanswered, they wait half an hour, then decide', () => {
    const { state, runId } = sendForked();
    const run = state.runs.find((r) => r.id === runId)!;
    const call = run.radio!;
    assert.deepEqual(Object.keys(call.branches!).sort(), call.orders.map((o) => o.id).sort());
    assert.equal(call.until - call.at, RADIO_WAIT);
    assert.ok(call.at > run.departAt && call.until < run.returnAt);
    // As things stand, nobody answers: they wait, then make the call themselves.
    const waited = run.beats[call.fromBeat]!;
    assert.equal(waited.title, 'No word from home');
    assert.equal(run.departAt + waited.at, call.until);
    // Every order's run is the same up to the fork.
    for (const order of call.orders) {
      const replay = simulateRun(state, run.plan, run.seed, run.departAt, { answer: order.id });
      assert.equal(replay.beats.length >= call.fromBeat, true);
      assert.equal(call.branches![order.id]!.beats[0]!.title, 'Word from home');
    }
    // Nothing after the call shows while they wait.
    assert.equal(radioWaiting(run, call.at + 60_000), call);
    assert.equal(radioWaiting(run, call.at - 1), undefined);
    assert.equal(radioWaiting(run, call.until), undefined);
  });

  test('an answer picks that future, and the rest of the run goes on from the moment of the answer', () => {
    const { state, runId } = sendForked(50);
    const run = state.runs.find((r) => r.id === runId)!;
    const call = run.radio!;
    const order = call.orders.at(-1)!.id;
    const branch = structuredClone(call.branches![order]!);
    const waitedTen = call.at + 10 * 60_000;
    assert.throws(() => answerRadio(state, runId, order, call.at - 1000), /not called yet/);
    assert.throws(() => answerRadio(state, runId, 'nonsense', waitedTen), /Unknown order/);
    answerRadio(state, runId, order, waitedTen);
    assert.equal(call.answer, order);
    assert.equal(call.branches, undefined);
    assert.deepEqual(run.result, branch.result);
    assert.equal(run.returnAt, branch.returnAt + 10 * 60_000);
    assert.equal(run.departAt + run.beats[call.fromBeat]!.at, waitedTen);
    assert.equal(run.beats[call.fromBeat]!.title, 'Word from home');
    for (let b = 1; b < run.beats.length; b++) assert.ok(run.beats[b]!.at >= run.beats[b - 1]!.at, 'beats in time order');
    assert.throws(() => answerRadio(state, runId, order, waitedTen), /settled already/);
    // Saves and loads, and the report says what was asked and answered.
    assert.deepEqual(deserialize(serialize(state)), state);
    const report = completeRun(state, runId, run.returnAt);
    assert.equal(report.radio?.answer, order);
    assert.equal(report.radio?.title, call.title);
  });

  test('too late: the crew made the call; time settles it and drops the other futures', () => {
    const { state, runId } = sendForked(90);
    const run = state.runs.find((r) => r.id === runId)!;
    const call = run.radio!;
    const before = structuredClone(run.result);
    assert.throws(() => answerRadio(state, runId, call.orders[0]!.id, call.until), /Too late/);
    settleRadio(state, call.until - 1);
    assert.equal(call.answer, undefined);
    advanceTime(state, call.until + 1000);
    assert.equal(call.answer, 'none');
    assert.equal(call.branches, undefined);
    assert.deepEqual(run.result, before);
    const report = completeRun(state, runId, run.returnAt);
    assert.equal(report.radio?.answer, 'none');
  });
});

describe('the Vultures on the radio', () => {
  function vultureRun(standing: number, order: string, i: number): string[] | undefined {
    const state = guild(`vr-${i % 4}`);
    state.vultures.arriveDay = 1;
    playVulturesDay(state, 1, new Rng(`vr-arrive-${i % 4}`));
    state.vultures.standing = standing;
    const camp = state.vultures.camps.find((c) => c.home)!.locationId;
    const plan = testPlan(state, camp);
    const first = simulateRun(state, plan, `vr${i}`, 0);
    if (first.fork?.forkId !== 'vultures') return undefined;
    const replay = simulateRun(state, plan, `vr${i}`, 0, { answer: order });
    return replay.beats.slice(replay.fork!.fromBeat).flatMap((b) => b.lines.map((l) => l.text));
  }

  test('wary: slip past, talk them down, pay the toll, or fight', () => {
    const outcomes = (order: string, pattern: RegExp): number => {
      let n = 0;
      for (let i = 0; i < 300; i++) {
        const lines = vultureRun(-10, order, i);
        if (lines && lines.some((t) => pattern.test(t))) n++;
      }
      return n;
    };
    assert.ok(outcomes('slip', /goes to ground|been seen/) > 3);
    assert.ok(outcomes('talk', /stares them down|now they want half|packs are empty/) > 3);
    assert.ok(outcomes('toll', /hands over|packs are empty/) > 3);
    assert.ok(outcomes('fight', /other ideas/) > 3);
  });

  test('at war: slip past, hit them first, or turn for home', () => {
    let home = 0;
    let hit = 0;
    for (let i = 0; i < 300; i++) {
      const back = vultureRun(-60, 'home', i);
      if (back?.some((t) => /heads for home/.test(t))) home++;
      const first = vultureRun(-60, 'hit', i);
      if (first?.some((t) => /strikes first/.test(t))) hit++;
    }
    assert.ok(home > 3 && hit > 3, `${home} home, ${hit} hit`);
  });
});

describe('saves', () => {
  test('a version 18 save loads: runs from before radio calls simply have none', () => {
    const state = guild('v18');
    const run = startRun(state, testPlan(state), T0);
    const old = JSON.parse(serialize(state)) as Record<string, unknown> & { runs: Record<string, unknown>[] };
    old.version = 18;
    delete old.runs[0]!.radio;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.equal(loaded.runs[0]!.id, run.id);
  });
});
