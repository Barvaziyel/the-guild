import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { NEED_BAR, NEED_TOGETHER, NEED_TOOL } from '../constants.ts';
import { GEAR, LOCATIONS, NEEDS, PARTS, PART_HAUL, PERKS, TRAITS, findTrait, getEnemy, partAt } from '../content/index.ts';
import { createItem } from '../gear.ts';
import { coverNeed, crewPerks, knowsPart, needsCoveredBy, perkMod, plannedPart } from '../needs.ts';
import { deserialize, serialize } from '../save.ts';
import { T0, openGame, testPlan, testSurvivor } from '../test-utils.ts';
import { fillRoles } from '../text.ts';
import { NEED_KINDS, type GameState, type NeedKind, type StatId, type Survivor } from '../types.ts';
import { completeRun, startRun } from './runs.ts';
import { simulateRun } from './sim.ts';

/** The same group words the solo test looks for. */
const GROUP = /\b(the crew|crew|everyone|the others|each other|together|they bring back|they had to leave)\b/i;
const withoutPlaceholders = (t: string): string => t.replace(/\{[^}]+\}/g, '');

/** A guild of plain people, all stats at 3, no traits or gear: nobody covers anything. */
function plain(seed: string): GameState {
  const state = openGame(seed);
  for (const s of state.survivors) {
    s.traits = [];
    s.equipment = {};
    for (const k of Object.keys(s.stats) as StatId[]) s.stats[k] = 3;
    s.hp = 30;
  }
  return state;
}

function person(stats: Partial<Record<StatId, number>>, id = 'p1'): Survivor {
  const s = testSurvivor(id);
  for (const k of Object.keys(s.stats) as StatId[]) s.stats[k] = stats[k] ?? 3;
  return s;
}

describe('places that need the right people: content (3.13.0)', () => {
  test('every place but the market has a best part on each level: one need on the outskirts, two at the heart', () => {
    for (const loc of LOCATIONS) {
      if (loc.market) {
        assert.equal(PARTS[loc.id], undefined, loc.id);
        continue;
      }
      const parts = PARTS[loc.id];
      assert.ok(parts, loc.id);
      assert.equal(parts.length, 3);
      assert.equal(parts[0].needs.length, 1, `${loc.id} outskirts`);
      assert.ok(parts[1].needs.length >= 1 && parts[1].needs.length <= 2, `${loc.id} deeper in`);
      assert.equal(parts[2].needs.length, 2, `${loc.id} heart`);
      for (const p of parts) {
        assert.ok(p.gear >= 0 && p.gear <= 1);
        assert.ok(Object.values(p.loot).some((w) => (w ?? 0) > 0), p.title);
        for (const id of p.gearFrom ?? []) assert.ok(GEAR.some((g) => g.id === id), id);
      }
    }
    for (const id of Object.keys(PARTS)) assert.ok(LOCATIONS.some((l) => l.id === id), id);
  });

  test('animals stand in the way only where there are animals to fight', () => {
    for (const [id, parts] of Object.entries(PARTS)) {
      const loc = LOCATIONS.find((l) => l.id === id)!;
      const ferals = loc.encounters.some((e) => e.enemies.some((x) => getEnemy(x).type === 'feral'));
      for (const p of parts) if (p.needs.some((n) => n.kind === 'animals')) assert.ok(ferals, `${id}: ${p.title}`);
    }
  });

  test('every need can be covered each way its lines allow, and each way that can happen has lines', () => {
    for (const kind of NEED_KINDS) {
      const def = NEEDS[kind];
      assert.equal(def.id, kind);
      const helps = GEAR.some((g) => g.hooks?.needHelp?.includes(kind));
      const gear = GEAR.some((g) => g.hooks?.needCover?.includes(kind));
      const trait = TRAITS.some((t) => t.hooks?.needCover?.includes(kind));
      assert.equal(def.covered.tool !== undefined, helps, `${kind}: tool lines`);
      assert.equal(def.covered.gear !== undefined, gear, `${kind}: gear lines`);
      assert.equal(def.covered.trait !== undefined, trait, `${kind}: trait lines`);
      assert.equal(def.covered.together !== undefined, def.together === true, `${kind}: together lines`);
      assert.equal(def.covered.vehicle !== undefined, def.vehicle === true, `${kind}: vehicle lines`);
    }
  });

  test('every line reads cleanly for every part it can be said of, for one person or a crew', () => {
    const a = testSurvivor('a', { firstName: 'Ana', pronouns: 'she' });
    const b = testSurvivor('b', { firstName: 'Bo', pronouns: 'he' });
    const fill = (line: string, vars: Record<string, string>): string => fillRoles(line.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m), { a, b });
    for (const [id, parts] of Object.entries(PARTS)) {
      for (const part of parts) {
        for (const line of [...part.sight, ...part.inside]) {
          assert.doesNotMatch(line, /[{}]/, `${id}: ${line}`);
          assert.doesNotMatch(line, GROUP, `${id}: ${line}`);
        }
        for (const need of part.needs) {
          const def = NEEDS[need.kind];
          const it = need.it ?? part.it;
          assert.ok(/^(the|a|an) /.test(it), `${id}: "${it}" is named with its article`);
          const vars = { it, It: it[0]!.toUpperCase() + it.slice(1), tool: 'the lockpicks', ride: 'the Pickup Truck' };
          const c = def.covered;
          const pools = [c.stat, c.tool, c.trait, c.gear, c.together, c.vehicle?.crew, c.vehicle?.solo, def.skip.crew, def.skip.solo, def.tries, def.won, def.lost, def.fail.quiet?.crew, def.fail.quiet?.solo];
          for (const pool of pools) for (const line of pool ?? []) assert.doesNotMatch(fill(line, vars), /[{}]|undefined/, `${id}, ${need.kind}: ${line}`);
          for (const line of [...def.skip.solo, ...(c.vehicle?.solo ?? []), ...(def.fail.quiet?.solo ?? []), ...c.stat, ...(c.tool ?? []), ...(c.trait ?? []), ...(c.gear ?? []), ...def.tries, ...def.won, ...def.lost]) {
            assert.doesNotMatch(withoutPlaceholders(line), GROUP, `${need.kind}: ${line}`);
          }
        }
      }
    }
    for (const line of PART_HAUL.solo) assert.doesNotMatch(withoutPlaceholders(line), GROUP, line);
  });

  test('traits and gear that cover or help name real needs, and perks name real traits', () => {
    for (const t of TRAITS) for (const k of t.hooks?.needCover ?? []) assert.ok(NEED_KINDS.includes(k), `${t.id}: ${k}`);
    for (const g of GEAR) for (const k of [...(g.hooks?.needCover ?? []), ...(g.hooks?.needHelp ?? [])]) assert.ok(NEED_KINDS.includes(k), `${g.id}: ${k}`);
    for (const p of PERKS) for (const t of p.traits) assert.ok(findTrait(t), `${p.id}: ${t}`);
  });
});

