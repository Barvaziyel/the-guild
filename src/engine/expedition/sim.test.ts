import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CARRY_COST_DOWNED, MAX_BEATS, MIN_BEATS } from '../constants.ts';
import { LOCATIONS, getTrait } from '../content/index.ts';
import { adjustRelationship } from '../relationships.ts';
import { carryCapacity, maxHp } from '../stats.ts';
import { openGame, testPlan } from '../test-utils.ts';
import { addTrait, hasTrait } from '../traits.ts';
import type { Approach, RetreatOrder, RunJob } from '../types.ts';
import { RESOURCE_IDS } from '../types.ts';
import { runDuration } from './plan.ts';
import { richness } from './beats.ts';
import { simulateRun } from './sim.ts';

const JOBS: RunJob[] = ['scavenge', 'scout', 'hunt'];
const APPROACHES: Approach[] = ['sneaky', 'balanced', 'aggressive'];
const RETREATS: RetreatOrder[] = ['wounded', 'downed', 'never'];

describe('simulateRun', () => {
  test('is deterministic and never changes the game state', () => {
    const state = openGame('det');
    const before = structuredClone(state);
    const plan = testPlan(state, 'st_judes');
    const a = simulateRun(state, plan, 'seed-1', 1000);
    const b = simulateRun(state, plan, 'seed-1', 1000);
    assert.deepEqual(a, b);
    assert.deepEqual(state, before);
    assert.notDeepEqual(simulateRun(state, plan, 'seed-2', 1000).beats, a.beats);
  });

  test('holds its invariants across every location, job and set of orders', () => {
    let runs = 0;
    for (const loc of LOCATIONS) {
      for (let i = 0; i < 60; i++) {
        const state = openGame(`inv-${i % 7}`);
        const size = 1 + (i % 4);
        const plan = testPlan(state, loc.id, { job: JOBS[i % 3]!, approach: APPROACHES[(i >> 1) % 3]!, retreat: RETREATS[(i >> 2) % 3]! }, size);
        const duration = runDuration(state, plan);
        const run = simulateRun(state, plan, `inv-${loc.id}-${i}`, 5000);
        const { result, beats } = run;
        runs++;

        // Log shape.
        assert.equal(beats[0]!.kind, 'depart');
        assert.equal(beats.at(-1)!.kind, 'return');
        assert.ok(beats.length >= 2 && beats.length <= MAX_BEATS + 1, `beats ${beats.length}`);
        if (result.outcome === 'completed') assert.ok(beats.length >= MIN_BEATS + 1);
        for (let b = 1; b < beats.length; b++) assert.ok(beats[b]!.at >= beats[b - 1]!.at, 'beats in time order');
        assert.equal(run.returnAt, 5000 + beats.at(-1)!.at);
        assert.ok(beats.at(-1)!.at <= duration);
        for (const beat of beats) {
          assert.ok(beat.lines.length > 0, `${beat.kind} beat has text`);
          for (const line of beat.lines) {
            assert.ok(!/[{}]|undefined|NaN/.test(line.text), line.text);
          }
        }

        // People.
        assert.equal(result.crew.length, size);
        for (const s of result.crew) {
          assert.ok(s.hp >= 0 && s.hp <= maxHp(s) + 2, `${s.hp}/${maxHp(s)}`);
          assert.ok(s.stress >= 0 && s.stress <= 100);
          const dead = result.deaths.some((d) => d.survivorId === s.id);
          assert.equal(s.status === 'dead', dead);
          if (dead) assert.ok(s.causeOfDeath && s.diedDay);
          else assert.ok(s.hp > 0, 'the living have HP');
          assert.equal(new Set(s.traits.map((t) => t.id)).size, s.traits.length, 'no duplicate traits');
          for (const t of s.traits) assert.ok(getTrait(t.id));
        }
        if (result.outcome === 'lost') assert.equal(result.deaths.length, size);
        if (size >= 2) assert.notEqual(result.outcome, 'lost', 'someone always makes it home from a crew');

        // Loot.
        let total = result.items.length;
        for (const res of RESOURCE_IDS) {
          assert.ok(Number.isInteger(result.loot[res]) && result.loot[res] >= 0);
          total += result.loot[res];
        }
        const capacity = result.crew.filter((s) => s.status !== 'dead').reduce((sum, s) => sum + carryCapacity(s), 0);
        // What they carry is capped; out of a dangerous place each load is worth more (§7.6).
        const rich = richness(plan);
        assert.ok(total <= Math.ceil((capacity + CARRY_COST_DOWNED * size) * rich) + RESOURCE_IDS.length, `loot ${total} within carry ${capacity} x ${rich}`);
        if (result.outcome === 'routed' || result.outcome === 'lost') assert.equal(total, 0);
        // Events can add a little to what the crew carries (a trade), never much.
        assert.ok(result.medsLeft >= 0 && result.medsLeft <= plan.meds + 2);
        assert.ok(result.ammoLeft >= 0 && result.ammoLeft <= plan.ammo);
        for (const id of result.discovered) assert.ok(loc.leadsTo.includes(id));
      }
    }
    assert.equal(runs, LOCATIONS.length * 60);
  });

  test('every survivor who comes home has one more run, and first runs are chronicled', () => {
    const state = openGame('runs');
    const { result } = simulateRun(state, testPlan(state, 'rail_yard'), 'first', 0);
    assert.equal(result.deaths.length, 0);
    for (const s of result.crew) {
      assert.equal(s.counters.runs, 1);
      assert.ok(s.chronicle.some((c) => /First run for the guild: The Rail Yard/.test(c.text)));
    }
    assert.ok(result.highlights.length >= 3);
  });

  test('mercy mode: nobody dies, however reckless the run', () => {
    const state = openGame('mercy');
    state.settings.mercyMode = true;
    let downs = 0;
    for (let i = 0; i < 600; i++) {
      const { result } = simulateRun(state, testPlan(state, 'the_glow', { retreat: 'never', approach: 'aggressive' }, 1 + (i % 3)), `m${i}`, 0);
      assert.equal(result.deaths.length, 0);
      downs += result.crew.reduce((n, s) => n + s.counters.timesDowned, 0);
    }
    assert.ok(downs > 300, 'the runs really were dangerous');
  });
});

