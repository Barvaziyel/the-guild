import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { Rng } from './rng.ts';

describe('Rng', () => {
  test('same seed gives the same sequence', () => {
    const a = new Rng('hello');
    const b = new Rng('hello');
    for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());
  });

  test('different seeds diverge', () => {
    const a = new Rng('seed-1');
    const b = new Rng('seed-2');
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean).length;
    assert.ok(same < 3);
  });

  test('state round-trips through JSON', () => {
    const a = new Rng(42);
    for (let i = 0; i < 10; i++) a.next();
    const restored = Rng.fromState(JSON.parse(JSON.stringify(a.getState())));
    for (let i = 0; i < 50; i++) assert.equal(a.next(), restored.next());
  });

  test('next() stays in [0, 1)', () => {
    const r = new Rng('range');
    for (let i = 0; i < 10_000; i++) {
      const x = r.next();
      assert.ok(x >= 0 && x < 1);
    }
  });

  test('int() is inclusive and roughly uniform', () => {
    const r = new Rng('dice');
    const counts = new Array<number>(11).fill(0);
    for (let i = 0; i < 20_000; i++) counts[r.int(1, 10)]! += 1;
    assert.equal(counts[0], 0);
    for (let face = 1; face <= 10; face++) {
      assert.ok(counts[face]! > 1700 && counts[face]! < 2300, `face ${face}: ${counts[face]}`);
    }
  });

  test('weighted() respects weights and skips zero weights', () => {
    const r = new Rng('weights');
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 10_000; i++) {
      const k = r.weighted([
        { item: 'a', weight: 1 },
        { item: 'b', weight: 3 },
        { item: 'c', weight: 0 },
      ]);
      counts[k]! += 1;
    }
    assert.equal(counts.c, 0);
    const ratio = counts.b! / counts.a!;
    assert.ok(ratio > 2.6 && ratio < 3.4, `ratio ${ratio}`);
  });

  test('fork() is deterministic and independent of later parent use', () => {
    const p1 = new Rng('parent');
    const p2 = new Rng('parent');
    const c1 = p1.fork('run');
    const c2 = p2.fork('run');
    p1.next();
    assert.equal(c1.next(), c2.next());
  });

  test('shuffle() keeps all elements', () => {
    const r = new Rng('shuffle');
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = r.shuffle(items);
    assert.deepEqual([...out].sort((a, b) => a - b), items);
    assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7, 8], 'input untouched');
  });
});
