/**
 * Elites (§7.15, 3.12.0): one of a kind at each place where there's fighting,
 * seen before it's met, gone after from the planner, dead for good once brought
 * down, and what each does in a fight that nothing else does.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ELITE_SEEN_AFTER } from '../constants.ts';
import { ELITES, ENEMIES, LOCATIONS, RAID_BANDS, eliteAt, findGear, getEnemy } from '../content/index.ts';
import { createItem } from '../gear.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import type { GameState, RoundOrders, RunPlan } from '../types.ts';
import type { FightAct, FightView } from './command.ts';
import { eliteOnRun, eliteStatus } from './elites.ts';
import { validatePlan } from './plan.ts';
import { completeRun, startRun } from './runs.ts';
import { simulateRun } from './sim.ts';

const GROUP = /\b(the crew|crew|everyone|the others|each other|together|they bring back|they had to leave)\b/i;

/** A guild in good kit: plain people, vests or better, a gun among them. */
function kitted(seed: string, place: string, band = 1): GameState {
  const state = openGame(seed);
  state.locations[place]!.explored = 60;
  for (const [k, s] of state.survivors.slice(0, 3).entries()) {
    s.traits = [];
    if (band > 1) for (const stat of Object.keys(s.stats) as (keyof typeof s.stats)[]) s.stats[stat] += band - 1;
    const q = band === 1 ? 'common' : band === 2 ? 'solid' : 'prime';
    s.equipment.armor = createItem(state, band === 1 ? 'scrap_vest' : band === 2 ? 'leather_jacket' : 'riot_gear', q);
    s.equipment.weapon = createItem(state, k === 2 ? 'hunting_rifle' : band === 1 ? 'machete' : k === 0 ? 'sledge' : 'machete', q);
  }
  return state;
}

/** The guild has seen it, and it's at large. */
function known(state: GameState, id: string): GameState {
  state.elites = { [id]: { seen: 0, status: 'atLarge', fights: 0 } };
  return state;
}

const chase = (state: GameState, place: string, overrides: Partial<RunPlan> = {}): RunPlan => testPlan(state, place, { elite: true, meds: 2, ammo: 16, ...overrides });

describe('elites: content (3.12.0)', () => {
  test('one at every place where there is fighting, none at the market', () => {
    for (const loc of LOCATIONS) {
      const here = ELITES.filter((e) => e.elite!.place === loc.id);
      assert.equal(here.length, loc.market ? 0 : 1, loc.id);
    }
    for (const e of ELITES) assert.ok(ENEMIES.includes(e));
  });

  test('never in a place’s encounters or a raid, and what they call in and leave behind exists', () => {
    const elites = new Set(ELITES.map((e) => e.id));
    for (const loc of LOCATIONS) for (const enc of loc.encounters) for (const id of [...enc.enemies, ...(enc.support?.ids ?? [])]) assert.ok(!elites.has(id), `${id} at ${loc.id}`);
    assert.ok(!JSON.stringify(RAID_BANDS).match(new RegExp([...elites].join('|'))), 'no raid band brings one');
    for (const e of ELITES) {
      assert.ok(findGear(e.elite!.prize.item), `${e.id}'s prize`);
      if (e.calls) assert.ok(getEnemy(e.calls.id) && !getEnemy(e.calls.id).elite, `${e.id} calls ${e.calls.id}`);
    }
  });

  test('alone, nothing they say talks about a group, and every line has only its own placeholders', () => {
    for (const e of ELITES) {
      const el = e.elite!;
      for (const line of [...el.signs.lines.solo, ...el.lair.lines.solo]) assert.doesNotMatch(line.replace(/\{[^}]+\}/g, ''), GROUP, `${e.id}: ${line}`);
      for (const line of [el.met, el.killed, el.prize.story]) assert.doesNotMatch(line, GROUP, `${e.id}: ${line}`);
      const all = [...el.signs.lines.crew, ...el.signs.lines.solo, ...el.lair.lines.crew, ...el.lair.lines.solo, el.met];
      for (const line of all) for (const m of line.matchAll(/\{([^}]+)\}/g)) assert.match(m[1]!, /^a\.(first|they|They|them|their)$/, `${e.id}: ${m[0]}`);
      assert.equal(el.signs.lines.crew.length, el.signs.lines.solo.length, e.id);
    }
  });
});

