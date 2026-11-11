import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NAMED_GEAR_KILLS, NEMESIS_MAX } from '../constants.ts';
import { EVOLUTIONS, NEMESIS_NAMES, NICKNAMES, TRAITS, WEAPON_NAMES, getEnemy, getLocation } from '../content/index.ts';
import { createItem } from '../gear.ts';
import { deserialize } from '../save.ts';
import { T0, openGame, testPlan } from '../test-utils.ts';
import { Rng } from '../rng.ts';
import type { GameState, Nemesis, Run, RunPlan } from '../types.ts';
import { completeRun, startRun } from './runs.ts';
import { simulateRun } from './sim.ts';

function nemesis(over: Partial<Nemesis> = {}): Nemesis {
  return { id: 'n900', name: 'Testface', enemyId: 'hollow', locationId: 'drowned_mall', status: 'atLarge', downed: [], killed: [], escapes: 1, bornDay: 1, history: [{ day: 1, text: 'Put someone down at the Drowned Mall, and got away.' }], ...over };
}

/**
 * Send crews (each from a fresh guild) until `pick` finds what it wants in a
 * run's result; fail if it never does. Returns the guild with that run out.
 */
function findRun<T>(label: string, setup: (i: number) => { state: GameState; plan: RunPlan }, pick: (state: GameState, sim: Pick<ReturnType<typeof simulateRun>, 'result' | 'beats'>) => T | undefined, tries = 3000): { state: GameState; run: Run; before: GameState; found: T } {
  for (let i = 0; i < tries; i++) {
    const { state, plan } = setup(i);
    state.rng = new Rng(`${label}-${i}`).getState();
    const before = structuredClone(state);
    const run = startRun(state, plan, T0);
    const found = pick(before, run);
    if (found !== undefined) return { state, run, before, found };
  }
  throw new Error(`no run found for ${label}`);
}

const lines = (sim: Pick<ReturnType<typeof simulateRun>, 'beats'>): string[] => sim.beats.flatMap((b) => b.lines.map((l) => l.text));

