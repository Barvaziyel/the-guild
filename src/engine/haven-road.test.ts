import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HAVEN_CARAVAN_SEAT, HAVEN_VULTURE_STANDING } from './constants.ts';
import { HAVEN_CLUES, HAVEN_JOURNEY, HAVEN_VULTURES } from './content/index.ts';
import { scheduleRaid } from './depot/raids.ts';
import { advanceTime } from './depot/time.ts';
import { roadTeam } from './expedition/haven-road.ts';
import { dueRuns, heldAt, letThemFight, takeCommand, visibleBeats } from './expedition/runs.ts';
import { simulateRun } from './expedition/sim.ts';
import { buyCaravan, caravanCost, caravanProblem, onHavenRoad, roadPlan, roadProblems, roadSeats, setOutForHaven, vulturesStayAway, vulturesWord } from './haven-road.ts';
import { havenRoadOpen, startHaven } from './haven.ts';
import { Rng } from './rng.ts';
import { openGame, T0, testSurvivor } from './test-utils.ts';
import type { GameState, Run } from './types.ts';
import { makeMember } from './vultures.ts';

/** A guild that knows the way: every clue found, a Cargo Van, gas, and four people. */
function roadGuild(seed: string, opts: { children?: number; vultures?: boolean; van?: boolean } = {}): GameState {
  const state = openGame(seed);
  startHaven(state, 1);
  for (const c of HAVEN_CLUES) state.haven!.found.push({ id: c.id, day: 2 });
  if (opts.van !== false) state.vehicles.push({ id: 'v-van', defId: 'van', condition: 100, runs: 0 });
  state.resources.gas = 100;
  state.resources.scrap = 500;
  state.resources.tech = 50;
  for (let i = 0; i < (opts.children ?? 0); i++) state.children.push(testSurvivor(`child${i}`, { firstName: `Kid${i}`, age: 6 }));
  if (opts.vultures) {
    const rng = new Rng(`v:${seed}`);
    const v = state.vultures;
    v.arrived = true;
    v.camps = [{ locationId: 'drowned_mall', since: 1, home: true }];
    v.people = [makeMember(state, rng, 1, 'boss'), makeMember(state, rng, 1, 'lieutenant'), makeMember(state, rng, 1, 'lieutenant')];
    state.haven!.found.push({ id: HAVEN_VULTURES.id, day: 3 });
  }
  return state;
}

/** Leave every fight to them and bring the guild home. */
function goAndComeHome(state: GameState, at = T0 + 60_000): Run {
  const run = setOutForHaven(state, at);
  // Every fight waits for the word, however long (§9.12): the word comes a minute in, to fight it out.
  for (;;) {
    const live = state.runs.find((r) => r.id === run.id);
    const f = live?.lead?.fights.find((x) => x.ended === undefined);
    if (!live || !f) break;
    letThemFight(state, run.id, f.at + 60_000);
  }
  advanceTime(state, state.runs.find((r) => r.id === run.id)!.returnAt + 1000);
  return run;
}

describe('the road east: the fights wait for the word (§9.12)', () => {
  test('a fight waits as long as it takes: never fought on their own, the run held, what comes after hidden', () => {
    const state = roadGuild('wait');
    const run = setOutForHaven(state, T0);
    const f = run.lead!.fights[0]!;
    const later = f.at + 3 * 24 * 3_600_000;
    advanceTime(state, later);
    const live = state.runs.find((r) => r.id === run.id)!;
    assert.ok(live, 'still out three days later');
    assert.equal(live.lead!.fights[0]!.ended, undefined, 'never settled on their own');
    assert.equal(heldAt(live, later), live.lead!.fights[0]);
    assert.deepEqual(dueRuns(state, later), [], 'not home while the fight waits');
    assert.equal(visibleBeats(live, later).length, f.fromBeat, 'nothing after the fight shows');
    // Taken up late, it plays from then on.
    const view = takeCommand(state, run.id, later);
    assert.ok(view, 'in command, days later');
    advanceTime(state, later + 2 * 3_600_000);
    assert.equal(live.lead!.fights[0]!.ended, undefined, 'still waiting on the next round’s orders');
    letThemFight(state, run.id, later + 2 * 3_600_000);
    assert.ok(live.lead!.fights[0]!.ended !== undefined);
    assert.ok(live.returnAt > later, 'the rest of the road comes after it');
  });
});