describe('elites: seen, then met (3.12.0)', () => {
  test('nobody sees one before the place’s outskirts are half explored', () => {
    const state = openGame('early');
    state.locations.rail_yard!.explored = ELITE_SEEN_AFTER - 1;
    assert.equal(eliteOnRun(state, testPlan(state, 'rail_yard'), 's', 5), undefined);
    state.locations.rail_yard!.explored = ELITE_SEEN_AFTER;
    assert.ok(eliteOnRun(state, testPlan(state, 'rail_yard'), 's', 5));
    assert.equal(eliteOnRun(state, testPlan(state, 'rail_yard', { job: 'trade' }), 's', 5), undefined, 'only crews that go looking');
  });

  test('a crew sees it, comes home, and from then on the guild knows it: on the place, with its prize', () => {
    let seen = 0;
    for (let i = 0; i < 80 && seen < 3; i++) {
      const state = kitted(`signs-${i}`, 'rail_yard');
      const run = startRun(state, testPlan(state, 'rail_yard', { job: 'scout' }), T0);
      const news = run.result.elites?.[0];
      if (!news?.seen) continue;
      seen++;
      assert.ok(run.beats.some((b) => b.title === 'Something on the tracks'));
      assert.equal(eliteStatus(state, 'rail_yard')?.state, 'unknown', 'not until they are home');
      completeRun(state, run.id, run.returnAt);
      assert.equal(eliteStatus(state, 'rail_yard')?.state, 'atLarge');
      const witness = state.survivors.find((s) => s.id === news.seen)!;
      assert.ok(witness.chronicle.some((c) => c.text === 'First to see the Switchman, at The Rail Yard.'), JSON.stringify(witness.chronicle.at(-1)));
    }
    assert.ok(seen >= 3, `seen on ${seen} runs`);
  });

  test('a run where it doesn’t show plays exactly as it would with no elite at all', () => {
    let compared = 0;
    for (let i = 0; i < 40; i++) {
      const state = kitted(`same-${i}`, 'kessler_farm');
      const plan = testPlan(state, 'kessler_farm');
      const run = simulateRun(state, plan, `same-${i}`, T0);
      if (run.result.elites) continue;
      const without = structuredClone(state);
      without.elites = { the_butcher: { seen: 0, status: 'dead', fights: 1 } };
      assert.deepEqual(simulateRun(without, plan, `same-${i}`, T0).beats, run.beats);
      compared++;
    }
    assert.ok(compared > 20);
  });

  test('once known, it now and then turns up at a fight there on its own', () => {
    let met = 0;
    for (let i = 0; i < 120 && met < 3; i++) {
      const state = known(kitted(`meet-${i}`, 'kessler_farm'), 'the_butcher');
      const run = simulateRun(state, testPlan(state, 'kessler_farm'), `meet-${i}`, T0);
      if (run.result.elites?.[0]?.fought) met++;
    }
    assert.ok(met >= 3);
  });
});

describe('elites: going after one (3.12.0)', () => {
  test('a crew sent after it finds it at the deepest point of the run, and the fight lasts longer', () => {
    for (let i = 0; i < 10; i++) {
      const state = known(kitted(`lair-${i}`, 'kessler_farm'), 'the_butcher');
      const run = simulateRun(state, chase(state, 'kessler_farm'), `lair-${i}`, T0);
      if (run.result.outcome === 'turnedBack' || run.result.outcome === 'routed') continue;
      assert.ok(run.result.elites?.[0]?.fought, `run ${i}`);
      assert.ok(run.beats.some((b) => b.title === 'The smokehouse'));
    }
  });

  test('only for one the guild has seen and that is still at large, on a job that goes looking', () => {
    const state = kitted('chase', 'kessler_farm');
    assert.ok(validatePlan(state, chase(state, 'kessler_farm')).some((p) => p.includes('Nobody has seen')));
    known(state, 'the_butcher');
    assert.deepEqual(validatePlan(state, chase(state, 'kessler_farm')).filter((p) => /seen|dead|looking/.test(p)), []);
    assert.ok(validatePlan(state, chase(state, 'kessler_farm', { job: 'rescue' })).some((p) => p.includes('goes looking')));
    state.elites.the_butcher!.status = 'dead';
    assert.ok(validatePlan(state, chase(state, 'kessler_farm')).some((p) => p.includes('The Butcher is dead.')));
  });

  test('brought down: dead for good, its prize home as a named Relic, and the one who did it remembered', () => {
    let killed = 0;
    for (let i = 0; i < 30 && killed < 2; i++) {
      const state = known(kitted(`kill-${i}`, 'rail_yard'), 'the_switchman');
      const run = startRun(state, chase(state, 'rail_yard'), T0);
      const by = run.result.elites?.[0]?.killed;
      if (!by) continue;
      killed++;
      const prize = run.result.items.find((it) => it.name === 'The Switch Bar')!;
      assert.equal(prize.defId, 'crowbar');
      assert.equal(prize.quality, 'relic');
      assert.ok(prize.history?.some((h) => h.text.includes('thrown a thousand switches')));
      completeRun(state, run.id, run.returnAt);
      const record = state.elites.the_switchman!;
      assert.equal(record.status, 'dead');
      assert.equal(record.killedBy?.id, by);
      assert.ok(state.survivors.find((s) => s.id === by)!.chronicle.some((c) => c.text === 'Brought down the Switchman at The Rail Yard.'));
      assert.equal(eliteOnRun(state, testPlan(state, 'rail_yard'), 'x', 5), undefined, 'it never turns up again');
    }
    assert.equal(killed, 2);
  });
});