describe('nemeses', () => {
  test('an enemy that puts someone down and gets away gets a name, and haunts the place', () => {
    const { state, run, found } = findRun(
      'born',
      (i) => {
        const state = openGame(`born-${i % 6}`);
        return { state, plan: testPlan(state, 'st_judes', { retreat: 'downed' }) };
      },
      (_s, run) => run.result.nemeses?.find((n) => n.born),
    );
    const n = found.born!;
    assert.equal(n.locationId, 'st_judes');
    assert.equal(n.status, 'atLarge');
    assert.ok(n.downed.length > 0);
    assert.ok(NEMESIS_NAMES[getEnemy(n.enemyId).type].includes(n.name));
    const place = getLocation('st_judes').name;
    assert.ok(n.history[0]!.text.endsWith(`down at ${place}, and got away.`), n.history[0]!.text);

    // Applied when the crew is back: the guild knows it, and so do those it put down.
    completeRun(state, run.id, run.returnAt);
    const kept = state.nemeses.find((x) => x.name === n.name)!;
    assert.ok(kept);
    assert.ok(state.log.some((l) => l.text.startsWith(`${n.name}, a`) && l.text.endsWith(`haunts ${place} now.`)), JSON.stringify(state.log.slice(-3)));
    const victim = [...state.survivors, ...state.memorial].find((s) => s.id === kept.downed[0])!;
    assert.ok(victim.chronicle.some((c) => c.text.includes(`calls it ${n.name} now`)));
  });

  test('no new nemesis while the guild already has the most it can', () => {
    const full = Array.from({ length: NEMESIS_MAX }, (_, i) => nemesis({ id: `n9${i}`, name: `Full ${i}`, locationId: 'the_glow' }));
    for (let i = 0; i < 400; i++) {
      const state = openGame(`full-${i % 6}`);
      state.nemeses = structuredClone(full);
      const sim = simulateRun(state, testPlan(state, 'st_judes', { retreat: 'downed' }), `full-${i}`, T0);
      assert.ok(!sim.result.nemeses?.some((n) => n.born));
    }
  });

  test('a nemesis comes back at its place, tougher, and the people it hurt remember it', () => {
    const { found } = findRun(
      'back',
      (i) => {
        const state = openGame(`back-${i % 6}`);
        const crew = testPlan(state, 'drowned_mall').crew;
        state.nemeses = [nemesis({ downed: [crew[0]!] })];
        return { state, plan: testPlan(state, 'drowned_mall') };
      },
      (state, sim) => {
        const text = lines(sim);
        if (!text.some((t) => t.startsWith('It is Testface, a Hollow the guild knows by name.'))) return undefined;
        const first = state.survivors.find((s) => s.id === testPlan(state, 'drowned_mall').crew[0])!.firstName;
        return text.includes(`${first} has not forgotten.`) ? text : undefined;
      },
    );
    assert.ok(found.some((t) => /Testface/.test(t)));
  });

  test('a nemesis can be killed: it stays dead, and everyone it hurt hears about it', () => {
    const { state, run, before, found } = findRun(
      'kill',
      (i) => {
        const state = openGame(`kill-${i % 6}`);
        const home = state.survivors[3]!;
        state.nemeses = [nemesis({ downed: [home.id] })];
        return { state, plan: testPlan(state, 'drowned_mall', { approach: 'aggressive', retreat: 'never' }) };
      },
      (_s, sim) => sim.result.nemeses?.find((n) => n.killedBy),
    );
    const place = getLocation('drowned_mall').name;
    const killer = before.survivors.find((s) => s.id === found.killedBy)!;
    const home = before.survivors[3]!;
    const stressBefore = home.stress;
    completeRun(state, run.id, run.returnAt);
    const n = state.nemeses[0]!;
    assert.equal(n.status, 'dead');
    assert.equal(n.killedBy, killer.id);
    assert.ok(n.history.at(-1)!.text.endsWith(` at ${place}.`) && n.history.at(-1)!.text.startsWith('Killed by '));
    const after = [...state.survivors, ...state.memorial].find((s) => s.id === killer.id)!;
    assert.ok(after.chronicle.some((c) => c.text === `Killed Testface at ${place}.`));
    assert.ok(state.log.some((l) => l.text.endsWith(`killed Testface at ${place}.`)));
    const heard = state.survivors.find((s) => s.id === home.id)!;
    assert.ok(heard.chronicle.some((c) => c.text.startsWith('Heard that Testface is dead.')));
    assert.ok(heard.stress <= stressBefore);

    // News from a crew that left earlier can't bring it back.
    const later = structuredClone(state);
    for (let i = 0; i < 300; i++) {
      const sim = simulateRun(later, testPlan(later, 'drowned_mall'), `after-${i}`, T0);
      assert.ok(!lines(sim).some((t) => t.startsWith('It is Testface')), 'dead nemeses stay dead');
    }
  });

  test('when a nemesis kills someone, the death is put down to it by name', () => {
    const { found } = findRun(
      'killer',
      (i) => {
        const state = openGame(`killer-${i % 6}`);
        state.nemeses = [nemesis({ enemyId: 'glowing_hollow', locationId: 'the_glow' })];
        return { state, plan: testPlan(state, 'the_glow', { retreat: 'never' }) };
      },
      (_s, sim) => {
        const news = sim.result.nemeses?.find((n) => n.id === 'n900' && n.killed.length > 0);
        return news ? { news, crew: sim.result.crew } : undefined;
      },
      6000,
    );
    const dead = found.crew.find((s) => s.id === found.news.killed[0])!;
    assert.equal(dead.causeOfDeath, `Killed by Testface at ${getLocation('the_glow').name}`);
    assert.ok(found.news.history.some((l) => l.text.startsWith(`Killed ${dead.firstName}`)));
  });

  test('older saves get an empty list of nemeses', () => {
    const state = openGame('v6');
    const old = structuredClone(state) as unknown as Record<string, unknown>;
    old.version = 6;
    delete old.nemeses;
    assert.deepEqual(deserialize(JSON.stringify(old)).nemeses, []);
  });
});

