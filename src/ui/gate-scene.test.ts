import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HAVEN_CLUES, HAVEN_JOURNEY, HAVEN_VULTURES, Rng, fightPreview, letThemFight, makeMember, setOutForHaven, startHaven, type GameState } from '../engine/index.ts';
import { T0, openGame } from '../engine/test-utils.ts';
import { stageSvg } from '../scene/index.ts';
import { gateScene } from './gate-scene.ts';
import { readingTime } from './scene-view.ts';
import { SPRITE } from './sounds.ts';

/** A guild at Haven's gate: every clue, a van, the Vultures' word if asked, one of them gone east if asked, and the first two fights behind them. */
function atTheGate(seed: string, vultures: boolean, dreamer = false): { state: GameState; runId: string } {
  const state = openGame(seed);
  if (dreamer) {
    const s = state.survivors.pop()!;
    state.departed.push(s);
  }
  startHaven(state, 1);
  if (dreamer) state.haven!.dreamer = { id: state.departed[state.departed.length - 1]!.id, day: 1, ready: 1, gone: 2 };
  for (const c of HAVEN_CLUES) state.haven!.found.push({ id: c.id, day: 2 });
  state.vehicles.push({ id: 'v-van', defId: 'van', condition: 100, runs: 0 });
  Object.assign(state.resources, { gas: 100, meds: 20 });
  if (vultures) {
    const rng = new Rng(`v:${seed}`);
    state.vultures.arrived = true;
    state.vultures.camps = [{ locationId: 'drowned_mall', since: 1, home: true }];
    state.vultures.people = [makeMember(state, rng, 1, 'boss'), makeMember(state, rng, 1, 'lieutenant')];
    state.haven!.found.push({ id: HAVEN_VULTURES.id, day: 3 });
  }
  const run = setOutForHaven(state, T0);
  for (let k = 0; k < 2; k++) {
    const f = state.runs[0]!.lead!.fights[k]!;
    letThemFight(state, run.id, f.at + 60_000);
  }
  return { state, runId: run.id };
}

