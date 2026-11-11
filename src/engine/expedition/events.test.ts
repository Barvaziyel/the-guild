import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EVENTS, LOCATIONS, findGear, findLocation, findTrait, type EventDef, type EventEffect } from '../content/index.ts';
import { addFlag, adjustRelationship } from '../relationships.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import { addTrait } from '../traits.ts';
import type { GameState, RunJob } from '../types.ts';
import { RESOURCE_IDS, STAT_IDS } from '../types.ts';
import { completeRun, startRun } from './runs.ts';
import { simulateRun } from './sim.ts';

const outcomes = (e: EventDef) => (e.failure ? [e.success, e.failure] : [e.success]);
const effects = (e: EventDef): EventEffect[] => outcomes(e).flatMap((o) => o.effects ?? []);

describe('event content integrity', () => {
  test('there are at least 40 events, with unique ids', () => {
    assert.ok(EVENTS.length >= 40, `${EVENTS.length} events`);
    assert.equal(new Set(EVENTS.map((e) => e.id)).size, EVENTS.length);
  });

  test('every event references real traits, gear, locations, stats and resources', () => {
    for (const e of EVENTS) {
      for (const role of [e.a, e.b]) {
        if (role?.trait) assert.ok(findTrait(role.trait), `${e.id}: trait ${role.trait}`);
        if (role?.gear) assert.ok(findGear(role.gear), `${e.id}: gear ${role.gear}`);
        for (const stat of [role?.best, role?.worst]) if (stat) assert.ok(STAT_IDS.includes(stat), e.id);
      }
      for (const id of e.locations ?? []) assert.ok(findLocation(id), `${e.id}: location ${id}`);
      assert.ok(e.weight > 0, e.id);
      for (const fx of effects(e)) {
        if (fx.type === 'trait') assert.ok(findTrait(fx.trait), `${e.id}: trait ${fx.trait}`);
        if (fx.type === 'loot' && fx.resource !== 'any') assert.ok(RESOURCE_IDS.includes(fx.resource), e.id);
        if ('amount' in fx && Array.isArray(fx.amount)) assert.ok(fx.amount[0] <= fx.amount[1], `${e.id}: range`);
        if (fx.type === 'relationship' && fx.with === 'b') assert.ok(e.b, `${e.id}: relationship with b needs a b role`);
      }
    }
  });

  test('events with a check have both outcomes; events without have one', () => {
    for (const e of EVENTS) {
      if (e.check) assert.ok(e.failure, `${e.id} has a check but no failure outcome`);
      else assert.equal(e.failure, undefined, `${e.id} has no check, so failure would never happen`);
      if (e.check && 'who' in e.check && e.check.who === 'b') assert.ok(e.b, `${e.id}: check by b needs a b role`);
      if (e.pair) assert.ok(e.b, `${e.id}: a pair needs a b role`);
    }
  });

  test('text only uses placeholders the event can fill', () => {
    const known = /^(first|last|name|they|them|their|theirs|themself|is|was|has|does)$/i;
    for (const e of EVENTS) {
      const texts = [e.intro, ...outcomes(e).map((o) => o.text)];
      for (const fx of effects(e)) {
        if (fx.type === 'chronicle') texts.push(fx.text);
        if (fx.type === 'trait') texts.push(fx.source);
      }
      for (const t of texts) {
        assert.ok(t.length > 10, `${e.id}: text too short`);
        for (const m of t.matchAll(/\{([^}]*)\}/g)) {
          const token = m[1]!;
          if (token === 'loc') continue;
          const [role, key] = token.split('.');
          assert.ok(role === 'a' || (role === 'b' && e.b && !e.b.optional), `${e.id}: {${token}} uses a role that may not be cast`);
          assert.ok(key && known.test(key), `${e.id}: unknown placeholder {${token}}`);
        }
      }
    }
  });

  test('every location has events of its own or general ones that fit', () => {
    for (const loc of LOCATIONS) {
      const fitting = EVENTS.filter(
        (e) =>
          (!e.locations || e.locations.includes(loc.id)) &&
          (e.minDanger === undefined || loc.danger >= e.minDanger) &&
          (e.maxDanger === undefined || loc.danger <= e.maxDanger),
      );
      assert.ok(fitting.length >= 12, `${loc.id}: only ${fitting.length} events can happen here`);
    }
  });
});

/** A crew built so that a given event can be cast. */
function stage(event: EventDef, i: number): { state: GameState; location: string } {
  const state = openGame(`stage-${i % 4}`);
  const [a, b, c] = state.survivors;
  for (const s of [a!, b!, c!]) s.traits = [];
  const dress = (s: typeof a, role: EventDef['a'] | undefined, runsDefault: number): void => {
    if (!s || !role) return;
    if (role.trait) addTrait(s, role.trait, { day: 1, silent: true, force: true });
    if (role.gear) s.equipment[findGear(role.gear)!.slot] = { uid: `e-${role.gear}`, defId: role.gear, quality: 'common' };
    s.counters.runs = role.minRuns ?? (role.maxRuns !== undefined ? 0 : runsDefault);
  };
  dress(a, event.a, 6);
  dress(b, event.b, 6);
  c!.counters.runs = 6;
  if (event.pair) {
    const delta = event.pair === 'hostile' ? -200 : event.pair === 'bonded' || event.pair === 'partners' ? 200 : 45;
    state.relationships[[a!.id, b!.id].sort().join('|')]!.score = 0;
    adjustRelationship(state, a!.id, b!.id, delta, { day: 1, silent: true, useTraitMult: false });
    if (event.pair === 'partners') addFlag(state, a!.id, b!.id, { kind: 'partners' });
  }
  const location =
    event.locations?.[i % event.locations.length] ??
    LOCATIONS.find((l) => (event.minDanger ?? 1) <= l.danger && l.danger <= (event.maxDanger ?? 5) && (!event.needsLead || l.leadsTo.length > 0) && (!event.noRadiation || l.radiation === 0))!.id;
  if (event.needsLead) for (const l of LOCATIONS) if (!l.startKnown) state.locations[l.id]!.discovered = false;
  return { state, location };
}

