import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { COUNT_MS, changeText, countAt, easeOut, screenKey } from './motion-view.ts';

describe('screen motion (3.2.0)', () => {
  test('a supply counts to its new amount and lands on it', () => {
    assert.equal(countAt(10, 40, 0), 10);
    const mid = countAt(10, 40, COUNT_MS / 2);
    assert.ok(mid > 25 && mid < 40, `eased past halfway by half time: ${mid}`);
    assert.equal(countAt(10, 40, COUNT_MS), 40);
    assert.equal(countAt(40, 10, COUNT_MS * 2), 10);
    for (let t = 0; t <= COUNT_MS; t += 50) assert.ok(Number.isInteger(countAt(3, 17, t)));
  });

  test('easing stays inside 0–1', () => {
    assert.equal(easeOut(-1), 0);
    assert.equal(easeOut(2), 1);
  });

  test('the change, signed', () => {
    assert.equal(changeText(5, 17), '+12');
    assert.equal(changeText(17, 14), '−3');
    assert.equal(changeText(4, 4), undefined);
  });

  test('another tab of the same screen is not a new screen; another person is', () => {
    assert.equal(screenKey({ screen: 'depot' }), screenKey({ screen: 'depot', tab: 'news' } as { screen: string }));
    assert.notEqual(screenKey({ screen: 'survivor', id: 'a' }), screenKey({ screen: 'survivor', id: 'b' }));
    assert.notEqual(screenKey({ screen: 'plan', locationId: 'a' }), screenKey({ screen: 'reach' }));
  });
});
