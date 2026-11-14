import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { GOAL_CHANCE } from '../constants.ts';
import { GOALS } from '../content/goals.ts';
import { ENEMIES } from '../content/index.ts';
import { createItem } from '../gear.ts';
import { Rng } from '../rng.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import type { GameState, RoundOrders, Run } from '../types.ts';
import type { FightView } from './command.ts';
import { commandRound, lastFought, startRun, takeCommand } from './runs.ts';
import { simulateRun } from './sim.ts';

const FIGHTS = ['maple_street', 'kessler_farm', 'old_metro', 'drowned_mall', 'st_judes', 'water_plant', 'checkpoint_bravo'];
const lines = (run: { beats: { lines: { text: string }[] }[] }): string[] => run.beats.flatMap((b) => b.lines.map((l) => l.text));
const sim = (state: GameState, place: string, seed: string, size = 3) => simulateRun(state, testPlan(state, place, { job: 'hunt' }, size), seed, T0);

/** A led fight that came with the job `id`, taken command of. */
function withJob(id: string, seed: string, setup?: (s: GameState) => void): { state: GameState; run: Run; view: FightView; at: number } {
  for (let i = 0; i < 1500; i++) {
    const state = openGame(`${seed}-${i % 9}`);
    setup?.(state);
    state.rng = new Rng(`${seed}-${i}`).getState();
    const run = startRun(state, { ...testPlan(state, FIGHTS[i % FIGHTS.length]!, { job: 'hunt', meds: 2 }), lead: true }, T0);
    const fight = run.lead?.fights[0];
    if (!fight) continue;
    const view = takeCommand(state, run.id, fight.at + 60_000);
    if (view?.goal?.id === id) return { state, run, view, at: fight.at + 90_000 };
  }
  throw new Error(`no led fight came with ${id}`);
}

/** Everyone covers, except `worker`, who does the job when there is one to do. */
function cover(view: FightView, worker?: string): RoundOrders {
  const moves: RoundOrders['moves'] = {};
  for (const m of view.crew) {
    if (m.moves.length === 0) continue;
    const job = m.moves.find((c) => c.move === 'job');
    if (m.id === worker && job) moves[m.id] = { move: 'job' };
    else if (m.moves.some((c) => c.move === 'cover')) moves[m.id] = { move: 'cover' };
  }
  return { moves };
}

/** Play a commanded fight with `order` until it ends; every view along the way. */
function play(state: GameState, run: Run, first: FightView, at: number, order: (v: FightView) => RoundOrders): FightView[] {
  const views = [first];
  let view: FightView | undefined = first;
  for (let r = 0; view && r < 12; r++) {
    view = commandRound(state, run.id, order(view), at + r * 10_000);
    views.push(view ?? lastFought(state, run.id)!);
  }
  return views;
}