describe('the road east: the Vultures’ word before it (§9.12)', () => {
  test('what they send depends on how things stand with them; without their word, nobody comes', () => {
    const state = roadGuild('word', { vultures: true });
    const boss = state.vultures.people.find((p) => p.role === 'boss')!.person.firstName;
    for (const [standing, band] of [[90, 'trade'], [10, 'truce'], [-20, 'wary'], [-90, 'war']] as const) {
      state.vultures.standing = standing;
      assert.deepEqual(vulturesWord(state), { by: boss, text: HAVEN_JOURNEY.word[band] }, band);
    }
    assert.equal(vulturesStayAway(state), false);
    state.haven!.found = state.haven!.found.filter((f) => f.id !== HAVEN_VULTURES.id);
    assert.equal(vulturesWord(state), undefined);
    assert.equal(vulturesStayAway(state), true);
    assert.equal(vulturesStayAway(roadGuild('none')), false, 'never met them: nothing to say');
  });
});

describe('the road east: setting out (§9.12)', () => {
  test('everyone rides, the children too, and a caravan makes up the rest', () => {
    const state = roadGuild('seats', { children: 2, van: false });
    state.vehicles.push({ id: 'v-bike', defId: 'motorcycle', condition: 100, runs: 0 });
    const seats = roadSeats(state);
    assert.equal(seats.people, state.survivors.length);
    assert.equal(seats.children, 2);
    assert.equal(seats.seats, 2);
    assert.equal(seats.short, state.survivors.length + 2 - 2);
    assert.ok(roadProblems(state).some((p) => p.startsWith('Not everyone has a seat')));
    const scrap = state.resources.scrap;
    buyCaravan(state, T0);
    assert.equal(state.resources.scrap, scrap - seats.short * HAVEN_CARAVAN_SEAT.scrap);
    assert.equal(roadSeats(state).short, 0);
    assert.equal(caravanProblem(state), 'Everyone has a seat already.');
    assert.deepEqual(roadProblems(state), []);
    assert.deepEqual(caravanCost(3), { scrap: 3 * HAVEN_CARAVAN_SEAT.scrap, tech: 3 * HAVEN_CARAVAN_SEAT.tech });
  });

  test('a broken vehicle doesn’t count, and the hurt go anyway', () => {
    const state = roadGuild('hurt');
    state.survivors[0]!.traits.push({ id: 'wounded', gainedDay: 1 });
    state.vehicles.push({ id: 'v-dead', defId: 'pickup', condition: 0, runs: 0 });
    assert.deepEqual(roadPlan(state).vehicles, ['v-van']);
    assert.deepEqual(roadProblems(state), []);
  });

  test('what stops it: not knowing the way, a crew out, raiders seen, a corner search; not someone at an outpost', () => {
    const state = roadGuild('stops');
    assert.ok(havenRoadOpen(state));
    state.survivors[1]!.outpost = 'maple_street';
    assert.deepEqual(roadProblems(state), [], 'they come in first');
    const lost = roadGuild('lost');
    lost.haven!.found = lost.haven!.found.filter((f) => f.id !== 'bearing');
    assert.ok(roadProblems(lost).includes('The guild doesn’t know the way yet.'));
    const out = roadGuild('out');
    out.survivors[0]!.status = 'away';
    out.runs.push({ id: 'r1' } as Run);
    assert.ok(roadProblems(out).includes('A crew is still out. Everyone goes together.'));
    const raided = roadGuild('raided');
    const raid = scheduleRaid(raided, 1, new Rng('r'), 'raiders')!;
    assert.deepEqual(roadProblems(raided), [], 'nobody has seen them');
    raid.seen = T0;
    assert.ok(roadProblems(raided).includes('Raiders are coming. Deal with them first.'));
  });

  test('setting out: everyone goes, outposts come in, the children ride, the caravan is used, unseen raiders move on, and whoever was listening goes ahead', () => {
    const state = roadGuild('go', { children: 1 });
    state.survivors.push(testSurvivor('extra', { firstName: 'Wren', joinedDay: 0 }));
    const dreamer = state.survivors.at(-1)!;
    state.haven!.dreamer = { id: dreamer.id, day: 5, ready: 6 };
    state.survivors[0]!.outpost = 'maple_street';
    state.haven!.caravan = 1;
    scheduleRaid(state, 1, new Rng('r'), 'raiders');
    const run = setOutForHaven(state, T0 + 60_000);
    assert.equal(run.plan.job, 'haven');
    assert.equal(run.plan.locationId, 'corwin_dam');
    assert.ok(!state.survivors.includes(dreamer) && state.departed.some((s) => s.id === dreamer.id), 'gone ahead of them');
    assert.deepEqual(run.plan.crew, state.survivors.map((s) => s.id));
    assert.ok(state.survivors.every((s) => s.status === 'away' && s.outpost === undefined));
    assert.deepEqual(state.haven!.road, { runId: run.id, children: ['child0'] });
    assert.equal(state.haven!.caravan, undefined);
    assert.equal(state.depot.raid, undefined);
    assert.ok(onHavenRoad(state));
    assert.equal(run.lead?.fights.length, 3, 'three fights, each under command');
    assert.equal(scheduleRaid(state, 2, new Rng('r2'), 'raiders'), undefined, 'nobody comes while they’re away');
    assert.throws(() => setOutForHaven(state, T0 + 120_000), /on the road already/);
  });
});

