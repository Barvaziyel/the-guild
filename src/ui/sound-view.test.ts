import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { describe, test } from 'node:test';
import { createItem, startRun, type FightAct, type FightActKind, type FightView, type GameState, type RunReport } from '../engine/index.ts';
import { T0, openGame, testPlan } from '../engine/test-utils.ts';
import { actCues, alertCues, ambienceFor, endCue, enemyVoice, gainOf, musicFor, stateCues, tapCue, type Alerts } from './sound-view.ts';
import { AMBIENCE, MUSIC, SPRITE } from './sounds.ts';

const NOON = 12;
const MIDNIGHT = 0;

const enemy = (index: number, type: string, kind: string): FightView['enemies'][number] => ({
  index,
  name: kind,
  type,
  kind,
  hp: 5,
  maxHp: 10,
  state: 'up',
  stunned: false,
  named: false,
  nemesis: false,
  vulture: false,
  rank: 'front',
  damage: 3,
  armor: 0,
  rises: false,
  pack: false,
  heavy: false,
  leader: false,
  fearless: false,
});

function fight(state: GameState): FightView {
  const [a, b] = state.survivors;
  return {
    round: 1,
    maxRounds: 6,
    place: 'Kessler Farm',
    enemies: [enemy(0, 'raider', 'raider_gunner'), enemy(1, 'feral', 'rad_hound'), enemy(2, 'scrapbot', 'scrap_drone')],
    crew: [a!, b!].map((s) => ({ id: s.id, name: s.id, hp: 10, maxHp: 20, state: 'up' as const, aimed: false, moves: [], rank: 'front' as const, byRank: { front: [], back: [] } })),
    meds: 0,
    ammo: 10,
    lines: [],
    acts: [],
  };
}

const act = (kind: FightActKind, by: number | string, at?: number | string, more: Partial<FightAct> = {}): FightAct => ({ round: 1, line: 0, kind, by, ...(at !== undefined ? { at } : {}), ...more });

describe('music (3.1.0)', () => {
  test('the Depot by day, softer at night, a fight’s own, and Haven’s', () => {
    const state = openGame('music');
    assert.equal(musicFor({ screen: 'depot' }, state, NOON), 'depot');
    assert.equal(musicFor({ screen: 'roster' }, state, MIDNIGHT), 'night');
    assert.equal(musicFor({ screen: 'roster' }, state, 19), 'night', 'dusk is night’s music');
    assert.equal(musicFor({ screen: 'fight', id: 'r1' }, state, NOON), 'fight');
    assert.equal(musicFor({ screen: 'haven' }, state, NOON), 'haven');
    // A raid screen with nothing on it is just the Depot.
    assert.equal(musicFor({ screen: 'raid' }, state, NOON), 'depot');
  });

  test('Haven’s tune is hopeful until the guild has been there; then the truth', () => {
    const state = openGame('truth');
    state.haven = { found: [] } as unknown as GameState['haven'];
    assert.equal(musicFor({ screen: 'haven' }, state, NOON), 'haven');
    state.haven = { found: [], end: { day: 40, won: true, freed: 3, withVultures: 0 } } as unknown as GameState['haven'];
    assert.equal(musicFor({ screen: 'haven' }, state, NOON), 'truth');
    assert.equal(musicFor({ screen: 'roster' }, state, NOON), 'depot', 'only on the Haven tab');
  });

  test('the whole time the guild is on the road east, it’s Haven’s tune', () => {
    const state = openGame('road');
    state.haven = { road: { runId: 'r1', children: [] } } as unknown as GameState['haven'];
    assert.equal(musicFor({ screen: 'roster' }, state, NOON), 'haven');
    assert.deepEqual(ambienceFor({ screen: 'depot' }, state, NOON), { wind: 0.8, fire: 0, crickets: 0, birds: 0 });
  });
});

