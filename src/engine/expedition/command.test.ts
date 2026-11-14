import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { LEAD_WAIT } from '../constants.ts';
import { LOCATIONS } from '../content/index.ts';
import { advanceTime } from '../depot/time.ts';
import { createItem } from '../gear.ts';
import { Rng } from '../rng.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import type { GameState, RoundOrders, Run, RunJob } from '../types.ts';
import type { FightView } from './command.ts';
import { validatePlan } from './plan.ts';
import { commandRound, fightNow, fightPreview, lastFought, ledFightNow, letThemFight, startRun, takeCommand } from './runs.ts';
import { runStart, simulateRun } from './sim.ts';
import { takenNames } from './stories.ts';

const PLACES = ['kessler_farm', 'old_metro', 'drowned_mall', 'st_judes', 'radio_station', 'water_plant'];

function guild(seed: string): GameState {
  const state = openGame(seed);
  state.buildings.radio_tower = 1;
  return state;
}

/** Send a led crew out until one stops at a fight. */
function ledRun(seed: string, opts: { job?: RunJob; place?: string; setup?: (s: GameState) => void } = {}): { state: GameState; run: Run } {
  for (let i = 0; i < 500; i++) {
    const state = guild(`${seed}-${i % 7}`);
    opts.setup?.(state);
    state.rng = new Rng(`${seed}-${i}`).getState();
    const run = startRun(state, { ...testPlan(state, opts.place ?? PLACES[i % PLACES.length]!, { job: opts.job ?? 'hunt', meds: 2 }), lead: true }, T0);
    if (run.lead!.fights.length > 0) return { state, run };
  }
  throw new Error('no led run came to a fight');
}

/** A simple commander: get the downed up, cover the badly hurt, everyone else at the weakest enemy. */
function orders(v: FightView): RoundOrders {
  const up = v.enemies.filter((e) => e.state === 'up');
  const weakest = up.reduce((a, b) => (b.hp < a.hp ? b : a), up[0]!);
  const moves: RoundOrders['moves'] = {};
  const downed = v.crew.find((o) => o.state === 'down');
  for (const m of v.crew) {
    if (m.moves.length === 0) continue;
    const has = (id: string) => m.moves.find((c) => c.move === id);
    if (downed && has('patch')?.targets.includes(downed.id)) moves[m.id] = { move: 'patch', target: downed.id };
    else if (m.hp < m.maxHp * 0.35) moves[m.id] = { move: 'cover' };
    else {
      const talk = (['intimidate', 'soothe', 'short_out'] as const).map(has).find((c) => c && c.targets.length > 0);
      moves[m.id] = talk ? { move: talk.move, target: talk.targets[0]! } : { move: 'attack', target: weakest.index };
    }
  }
  return { moves };
}

/** Command a fight to its end. */
function command(state: GameState, run: Run, at: number): FightView[] {
  const views: FightView[] = [];
  let now = at;
  let view = takeCommand(state, run.id, now);
  while (view) {
    views.push(view);
    now += 30_000;
    view = commandRound(state, run.id, orders(view), now);
  }
  return views;
}

describe('the start copy', () => {
  test('a run played from its start copy comes out exactly as from the guild', () => {
    for (let i = 0; i < 120; i++) {
      const state = guild(`copy-${i % 5}`);
      const plan = { ...testPlan(state, LOCATIONS[i % LOCATIONS.length]!.id, { job: (['scavenge', 'scout', 'hunt'] as const)[i % 3] }), lead: i % 2 === 0 };
      const direct = simulateRun(state, plan, `c${i}`, T0);
      const copy = structuredClone(runStart(state, plan));
      const replay = simulateRun(copy, plan, `c${i}`, T0, { taken: [...takenNames(state)] });
      assert.deepEqual(replay, direct);
    }
  });

  test('any crew can be led, with or without a Radio Tower', () => {
    const state = openGame('no-radio');
    state.buildings.radio_tower = 0;
    assert.deepEqual(validatePlan(state, { ...testPlan(state), lead: true }), []);
  });
});

