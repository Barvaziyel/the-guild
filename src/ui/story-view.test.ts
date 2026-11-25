import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FIRST_WEEK, claimStory, equipFromStash, getGear, seenStory, type GameState } from '../engine/index.ts';
import { T0, testGame } from '../engine/test-utils.ts';
import { baselineSeen, dots } from './attention-view.ts';
import { giftsText, storyCard, storyEnding } from './story-view.ts';
import { TOUR_STEPS } from './tour.ts';

function at(state: GameState, id: string): void {
  state.story!.step = FIRST_WEEK.findIndex((s) => s.id === id);
}

describe('the first week on the Yard (2.8.0)', () => {
  test('the step under way: where it is in the week, the goal, the reward, and a button to where it’s done', () => {
    const state = testGame('card');
    const card = storyCard(state)!;
    assert.equal(card.kicker, `Getting started · 1 of ${FIRST_WEEK.length}`);
    assert.equal(card.title, 'Kit them out');
    assert.equal(card.goal, 'Hand out the gear in the stash.');
    assert.equal(card.reward, 'Reward: 6 ammo.');
    assert.equal(card.met, false);
    assert.deepEqual(card.go, { label: 'Open the Gear screen', to: { screen: 'gear' } });

    at(state, 'garden');
    assert.deepEqual(storyCard(state)!.go, { label: 'Go to the Garden', to: { screen: 'building', id: 'garden' } });
    at(state, 'smoke');
    assert.deepEqual(storyCard(state)!.go, { label: 'Plan a run to Maple Street', to: { screen: 'plan', locationId: 'maple_street' } });
    at(state, 'first_run');
    assert.deepEqual(storyCard(state)!.go, { label: 'Open the Reach', to: { screen: 'reach' } });
    // The corners are on the same tab, under the yard.
    at(state, 'corners');
    state.corners.searched.push('ticket_office');
    const corners = storyCard(state)!;
    assert.equal(corners.goal, 'Search three corners of the Depot: 1 of 3.');
    assert.deepEqual(corners.go, { label: 'Show the corners', scrollTo: 'corners' });
  });

  test('done: it says so, a dot on the Yard tab says the reward is waiting, and collecting it shows how it went', () => {
    const state = testGame('met');
    for (const item of [...state.stash]) {
      const s = state.survivors.find((x) => !x.equipment[getGear(item.defId).slot]);
      if (s) equipFromStash(state, s, item.uid);
    }
    const card = storyCard(state)!;
    assert.equal(card.met, true);
    assert.equal(card.goal, 'Done: hand out the gear in the stash.');
    assert.equal(card.go, undefined);
    assert.equal(dots(state, T0, baselineSeen(state)).depot.yard, true);
    // While the tour is on, the note is hidden, so no dot points at it (2.8.1).
    assert.equal(dots(state, T0, baselineSeen(state), { touring: true }).depot.yard, undefined);

    claimStory(state, T0);
    // How it went comes first; the next step waits until it's read.
    assert.equal(storyCard(state), undefined);
    assert.deepEqual(storyEnding(state), { title: 'Kit them out', text: FIRST_WEEK[0]!.done, supplies: 'Ammo +6.', last: false });
    assert.equal(dots(state, T0, baselineSeen(state)).depot.yard, undefined);
    seenStory(state);
    assert.equal(storyEnding(state), undefined);
    assert.equal(storyCard(state)!.title, 'Get the Garden going');
  });

  test('the motorcycle, someone at the gate, and the end of the week', () => {
    const state = testGame('end');
    at(state, 'wheels');
    state.buildings.workshop = 1;
    claimStory(state, T0);
    assert.deepEqual(storyEnding(state), { title: 'Wheels', text: FIRST_WEEK.find((s) => s.id === 'wheels')!.done, supplies: 'Gas +8.', gifts: 'And a Motorcycle.', last: false });

    at(state, 'smoke');
    state.story!.last = undefined;
    state.locations.maple_street!.runs = 1;
    claimStory(state, T0);
    assert.match(storyEnding(state)!.gifts!, /^[A-Z][a-z]+ [A-Z][a-z]+, at the gate\.$/);

    at(state, 'on_air');
    state.buildings.radio_tower = 1;
    claimStory(state, T0);
    const end = storyEnding(state)!;
    assert.equal(end.last, true);
    assert.match(end.text, /This is Haven/);
    seenStory(state);
    assert.equal(storyCard(state), undefined);
    assert.equal(storyEnding(state), undefined);
  });

  test('rewards read as a list', () => {
    assert.equal(giftsText([{ kind: 'supplies', change: { ammo: 6 } }]), '6 ammo');
    assert.equal(giftsText([{ kind: 'supplies', change: { rations: 10, tech: 4 } }]), '10 rations and 4 tech');
    assert.equal(giftsText([{ kind: 'vehicle', defId: 'motorcycle', condition: 60 }, { kind: 'supplies', change: { gas: 8 } }]), 'a Motorcycle and 8 gas');
    assert.equal(giftsText([{ kind: 'wanderer' }]), 'someone at the gate');
  });

  test('the tour hands over to the note at its end, instead of pointing at it on the way (2.8.1)', () => {
    const state = testGame('tour');
    assert.equal(TOUR_STEPS.some((s) => s.target === 'story'), false);
    const done = TOUR_STEPS.at(-1)!;
    assert.match(done.text(state), /^When you close this, a note above the yard says what to do first/);
    delete state.story;
    assert.match(done.text(state), /^Send your first crew out/);
  });

  test('a guild without the week shows nothing', () => {
    const state = testGame('none');
    delete state.story;
    assert.equal(storyCard(state), undefined);
    assert.equal(storyEnding(state), undefined);
  });
});