describe('the yard’s ambience (3.1.0)', () => {
  const state = openGame('amb');
  test('birds by day, crickets at night, wind and the fire always', () => {
    const day = ambienceFor({ screen: 'roster' }, state, NOON);
    const night = ambienceFor({ screen: 'roster' }, state, MIDNIGHT);
    assert.ok(day.birds > 0 && day.crickets === 0);
    assert.ok(night.crickets > 0 && night.birds === 0);
    for (const m of [day, night]) assert.ok(m.wind > 0 && m.fire > 0);
  });

  test('the fire is nearer on the yard itself', () => {
    assert.ok(ambienceFor({ screen: 'depot' }, state, NOON).fire > ambienceFor({ screen: 'depot', tab: 'today' }, state, NOON).fire);
  });

  test('a fight has its music alone', () => {
    assert.deepEqual(ambienceFor({ screen: 'fight', id: 'r1' }, state, NOON), { wind: 0, fire: 0, crickets: 0, birds: 0 });
  });
});

describe('the game changing (3.1.0)', () => {
  test('a crew setting out, on foot or with an engine', () => {
    const before = openGame('send');
    const after = structuredClone(before);
    const run = startRun(after, testPlan(after, 'maple_street'), T0);
    assert.deepEqual(stateCues(before, after).map((c) => c.id), ['send']);
    const driving = structuredClone(after);
    driving.runs.find((r) => r.id === run.id)!.plan.vehicles = ['v1'];
    assert.deepEqual(stateCues(before, driving).map((c) => c.id), ['engine']);
  });

  test('a building going up, someone new, and a crew home', () => {
    const before = openGame('changes');
    const built = structuredClone(before);
    built.buildings.workshop = 1;
    assert.deepEqual(stateCues(before, built).map((c) => c.id), ['build']);
    const joined = structuredClone(before);
    joined.survivors.push({ ...structuredClone(before.survivors[0]!), id: 'new-one' });
    assert.deepEqual(stateCues(before, joined).map((c) => c.id), ['recruit']);
    const home = structuredClone(before);
    home.reports.push({ id: 'r9', plan: testPlan(before) } as unknown as RunReport);
    assert.deepEqual(stateCues(before, home).map((c) => c.id), ['home']);
  });

  test('a death comes first, and no more than two sounds at once, the second a beat later', () => {
    const before = openGame('death');
    const after = structuredClone(before);
    after.memorial.push(after.survivors.pop()!);
    after.buildings.workshop = 1;
    after.reports.push({ id: 'r9', plan: testPlan(before) } as unknown as RunReport);
    after.survivors.push({ ...structuredClone(before.survivors[0]!), id: 'new-one' });
    const cues = stateCues(before, after);
    assert.equal(cues.length, 2);
    assert.equal(cues[0]!.id, 'death');
    assert.ok((cues[1]!.delay ?? 0) > 0);
  });

  test('making something at the Workshop, or a trade', () => {
    const before = openGame('craft');
    const made = structuredClone(before);
    made.resources.scrap -= 4;
    made.stash.push(createItem(made, 'pipe'));
    assert.deepEqual(stateCues(before, made).map((c) => c.id), ['craft']);
    // Buying a trader's gear is a trade, not making something.
    const traded = structuredClone(before);
    traded.depot.offers = [{ id: 'o1', give: {}, get: {}, expiresDay: 9 }];
    const bought = structuredClone(traded);
    bought.depot.offers = [];
    bought.resources.scrap += 0;
    bought.resources.rations -= 10;
    bought.stash.push(createItem(bought, 'machete'));
    assert.deepEqual(stateCues(traded, bought).map((c) => c.id), ['trade']);
    // Giving gear from the stash to someone changes nothing to hear.
    const given = structuredClone(before);
    given.stash.push(createItem(given, 'pipe'));
    assert.deepEqual(stateCues(before, given), []);
  });

  test('a different guild (a new game, an import) is silent', () => {
    const before = openGame('one');
    const after = openGame('two');
    assert.deepEqual(stateCues(before, after), []);
  });
});

