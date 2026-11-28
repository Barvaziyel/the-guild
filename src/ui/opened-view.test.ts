import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SYSTEM_IDS, createVehicle, newGame, openSystem, seenOpening } from '../engine/index.ts';
import { T0, openGame } from '../engine/test-utils.ts';
import { GLYPHS } from './glyphs.ts';
import { openingCard, openingFits } from './opened-view.ts';

describe('first-time moments (3.14.0)', () => {
  test('one card for each system the story opens, in the order they opened, each once', () => {
    const state = newGame({ seed: 'open', now: T0, guided: true });
    assert.equal(openingCard(state), undefined);
    openSystem(state, 'raids', 5);
    openSystem(state, 'market', 3);
    assert.equal(openingCard(state)!.id, 'market');
    assert.deepEqual(openingCard(state)!.go, { label: 'Find it on the map', to: { screen: 'reach', id: 'drive_in' } });
    seenOpening(state, 'market');
    assert.equal(openingCard(state)!.id, 'raids');
    seenOpening(state, 'raids');
    assert.equal(openingCard(state), undefined);
  });

  test('a vehicle that turns up opens vehicles, with its card', () => {
    const state = newGame({ seed: 'ride', now: T0, guided: true });
    state.vehicles.push(createVehicle(state, 'motorcycle', 60));
    assert.equal(openingCard(state)!.id, 'vehicles');
  });

  test('a guild from before 3.14.0 never gets them', () => {
    assert.equal(openingCard(openGame('old')), undefined);
  });

  test('every system has a card with a picture and one line, and none pops over a fight', () => {
    const state = newGame({ seed: 'all', now: T0, guided: true });
    for (const id of SYSTEM_IDS) {
      openSystem(state, id, 1);
      const card = openingCard(state)!;
      assert.equal(card.id, id);
      assert.ok(card.glyph in GLYPHS, id);
      assert.equal(card.line.split(/[.!?](\s|$)/).filter((x) => x && x.trim()).length >= 1, true);
      seenOpening(state, id);
    }
    assert.equal(openingFits('fight'), false);
    assert.equal(openingFits('depot'), true);
  });
});
