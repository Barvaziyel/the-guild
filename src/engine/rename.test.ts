import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { deserialize, newGame, type GameState } from './index.ts';
import { T0, testGame } from './test-utils.ts';

describe('the game is The Depot (3.15.1)', () => {
  function old(name: string): GameState {
    const state = testGame('rename');
    const saved = structuredClone(state) as unknown as { version: number; guildName: string };
    saved.version = 32;
    saved.guildName = name;
    return deserialize(JSON.stringify(saved));
  }

  test('a new guild is The Depot unless the player names it', () => {
    assert.equal(newGame({ seed: 'd', now: T0 }).guildName, 'The Depot');
    assert.equal(newGame({ seed: 'd', now: T0, guildName: 'The Ash Line' }).guildName, 'The Ash Line');
  });

  test('a guild that kept the old default takes the new one; one the player named keeps its name', () => {
    assert.equal(old('The Guild').guildName, 'The Depot');
    assert.equal(old('The Ash Line').guildName, 'The Ash Line');
  });
});
