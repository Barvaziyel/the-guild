import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { parseRoute, routeHash, tabFor, type Route } from './route.ts';

describe('routes', () => {
  test('round-trip through the hash', () => {
    const routes: Route[] = [
      { screen: 'roster' },
      { screen: 'memorial' },
      { screen: 'settings' },
      { screen: 'survivor', id: 's3', tab: 'stats' },
      { screen: 'survivor', id: 's3', tab: 'bonds' },
      { screen: 'survivor', id: 's12', tab: 'story' },
    ];
    for (const r of routes) assert.deepEqual(parseRoute(routeHash(r)), r);
  });

  test('anything unknown lands on the roster', () => {
    assert.deepEqual(parseRoute(''), { screen: 'roster' });
    assert.deepEqual(parseRoute('#/nowhere'), { screen: 'roster' });
    assert.deepEqual(parseRoute('#/s/'), { screen: 'roster' });
    assert.deepEqual(parseRoute('#/s/s1/nonsense'), { screen: 'survivor', id: 's1', tab: 'stats' });
  });

  test('a sheet lights the tab it was opened from', () => {
    const sheet: Route = { screen: 'survivor', id: 's1', tab: 'stats' };
    assert.equal(tabFor(sheet, false), 'roster');
    assert.equal(tabFor(sheet, true), 'memorial');
    assert.equal(tabFor({ screen: 'settings' }, false), 'settings');
  });
});