describe('who covers a need (3.13.0)', () => {
  test('good enough covers it, a level deeper takes more, and one short does not', () => {
    for (const [i, bar] of NEED_BAR.entries()) {
      const level = i + 1;
      assert.equal(coverNeed([person({ wits: bar })], 'locked', level)?.how, 'stat');
      assert.equal(coverNeed([person({ wits: bar - 1 })], 'locked', level), undefined);
    }
  });

  test('a tool that helps lowers the bar for whoever holds it', () => {
    const state = openGame('tools');
    const s = person({ wits: NEED_BAR[0] - NEED_TOOL });
    assert.equal(coverNeed([s], 'locked', 1), undefined);
    s.equipment.tool = createItem(state, 'lockpicks');
    assert.deepEqual(coverNeed([s], 'locked', 1), { how: 'tool', by: s.id, item: 'lockpicks' });
    // Lockpicks don't help with machines.
    assert.equal(coverNeed([s], 'machines', 1), undefined);
  });

  test('a trait or a piece of gear that covers it does, whatever the stats; a hidden trait only on the run', () => {
    const state = openGame('covers');
    const tinker = person({ wits: 1 });
    tinker.traits = [{ id: 'tinkerer', gainedDay: 1 }];
    assert.equal(coverNeed([tinker], 'machines', 3)?.how, 'trait');
    tinker.traits[0]!.hidden = true;
    assert.equal(coverNeed([tinker], 'machines', 3), undefined);
    assert.equal(coverNeed([tinker], 'machines', 3, { hidden: true })?.how, 'trait');
    const suited = person({ grit: 1 });
    suited.equipment.armor = createItem(state, 'hazmat_suit');
    assert.deepEqual(coverNeed([suited], 'radiation', 3), { how: 'gear', by: suited.id, item: 'hazmat_suit' });
  });

  test('two who are nearly strong enough lift together, but two nearly good with locks open nothing', () => {
    const near = NEED_BAR[1] - NEED_TOGETHER;
    const a = person({ brawn: near, wits: near }, 'a');
    const b = person({ brawn: near, wits: near }, 'b');
    assert.equal(coverNeed([a], 'heavy', 2), undefined);
    assert.deepEqual(coverNeed([a, b], 'heavy', 2), { how: 'together', by: 'a', with: 'b' });
    assert.equal(coverNeed([a, b], 'locked', 2), undefined);
  });

  test('a vehicle with room carries a load out', () => {
    const a = person({ brawn: 1 });
    assert.equal(coverNeed([a], 'carry', 1), undefined);
    assert.equal(coverNeed([a], 'carry', 1, { vehicle: true })?.how, 'vehicle');
    assert.equal(coverNeed([a], 'heavy', 1, { vehicle: true }), undefined);
  });

  test('the planner sees the part, who covers it, and whether the guild knows of it yet', () => {
    const state = plain('planner');
    const keen = state.survivors[0]!;
    keen.stats.wits = NEED_BAR[0];
    const plan = testPlan(state, 'rail_yard', {}, 2);
    const seen = plannedPart(state, plan)!;
    assert.equal(seen.part, partAt('rail_yard', 1));
    assert.equal(seen.known, false);
    assert.equal(seen.needs[0]!.cover?.by, keen.id);
    assert.deepEqual(needsCoveredBy(keen, 'rail_yard', 1), ['locked']);
    assert.deepEqual(needsCoveredBy(state.survivors[1]!, 'rail_yard', 1), []);
    // Only a scavenging crew goes for it.
    assert.equal(plannedPart(state, { ...plan, job: 'scout' }), undefined);
    assert.equal(plannedPart(state, { ...plan, locationId: 'drive_in', job: 'trade' }), undefined);
  });
});