describe('the road east: the road (§9.12)', () => {
  test('in order: the highway, Red Hand, a white truck, the Glow road, the dam, the gate, the end, home; about two and a half hours', () => {
    for (let i = 0; i < 10; i++) {
      const state = roadGuild(`order-${i}`);
      const sim = simulateRun(state, { ...roadPlan(state), lead: false }, `o-${i}`, T0);
      const titles = sim.beats.map((b) => b.title);
      const want = ['Setting Out', HAVEN_JOURNEY.highway.title, HAVEN_JOURNEY.toll.title, HAVEN_JOURNEY.truck.title, HAVEN_JOURNEY.glow.title, HAVEN_JOURNEY.dam.title, HAVEN_JOURNEY.gate.title];
      let at = 0;
      for (const t of want) {
        const j = titles.indexOf(t, at);
        assert.ok(j >= 0, `${t} in ${titles.join(' / ')}`);
        at = j + 1;
      }
      const end = sim.result.havenEnd!;
      assert.ok(titles.includes(end.won ? HAVEN_JOURNEY.won.title : HAVEN_JOURNEY.lost.title));
      assert.equal(titles.at(-1), 'Home');
      assert.equal(sim.returnAt - T0, 155 * 60_000);
      // The white truck is no fight: nobody knows yet.
      const truck = sim.beats.find((b) => b.title === HAVEN_JOURNEY.truck.title)!;
      assert.equal(truck.kind, 'travel');
    }
  });

  test('the six in best shape fight; the rest stay with the vehicles', () => {
    const state = roadGuild('team');
    for (let i = 0; i < 6; i++) state.survivors.push(testSurvivor(`more${i}`, { firstName: `More${i}`, hp: 4 + i }));
    const sim = simulateRun(state, { ...roadPlan(state), lead: false }, 'team', T0);
    const toll = sim.beats.find((b) => b.title === HAVEN_JOURNEY.toll.title)!;
    assert.match(toll.lines.map((l) => l.text).join(' '), /go forward\. The others stay with the vehicles\./);
    const fake = { members: state.survivors.map((s) => ({ s, down: false, dead: false, fled: false })) } as never;
    const team = roadTeam(fake);
    assert.equal(team.length, 6);
    assert.ok(!team.some((m: { s: { id: string } }) => m.s.id === 'more0' || m.s.id === 'more1'), 'the most hurt stay back');
  });

  test('at the gate: the one who went east, or a stranger; and nobody dies there', () => {
    for (let i = 0; i < 30; i++) {
      const state = roadGuild(`gate-${i}`);
      const went = i % 2 === 0;
      if (went) {
        const s = testSurvivor(`east${i}`, { firstName: 'Rosa', status: 'left' });
        state.departed.push(s);
        state.haven!.dreamer = { id: s.id, day: 5, ready: 6, gone: 8 };
      }
      const sim = simulateRun(state, { ...roadPlan(state), lead: false }, `g-${i}`, T0);
      const gate = sim.beats.findIndex((b) => b.title === HAVEN_JOURNEY.gate.title);
      const text = sim.beats[gate]!.lines.map((l) => l.text).join(' ');
      assert.equal(text.includes('Rosa comes running out barefoot'), went);
      assert.equal(text.includes('a woman comes running out barefoot'), !went);
      assert.equal(sim.result.havenEnd!.shot, went ? `east${i}` : undefined);
      const after = sim.beats.slice(gate).flatMap((b) => b.lines.map((l) => l.text));
      assert.ok(!after.some((t) => t.includes('There is nothing anyone can do.')), 'nobody dies at the gate');
      if (went) for (const s of sim.result.crew) assert.ok(s.chronicle.some((c) => c.text === 'Saw Rosa shot at Haven’s gate.'));
    }
  });

  test('the Vultures come once they’ve given their word, fight beside the guild, and never come home with it', () => {
    let fought = 0;
    for (let i = 0; i < 20; i++) {
      const state = roadGuild(`allies-${i}`, { vultures: true });
      const sim = simulateRun(state, { ...roadPlan(state), lead: false }, `a-${i}`, T0);
      const gate = sim.beats.find((b) => b.title === HAVEN_JOURNEY.gate.title)!;
      const boss = state.vultures.people[0]!.person.firstName;
      assert.ok(gate.lines.some((l) => l.text.startsWith(`Engines on the road behind them: the Vultures, as they promised. ${boss} jumps down`)));
      assert.ok(sim.result.havenEnd!.vultures);
      assert.deepEqual(sim.result.crew.map((s) => s.id).sort(), state.survivors.map((s) => s.id).sort());
      if (gate.lines.some((l) => l.text.includes(boss) && /hits|shoots|strikes|swings|is hit|is cut|is torn/.test(l.text))) fought++;
    }
    assert.ok(fought > 0, 'the boss is in the fight');
    // Without their word, they don't come.
    const state = roadGuild('no-word', { vultures: true });
    state.haven!.found = state.haven!.found.filter((f) => f.id !== HAVEN_VULTURES.id);
    const sim = simulateRun(state, { ...roadPlan(state), lead: false }, 'nw', T0);
    assert.equal(sim.result.havenEnd!.vultures, false);
  });

  test('a strong guild beside the Vultures usually wins; four new hands alone usually don’t', () => {
    let strong = 0;
    let weak = 0;
    const n = 60;
    for (let i = 0; i < n; i++) {
      const s = roadGuild(`strong-${i}`, { vultures: true });
      for (let k = 0; k < 4; k++) s.survivors.push(testSurvivor(`vet${k}`, { firstName: `Vet${k}`, hp: 24, stats: { brawn: 8, wits: 7, nerve: 8, aim: 8, grit: 8 } }));
      for (const p of s.survivors) {
        p.stats = { brawn: 8, wits: 7, nerve: 8, aim: 8, grit: 8 };
        p.hp = 24;
        p.equipment = { weapon: { uid: `w-${p.id}`, defId: 'hunting_rifle', quality: 'solid' }, armor: { uid: `a-${p.id}`, defId: 'riot_gear', quality: 'solid' } };
      }
      if (simulateRun(s, { ...roadPlan(s), lead: false }, `s-${i}`, T0).result.havenEnd!.won) strong++;
      const w = roadGuild(`weak-${i}`);
      if (simulateRun(w, { ...roadPlan(w), lead: false }, `w-${i}`, T0).result.havenEnd!.won) weak++;
    }
    assert.ok(strong / n > 0.5, `strong won ${strong} of ${n}`);
    assert.ok(weak / n < 0.3, `weak won ${weak} of ${n}`);
  });
});

