import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HAVEN_CLUES, HAVEN_JOURNEY, HAVEN_VULTURES, Rng, fightPreview, letThemFight, makeMember, setOutForHaven, startHaven, type GameState } from '../engine/index.ts';
import { T0, openGame } from '../engine/test-utils.ts';
import { stageSvg } from '../scene/index.ts';
import { gateScene, readingTime } from './gate-scene.ts';

/** A guild at Haven's gate: every clue, a van, the Vultures' word if asked, and the first two fights behind them. */
function atTheGate(seed: string, vultures: boolean): { state: GameState; runId: string } {
  const state = openGame(seed);
  startHaven(state, 1);
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

describe('Haven’s gate, before the fight (§9.12)', () => {
  test('the shut gate, the runner, the shot, the Vultures, then the gate open on the fight', () => {
    const { state, runId } = atTheGate('scene', true);
    const run = state.runs.find((r) => r.id === runId)!;
    const fight = run.lead!.fights[2]!;
    assert.equal(fight.site, 'haven_gate');
    const view = fightPreview(state, runId, fight.at + 1000)!;
    const frames = gateScene(state, run, fight, view)!;
    assert.equal(frames.length, 7);
    const lines = run.beats[fight.fromBeat - 1]!.lines.map((l) => l.text);
    assert.deepEqual(
      frames.slice(0, 5).map((f) => f.caption),
      [lines[0], lines[1], lines[1], lines[2], lines[2]],
    );
    assert.ok(frames[5]!.caption.startsWith('Engines on the road behind them'));
    assert.equal(frames[6]!.caption, HAVEN_JOURNEY.gate.open);
    // One of the guild calls the halt, not a Vulture.
    assert.ok(state.survivors.some((s) => s.id === fight.by));
    // Shut until the last; nobody of Haven's on the stage until then; the Vultures only from their line on.
    assert.ok(frames.slice(0, 6).every((f) => f.model.place === 'haven_gate_shut' && f.model.enemies.length === 0));
    assert.equal(frames[6]!.model.place, 'haven_gate');
    assert.ok(frames[6]!.model.enemies.some((e) => e.kind === 'the_shepherd'));
    const allies = (k: number) => frames[k]!.model.crew.filter((f) => f.vulture && f.state !== 'fled').length;
    assert.equal(allies(4), 0);
    assert.equal(allies(5), 2);
    // The shot, and the runner on the ground from then on.
    assert.ok(frames[3]!.model.shot);
    assert.ok(frames[3]!.model.extras![0]!.hit);
    assert.ok(frames.slice(4).every((f) => f.model.extras![0]!.lying));
    // A scene: no names or bars, and it draws.
    assert.ok(frames.every((f) => f.model.scene));
    for (const f of frames) assert.match(stageSvg(f.model), /aria-label="Before the fight"/);
    assert.ok(frames.every((f) => f.ms >= 900));
  });

  test('without the Vultures there’s no frame for them', () => {
    const { state, runId } = atTheGate('alone', false);
    const run = state.runs.find((r) => r.id === runId)!;
    const fight = run.lead!.fights[2]!;
    const frames = gateScene(state, run, fight, fightPreview(state, runId, fight.at + 1000)!)!;
    assert.equal(frames.length, 6);
    assert.ok(!frames.some((f) => f.caption.startsWith('Engines on the road behind them')));
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
