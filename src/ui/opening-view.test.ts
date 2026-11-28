import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { newGame } from '../engine/index.ts';
import { T0 } from '../engine/test-utils.ts';
import { openingShots } from './opening-view.ts';

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
});