describe('the road east: home again (§9.12)', () => {
  test('the end is kept for good, the one who went east is on the Memorial Wall, and the guild is home', () => {
    const state = roadGuild('home', { vultures: true });
    const s = testSurvivor('east', { firstName: 'Rosa', status: 'left' });
    state.departed.push(s);
    state.haven!.dreamer = { id: s.id, day: 5, ready: 6, gone: 8 };
    const standing = state.vultures.standing;
    goAndComeHome(state);
    const end = state.haven!.end!;
    assert.ok(end);
    assert.equal(state.haven!.road, undefined);
    assert.ok(!onHavenRoad(state));
    assert.ok(state.memorial.some((m) => m.id === 'east' && m.chronicle.at(-1)!.text === HAVEN_JOURNEY.shot));
    assert.ok(!state.departed.some((m) => m.id === 'east'));
    assert.equal(state.vultures.standing, Math.min(100, standing + (end.won ? HAVEN_VULTURE_STANDING.won : HAVEN_VULTURE_STANDING.lost)));
    assert.ok(state.survivors.every((p) => p.status !== 'away'));
    assert.ok(state.log.some((l) => l.text === (end.won ? 'Haven is finished.' : 'Haven goes on.')));
    assert.throws(() => setOutForHaven(state, T0 + 10 * 3_600_000), /over now/);
  });

  test('won: the freed fill the free beds, and the rest go with the Vultures', () => {
    let checked = 0;
    for (let i = 0; i < 40 && checked < 3; i++) {
      const state = roadGuild(`freed-${i}`, { vultures: true });
      for (const p of state.survivors) {
        p.stats = { brawn: 9, wits: 7, nerve: 9, aim: 9, grit: 9 };
        p.hp = 26;
        p.equipment = { weapon: { uid: `w-${p.id}`, defId: 'hunting_rifle', quality: 'solid' }, armor: { uid: `a-${p.id}`, defId: 'riot_gear', quality: 'solid' } };
      }
      const people = state.survivors.length;
      const strength = state.vultures.strength;
      const run = goAndComeHome(state);
      const report = state.reports.find((r) => r.id === run.id)!;
      const end = report.summary.havenEnd!;
      if (!end.won) continue;
      checked++;
      const freed = end.freed!.length;
      const joined = state.haven!.end!.freed;
      assert.equal(joined + state.haven!.end!.withVultures, freed);
      assert.ok(state.survivors.length >= people + joined - 1);
      if (state.haven!.end!.withVultures > 0) assert.ok(state.vultures.strength > strength);
      assert.ok(state.survivors.some((p) => p.chronicle.some((c) => c.text === HAVEN_JOURNEY.freed)) === joined > 0);
    }
    assert.equal(checked, 3);
  });
});