describe('events in play', () => {
  const JOB_FOR: Record<EventDef['kind'], RunJob> = { travel: 'scout', hazard: 'scout', discovery: 'scout', social: 'scavenge' };

  test('every event can happen, and both of its outcomes read cleanly', () => {
    for (const event of EVENTS) {
      const seen = { success: false, failure: !event.failure };
      for (let i = 0; i < 400 && !(seen.success && seen.failure); i++) {
        const { state, location } = stage(event, i);
        const plan = testPlan(state, location, { job: JOB_FOR[event.kind], approach: 'sneaky', meds: 3 });
        const { beats, result } = simulateRun(state, plan, `ev-${event.id}-${i}`, 0);
        if (!result.events.includes(event.id)) continue;
        const beat = beats.find((b) => b.title === event.title && b.kind === event.kind)!;
        assert.ok(beat, `${event.id}: beat present`);
        for (const line of beat.lines) assert.ok(!/[{}]|undefined|NaN/.test(line.text), `${event.id}: ${line.text}`);
        // The outcome line follows the intro; with a check it is toned good or bad.
        const toned = beat.lines.find((l) => l.tone && (l.check || (event.check && 'chance' in event.check)));
        if (!event.check || toned?.tone === 'good') seen.success = true;
        else if (toned?.tone === 'bad') seen.failure = true;
      }
      assert.ok(seen.success, `${event.id}: success outcome never happened`);
      assert.ok(seen.failure, `${event.id}: failure outcome never happened`);
    }
  });

  test('no event happens twice on one run, and plenty of runs have one', () => {
    let withEvent = 0;
    const total = 300;
    for (let i = 0; i < total; i++) {
      const state = openGame(`twice-${i % 6}`);
      const loc = LOCATIONS[i % LOCATIONS.length]!;
      const { result } = simulateRun(state, testPlan(state, loc.id, { job: 'scout', approach: 'sneaky' }), `t${i}`, 0);
      assert.equal(new Set(result.events).size, result.events.length);
      if (result.events.length > 0) withEvent++;
    }
    assert.ok(withEvent > total * 0.5, `${withEvent} of ${total} runs had an event`);
  });

  test('a hidden trait that drives an event is revealed', () => {
    const event = EVENTS.find((e) => e.id === 'lucky_find')!;
    let checked = 0;
    for (let i = 0; i < 200 && checked < 5; i++) {
      const { state, location } = stage(event, i);
      state.survivors[0]!.traits[0]!.hidden = true;
      const { result } = simulateRun(state, testPlan(state, location, { job: 'scout', approach: 'sneaky' }), `hid${i}`, 0);
      if (!result.events.includes(event.id)) continue;
      checked++;
      const after = result.crew[0]!;
      assert.ok(!after.traits.find((t) => t.id === 'lucky')!.hidden);
      assert.ok(result.items.length > 0 || result.outcome !== 'completed', 'the lucky find is in the packs');
    }
    assert.equal(checked, 5);
  });

  test('events the guild has seen come up less often', () => {
    const count = (seen: number): number => {
      let n = 0;
      for (let i = 0; i < 1200; i++) {
        const state = openGame(`seen-${i % 4}`);
        for (const s of state.survivors) s.traits = [];
        state.eventsSeen.railyard_handcar = seen;
        const { result } = simulateRun(state, testPlan(state, 'rail_yard', { job: 'scout', approach: 'sneaky' }), `s${i}`, 0);
        if (result.events.includes('railyard_handcar')) n++;
      }
      return n;
    };
    const fresh = count(0);
    const stale = count(8);
    assert.ok(fresh > 40, `fresh: ${fresh}`);
    assert.ok(stale < fresh * 0.6, `stale ${stale} vs fresh ${fresh}`);
  });

  test('finished runs record their events in the guild state and the report', () => {
    const state = openGame('record');
    let now = T0;
    let total = 0;
    for (let i = 0; i < 12; i++) {
      for (const s of state.survivors) {
        s.hp = 30;
        s.traits = s.traits.filter((t) => t.id !== 'wounded' && t.id !== 'badly_wounded');
      }
      if (state.survivors.length < 3) break;
      const run = startRun(state, testPlan(state, 'maple_street', { job: 'scout', approach: 'sneaky' }), now);
      now = run.returnAt;
      const report = completeRun(state, run.id, now);
      total += report.summary.events.length;
    }
    assert.ok(total > 5);
    assert.equal(Object.values(state.eventsSeen).reduce((a, b) => a + b, 0), total);
    assert.deepEqual(deserialize(serialize(state)), state);
  });

  test('a version 2 save gains event tracking', () => {
    const state = openGame('v2');
    const run = startRun(state, testPlan(state), T0);
    completeRun(state, run.id, run.returnAt);
    const old = JSON.parse(serialize(state)) as Record<string, unknown> & { reports: { summary: Record<string, unknown> }[] };
    old.version = 2;
    delete old.eventsSeen;
    delete old.reports[0]!.summary.events;
    const loaded = deserialize(JSON.stringify(old));
    assert.deepEqual(loaded.eventsSeen, {});
    assert.deepEqual(loaded.reports[0]!.summary.events, []);
  });
});