describe('a led run', () => {
  test('nobody answers: at every fight they call, wait half an hour, then fight on their own', () => {
    const { run } = ledRun('wait');
    for (const f of run.lead!.fights) {
      assert.equal(f.until - f.at, LEAD_WAIT);
      const called = run.beats[f.fromBeat - 1]!;
      assert.match(called.lines.at(-1)!.text, /gets on the radio to the Depot\.$/);
      const fight = run.beats[f.fromBeat]!;
      assert.equal(fight.title, 'No word from home');
      assert.equal(run.departAt + fight.at, f.until);
    }
    assert.equal(ledFightNow(run, run.lead!.fights[0]!.at - 1), undefined);
    assert.equal(ledFightNow(run, run.lead!.fights[0]!.at), run.lead!.fights[0]);
  });

  test('in command: round by round, then the run goes on from the moment it ended', () => {
    const { state, run } = ledRun('cmd');
    const f = run.lead!.fights[0]!;
    const fallback = run.returnAt;
    const views = command(state, run, f.at + 2 * 60_000);
    assert.ok(views.length >= 1);
    for (const [k, v] of views.entries()) {
      assert.ok(v.round >= 1 && v.round <= v.maxRounds);
      if (k > 0) assert.ok(v.round > views[k - 1]!.round);
      for (const m of v.crew) if (m.state === 'up') assert.ok(m.moves.some((c) => c.move === 'attack') && m.moves.some((c) => c.move === 'cover'));
    }
    assert.ok(f.ended !== undefined && f.ended < f.until);
    assert.equal(f.rounds.length, views.length);
    const beat = run.beats[f.fromBeat]!;
    assert.equal(beat.title, 'Under orders');
    assert.equal(run.departAt + beat.at, f.ended);
    assert.ok(run.returnAt < fallback, 'back sooner than if they had waited');
    for (let b = 1; b < run.beats.length; b++) assert.ok(run.beats[b]!.at >= run.beats[b - 1]!.at);
    assert.throws(() => commandRound(state, run.id, { moves: {} }, f.ended! + 1000), /no fight waiting/);
  });

  test('replays are the same every time, and survive saving and loading', () => {
    const { state, run } = ledRun('same');
    const f = run.lead!.fights[0]!;
    const at = f.at + 60_000;
    const first = takeCommand(state, run.id, at)!;
    assert.deepEqual(fightNow(state, run.id, at + 1000), first);
    const loaded = deserialize(serialize(state));
    assert.equal(serialize(loaded), serialize(state));
    assert.deepEqual(fightNow(loaded, run.id, at + 2000), first);
  });

  test('let them fight: they go in on their own at once', () => {
    const { state, run } = ledRun('let');
    const f = run.lead!.fights[0]!;
    const sent = f.at + 5 * 60_000;
    letThemFight(state, run.id, sent);
    assert.equal(f.ended, sent);
    assert.equal(f.auto, true);
    const beat = run.beats[f.fromBeat]!;
    assert.equal(beat.title, 'Word from home');
    assert.equal(run.departAt + beat.at, sent);
  });

  test('time runs out under command: they fight the rest of it on their own', () => {
    const { state, run } = ledRun('late');
    const f = run.lead!.fights[0]!;
    const view = takeCommand(state, run.id, f.at + 60_000);
    if (view) commandRound(state, run.id, orders(view), f.at + 2 * 60_000);
    if (f.ended !== undefined) return; // over in one round: nothing left to run out
    advanceTime(state, f.until + 1000);
    assert.equal(f.ended, f.until);
    assert.equal(f.auto, true);
    assert.equal(f.rounds.length, 1);
    assert.equal(run.departAt + run.beats[f.fromBeat]!.at, f.until);
    assert.throws(() => commandRound(state, run.id, { moves: {} }, f.until + 2000), /no fight waiting/);
  });

  test('the report says how many fights were led', () => {
    const { state, run } = ledRun('report');
    const f = run.lead!.fights[0]!;
    command(state, run, f.at + 60_000);
    for (let next; (next = run.lead!.fights.find((x) => x.ended === undefined)); ) letThemFight(state, run.id, next.at + 1000);
    advanceTime(state, run.returnAt + 1000);
    const report = state.reports.find((r) => r.id === run.id)!;
    assert.equal(report.lead?.fights, run.lead!.fights.length);
    assert.ok(report.lead!.commanded >= (f.rounds.length > 0 ? 1 : 0));
  });
});