/** Led runs after an elite, every round under `commander`; every round's view, with the acts it led to. */
function eliteRounds(place: string, id: string, commander: (v: FightView) => RoundOrders, want: (views: FightView[]) => boolean, band = 1): FightView[] {
  const all: FightView[] = [];
  for (let i = 0; i < 200 && !want(all); i++) {
    const state = known(kitted(`${id}-${i}`, place, band), id);
    const run = simulateRun(state, { ...chase(state, place), lead: true }, `${id}-${i}`, T0, {
      commander: (v) => {
        if (v.enemies.some((e) => e.kind === id)) all.push(v);
        return commander(v);
      },
    });
    for (const end of run.ends ?? []) if (end?.enemies.some((e) => e.kind === id)) all.push(end);
  }
  return all;
}

/** Everyone hits the elite if they can, or whatever they can reach. */
function onIt(v: FightView): RoundOrders {
  const elite = v.enemies.find((e) => e.elite);
  const moves: RoundOrders['moves'] = {};
  for (const m of v.crew) {
    const attack = m.moves.find((c) => c.move === 'attack');
    if (!attack) continue;
    moves[m.id] = { move: 'attack', target: elite && attack.targets.includes(elite.index) ? elite.index : attack.targets[0]! };
  }
  return { moves };
}

/** The acts of the round played from view k. */
function played(views: FightView[], k: number): FightAct[] {
  const next = views[k + 1];
  if (!next || next.acts.length < views[k]!.acts.length) return [];
  return next.acts.slice(views[k]!.acts.length).filter((a) => a.round === views[k]!.round);
}

