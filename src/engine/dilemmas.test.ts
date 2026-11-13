import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { DILEMMA_DAYS, DILEMMA_FIRST_DAY, DILEMMA_GAP, SAVE_VERSION } from './constants.ts';
import { DILEMMAS, getDilemma, getTrait, type DilemmaDef } from './content/index.ts';
import { build } from './depot/buildings.ts';
import { advanceTime, dayStart } from './depot/time.ts';
import { decideDilemma, decideProblem, dilemmaRoles, dilemmaText, playDilemmaDay, startDilemma } from './dilemmas.ts';
import { becomePartners } from './relationships.ts';
import { Rng } from './rng.ts';
import { deserialize } from './save.ts';
import { openGame, testGame } from './test-utils.ts';
import { addTrait } from './traits.ts';
import { playVulturesDay } from './vultures.ts';
import type { GameState } from './types.ts';
import { STAT_IDS } from './types.ts';

/** A guild where any decision can come up: a grieving Greedy founder, a couple, a rivalry, supplies, and places left to find. */
function guildFor(def: DilemmaDef, seed: string): GameState {
  // A new guild knows a few places, so there are always more to find.
  const state = testGame(seed);
  state.resources = { scrap: 60, rations: 80, meds: 12, ammo: 40, tech: 20, gas: 5 };
  const [a, b, c, d] = state.survivors as [GameState['survivors'][0], GameState['survivors'][0], GameState['survivors'][0], GameState['survivors'][0]];
  if (def.cast.a?.trait) for (const s of state.survivors) addTrait(s, def.cast.a.trait, { day: 1, silent: true, force: true, rng: new Rng(seed) });
  if (def.cast.b?.with === 'apart') for (const rel of Object.values(state.relationships)) rel.score = -40;
  if (def.cast.b?.with === 'feud') for (const rel of Object.values(state.relationships)) rel.score = -70;
  if (def.cast.b?.with === 'close') for (const rel of Object.values(state.relationships)) rel.score = 60;
  // Pairs with no condition: friends in half the guilds, so outcomes for friends and for the rest both come up.
  if (def.cast.b && !def.cast.b.with && new Rng(`close-${seed}`).chance(0.5)) for (const rel of Object.values(state.relationships)) rel.score = 60;
  if (def.cast.b?.with === 'partner') {
    a.pronouns = 'she';
    b.pronouns = 'he';
    a.orientation = b.orientation = 'straight';
    for (const rel of Object.values(state.relationships)) rel.score = 70;
    becomePartners(state, a, b, 1);
    becomePartners(state, c, d, 1);
  }
  // The Vultures' envoys: they've arrived, things stand as the decision needs, and the guild may hold one of theirs.
  const v = def.needs?.vultures;
  if (v) {
    state.vultures.arriveDay = 1;
    playVulturesDay(state, 1, new Rng(`v-${seed}`));
    const band = v.bands?.[new Rng(`band-${seed}`).int(0, v.bands.length - 1)];
    state.vultures.standing = band === 'war' ? -60 : band === 'truce' ? 20 : band === 'trade' ? 50 : -10;
    state.vultures.strength = Math.max(state.vultures.strength, v.minStrength ?? 0);
    if (!v.first) state.dilemmas.seen.vulture_first_contact = 1;
    if (v.prisoner) state.vultures.people.find((m) => m.role === 'lieutenant')!.status = 'captured';
  }
  return state;
}

/** A pattern for the news line an outcome writes: its text with each placeholder matching any name or word. */
function told(def: DilemmaDef, text: string): RegExp {
  const escape = (x: string): string => x.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
  const pattern = text
    .split(/\{[\w.]+\}/)
    .map(escape)
    .join('.+?');
  return new RegExp(`^${escape(def.title)}: ${pattern}`);
}