describe('moves', () => {
  test('gear and traits add moves; hidden traits add none', () => {
    const { state, run } = ledRun('moves', {
      setup: (s) => {
        const [a, b, c] = s.survivors;
        a!.equipment.weapon = createItem(s, 'hunting_rifle');
        a!.traits = [{ id: 'hothead', gainedDay: 0 }];
        b!.equipment.armor = createItem(s, 'riot_gear');
        b!.traits = [{ id: 'brave', gainedDay: 0, hidden: true }];
        c!.equipment.weapon = createItem(s, 'sledge');
        c!.equipment.tool = createItem(s, 'binoculars');
      },
    });
    const view = takeCommand(state, run.id, run.lead!.fights[0]!.at + 1000);
    if (!view) return; // over before they could act
    const [a, b, c] = run.plan.crew.map((id) => view.crew.find((m) => m.id === id)!);
    const names = (m: typeof a) => (m && m.state === 'up' ? m.moves.map((x) => x.move) : undefined);
    const ma = names(a);
    if (ma) {
      assert.ok(ma.includes('called_shot') && ma.includes('charge') && ma.includes('aim'));
      assert.equal(a!.moves.find((x) => x.move === 'attack')!.name, 'Shoot');
    }
    const mb = names(b);
    if (mb) {
      assert.ok(mb.includes('guard'));
      assert.ok(!mb.includes('draw_fire'), 'a hidden Brave adds nothing');
    }
    const mc = names(c);
    if (mc) {
      assert.ok(mc.includes('smash') && !mc.includes('aim'));
      if (view.crew.filter((m) => m.state === 'up').length > 1) assert.ok(mc.includes('spot'));
      assert.equal(c!.moves.find((x) => x.move === 'attack')!.name, 'Strike');
    }
  });

  test('patching up gets someone who is down back on their feet', () => {
    let revived = 0;
    for (let i = 0; i < 300 && revived < 3; i++) {
      const { state, run } = ledRun(`patch-${i}`, { place: 'drowned_mall' });
      const views = command(state, run, run.lead!.fights[0]!.at + 1000);
      const lines = run.beats[run.lead!.fights[0]!.fromBeat]!.lines.map((l) => l.text);
      if (lines.some((t) => /gets \w+ back on (his|her) feet/.test(t))) revived++;
      for (const v of views) for (const m of v.crew) if (m.state === 'down') assert.ok(m.moves.length === 0);
    }
    assert.ok(revived >= 3, `${revived} got back up`);
  });

  test('someone with burn scars can stare a raider into running', () => {
    let ran = 0;
    for (let i = 0; i < 200 && ran < 2; i++) {
      const { state, run } = ledRun(`scare-${i}`, {
        job: 'scavenge',
        place: 'kessler_farm',
        setup: (s) => {
          for (const x of s.survivors) x.traits = [{ id: 'burn_scars', gainedDay: 0 }];
        },
      });
      command(state, run, run.lead!.fights[0]!.at + 1000);
      if (run.beats[run.lead!.fights[0]!.fromBeat]!.lines.some((l) => /breaks and runs\./.test(l.text))) ran++;
    }
    assert.ok(ran >= 2);
  });
});