describe('alerts while looking (3.1.0)', () => {
  const quiet: Alerts = { radio: false, raid: 0 };
  test('raiders seen, then at the gate, each ring the bell; a call comes in on the radio', () => {
    assert.deepEqual(alertCues(quiet, { radio: false, raid: 1 }).map((c) => c.id), ['alarm']);
    assert.deepEqual(alertCues({ radio: false, raid: 1 }, { radio: false, raid: 2 }).map((c) => c.id), ['alarm']);
    assert.deepEqual(alertCues(quiet, { radio: true, raid: 0 }).map((c) => c.id), ['radio_call']);
    assert.deepEqual(alertCues(quiet, { radio: false, fight: true, raid: 0 }).map((c) => c.id), ['radio']);
    assert.deepEqual(alertCues({ radio: true, raid: 2 }, { radio: true, raid: 2 }), []);
  });

  test('answering a crew on the radio keys the mic; nobody answering makes no sound (3.11.0)', () => {
    const state = openGame('radio-answer');
    const [a] = state.survivors;
    const run = startRun(state, testPlan(state), T0);
    run.radio = { forkId: 'press_on', title: 'Further in', by: a!.id, intro: '', ask: '', orders: [{ id: 'press', label: 'Press on' }, { id: 'home', label: 'Come home' }], at: T0 + 1000, until: T0 + 600_000, fromBeat: 0 };
    const before = structuredClone(state);
    const after = structuredClone(state);
    Object.assign(after.runs.find((r) => r.id === run.id)!.radio!, { answer: 'press', answeredAt: T0 + 5000 });
    assert.deepEqual(stateCues(before, after).map((c) => c.id), ['radio_answer']);
    const late = structuredClone(state);
    Object.assign(late.runs.find((r) => r.id === run.id)!.radio!, { answer: 'none' });
    assert.deepEqual(stateCues(before, late), []);
  });
});

describe('fights (3.1.0)', () => {
  const state = openGame('fight-sounds');
  const view = fight(state);
  const [a, b] = state.survivors;
  a!.equipment.weapon = createItem(state, 'hunting_rifle');
  b!.equipment.weapon = createItem(state, 'machete');

  const ids = (cues: readonly { id: string }[]): string[] => cues.map((c) => c.id.replace(/^hurt\d$/, 'hurt'));

  test('a shot sounds like the gun, and lands or flies wide', () => {
    assert.deepEqual(ids(actCues(state, view, act('hit', a!.id, 0, { shot: true, amount: 4 })).cues), ['rifle', 'hurt']);
    assert.deepEqual(actCues(state, view, act('miss', a!.id, 0, { shot: true })).cues.map((c) => c.id), ['rifle', 'ricochet']);
    assert.deepEqual(ids(actCues(state, view, act('hit', 0, a!.id, { shot: true, amount: 2 })).cues), ['rifle', 'hurt']);
    assert.deepEqual(ids(actCues(state, view, act('hit', 2, a!.id, { shot: true, amount: 2 })).cues), ['laser', 'hurt']);
  });

  test('eight of the same enemy each sound like themselves (3.4.1)', () => {
    const voices = Array.from({ length: 8 }, (_, i) => enemyVoice(i));
    assert.equal(new Set(voices.map((v) => `${v.variant}@${v.rate}`)).size, 8, 'no two of the first eight alike');
    for (let i = 1; i < 8; i++) assert.ok(voices[i]!.variant !== voices[i - 1]!.variant || voices[i]!.rate !== voices[i - 1]!.rate, 'never the same twice in a row');
    assert.ok(voices.every((v) => v.rate >= 0.85 && v.rate <= 1.15));
    // A hound's snarl is its own voice, at its own pitch.
    const cue = actCues(state, view, act('hit', 1, a!.id, { amount: 2 })).cues[0]!;
    assert.equal(cue.id, 'snarl2');
    assert.equal(cue.rate, enemyVoice(1).rate);
  });

  test('a blow swings, then lands by the weapon; a kill falls', () => {
    assert.deepEqual(actCues(state, view, act('kill', b!.id, 0, { amount: 5 })).cues.map((c) => c.id), ['swing2', 'blade', 'fall']);
    assert.deepEqual(actCues(state, view, act('kill', b!.id, 2, { amount: 5 })).cues.map((c) => c.id), ['swing2', 'blade', 'door'], 'a machine crashes down');
  });

  test('a hound bites; one of ours going down buzzes the phone hard, a big hit lightly', () => {
    const down = actCues(state, view, act('hit', 1, a!.id, { amount: 3, down: true }));
    assert.deepEqual(down.cues.map((c) => c.id), ['snarl2', 'bite', 'fall']);
    assert.equal(down.buzz, 'heavy');
    assert.equal(actCues(state, view, act('hit', 1, a!.id, { amount: 5 })).buzz, 'light');
    assert.equal(actCues(state, view, act('hit', 1, a!.id, { amount: 2 })).buzz, undefined);
    assert.equal(actCues(state, view, act('hit', a!.id, 1, { amount: 9, shot: true })).buzz, undefined, 'hurting them doesn’t buzz');
  });

  test('our side on the left, theirs on the right', () => {
    const [shot, hurt] = actCues(state, view, act('hit', a!.id, 0, { shot: true, amount: 4 })).cues;
    assert.ok(shot!.pan! < 0 && hurt!.pan! > 0);
  });

  test('every kind of act is handled', () => {
    const kinds: FightActKind[] = ['hit', 'miss', 'kill', 'heal', 'revive', 'talk', 'cover', 'aim', 'draw_fire', 'guard', 'spot', 'flee', 'break', 'escape', 'reel', 'withdraw', 'finish', 'rise', 'job', 'arrive'];
    for (const k of kinds) for (const cue of actCues(state, view, act(k, a!.id, 0)).cues) assert.ok(cue.id in SPRITE, `${k}: ${cue.id}`);
    assert.deepEqual(actCues(state, view, act('hit', 'dog', 0, { amount: 2 })).cues.map((c) => c.id), ['bark', 'bite']);
  });

  test('how a fight ends', () => {
    assert.equal(endCue('won')?.id, 'victory');
    assert.equal(endCue('routed')?.id, 'defeat');
    assert.equal(endCue('stalemate'), undefined);
  });
});