/** Placeholders a decision's texts may use: its roles' keys, and {place} where a place is revealed. */
function checkText(def: DilemmaDef, text: string, where: string): void {
  const roles = new Set(['a', ...(def.cast.b ? ['b'] : []), ...(def.needs?.stranger ? ['s'] : []), ...(def.needs?.vultures ? ['v'] : []), ...(def.needs?.vultures?.prisoner ? ['p'] : [])]);
  for (const [, role, key] of text.matchAll(/\{(\w+)\.(\w+)\}/g)) {
    assert.ok(roles.has(role!), `${def.id} ${where}: role ${role} isn't cast`);
    assert.ok(['first', 'last', 'name', 'they', 'them', 'their', 'theirs', 'themself', 'is', 'was', 'has', 'does'].includes(key!.toLowerCase()), `${def.id} ${where}: {${role}.${key}}`);
  }
  for (const [match] of text.matchAll(/\{(\w+)\}/g)) assert.equal(match, '{place}', `${def.id} ${where}: ${match}`);
}

describe('decisions at the Depot: content', () => {
  test('every decision is well formed: four answers, a last outcome with no test, real traits and stats, placeholders that fill', () => {
    assert.ok(DILEMMAS.length >= 12);
    assert.equal(new Set(DILEMMAS.map((d) => d.id)).size, DILEMMAS.length);
    for (const def of DILEMMAS) {
      assert.equal(def.choices.length, 4, def.id);
      checkText(def, def.text, 'text');
      for (const [role, line] of Object.entries(def.chronicle ?? {})) {
        checkText(def, line, `chronicle ${role}`);
        assert.ok(!/^\{a\.first\}|^\{b\.first\}/.test(line), `${def.id}: Chronicle lines have no subject`);
      }
      if (def.cast.a?.trait) getTrait(def.cast.a.trait);
      for (const [i, list] of [...def.choices.map((c) => c.outcomes), def.unanswered].entries()) {
        if (i < 4) checkText(def, def.choices[i]!.label, `choice ${i}`);
        assert.ok(list.length > 0 && list[list.length - 1]!.test === undefined, `${def.id} list ${i} must end with an outcome that always fits`);
        for (const o of list) {
          checkText(def, o.text, `outcome "${o.text.slice(0, 20)}"`);
          if (o.text.includes('{place}')) assert.ok(o.effects.some((e) => e.kind === 'reveal'), `${def.id}: {place} without a reveal`);
          if (o.test && 'trait' in o.test) getTrait(o.test.trait);
          if (o.test && 'stat' in o.test) assert.ok(STAT_IDS.includes(o.test.stat));
          if (o.test && ('close' in o.test || 'apart' in o.test)) assert.ok(def.cast.b, `${def.id}: a pair test needs b`);
          for (const e of o.effects) {
            if (e.kind === 'trait') getTrait(e.trait);
            if (e.kind === 'bond' && !e.stranger) assert.ok(def.cast.b, `${def.id}: bond needs b`);
            if (e.kind === 'joins' || (e.kind === 'bond' && e.stranger)) assert.ok(def.needs?.stranger, `${def.id}: no stranger to join`);
            if ('who' in e && (e.who === 'b' || e.who === 'both')) assert.ok(def.cast.b, `${def.id}: effect on b without b`);
          }
        }
      }
    }
  });

  test('every decision can come up, and every outcome of every answer can happen', () => {
    for (const def of DILEMMAS) {
      const seen = new Map<string, number>();
      for (let choice = 0; choice <= 4; choice++) {
        const list = choice < 4 ? def.choices[choice]!.outcomes : def.unanswered;
        const reached = new Set<string>();
        for (let i = 0; i < 400 && reached.size < list.length; i++) {
          const state = guildFor(def, `${def.id}-${choice}-${i}`);
          const d = startDilemma(state, 3, new Rng(`${def.id}-${i}`), def.id);
          assert.ok(d, `${def.id} could not come up`);
          const before = state.log.length;
          if (choice < 4) decideDilemma(state, choice, dayStart(state, 3) + 1000);
          else playDilemmaDay(state, d.deadlineDay, new Rng(`u${i}`));
          assert.equal(state.dilemmas.active, undefined);
          const news = state.log.slice(before).find((l) => l.tags?.includes('decision'))!;
          assert.ok(news, `${def.id}: no news`);
          assert.ok(!/\{[\w.]+\}/.test(news.text), `${def.id}: unfilled ${news.text}`);
          const hit = list.findIndex((o) => told(def, o.text).test(news.text));
          if (hit >= 0) reached.add(String(hit));
        }
        seen.set(String(choice), reached.size);
        assert.equal(reached.size, list.length, `${def.id}, ${choice < 4 ? `answer ${choice}` : 'unanswered'}: reached ${reached.size} of ${list.length} outcomes`);
      }
    }
  });
});