/** A run at a place's level, by a crew made to cover its part or not. */
function runAt(seed: string, locationId: string, opts: { depth?: number; cover?: boolean; approach?: 'sneaky' | 'balanced' | 'aggressive'; size?: number } = {}) {
  const state = plain(seed);
  const level = opts.depth ?? 1;
  const part = partAt(locationId, level)!;
  if (opts.cover) {
    for (const n of part.needs) {
      const stat = NEEDS[n.kind].stat;
      state.survivors[0]!.stats[stat] = NEED_BAR[level - 1]!;
    }
  }
  if (level > 1) {
    state.locations[locationId]!.explored = 100;
    if (level > 2) state.locations[locationId]!.depths = [100, 0];
  }
  const plan = testPlan(state, locationId, { approach: opts.approach ?? 'sneaky', ...(level > 1 ? { depth: level } : {}) }, opts.size ?? 2);
  return { state, plan, part, sim: simulateRun(state, plan, seed, T0) };
}

describe('the best part on a run (3.13.0)', () => {
  test('a crew that covers it gets in and brings out what it holds, instead of its first search', () => {
    let checked = 0;
    for (let i = 0; i < 20; i++) {
      const { part, sim } = runAt(`in-${i}`, 'maple_street', { depth: 2, cover: true });
      const beat = sim.beats.find((b) => b.title === part.title);
      if (!beat) continue;
      checked++;
      assert.ok(beat.lines.some((l) => part.inside.includes(l.text)), beat.lines.map((l) => l.text).join(' / '));
      assert.ok(beat.lines.some((l) => l.tone === 'good' && /come away with|take/.test(l.text)));
      assert.deepEqual(sim.result.parts, [2]);
    }
    assert.ok(checked >= 15, `${checked} runs came to the gun safe`);
  });

  test('with nobody to cover it, a sneaky crew leaves it, and that stretch brings nothing', () => {
    let checked = 0;
    for (let i = 0; i < 20; i++) {
      const { part, sim } = runAt(`skip-${i}`, 'rail_yard', { approach: 'sneaky' });
      const beat = sim.beats.find((b) => b.title === part.title);
      if (!beat) continue;
      checked++;
      assert.ok(!beat.lines.some((l) => l.check), 'no go at it');
      assert.ok(beat.lines.some((l) => /stays shut/.test(l.text)), beat.lines.map((l) => l.text).join(' / '));
      assert.ok(!beat.lines.some((l) => part.inside.includes(l.text) || l.tone === 'good'));
    }
    assert.ok(checked >= 15);
  });

  test('an aggressive crew has a go anyway, and sometimes it costs them', () => {
    let tries = 0;
    let won = 0;
    let hurt = 0;
    for (let i = 0; i < 120; i++) {
      const { part, sim } = runAt(`force-${i}`, 'rail_yard', { depth: 2, approach: 'aggressive' });
      const beat = sim.beats.find((b) => b.title === part.title);
      if (!beat) continue;
      const go = beat.lines.find((l) => l.check);
      if (!go) continue;
      tries++;
      if (go.check!.success) won++;
      else if (/HP/.test(go.text)) hurt++;
    }
    assert.ok(tries > 60, `tries ${tries}`);
    assert.ok(won > 0 && won < tries, `won ${won} of ${tries}`);
    assert.ok(hurt > 0, 'a heavy door that would not give hurt someone');
  });

  test('a hidden trait that gets them in shows itself', () => {
    let checked = 0;
    for (let i = 0; i < 20 && checked < 5; i++) {
      const state = plain(`hidden-${i}`);
      state.survivors[0]!.traits = [{ id: 'tinkerer', gainedDay: 1, hidden: true }];
      const plan = testPlan(state, 'water_plant', { approach: 'sneaky' }, 2);
      const sim = simulateRun(state, plan, `hidden-${i}`, T0);
      const beat = sim.beats.find((b) => b.title === partAt('water_plant', 1)!.title);
      if (!beat) continue;
      checked++;
      assert.ok(beat.lines.some((l) => /is Tinkerer/.test(l.text)));
      assert.ok(!sim.result.crew[0]!.traits.find((t) => t.id === 'tinkerer')!.hidden);
    }
    assert.equal(checked, 5);
  });

  test('only a scavenging crew goes for it; a scout who goes all the way sees it and the next level down', () => {
    const state = plain('scout');
    const plan = testPlan(state, 'old_metro', { job: 'scout' }, 3);
    for (let i = 0; i < 40; i++) {
      const sim = simulateRun(state, plan, `scout-${i}`, T0);
      assert.ok(!sim.beats.some((b) => PARTS.old_metro!.some((p) => p.title === b.title)));
      if (sim.result.outcome === 'completed') {
        assert.deepEqual(sim.result.parts, [2]);
        const run = startRun(state, plan, T0);
        completeRun(state, run.id, run.returnAt);
        return;
      }
    }
    assert.fail('no scouting run came back');
  });

  test('coming home, the guild knows of what they saw, and it saves', () => {
    for (let i = 0; i < 30; i++) {
      const state = plain(`home-${i}`);
      state.survivors[0]!.stats.wits = NEED_BAR[0];
      const run = startRun(state, testPlan(state, 'rail_yard', { approach: 'sneaky' }, 2), T0);
      if (!run.result.parts) continue;
      assert.equal(knowsPart(state, 'rail_yard', 1), false);
      completeRun(state, run.id, run.returnAt);
      assert.equal(knowsPart(state, 'rail_yard', 1), true);
      assert.deepEqual(deserialize(serialize(state)).locations.rail_yard!.parts, [1]);
      return;
    }
    assert.fail('no run came to the signal box');
  });

  test('a crew that covers it brings home more, many runs over', () => {
    const haul = (cover: boolean): number => {
      let total = 0;
      for (let i = 0; i < 300; i++) {
        const { sim } = runAt(`haul-${i}`, 'maple_street', { depth: 2, cover });
        total += Object.values(sim.result.loot).reduce((a, b) => a + b, 0);
      }
      return total / 300;
    };
    const covered = haul(true);
    const not = haul(false);
    assert.ok(covered > not * 1.15, `covered ${covered.toFixed(1)} vs not ${not.toFixed(1)}`);
  });
});