describe('jobs in fights (2.5.0)', () => {
  test('every job is written out: a move, what it does, its lines, and kinds of enemy that exist', () => {
    const types = new Set(ENEMIES.map((e) => e.type));
    for (const g of GOALS) {
      assert.ok(g.title && g.move && g.intro && g.detail && g.working.includes('{a}') && g.done && g.lost, g.id);
      assert.ok(g.against.length > 0 && g.against.every((t) => types.has(t as never)), `${g.id} against ${g.against.join(', ')}`);
      assert.ok(g.rounds > 0 && (g.deadline === undefined || g.deadline >= g.rounds), g.id);
      assert.ok(g.fast.gear === undefined || g.fast.gear.length > 0, g.id);
    }
  });

  test('about a quarter of fights on a run come with one, and every kind comes up', () => {
    let fights = 0;
    let jobs = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 1200; i++) {
      const state = openGame(`jobs-${i % 9}`);
      const run = sim(state, FIGHTS[i % FIGHTS.length]!, `j${i}`);
      for (const b of run.beats) {
        // Encounters; fights out of events and rescues come on top, so the share runs a little high.
        if (b.kind === 'combat') fights++;
        const g = GOALS.find((x) => b.lines.some((l) => l.text === x.intro));
        if (g) {
          jobs++;
          seen.add(g.id);
        }
      }
    }
    const share = jobs / fights;
    assert.ok(share > GOAL_CHANCE * 0.7 && share < GOAL_CHANCE * 1.4, `${jobs} of ${fights}`);
    assert.deepEqual([...seen].sort(), GOALS.map((g) => g.id).sort());
  });

  test('a job only comes with the kinds of enemy it fits', () => {
    for (const g of GOALS) {
      const { view } = withJob(g.id, `fits-${g.id}`);
      assert.ok(view.enemies.some((e) => g.against.includes(e.type)), `${g.id} against ${view.enemies.map((e) => e.type).join(', ')}`);
    }
  });

  test('anyone on the ground can take the job, by its own name, and each turn on it shows', () => {
    for (const g of GOALS) {
      const { state, run, view, at } = withJob(g.id, `move-${g.id}`);
      const able = view.crew.filter((m) => m.state === 'up' && !m.perch);
      for (const m of able) {
        const job = m.moves.find((c) => c.move === 'job');
        assert.ok(job, `${m.name} can work ${g.id}`);
        assert.equal(job.name, g.move);
        assert.equal(job.target, 'none');
      }
      assert.equal(view.goal!.progress, 0);
      assert.equal(view.goal!.needed, g.rounds);
      const worker = able[0]!.id;
      const after = commandRound(state, run.id, cover(view, worker), at) ?? lastFought(state, run.id)!;
      assert.ok(after.goal!.progress >= 1 || after.goal!.state === 'done', `${g.id}: ${JSON.stringify(after.goal)}`);
      assert.ok(after.acts.some((a) => a.kind === 'job' && a.by === worker), 'a job act for the stage');
    }
  });

  test('a door nobody holds lets more of them in, two at most; one held shuts it', () => {
    let opened = 0;
    let shut = 0;
    for (let n = 0; n < 6; n++) {
      const { state, run, view, at } = withJob('hold_door', `door-${n}`);
      const waiting = view.enemies.filter((e) => e.state === 'waiting').length;
      assert.equal(waiting, 2, 'two behind the door');
      const hold = n % 2 === 0;
      const holder = view.crew.find((m) => m.moves.some((c) => c.move === 'job'))!;
      const views = play(state, run, view, at, (v) => cover(v, hold ? holder.id : undefined));
      const end = views.at(-1)!;
      const came = end.enemies.filter((e) => e.state !== 'waiting').length - view.enemies.filter((e) => e.state !== 'waiting').length;
      if (hold) {
        if (end.goal!.state === 'done') shut++;
        // Held from the first round, it's shut before anyone gets through... unless whoever held it went down first.
        assert.ok(came <= 2);
      } else {
        assert.ok(came <= 2, `came ${came}`);
        if (end.round >= 2) assert.ok(came >= 1, 'one through after a round nobody held it');
        if (came === 2) assert.equal(end.goal!.state, 'lost');
        opened++;
      }
    }
    assert.ok(opened > 0 && shut > 0, `opened ${opened}, shut ${shut}`);
  });

  test('a job with a deadline nobody works is lost once the round passes', () => {
    for (const id of ['grab_and_go', 'get_out', 'fix_open']) {
      const g = GOALS.find((x) => x.id === id)!;
      const { state, run, view, at } = withJob(id, `late-${id}`);
      const views = play(state, run, view, at, (v) => cover(v));
      const past = views.find((v) => !v.over && v.round > g.deadline!);
      if (past) assert.equal(past.goal!.state, 'lost', id);
      assert.notEqual(views.at(-1)!.goal!.state, 'open', `${id} settled by the end`);
    }
  });

  test('a job done pays: their stash, a stranger home, what was in the cage', () => {
    const pays: Record<string, (run: ReturnType<typeof simulateRun>) => boolean> = {
      grab_and_go: (r) => lines(r).some((t) => /^\d+ \w+ and \d+ \w+ for the packs\.$/.test(t)),
      get_out: (r) => (r.result.found?.length ?? 0) > 0 || r.result.outcome === 'lost' || lines(r).some((t) => /^The stranger has somewhere to be, and presses (a med|\d meds) on \w+ before slipping away\.$/.test(t)),
      fix_open: (r) => lines(r).some((t) => /^And \d+ scrap\.$/.test(t)),
    };
    for (const [id, paid] of Object.entries(pays)) {
      const g = GOALS.find((x) => x.id === id)!;
      let done = 0;
      for (let i = 0; i < 4000 && done < 3; i++) {
        const state = openGame(`pay-${i % 9}`);
        const run = sim(state, FIGHTS[i % FIGHTS.length]!, `p${i}`);
        if (!lines(run).includes(g.done)) continue;
        assert.ok(paid(run), `${id} paid in p${i}`);
        done++;
      }
      assert.ok(done > 0, `${id} got done on its own`);
    }
  });

  test('Lockpicks make the lock go faster', () => {
    const { state, run, view, at } = withJob('fix_open', 'picks', (s) => {
      for (const x of s.survivors) x.equipment.tool = createItem(s, 'lockpicks');
    });
    const worker = view.crew.find((m) => m.moves.some((c) => c.move === 'job'))!;
    const after = commandRound(state, run.id, cover(view, worker.id), at) ?? lastFought(state, run.id)!;
    assert.ok(after.goal!.progress === 2 || after.goal!.state === 'done', JSON.stringify(after.goal));
  });

  test('a crew on its own puts one on the job, and nobody when they are alone', () => {
    let worked = 0;
    let soloWorked = 0;
    const working = GOALS.map((g) => new RegExp(`^${g.working.replace('{a}', '\\w+').replace(/[.()]/g, (c) => `\\${c}`)}`));
    for (let i = 0; i < 600; i++) {
      const state = openGame(`own-${i % 9}`);
      const solo = i % 3 === 0;
      const n = lines(sim(state, FIGHTS[i % FIGHTS.length]!, `o${i}`, solo ? 1 : 3)).filter((t) => working.some((re) => re.test(t))).length;
      if (solo) soloWorked += n;
      else worked += n;
    }
    assert.ok(worked > 20, `worked ${worked}`);
    assert.equal(soloWorked, 0);
  });
});
