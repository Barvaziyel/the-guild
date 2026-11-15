import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { build } from '../engine/index.ts';
import { T0, openGame } from '../engine/test-utils.ts';
import { fastForward } from './dev.ts';
import { memoryStore } from './persist.ts';
import { createPrefsStore } from './prefs.ts';
import { parseRoute, routeHash } from './route.ts';
import { createGameStore } from './store.ts';
import {
  FIRST_STEP,
  TOUR_PARTS,
  TOUR_STEPS,
  firstBuildSuggestions,
  proseDays,
  proseDuration,
  nextPartStepId,
  nextStepId,
  tourCard,
  tourStep,
} from './tour.ts';

/** Every `data-tour="..."` in the screens and components. */
function tourTargetsInSource(): Set<string> {
  const dir = fileURLToPath(new URL('.', import.meta.url));
  const files = ['App.tsx', ...['screens', 'components'].flatMap((d) => readdirSync(join(dir, d)).map((f) => join(d, f)))];
  const found = new Set<string>();
  for (const f of files.filter((f) => f.endsWith('.tsx'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const m of src.matchAll(/data-tour="([a-z-]+)"|tour="([a-z-]+)"/g)) found.add(m[1] ?? m[2]!);
  }
  return found;
}

describe('tour', () => {
  test('steps have unique ids, known parts, and each part is one unbroken run of steps', () => {
    assert.equal(new Set(TOUR_STEPS.map((s) => s.id)).size, TOUR_STEPS.length);
    const parts = TOUR_PARTS.map((p) => p.id);
    assert.deepEqual([...new Set(TOUR_STEPS.map((s) => s.part))], parts, 'parts appear in order, each once');
    assert.equal(FIRST_STEP, TOUR_STEPS[0]!.id);
  });

  test('everything the tour points at is on some screen', () => {
    const inSource = tourTargetsInSource();
    for (const step of TOUR_STEPS) {
      if (step.target) assert.ok(inSource.has(step.target), `nothing has data-tour="${step.target}" (step ${step.id})`);
    }
  });

  test('every step reads cleanly for a new guild and an older one', () => {
    const fresh = openGame('tour-new');
    const older = openGame('tour-old');
    fastForward(older, T0, { runs: 6 });
    for (const state of [fresh, older]) {
      for (const step of TOUR_STEPS) {
        const text = step.text(state);
        assert.ok(text.length > 20 && text.length < 400, `${step.id}: ${text}`);
        assert.doesNotMatch(text, /undefined|NaN|\[object|\ba [AEIOU]/, `${step.id}: ${text}`);
        assert.match(text, /[.!?]$/, `${step.id} ends a sentence`);
        // The step's screen is a real route.
        const route = step.route(state);
        assert.deepEqual(parseRoute(routeHash(route)), route, step.id);
      }
    }
  });

  test('a first run is suggested at the safest place the guild knows', () => {
    const state = openGame('tour-plan');
    const plan = tourStep('plan')!;
    const route = plan.route(state);
    assert.equal(route.screen, 'plan');
    assert.match(plan.text(state), /three people scavenging (the Rail Yard|Maple Street)\./);
  });

  test('the build suggestions follow what has been built', () => {
    const state = openGame('tour-build');
    const before = firstBuildSuggestions(state);
    assert.equal(before.length, 3);
    assert.match(before[0]!, /^Bunks level 2 \(\d+ scrap(, \d+ rations)?\) to make room for a recruit$/);
    assert.match(before[1]!, /^an Infirmary \(/);
    state.resources.scrap = 500;
    state.resources.tech = 50;
    build(state, 'infirmary', 1);
    const after = firstBuildSuggestions(state);
    assert.ok(!after.some((s) => s.includes('Infirmary')));
    // The first week asks for the Workshop itself, so it isn't suggested while that step is ahead (2.8.2).
    assert.ok(!after.some((s) => s.includes('Workshop')));
    delete state.story;
    assert.ok(firstBuildSuggestions(state).some((s) => s.includes('Workshop')), 'without the week, the next idea moves up');
  });

  test('the parts run from the Depot to what comes later, and the text matches the game (2.8.2)', () => {
    assert.deepEqual(TOUR_PARTS.map((p) => p.title), ['The Depot', 'Supplies and food', 'Your people', 'Runs', 'Building', 'Raids and decisions', 'Later on']);
    const part = (id: string) => tourStep(id)!.part;
    assert.equal(part('corners'), 'depot');
    assert.equal(part('notices'), 'depot');
    assert.equal(part('radio'), 'runs', 'forks come up from the first runs, tower or not');
    const state = openGame('tour-text');
    const text = (id: string) => tourStep(id)!.text(state);
    assert.match(text('vultures'), /Around game day 40, about five real days in,/);
    assert.match(text('decisions'), /Leave it 24 hours/);
    assert.match(text('radio'), /^Now and then a crew comes to a fork/);
    assert.doesNotMatch(text('radio'), /Radio Tower/, 'forks need no tower (2.8.2)');
    assert.match(text('raids'), /with a Radio Tower, call a crew home/);
    assert.doesNotMatch(text('lead'), /call home|radio/i, 'leading a fight needs no tower');
    assert.doesNotMatch(text('gate'), /floor/, 'nobody joins without a bed');
    assert.match(text('corners'), /5 to 20 minutes/);
    assert.doesNotMatch(text('plan'), /tries|trial|went down/, 'the tour says how risky, not how that is worked out');
    assert.match(text('build-first'), /^Besides what the first week asks for, good first goals: /);
  });

  test('Next walks every step, then ends', () => {
    const seen: string[] = [];
    for (let id: string | null = FIRST_STEP; id; id = nextStepId(id)) seen.push(id);
    assert.deepEqual(
      seen,
      TOUR_STEPS.map((s) => s.id),
    );
    assert.equal(nextStepId('not-a-step'), null);
  });

  test('skipping a part goes to the start of the next part, and past the last part ends the tour', () => {
    assert.equal(nextPartStepId('welcome'), 'supplies');
    assert.equal(nextPartStepId('roster'), 'reach');
    assert.equal(nextPartStepId('days'), 'supplies');
    assert.equal(nextPartStepId('vultures'), null);
  });

  test('the card says where in the tour you are', () => {
    const state = openGame('tour-card');
    const first = tourCard(state, 'welcome')!;
    assert.equal(first.where, 'The Depot: 1 of 6');
    assert.equal(first.partOf, `Part 1 of ${TOUR_PARTS.length}`);
    assert.equal(first.last, false);
    assert.equal(first.lastInPart, false);
    const decisions = tourCard(state, 'decisions')!;
    assert.equal(decisions.where, 'Raids and decisions: 2 of 2');
    assert.equal(decisions.lastInPart, true);
    assert.equal(tourCard(state, 'done')!.last, true);
    assert.equal(tourCard(state, 'gone'), null);
  });
});

test('durations read as prose', () => {
  assert.equal(proseDuration(10), '10 minutes');
  assert.equal(proseDuration(60), 'an hour');
  assert.equal(proseDuration(90), '1½ hours');
  assert.equal(proseDuration(150), '2½ hours');
  assert.equal(proseDuration(180), '3 hours');
  assert.equal(proseDays(5), 'five real days');
  assert.equal(proseDays(0.4), 'a real day');
});

describe('the tour and a new guild', () => {
  const opts = { now: () => T0, newSeed: () => 'tour-seed' };

  test('a new guild starts the tour, on first launch and from Settings', () => {
    const started: string[] = [];
    const kv = memoryStore();
    const store = createGameStore(kv, { ...opts, onNewGuild: (s) => started.push(s.seed) });
    assert.deepEqual(started, ['tour-seed']);
    store.newGuild();
    assert.equal(started.length, 2);
  });

  test('loading a saved guild does not', () => {
    const kv = memoryStore();
    createGameStore(kv, opts);
    let calls = 0;
    createGameStore(kv, { ...opts, onNewGuild: () => calls++ });
    assert.equal(calls, 0);
  });

  test('the tour step is kept with the device settings, off by default', () => {
    const kv = memoryStore();
    const prefs = createPrefsStore(kv);
    assert.equal(prefs.get().tour, null);
    prefs.set({ tour: 'garden' });
    assert.equal(createPrefsStore(kv).get().tour, 'garden');
  });
});