describe('traits shape what happens', () => {
  const fled = (beats: { lines: { text: string }[] }[], name: string): boolean =>
    beats.some((b) => b.lines.some((l) => l.text.startsWith(name) && /panics and bolts|nerve goes/.test(l.text)));

  test('the Cowardly sometimes run; the Brave never do', () => {
    let cowardRan = 0;
    let braveRan = 0;
    for (let i = 0; i < 300; i++) {
      const state = openGame(`flee-${i % 5}`);
      const [coward, brave] = state.survivors;
      for (const s of [coward!, brave!]) s.traits = [];
      addTrait(coward!, 'cowardly', { day: 1, silent: true });
      addTrait(brave!, 'brave', { day: 1, silent: true });
      const { beats } = simulateRun(state, testPlan(state, 'red_hand_camp', { job: 'hunt', retreat: 'never' }), `f${i}`, 0);
      if (fled(beats, coward!.firstName)) cowardRan++;
      if (fled(beats, brave!.firstName)) braveRan++;
    }
    assert.ok(cowardRan > 30, `coward ran ${cowardRan} times`);
    assert.equal(braveRan, 0);
  });

  test('a hidden trait that shows itself is revealed', () => {
    let revealed = 0;
    for (let i = 0; i < 200; i++) {
      const state = openGame(`hid-${i % 5}`);
      const s = state.survivors[0]!;
      s.traits = [];
      addTrait(s, 'cowardly', { day: 1, hidden: true });
      s.counters.runs = 0;
      const { beats, result } = simulateRun(state, testPlan(state, 'red_hand_camp', { job: 'hunt', retreat: 'never' }), `h${i}`, 0);
      const after = result.crew[0]!;
      if (fled(beats, s.firstName)) {
        revealed++;
        assert.ok(!after.traits.find((t) => t.id === 'cowardly')?.hidden, 'fleeing gives it away');
        assert.ok(after.chronicle.some((c) => /Showed a side nobody had seen: Cowardly/.test(c.text)));
      }
    }
    assert.ok(revealed > 10);
  });

  test('hidden traits always come out by the third run', () => {
    let checked = 0;
    for (let i = 0; i < 20; i++) {
      const state = openGame('third');
      const s = state.survivors[0]!;
      s.traits = [];
      addTrait(s, 'unlucky', { day: 1, hidden: true });
      s.counters.runs = 2;
      const { result } = simulateRun(state, testPlan(state, 'rail_yard'), `s${i}`, 0);
      const after = result.crew[0]!;
      if (after.status === 'dead') continue;
      checked++;
      assert.equal(after.counters.runs, 3);
      assert.ok(after.traits.every((t) => !t.hidden));
    }
    assert.ok(checked >= 15);
  });

  test('a trinket carried for five runs becomes Cherished', () => {
    const state = openGame('cherish');
    const s = state.survivors[0]!;
    s.equipment.trinket = { uid: 'i999', defId: 'old_photo', quality: 'common', runsWithHolder: 4 };
    const { result } = simulateRun(state, testPlan(state, 'rail_yard', {}, 1), 'calm-day', 0);
    const after = result.crew[0]!;
    assert.notEqual(after.status, 'dead');
    assert.equal(after.equipment.trinket!.cherishedBy, s.id);
    assert.ok(after.chronicle.some((c) => /Would not part with the Old Photo/.test(c.text)));
  });

  test('a Geiger counter lets the crew walk around hot zones', () => {
    const withCounter = { avoided: 0, hit: 0 };
    for (let i = 0; i < 150; i++) {
      const state = openGame(`geiger-${i % 5}`);
      state.survivors[0]!.equipment.tool = { uid: 'i998', defId: 'geiger_counter', quality: 'common' };
      const { beats } = simulateRun(state, testPlan(state, 'the_glow', { approach: 'sneaky' }), `g${i}`, 0);
      for (const b of beats) {
        if (b.title !== 'Hot Zone') continue;
        if (b.lines.some((l) => /Geiger counter/.test(l.text))) withCounter.avoided++;
        else withCounter.hit++;
      }
    }
    assert.ok(withCounter.avoided > 20);
    assert.equal(withCounter.hit, 0);
  });
});

