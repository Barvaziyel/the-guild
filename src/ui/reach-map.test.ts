import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { startRun } from '../engine/index.ts';
import { T0, openGame, testGame, testPlan } from '../engine/test-utils.ts';
import { DEPOT_SPOT, MAP_SPOTS, ROAD_SHARE, crewMarker, routeTo } from './reach-map.ts';

describe('crews on the map (3.2.0)', () => {
  test('the road to a place the guild started with goes straight there; further places go through the ones between', () => {
    const state = openGame('roads');
    assert.deepEqual(routeTo(state, 'maple_street'), [DEPOT_SPOT, MAP_SPOTS.maple_street]);
    assert.deepEqual(routeTo(state, 'drowned_mall'), [DEPOT_SPOT, MAP_SPOTS.maple_street, MAP_SPOTS.drowned_mall]);
    const glow = routeTo(state, 'the_glow');
    assert.equal(glow[0], DEPOT_SPOT);
    assert.equal(glow.at(-1), MAP_SPOTS.the_glow);
    assert.ok(glow.length >= 3);
  });

  test('a place off the map has no road on it', () => {
    assert.deepEqual(routeTo(openGame('off'), 'corwin_dam'), []);
  });

  test('out along the road, at the place, then home again', () => {
    const state = testGame('marker');
    const run = startRun(state, testPlan(state, 'maple_street'), T0);
    const span = run.returnAt - run.departAt;
    const at = (share: number) => crewMarker(state, run, run.departAt + span * share)!;
    assert.equal(at(0).stage, 'out');
    assert.deepEqual([at(0).x, at(0).y], [DEPOT_SPOT.x, DEPOT_SPOT.y]);
    const half = at(ROAD_SHARE / 2);
    assert.ok(half.y < DEPOT_SPOT.y && half.y > MAP_SPOTS.maple_street!.y, 'halfway up the road');
    assert.equal(at(0.5).stage, 'there');
    assert.deepEqual([at(0.5).x, at(0.5).y], [MAP_SPOTS.maple_street!.x, MAP_SPOTS.maple_street!.y]);
    assert.equal(at(0.9).stage, 'back');
    assert.equal(at(1).y, DEPOT_SPOT.y);
    assert.equal(at(0.2).driving, false);
  });

  test('they face the way they’re going', () => {
    const state = openGame('facing');
    const run = startRun(state, testPlan(state, 'rail_yard'), T0);
    const span = run.returnAt - run.departAt;
    // The Rail Yard is west of the Depot: out they face left, home they face right.
    assert.equal(crewMarker(state, run, run.departAt + span * 0.1)!.facing, -1);
    assert.equal(crewMarker(state, run, run.departAt + span * 0.9)!.facing, 1);
  });
});