describe('crew perks (3.13.0)', () => {
  test('a pair makes a perk only when both traits show', () => {
    const a = person({}, 'a');
    const b = person({}, 'b');
    a.traits = [{ id: 'curious', gainedDay: 1 }];
    b.traits = [{ id: 'cautious', gainedDay: 1, hidden: true }];
    assert.deepEqual(crewPerks([a, b]), []);
    b.traits[0]!.hidden = false;
    const perks = crewPerks([a, b]);
    assert.deepEqual(
      perks.map((p) => [p.perk.id, p.pair]),
      [['look_and_check', ['a', 'b']]],
    );
    assert.equal(perkMod(perks, 'a', 'wits', ['scavenge']), 2);
    assert.equal(perkMod(perks, 'b', 'wits', ['spot']), 2);
    assert.equal(perkMod(perks, 'a', 'wits', ['ambush']), 0);
    assert.equal(perkMod(perks, 'a', 'aim', ['scavenge']), 0);
  });

  test('the same trait twice takes two people; a one-sided perk helps only its one', () => {
    const v = person({}, 'v');
    v.traits = [{ id: 'veteran', gainedDay: 1 }];
    assert.deepEqual(crewPerks([v]), []);
    const w = person({}, 'w');
    w.traits = [{ id: 'veteran', gainedDay: 1 }];
    assert.equal(crewPerks([v, w])[0]?.perk.id, 'old_hands');
    const p = person({}, 'p');
    p.traits = [{ id: 'patcher', gainedDay: 1 }];
    const l = person({}, 'l');
    l.traits = [{ id: 'loyal', gainedDay: 1 }];
    const perks = crewPerks([l, p]);
    assert.equal(perkMod(perks, 'p', 'wits', ['medicine']), 2);
    assert.equal(perkMod(perks, 'l', 'wits', ['medicine']), 0);
  });
});

/** Make sure each kind of need is met somewhere, so none of their lines is dead. */
test('every kind of need stands in the way somewhere', () => {
  const met = new Set<NeedKind>();
  for (const parts of Object.values(PARTS)) for (const p of parts) for (const n of p.needs) met.add(n.kind);
  assert.deepEqual([...met].sort(), [...NEED_KINDS].sort());
});