describe('named weapons', () => {
  test('a weapon earns a name at its tenth kill, with the start of its story', () => {
    const { found } = findRun(
      'named',
      (i) => {
        const state = openGame(`named-${i % 6}`);
        for (const s of state.survivors) {
          s.equipment.weapon = createItem(state, 'machete', 'solid');
          s.equipment.weapon.kills = NAMED_GEAR_KILLS - 1;
        }
        return { state, plan: testPlan(state, 'drowned_mall', { approach: 'aggressive' }) };
      },
      (_s, sim) => sim.result.crew.find((s) => s.equipment.weapon?.name),
    );
    const w = found.equipment.weapon!;
    assert.ok(WEAPON_NAMES.melee.includes(w.name!));
    assert.equal(w.kills, NAMED_GEAR_KILLS);
    assert.match(w.history![0]!.text, new RegExp(`^Named after its tenth kill, in .*'s hands at ${getLocation('drowned_mall').name}\\.$`));
    assert.ok(found.chronicle.some((c) => c.text === `Carried the Solid Machete to its tenth kill. The guild calls it ${w.name} now.`));
  });

  test('names are never handed out twice', () => {
    const { found } = findRun(
      'unique',
      (i) => {
        const state = openGame(`unique-${i % 6}`);
        // Every name but one is taken.
        const [keep] = WEAPON_NAMES.melee.slice(-1);
        WEAPON_NAMES.melee.slice(0, -1).forEach((name, j) => {
          const it = createItem(state, 'pipe');
          it.name = name;
          state.stash.push(it);
          if (j === 0) state.survivors[3]!.nickname = 'unused';
        });
        for (const s of state.survivors) {
          s.equipment.weapon = createItem(state, 'machete');
          s.equipment.weapon.kills = 40;
        }
        return { state, plan: testPlan(state, 'maple_street'), keep };
      },
      (_s, sim) => {
        const named = sim.result.crew.map((s) => s.equipment.weapon!.name).filter(Boolean);
        return named.length >= 2 ? named : undefined;
      },
    );
    assert.equal(new Set(found).size, found.length);
    assert.ok(found.includes(WEAPON_NAMES.melee.at(-1)!), 'the one free name went first');
  });
});

describe('nicknames', () => {
  test('feats earn a nickname, written in the Chronicle', () => {
    const { found } = findRun(
      'nick',
      (i) => {
        const state = openGame(`nick-${i % 6}`);
        for (const s of state.survivors) s.counters.rangedKills = 20;
        return { state, plan: testPlan(state, 'maple_street') };
      },
      (_s, sim) => sim.result.crew.find((s) => s.nickname),
    );
    const rule = NICKNAMES.find((r) => r.names.includes(found.nickname!))!;
    assert.ok(rule);
    assert.ok(found.chronicle.some((c) => c.text.startsWith(`Earned a name: "${found.nickname}", for`)));
  });

  test('someone with a nickname keeps it', () => {
    for (let i = 0; i < 200; i++) {
      const state = openGame(`keep-${i % 6}`);
      for (const s of state.survivors) {
        s.nickname = 'Keeper';
        s.counters.rangedKills = 50;
      }
      const sim = simulateRun(state, testPlan(state, 'maple_street'), `keep-${i}`, T0);
      for (const s of sim.result.crew) assert.equal(s.nickname, 'Keeper');
    }
  });

  test('the rules refer to real traits, counters and run tallies, and names are unique', () => {
    const traits = new Set(TRAITS.map((t) => t.id));
    const counters = Object.keys(openGame('c').survivors[0]!.counters);
    for (const rule of NICKNAMES) {
      if (rule.trait) assert.ok(traits.has(rule.trait), rule.id);
      for (const c of Object.keys(rule.counters ?? {})) assert.ok(counters.includes(c), `${rule.id}: ${c}`);
      assert.ok(rule.names.length >= 2, rule.id);
      assert.ok(rule.why.startsWith('for '), rule.id);
    }
    const all = [...NICKNAMES.flatMap((r) => r.names), ...WEAPON_NAMES.melee, ...WEAPON_NAMES.ranged, ...Object.values(NEMESIS_NAMES).flat()];
    assert.equal(new Set(all).size, all.length, 'no name is shared between pools');
    for (const pool of Object.values(NEMESIS_NAMES)) assert.ok(pool.length > NEMESIS_MAX * 2);
    assert.ok(EVOLUTIONS.length > 0);
  });
});