describe('taps (3.1.0)', () => {
  const el = (matches: string[]) => ({ closest: (sel: string) => (sel.split(',').some((s) => matches.includes(s.trim())) ? {} : null) });
  test('the tab bar turns a page, buttons click, the rest is silent', () => {
    assert.equal(tapCue(el(['.tab', 'button']))?.id, 'tab');
    assert.equal(tapCue(el(['button']))?.id, 'tap');
    assert.equal(tapCue(el([])), undefined);
    assert.equal(tapCue(null), undefined);
  });
});

describe('the sound files (3.1.0)', () => {
  test('every piece of music, ambience and the effects are in public/audio', () => {
    for (const name of [...Object.keys(MUSIC), ...Object.keys(AMBIENCE).map((a) => `amb-${a}`), 'sfx']) {
      assert.ok(existsSync(new URL(`../../public/audio/${name}.ogg`, import.meta.url)), name);
    }
  });

  test('the effects follow one another in the sprite without overlapping', () => {
    const spans = Object.values(SPRITE) as readonly (readonly [number, number])[];
    for (let i = 1; i < spans.length; i++) assert.ok(spans[i]![0] >= spans[i - 1]![0] + spans[i - 1]![1], `effect ${i}`);
  });

  test('the music credits are in Settings and the README', () => {
    assert.match(readFileSync(new URL('./screens/Settings.tsx', import.meta.url), 'utf8'), /FluidR3/);
    assert.match(readFileSync(new URL('../../README.md', import.meta.url), 'utf8'), /FluidR3/);
  });

  test('volumes: the middle of a slider is a quarter of the power, and nothing beyond the ends', () => {
    assert.equal(gainOf(0), 0);
    assert.equal(gainOf(1), 1);
    assert.equal(gainOf(0.5), 0.25);
    assert.equal(gainOf(2), 1);
    assert.equal(gainOf(-1), 0);
  });
});
