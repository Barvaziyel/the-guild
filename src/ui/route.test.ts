import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseRoute, routeHash, tabFor, type Route } from './route.ts';

describe('routes', () => {
  test('round-trip through the hash', () => {
    const routes: Route[] = [
      { screen: 'depot' },
      { screen: 'building', id: 'garden' },
      { screen: 'recruits' },
      { screen: 'roster' },
      { screen: 'memorial' },
      { screen: 'settings' },
      { screen: 'runs' },
      { screen: 'reach' },
      { screen: 'reach', id: 'maple_street' },
      { screen: 'plan', locationId: 'the_glow' },
      { screen: 'run', id: 'r14' },
      { screen: 'survivor', id: 's3', tab: 'stats' },
      { screen: 'survivor', id: 's3', tab: 'bonds' },
      { screen: 'survivor', id: 's12', tab: 'story' },
    ];
    for (const r of routes) assert.deepEqual(parseRoute(routeHash(r)), r);
  });

  test('anything unknown or incomplete lands somewhere sensible', () => {
    assert.deepEqual(parseRoute(''), { screen: 'depot' });
    assert.deepEqual(parseRoute('#/nowhere'), { screen: 'depot' });
    assert.deepEqual(parseRoute('#/s/'), { screen: 'depot' });
    assert.deepEqual(parseRoute('#/b'), { screen: 'depot' });
    assert.deepEqual(parseRoute('#/s/s1/nonsense'), { screen: 'survivor', id: 's1', tab: 'stats' });
    assert.deepEqual(parseRoute('#/plan'), { screen: 'reach' });
    assert.deepEqual(parseRoute('#/run'), { screen: 'runs' });
  });

  test('each screen lights its tab', () => {
    assert.equal(tabFor({ screen: 'survivor', id: 's1', tab: 'stats' }), 'roster');
    assert.equal(tabFor({ screen: 'memorial' }), 'roster');
    assert.equal(tabFor({ screen: 'plan', locationId: 'x' }), 'reach');
    assert.equal(tabFor({ screen: 'run', id: 'r1' }), 'runs');
    assert.equal(tabFor({ screen: 'settings' }), 'settings');
    assert.equal(tabFor({ screen: 'building', id: 'garden' }), 'depot');
    assert.equal(tabFor({ screen: 'recruits' }), 'depot');
  });
});