describe('Haven’s gate, before the fight (§9.12; moving, 4b)', () => {
  test('the door and the runner, the Vultures coming up, then the gate opening on the fight', () => {
    const { state, runId } = atTheGate('scene', true, true);
    const run = state.runs.find((r) => r.id === runId)!;
    const fight = run.lead!.fights[2]!;
    assert.equal(fight.site, 'haven_gate');
    const view = fightPreview(state, runId, fight.at + 1000)!;
    const shots = gateScene(state, run, fight, view)!;
    assert.equal(shots.length, 3);
    const lines = run.beats[fight.fromBeat - 1]!.lines.map((l) => l.text);
    // The runner's three lines come up in turn over one moving shot, each with time to be read.
    const first = shots[0]!;
    assert.deepEqual(first.lines.map((l) => l.text), lines.slice(0, 3));
    assert.ok(Math.abs(first.lines[1]!.at * 1000 - readingTime(lines[0]!)) <= 50);
    assert.ok(first.ms >= lines.slice(0, 3).reduce((t, l) => t + readingTime(l), 0));
    assert.ok(shots[1]!.lines[0]!.text.startsWith('Engines on the road behind them'));
    // Their boss says it once the camera is in on them, face and all.
    assert.ok(shots[1]!.lines[1]!.text.startsWith('“We saw everything,”'));
    const boss = shots[1]!.faces![0]!;
    assert.equal(boss.tone, 'vulture');
    assert.ok(state.vultures.people.some((p) => p.person.id === boss.survivor.id && p.role === 'boss'));
    assert.ok(Math.abs(boss.at - shots[1]!.lines[1]!.at) < 0.5);
    assert.ok(shots[1]!.model.camera!.some((c) => c.scale > 1 && c.on?.length));
    assert.equal(shots[1]!.lines.map((l) => l.text).join(' '), lines.find((l) => l.startsWith('Engines'))!);
    assert.equal(shots[2]!.lines[0]!.text, HAVEN_JOURNEY.gate.open);

    // The small door bangs open, then the great gate swings open; nobody of Haven's on the stage until it does.
    assert.deepEqual(shots.map((s) => s.model.place), ['haven_gate_door', 'haven_gate_shut', 'haven_gate_opening']);
    assert.ok(shots.slice(0, 2).every((s) => s.model.enemies.length === 0));
    assert.ok(shots[2]!.model.enemies.some((e) => e.kind === 'the_shepherd'));
    // Haven's own walk out of the gate, the Shepherd last; the Vultures come on from behind.
    const out = shots[2]!.model.arrive!;
    assert.ok(out.every((a) => a.from !== 'left'));
    assert.deepEqual(out[out.length - 1]!.keys, shots[2]!.model.enemies.filter((e) => e.kind === 'the_shepherd').map((e) => e.key));
    assert.equal(out.flatMap((a) => a.keys).length, shots[2]!.model.enemies.length);
    const allies = (k: number) => shots[k]!.model.crew.filter((f) => f.vulture && f.state !== 'fled').map((f) => f.key);
    assert.equal(allies(0).length, 0);
    assert.deepEqual(shots[1]!.model.arrive![0]!.keys, allies(1));
    assert.equal(allies(1).length, 2);

    // The runner: hidden in the door, running, shouting, hit when the shot comes, and on the ground after.
    const keys = first.model.extras![0]!.keys!;
    assert.ok(keys[0]!.hidden);
    assert.ok(keys.some((k) => k.pose === 'run') && keys.some((k) => k.pose === 'shout'));
    const hit = keys.find((k) => k.pose === 'hit')!;
    assert.ok(Math.abs(hit.t - first.model.shot!.at!) < 0.1, 'hit when the shot comes');
    assert.ok(hit.t > first.lines[2]!.at, 'after its line is up');
    assert.equal(keys[keys.length - 1]!.pose, 'lying');
    assert.ok(keys.every((k, i) => i === 0 || k.t > keys[i - 1]!.t), 'in order');
    assert.ok(shots.slice(1).every((s) => s.model.extras![0]!.lying));
    // She's one of the guild's own: her face, in close, while she screams; she bleeds when the shot hits.
    const dreamer = state.departed.find((s) => s.id === state.haven!.dreamer!.id)!;
    assert.match(first.lines[0]!.text, new RegExp(dreamer.firstName));
    const face = first.faces![0]!;
    assert.equal(face.survivor.id, dreamer.id);
    assert.ok(face.at >= first.lines[1]!.at && face.until < hit.t);
    const cam = first.model.camera!;
    assert.ok(cam.some((c) => c.scale > 1 && c.t > first.lines[1]!.at && c.t < hit.t));
    assert.equal(cam[cam.length - 1]!.scale, 1, 'out again for the shot');
    assert.ok(cam[cam.length - 1]!.t < hit.t - 0.5);
    assert.ok(first.model.extras![0]!.blood && shots.slice(1).every((s) => s.model.extras![0]!.blood));
    assert.match(stageSvg(first.model), /#8e2a20/);

    // Its sound: Haven's tune turning at the scream; the door, the shot, the fall, the gate; all of it while its shot is up.
    assert.deepEqual(first.sound.music, [{ id: 'haven', at: 0 }, { id: 'truth', at: first.lines[1]!.at }]);
    const ids = shots.flatMap((s) => s.sound.cues.map((c) => c.id));
    for (const id of ['door_bang', 'shot_far', 'body_fall', 'pull_up', 'boots', 'gate_groan', 'stomp'] as const) assert.ok(ids.includes(id), id);
    // The trucks are heard and stop before the Vultures come on.
    const truck = shots[1]!.sound.cues.find((c) => c.id === 'pull_up')!;
    assert.ok((truck.delay ?? 0) + SPRITE.pull_up[1] <= shots[1]!.model.arrive![0]!.at + 0.2);
    // She lies under whoever stands over her: drawn before any of the ranks.
    const gateSvg = stageSvg(shots[2]!.model);
    assert.ok(gateSvg.indexOf('#6e1f18') < gateSvg.indexOf('data-key='), 'her blood is under the ranks');
    // She screams (no words), as she shouts: a man's scream for a man.
    const scream = dreamer.pronouns === 'he' ? 'scream_m' : 'scream_f';
    const screams = first.sound.cues.filter((c) => c.id === scream);
    assert.ok(screams.length >= 1);
    for (const c of screams) assert.ok(keys.some((k, i) => k.pose === 'shout' && k.t <= c.delay! && c.delay! < (keys[i + 1]?.t ?? Infinity)), 'while shouting');
    for (const s of shots) for (const c of s.sound.cues) {
      assert.ok(c.id in SPRITE, c.id);
      assert.ok((c.delay ?? 0) * 1000 < s.ms, `${c.id} at ${c.delay} s in a ${s.ms} ms shot`);
    }

    // A scene: no names or bars, and it draws, moving.
    for (const s of shots) {
      assert.ok(s.model.scene);
      const svg = stageSvg(s.model);
      assert.match(svg, /aria-label="Before the fight"/);
    }
    assert.match(stageSvg(first.model), /@keyframes sx/);
    assert.match(stageSvg(shots[2]!.model), /class="bt-arrive"/);
    assert.match(stageSvg(shots[2]!.model), /bd-leaf-l/);
  });

  test('without the Vultures there’s no shot for them', () => {
    const { state, runId } = atTheGate('alone', false);
    const run = state.runs.find((r) => r.id === runId)!;
    const fight = run.lead!.fights[2]!;
    const shots = gateScene(state, run, fight, fightPreview(state, runId, fight.at + 1000)!)!;
    assert.equal(shots.length, 2);
    // A stranger: no face to show.
    assert.equal(shots[0]!.faces!.length, 0);
    assert.ok(!shots.some((s) => s.lines.some((l) => l.text.startsWith('Engines on the road behind them'))));
  });

  test('any other fight has no scene', () => {
    const { state, runId } = atTheGate('toll', false);
    const run = state.runs.find((r) => r.id === runId)!;
    const toll = run.lead!.fights[0]!;
    assert.equal(gateScene(state, run, toll, fightPreview(state, runId, run.lead!.fights[2]!.at + 1000)!), undefined);
  });

  test('a line stays long enough to read', () => {
    assert.ok(readingTime('Short.') >= 1500);
    assert.ok(readingTime(HAVEN_JOURNEY.gate.open) > readingTime('Short.') + 5000);
  });
});