describe('decisions at the Depot: in the game', () => {
  test('the first comes up a few days into a new guild, one at a time, and waits about a real day', () => {
    const state = openGame('first');
    advanceTime(state, dayStart(state, DILEMMA_FIRST_DAY - 1) + 1);
    assert.equal(state.dilemmas.active, undefined);
    advanceTime(state, dayStart(state, DILEMMA_FIRST_DAY) + 1);
    const d = state.dilemmas.active!;
    assert.ok(d, 'one has come up');
    assert.equal(d.day, DILEMMA_FIRST_DAY);
    assert.equal(d.deadlineDay, DILEMMA_FIRST_DAY + DILEMMA_DAYS);
    const text = dilemmaText(state, d, getDilemma(d.defId).text);
    assert.ok(!/\{\w+\.\w+\}/.test(text), text);
    advanceTime(state, dayStart(state, DILEMMA_FIRST_DAY + 3) + 1);
    assert.equal(state.dilemmas.active, d, 'still waiting, and nothing else came up');
  });

  test('answering settles it, and the next comes 5 to 11 days later', () => {
    const state = openGame('answer');
    advanceTime(state, dayStart(state, DILEMMA_FIRST_DAY) + 1);
    const result = decideDilemma(state, 2, dayStart(state, DILEMMA_FIRST_DAY) + 2);
    assert.ok(result.choice && result.text);
    assert.equal(state.dilemmas.active, undefined);
    assert.ok(state.dilemmas.nextDay >= DILEMMA_FIRST_DAY + DILEMMA_GAP[0] && state.dilemmas.nextDay <= DILEMMA_FIRST_DAY + DILEMMA_GAP[1]);
    assert.match(decideProblem(state, 0)!, /nothing to decide/);
  });

  test('left alone past its deadline, the people involved settle it themselves', () => {
    const state = openGame('alone');
    advanceTime(state, dayStart(state, DILEMMA_FIRST_DAY) + 1);
    const d = state.dilemmas.active!;
    const def = getDilemma(d.defId);
    advanceTime(state, dayStart(state, d.deadlineDay) + 1);
    assert.notEqual(state.dilemmas.active?.day, d.day);
    const line = state.log.find((l) => l.tags?.includes('decision'))!;
    assert.ok(def.unanswered.some((o) => told(def, o.text).test(line.text)), line.text);
  });

  test('a decision about someone who is gone is dropped', () => {
    const state = openGame('gone');
    advanceTime(state, dayStart(state, DILEMMA_FIRST_DAY) + 1);
    const d = state.dilemmas.active!;
    state.survivors = state.survivors.filter((s) => s.id !== d.cast.a);
    assert.equal(dilemmaRoles(state, d), undefined);
    playDilemmaDay(state, DILEMMA_FIRST_DAY + 1, new Rng('g'));
    assert.equal(state.dilemmas.active, undefined);
  });

  test('a stranger let in joins if there is a bed, and moves on if there is not', () => {
    const def = getDilemma('stranger_at_gate');
    let joined = 0;
    let movedOn = 0;
    for (let i = 0; i < 60; i++) {
      const state = guildFor(def, `bed-${i}`);
      const full = i % 2 === 1;
      if (!full) {
        state.resources.scrap = 100;
        build(state, 'bunks', 1);
      }
      startDilemma(state, 3, new Rng(`bed${i}`), def.id);
      const count = state.survivors.length;
      const result = decideDilemma(state, 0, dayStart(state, 3) + 1000);
      if (state.survivors.length > count) joined += 1;
      if (/no bed for/.test(result.text)) {
        movedOn += 1;
        assert.ok(full);
      }
    }
    assert.ok(joined > 10 && movedOn > 10, `${joined} joined, ${movedOn} moved on`);
  });

  test('a save from before version 13 gets its first decision soon', () => {
    const state = testGame('v12');
    const old = structuredClone(state) as unknown as Partial<GameState> & { version: number };
    delete old.dilemmas;
    old.version = 12;
    const loaded = deserialize(JSON.stringify(old));
    assert.equal(loaded.version, SAVE_VERSION);
    assert.deepEqual(loaded.dilemmas, { nextDay: state.depot.lastDay + 2, seen: {} });
  });
});
