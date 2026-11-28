import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { newGame } from '../engine/index.ts';
import { T0 } from '../engine/test-utils.ts';
import { openingShots } from './opening-view.ts';
import { SPRITE } from './sounds.ts';

describe('the opening scene (3.14.0)', () => {
  test('the rail line, the founders up close, the depot, the fire, “We stay.” up close, then the guild’s name', () => {
    const state = newGame({ seed: 'opening', now: T0, guided: true, guildName: 'The Ash Line' });
    const shots = openingShots(state);
    assert.equal(shots.length, 6);
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
    // In close by the fire, and only what was said.
    assert.match(shots[4]!.svg!, /^<svg[^>]*viewBox="151 316 120 180"/);
    assert.equal(shots[4]!.caption, '“We stay.”');
    assert.ok(shots[4]!.quote && shots[4]!.svg!.includes('yard-flame'));
    assert.doesNotMatch(shots[3]!.caption, /We stay/);
    assert.deepEqual(shots[5]!.title, { name: 'The Ash Line', day: 'Day 1' });
    // Nobody walks on the spot: the far walkers keep going for as long as the shot is up.
    const walk = /--sec:([\d.]+)s;--dist:(\d+)px/.exec(shots[0]!.svg!)!;
    assert.ok(Number(walk[1]) * 1000 > shots[0]!.ms, 'still walking when it cuts');
    assert.ok(Math.abs(Number(walk[2]) / Number(walk[1]) - 440 / 7) < 1, 'at the same pace');
    // The gate is shut until the first of them gets to it, and its sound comes then.
    const opens = /animation:yard-gate-\d+ [\d.]+s linear (-?[\d.]+)s/.exec(shots[2]!.svg!)!;
    assert.ok(Number(opens[1]) > 3, `the gate opens ${opens[1]} s in`);
    const creak = shots[2]!.sound.cues.find((c) => c.id === 'creak')!;
    assert.ok(Math.abs(creak.delay! - Number(opens[1])) < 0.5);
  });

  test('every shot has its sound, and each sound starts while its shot is up', () => {
    const shots = openingShots(newGame({ seed: 'opening', now: T0, guided: true }));
    for (const shot of shots) {
      for (const cue of shot.sound.cues) {
        assert.ok(cue.id in SPRITE, cue.id);
        assert.ok((cue.delay ?? 0) * 1000 < shot.ms - 400, `${cue.id} at ${cue.delay} s in a ${shot.ms} ms shot`);
      }
    }
    // No voice in it: words are heard only over the radio. The fire catches, and a real fire's crackle comes up
    // (not the yard's everyday one) and lasts to the end.
    const fire = shots[3]!;
    assert.ok(fire.catches && fire.sound.cues.some((c) => c.id === 'campfire'));
    assert.ok(shots.slice(3).every((s) => s.sound.ambience!.fire === 0));
    const rest = shots.slice(3).reduce((t, s) => t + s.ms, 0) / 1000;
    assert.ok(SPRITE.campfire[1] >= rest - 1, `the fire's crackle lasts ${SPRITE.campfire[1]} s of ${rest} s`);
    // The real ones (3.15.0): the match as the fire catches, the old gate as the first of them reaches it.
    assert.ok(fire.sound.cues.some((c) => c.id === 'match' && (c.delay ?? 0) < 1));
    assert.ok(shots[2]!.sound.cues.some((c) => c.id === 'creak' && (c.delay ?? 0) > 3));
    assert.ok(!shots.some((s) => s.sound.cues.some((c) => c.id.startsWith('radio_'))));
    assert.ok(shots[5]!.sound.cues.some((c) => c.id === 'stamp'));
  });
});