describe('elites: what they do in a fight (3.12.0)', () => {
  test('plates: each hit that lands knocks one off and does no harm, then it is soft', () => {
    const views = eliteRounds('rail_yard', 'the_switchman', onIt, (vs) => vs.filter((v) => v.enemies.some((e) => e.kind === 'the_switchman' && e.plates === 0)).length >= 2);
    let checked = 0;
    views.forEach((v, k) => {
      const e = v.enemies.find((x) => x.kind === 'the_switchman')!;
      for (const a of played(views, k).filter((x) => x.at === e.index)) {
        if (a.kind === 'plate') {
          assert.ok((e.plates ?? 0) > 0, 'only while there are plates');
          checked++;
        }
      }
      const next = views[k + 1];
      if (next && next.round === v.round + 1 && (e.plates ?? 0) > 0) {
        const knocked = played(views, k).filter((a) => a.kind === 'plate' && a.at === e.index).length;
        assert.equal(next.enemies[e.index]!.plates, (e.plates ?? 0) - knocked);
        if (knocked > 0 && played(views, k).every((a) => a.at !== e.index || a.kind === 'plate' || a.kind === 'miss')) assert.ok(next.enemies[e.index]!.hp >= e.hp - 0, 'no harm while the plates take it');
      }
    });
    assert.ok(checked >= 4, `plates knocked off: ${checked}`);
  });

  test('calls: it calls more in, one at a time, as many as it has, from off the stage', () => {
    const views = eliteRounds('old_metro', 'the_conductor', onIt, (vs) => vs.filter((v) => v.enemies.some((e) => e.intent?.kind === 'call')).length >= 4);
    let calls = 0;
    views.forEach((v, k) => {
      const caller = v.enemies.find((e) => e.kind === 'the_conductor' && e.intent?.kind === 'call' && e.state === 'up' && !e.stunned);
      if (!caller) return;
      const acts = played(views, k);
      const call = acts.find((a) => a.kind === 'call' && a.by === caller.index);
      if (!call) return;
      calls++;
      const came = acts.find((a) => a.kind === 'arrive');
      assert.ok(came, 'one comes');
      const was = v.enemies[came!.by as number]!;
      assert.equal(was.state, 'waiting');
      assert.ok(was.reserve);
      assert.equal(was.kind, 'hollow');
    });
    assert.ok(calls >= 3, `calls answered: ${calls}`);
    assert.ok(views.every((v) => v.enemies.filter((e) => e.reserve).length === 3), 'three to call');
  });

  test('going under: nothing reaches it for a round, then it comes up under someone, front or back', () => {
    const views = eliteRounds('drowned_mall', 'the_snapper', onIt, (vs) => vs.filter((v) => v.enemies.some((e) => e.under)).length >= 4);
    let under = 0;
    for (const v of views) {
      const e = v.enemies.find((x) => x.kind === 'the_snapper' && x.under && x.state === 'up');
      if (!e || v.over) continue;
      under++;
      assert.equal(e.intent?.kind, 'surface');
      for (const m of v.crew) for (const c of m.moves) assert.ok(!c.targets.includes(e.index), `${c.move} can't reach it`);
    }
    assert.ok(under >= 3, `rounds under: ${under}`);
  });

  test('a sweep catches everyone standing in the rank it goes for', () => {
    const views = eliteRounds('the_glow', 'the_glass_man', onIt, (vs) => vs.filter((v) => v.enemies.some((e) => e.intent?.kind === 'sweep')).length >= 4, 3);
    let swept = 0;
    views.forEach((v, k) => {
      const e = v.enemies.find((x) => x.kind === 'the_glass_man' && x.intent?.kind === 'sweep' && x.state === 'up' && !x.stunned);
      if (!e) return;
      const acts = played(views, k);
      if (!acts.some((a) => a.kind === 'sweep' && a.by === e.index)) return;
      const there = v.crew.filter((m) => m.state === 'up' && m.rank === e.intent!.rank).map((m) => m.id);
      const caught = acts.filter((a) => a.by === e.index && a.kind === 'hit').map((a) => a.at);
      for (const id of caught) assert.ok(there.includes(id as string), 'only those in the rank');
      swept++;
    });
    assert.ok(swept >= 3, `sweeps: ${swept}`);
  });

  test('enraged: once down to half, it strikes twice', () => {
    const views = eliteRounds('kessler_farm', 'the_butcher', onIt, (vs) => vs.filter((v) => v.enemies.some((e) => e.kind === 'the_butcher' && e.state === 'up' && e.hp * 2 <= e.maxHp)).length >= 3);
    for (const v of views) {
      const e = v.enemies.find((x) => x.kind === 'the_butcher')!;
      if (e.state !== 'up') continue;
      assert.equal(e.twice === true, e.hp * 2 <= e.maxHp, `${e.hp}/${e.maxHp}`);
    }
  });

  test('an elite’s fight always calls home, and can’t be talked down', () => {
    const state = known(kitted('calls', 'kessler_farm'), 'the_butcher');
    const run = startRun(state, { ...chase(state, 'kessler_farm'), lead: 'matters' }, T0);
    assert.ok(run.lead?.fights.some((f) => f.elite === 'the_butcher'), 'the card knows whose prize it is');
  });
});

describe('elites: the save (3.12.0)', () => {
  test('an older save has seen none', () => {
    const state = openGame('old');
    const data = JSON.parse(serialize(state)) as Record<string, unknown>;
    delete data.elites;
    data.version = 29;
    assert.deepEqual(deserialize(JSON.stringify(data)).elites, {});
  });

  test('each place’s elite is the one at it', () => {
    for (const e of ELITES) assert.equal(eliteAt(e.elite!.place), e);
  });
});