describe('relationships on the road', () => {
  test('time together moves relationships, and rescues create a life debt', () => {
    let moved = 0;
    let debts = 0;
    // A large sample: rescues are rare, and a small one swings with any change to the dice.
    for (let i = 0; i < 1200; i++) {
      const state = openGame(`rel-${i % 6}`);
      const plan = testPlan(state, 'water_plant', { retreat: 'never' });
      // Give the crew a healer so that help can make the difference.
      const medic = state.survivors[0]!;
      if (!hasTrait(medic, 'patcher')) addTrait(medic, 'patcher', { day: 1, silent: true, force: true });
      const { result } = simulateRun(state, plan, `r${i}`, 0);
      for (const rel of result.relationships) {
        const before = state.relationships[`${rel.a}|${rel.b}`]!;
        if (rel.score !== before.score) moved++;
        if (rel.flags.some((f) => f.kind === 'owesLife')) {
          debts++;
          assert.ok(rel.score >= before.score + 20, 'a rescue is a big deal');
          const debtor = result.crew.find((s) => rel.flags.some((f) => f.kind === 'owesLife' && f.debtor === s.id))!;
          assert.ok(debtor.chronicle.some((c) => /Owes .* a life/.test(c.text)));
        }
      }
    }
    assert.ok(moved > 2000, `relationships moved ${moved} times`);
    assert.ok(debts > 10, `life debts: ${debts}`);
  });

  test('feuding crews argue more than friendly ones', () => {
    const count = (score: number): number => {
      let args = 0;
      for (let i = 0; i < 200; i++) {
        const state = openGame(`arg-${i % 5}`);
        const [a, b, c] = state.survivors;
        for (const s of [a!, b!, c!]) s.traits = [];
        for (const [x, y] of [[a!, b!], [a!, c!], [b!, c!]] as const) {
          state.relationships[[x.id, y.id].sort().join('|')]!.score = 0;
          adjustRelationship(state, x.id, y.id, score, { day: 1, silent: true, useTraitMult: false });
        }
        const { beats } = simulateRun(state, testPlan(state, 'radio_station', { approach: 'sneaky' }), `a${i}`, 0);
        args += beats.filter((bt) => bt.title === 'Argument').length;
      }
      return args;
    };
    const feuding = count(-70);
    const friendly = count(70);
    assert.ok(feuding > friendly * 2, `feuding ${feuding} vs friendly ${friendly}`);
  });
});
