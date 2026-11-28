import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { ELITES, getLocation, seenEliteSight, type LedFight, type Run } from '../engine/index.ts';
import { openGame } from '../engine/test-utils.ts';
import { stageSvg } from '../scene/index.ts';
import { eliteFightScene, eliteSightScene, STAGING } from './elite-scene.ts';
import { SPRITE, STINGS } from './sounds.ts';

/** A run whose log has the elite's line as it turned up, in the fight's own beat. */
function runWith(line: string): Run {
  return { beats: [{ lines: [{ text: 'They go in by the gate.' }] }, { lines: [{ text: line }] }] } as unknown as Run;
}

describe('an elite’s first sight (4c, 3.16.0)', () => {
  test('every elite has its staging, and nothing else does', () => {
    assert.deepEqual(Object.keys(STAGING).sort(), ELITES.map((e) => e.id).sort());
  });

  test('its place and the sign of it under what was seen, then it comes on and its name comes down', () => {
    for (const e of ELITES) {
      const shots = eliteSightScene(e.id);
      assert.equal(shots.length, 2, e.id);
      const [sign, comes] = shots as [(typeof shots)[0], (typeof shots)[0]];
      assert.equal(sign.model.place, e.elite!.place, e.id);
      assert.equal(sign.lines[0]!.text, e.elite!.sight);
      assert.equal(sign.stamp, undefined, `${e.id}: no name until it has come on`);
      assert.equal(comes.lines[0]!.text, e.description);
      assert.deepEqual({ title: comes.stamp!.title, sub: comes.stamp!.sub }, { title: e.name, sub: getLocation(e.elite!.place).name });
      // It's come on, the camera has gone in, and its call is heard before the name lands; then time to read it.
      const there = comes.model.extras![0]!.keys!.at(-1)!.t;
      assert.ok(comes.stamp!.at > there, `${e.id}: stamped once it's there`);
      assert.ok(comes.ms / 1000 >= comes.stamp!.at + 3, `${e.id}: held after the stamp`);
      // The sting's hit on the stamp, and the shot held until it has nearly rung out.
      assert.deepEqual(comes.sound.stings, [{ id: 'elite', at: comes.stamp!.at }]);
      assert.ok(comes.ms / 1000 >= comes.stamp!.at + STINGS.elite.length - STINGS.elite.hit - 0.5, `${e.id}: held for the sting`);
      assert.ok(
        comes.sound.cues.some((c) => c.id === 'stamp' && c.delay === comes.stamp!.at),
        `${e.id}: the stamp is heard when it lands`,
      );
      // No music under either shot but the sting.
      assert.deepEqual(sign.sound.music, [{ id: null, at: 0 }]);
      assert.deepEqual(comes.sound.music, [{ id: null, at: 0 }]);
    }
  });

  test('a walker comes from far off and small to where it stands; one in the water comes up out of its rings', () => {
    for (const e of ELITES) {
      const how = STAGING[e.id]!;
      const keys = eliteSightScene(e.id)[1]!.model.extras![0]!.keys!;
      const [first, last] = [keys[0]!, keys.at(-1)!];
      if (how.comes === 'walks') {
        assert.ok(first.scale < last.scale / 2 && first.y < last.y, `${e.id} walks up from far off`);
        assert.equal(first.pose, 'walk');
      }
      if (how.comes === 'rises') {
        assert.ok(first.hidden && !last.hidden, `${e.id} comes up out of the water`);
        assert.ok(eliteSightScene(e.id)[0]!.model.enemies[0]!.under, `${e.id}: the rings where it went under, first`);
      }
      assert.equal(e.dives !== undefined, how.comes === 'rises', `${e.id}: what goes under comes up`);
    }
  });

  test('every sound is one there is, and nobody speaks', () => {
    for (const e of ELITES) {
      for (const shot of eliteSightScene(e.id)) {
        for (const c of shot.sound.cues) {
          assert.ok(c.id in SPRITE, `${e.id}: ${c.id}`);
          assert.doesNotMatch(c.id, /^radio_|^we_stay/, `${e.id}: no voices in a scene`);
        }
      }
    }
  });

  test('every shot draws, with it on the stage', () => {
    for (const e of ELITES) {
      const [sign, comes] = eliteSightScene(e.id);
      assert.match(stageSvg(sign!.model), /<svg/);
      const svg = stageSvg(comes!.model);
      assert.match(svg, /<svg/);
      assert.ok(svg.includes('@keyframes'), `${e.id}: it moves`);
    }
  });
});

describe('an elite at a fight (4c, 3.16.0)', () => {
  const met = ELITES[0]!.elite!.met;
  const fight = { elite: 'the_switchman', fromBeat: 1, at: 0 } as unknown as LedFight;

  test('no scene for a fight without one', () => {
    const state = openGame('no-elite');
    assert.equal(eliteFightScene(state, runWith('Raiders.'), { fromBeat: 1, at: 0 } as unknown as LedFight), undefined);
  });

  test('met before its first sight was seen: the sight first, then it comes on under how it turned up', () => {
    const state = openGame('met-first');
    const shots = eliteFightScene(state, runWith(met), fight)!;
    assert.equal(shots.length, 2);
    assert.equal(shots[0]!.lines[0]!.text, ELITES[0]!.elite!.sight);
    assert.equal(shots[1]!.lines[0]!.text, met);
    assert.equal(shots[1]!.stamp!.title, 'The Switchman');
  });

  test('once its first sight has been seen, only it coming on; what it is when the log has no line for it', () => {
    const state = openGame('met-again');
    seenEliteSight(state, 'the_switchman');
    const shots = eliteFightScene(state, runWith(met), fight)!;
    assert.equal(shots.length, 1);
    assert.equal(shots[0]!.lines[0]!.text, met);
    assert.equal(eliteFightScene(state, runWith('Something else.'), fight)![0]!.lines[0]!.text, ELITES[0]!.description);
  });
});
