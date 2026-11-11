import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { EVENTS } from '../content/events.ts';
import * as FLAVOR from '../content/flavor.ts';
import { openGame, T0, testPlan } from '../test-utils.ts';
import type { RunPlan } from '../types.ts';
import { simulateRun } from './sim.ts';

/** Words that only make sense with company. */
const GROUP = /\b(the crew|crew|everyone|the others|each other|together|they bring back|they had to leave)\b/i;
const withoutPlaceholders = (t: string): string => t.replace(/\{[^}]+\}/g, '');

describe('someone out alone', () => {
  test('solo lines never talk about a group', () => {
    for (const [name, pool] of Object.entries(FLAVOR)) {
      if (typeof pool !== 'object' || pool === null || !('solo' in pool)) continue;
      for (const line of (pool as FLAVOR.CrewLines).solo) assert.doesNotMatch(withoutPlaceholders(line), GROUP, `${name}: ${line}`);
    }
    for (const lines of Object.values(FLAVOR.RETURN_LINES)) for (const line of lines.solo) assert.doesNotMatch(line, GROUP, line);
  });

  test('events that can happen to one person read right for one person', () => {
    // The Vultures are another crew, not this guild's.
    const allowed = new Set(['rival_crew']);
    for (const e of EVENTS) {
      if (e.b || (e.minCrew ?? 1) >= 2 || allowed.has(e.id)) continue;
      for (const t of [e.intro, e.success.text, e.failure?.text]) {
        if (t) assert.doesNotMatch(withoutPlaceholders(t), GROUP, `${e.id}: ${t}`);
      }
    }
  });

  test('a few hundred solo runs never mention a crew', () => {
    const state = openGame('solo-runs');
    const places = ['rail_yard', 'maple_street', 'kessler_farm', 'drowned_mall', 'st_judes', 'old_metro'];
    const jobs: RunPlan['job'][] = ['scavenge', 'scout', 'hunt'];
    const approaches: RunPlan['approach'][] = ['sneaky', 'balanced', 'aggressive'];
    let runs = 0;
    for (const loc of places) {
      for (const [j, job] of jobs.entries()) {
        for (let i = 0; i < 12; i++) {
          const who = state.survivors[i % state.survivors.length]!;
          const plan = testPlan(state, loc, { crew: [who.id], job, approach: approaches[(i + j) % 3]! });
          const sim = simulateRun(state, plan, `solo-${loc}-${job}-${i}`, T0);
          runs++;
          for (const beat of sim.beats) {
            for (const line of beat.lines) {
              const text = line.text.replace(/\b(Another crew|each crew)\b/g, '');
              assert.doesNotMatch(text, GROUP, `${loc} ${job} #${i}, ${beat.title}: ${line.text}`);
            }
          }
        }
      }
    }
    assert.ok(runs >= 200);
  });
});