describe('orders whose target is gone', () => {
  test('they keep the move and turn it on the enemy next to it', () => {
    let turned = 0;
    for (let i = 0; i < 40 && turned === 0; i++) {
      const { state, run } = ledRun(`retarget-${i}`, { setup: (s) => s.survivors.forEach((x) => (x.stats.aim = x.stats.brawn = 9)) });
      const f = run.lead!.fights[0]!;
      let now = f.at + 60_000;
      let view = takeCommand(state, run.id, now);
      while (view) {
        // Everyone at the weakest enemy: whoever goes last often finds it already down.
        const up = view.enemies.filter((e) => e.state === 'up');
        const weakest = up.reduce((a, b) => (b.hp < a.hp ? b : a), up[0]!);
        const moves: RoundOrders['moves'] = {};
        for (const m of view.crew) if (m.moves.some((c) => c.move === 'attack')) moves[m.id] = { move: 'attack', target: weakest.index };
        now += 30_000;
        const next = commandRound(state, run.id, { moves }, now);
        if (!next) break;
        turned += next.lines.filter((l) => /^\w+'s target is gone\. (He|She) turns to .+\.$/.test(l.text)).length;
        view = next;
      }
    }
    assert.ok(turned > 0, 'someone turned to another enemy');
  });
});

describe('the battle stage', () => {
  test('every act names who did it and to whom, points at a line, and the hits add up to what the enemies lost', () => {
    let checked = 0;
    for (let k = 0; k < 12; k++) {
      const { state, run } = ledRun(`acts-${k}`);
      const f = run.lead!.fights[0]!;
      let now = f.at + 60_000;
      let view = takeCommand(state, run.id, now);
      let before: FightView | undefined = view;
      while (view) {
        const ids = new Set(view.crew.map((m) => m.id));
        for (const a of view.acts) {
          const side = (x: number | string) => (typeof x === 'number' ? x >= 0 && x < view!.enemies.length : ids.has(x));
          assert.ok(side(a.by), `who: ${JSON.stringify(a)}`);
          if (a.at !== undefined) assert.ok(side(a.at), `at whom: ${JSON.stringify(a)}`);
          assert.ok(a.line >= 0 && a.line <= view.lines.length, `line: ${JSON.stringify(a)}`);
          assert.ok(a.round >= 1 && a.round < view.round + 1);
        }
        if (before && before !== view) {
          // What the crew did to each enemy since the last view is what it lost.
          const fresh = view.acts.slice(before.acts.length);
          for (const e of view.enemies) {
            const dealt = fresh.filter((a) => a.at === e.index && (a.kind === 'hit' || a.kind === 'kill')).reduce((t, a) => t + a.amount!, 0);
            const lost: number = before.enemies[e.index]!.hp - e.hp;
            assert.equal(lost, Math.min(dealt, before.enemies[e.index]!.hp), `${e.name}: lost ${lost}, dealt ${dealt}`);
          }
          checked++;
        }
        before = view;
        now += 20_000;
        view = commandRound(state, run.id, orders(view), now);
      }
    }
    assert.ok(checked >= 10, `rounds checked: ${checked}`);
  });

  test('the acts of a round carry the moves given: aiming, cover, a called shot that lands or misses', () => {
    const { state, run } = ledRun('acts-moves', {
      setup: (s) => {
        s.survivors[0]!.equipment.weapon = createItem(s, 'hunting_rifle');
      },
    });
    const f = run.lead!.fights[0]!;
    const view = takeCommand(state, run.id, f.at + 1000)!;
    const [a, b] = view.crew.filter((m) => m.moves.length > 0);
    const target = view.enemies.find((e) => e.state === 'up')!.index;
    const moves: RoundOrders['moves'] = {};
    if (a) moves[a.id] = a.moves.some((c) => c.move === 'called_shot') ? { move: 'called_shot', target } : { move: 'aim' };
    if (b) moves[b.id] = { move: 'cover' };
    const next = commandRound(state, run.id, { moves }, f.at + 2000);
    const acts = (next ?? lastFought(state, run.id)!).acts.slice(view.acts.length);
    if (a) assert.ok(acts.some((x) => x.by === a.id && ['hit', 'miss', 'kill', 'aim'].includes(x.kind)), JSON.stringify(acts));
    if (b) assert.ok(acts.some((x) => x.by === b.id && x.kind === 'cover'), JSON.stringify(acts));
  });

  test('after the last round, the fight as it ended: how it went, and every act', () => {
    for (let k = 0; k < 6; k++) {
      const { state, run } = ledRun(`ended-${k}`);
      const views = command(state, run, run.lead!.fights[0]!.at + 1000);
      const end = lastFought(state, run.id)!;
      assert.ok(end, 'the end view');
      assert.ok(['won', 'withdrew', 'stalemate', 'routed'].includes(end.over!), String(end.over));
      const last = views.at(-1);
      if (last) assert.ok(end.acts.length >= last.acts.length && end.lines.length >= last.lines.length);
      if (end.over === 'won') assert.ok(end.enemies.every((e) => e.state !== 'up'));
    }
  });

  test('a preview of a waiting fight changes nothing', () => {
    const { state, run } = ledRun('preview');
    const f = run.lead!.fights[0]!;
    const saved = serialize(state);
    const view = fightPreview(state, run.id, f.at + 1000);
    assert.ok(view && view.enemies.length > 0 && view.crew.length === run.plan.crew.length);
    assert.equal(serialize(state), saved);
    assert.equal(fightPreview(state, run.id, f.at - 1000), undefined, 'not before the fight');
    assert.equal(lastFought(state, run.id), undefined, 'no fight under command yet');
    const taken = takeCommand(state, run.id, f.at + 1000);
    if (taken) assert.deepEqual(taken.enemies, view.enemies);
  });

  test('enemies say which kind they are, and Vultures and nemeses are marked', () => {
    const { state, run } = ledRun('kinds');
    const view = takeCommand(state, run.id, run.lead!.fights[0]!.at + 1000)!;
    for (const e of view.enemies) {
      assert.ok(LOCATIONS.length > 0 && typeof e.kind === 'string' && e.kind.length > 0);
      assert.equal(e.vulture, e.kind.startsWith('vulture_'));
      assert.equal(e.named, e.nemesis || (e.vulture && e.named));
    }
  });
});

describe('balance', () => {
  test('commanding does a little better than leaving them to it', () => {
    const tally = () => ({ fights: 0, won: 0, deaths: 0, runs: 0 });
    const alone = tally();
    const led = tally();
    // Deaths are rare: it takes about a thousand runs to see a difference in them.
    for (let i = 0; i < 1500; i++) {
      const base = guild(`bal-${i % 11}`);
      base.rng = new Rng(`bal-${i}`).getState();
      const plan = { ...testPlan(base, PLACES[i % PLACES.length]!, { job: (['hunt', 'scavenge', 'scout'] as const)[i % 3], meds: 2 }), lead: true };
      const a = structuredClone(base);
      const runA = startRun(a, plan, T0);
      if (runA.lead!.fights.length === 0) continue;
      for (let f; (f = runA.lead!.fights.find((x) => x.ended === undefined)); ) letThemFight(a, runA.id, f.at + 60_000);
      const b = structuredClone(base);
      const runB = startRun(b, plan, T0);
      for (let f; (f = runB.lead!.fights.find((x) => x.ended === undefined)); ) command(b, runB, f.at + 60_000);
      for (const [t, run] of [[alone, runA], [led, runB]] as const) {
        t.runs++;
        t.fights += run.lead!.fights.length;
        t.won += run.beats.flatMap((x) => x.lines).filter((l) => /^The fight is over/.test(l.text)).length;
        t.deaths += run.result.crew.filter((s) => s.status === 'dead').length;
      }
    }
    const winA = alone.won / alone.fights;
    const winB = led.won / led.fights;
    assert.ok(winB > winA + 0.02 && winB < winA + 0.2, `won ${(winA * 100).toFixed(1)}% alone, ${(winB * 100).toFixed(1)}% in command`);
    // Deaths are rare and noisy at this size (§7.13 has them a fifth lower over thousands of runs); here: not clearly worse.
    assert.ok(led.deaths <= alone.deaths * 1.25, `${alone.deaths} deaths alone, ${led.deaths} in command`);
  });
});
