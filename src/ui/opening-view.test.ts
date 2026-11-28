import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { newGame } from '../engine/index.ts';
import { T0 } from '../engine/test-utils.ts';
import { openingShots } from './opening-view.ts';
import { SPRITE } from './sounds.ts';

describe('the opening scene (3.14.0)', () => {
  test('the rail line, the founders up close, the depot, the fire, then the guild’s name', () => {
    const state = newGame({ seed: 'opening', now: T0, guided: true, guildName: 'The Ash Line' });
    const shots = openingShots(state);
    assert.equal(shots.length, 5);
    for (const shot of shots.slice(0, 4)) {
      assert.match(shot.svg!, /^<svg[^>]*viewBox="0 0 400 600"/);
      assert.ok(shot.caption.length > 0);
      assert.ok(shot.ms >= 5000, `${shot.ms} ms to read: ${shot.caption}`);
    }
    assert.match(shots[1]!.caption, /^Four of them/);
    // Everything moves: the smoke, the walkers, the founders coming through the gate.
    assert.match(shots[0]!.svg!, /op-puff/);
    assert.match(shots[0]!.svg!, /op-walk-far/);
    assert.match(shots[1]!.svg!, /op-slide/);
    assert.match(shots[2]!.svg!, /@keyframes/);
    assert.deepEqual(shots[4]!.title, { name: 'The Ash Line', day: 'Day 1' });
  });

  test('every shot has its sound, and each sound starts while its shot is up', () => {
    const shots = openingShots(newGame({ seed: 'opening', now: T0, guided: true }));
    for (const shot of shots) {
      for (const cue of shot.sound.cues) {
        assert.ok(cue.id in SPRITE, cue.id);
        assert.ok((cue.delay ?? 0) * 1000 < shot.ms - 400, `${cue.id} at ${cue.delay} s in a ${shot.ms} ms shot`);
      }
    }
    // No voice in it: words are heard only over the radio. The fire catches, and its crackle comes up.
    const fire = shots[3]!;
    assert.ok(fire.catches && fire.sound.ambience!.fire > 0);
    // The real ones (3.15.0): the match as the fire catches, the old gate as the first of them reaches it.
    assert.ok(fire.sound.cues.some((c) => c.id === 'match' && (c.delay ?? 0) < 1));
    assert.ok(shots[2]!.sound.cues.some((c) => c.id === 'creak' && (c.delay ?? 0) > 3));
    assert.ok(!shots.some((s) => s.sound.cues.some((c) => c.id.startsWith('radio_'))));
    assert.ok(shots[4]!.sound.cues.some((c) => c.id === 'stamp'));
  });
});
