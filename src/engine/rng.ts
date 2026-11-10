/**
 * Seeded, serializable random number generator (sfc32).
 *
 * The engine never calls Math.random(). Every random decision goes through an
 * Rng so that the same seed always produces the same game. Rng state is plain
 * data (four uint32s) and is stored in the save file.
 */

export interface RngState {
  a: number;
  b: number;
  c: number;
  d: number;
}

/** Hash a string into four 32-bit seeds (cyrb128). */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export interface Weighted<T> {
  item: T;
  weight: number;
}

export class Rng {
  private s: RngState;

  constructor(seed: string | number | RngState) {
    if (typeof seed === 'object') {
      this.s = { ...seed };
    } else {
      const [a, b, c, d] = cyrb128(String(seed));
      this.s = { a, b, c, d };
      // Warm up so similar seeds diverge quickly.
      for (let i = 0; i < 15; i++) this.next();
    }
  }

  /** Restore an Rng from saved state. */
  static fromState(state: RngState): Rng {
    return new Rng(state);
  }

  /** Copy of the current state, safe to store in a save. */
  getState(): RngState {
    return { ...this.s };
  }

  /** Uniform float in [0, 1). */
  next(): number {
    const s = this.s;
    s.a >>>= 0;
    s.b >>>= 0;
    s.c >>>= 0;
    s.d >>>= 0;
    let t = (s.a + s.b) | 0;
    s.a = s.b ^ (s.b >>> 9);
    s.b = (s.c + (s.c << 3)) | 0;
    s.c = (s.c << 21) | (s.c >>> 11);
    s.d = (s.d + 1) | 0;
    t = (t + s.d) | 0;
    s.c = (s.c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  /** Integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    if (max < min) throw new Error(`Rng.int: max (${max}) < min (${min})`);
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Roll one die with the given number of sides (1..sides). */
  die(sides: number): number {
    return this.int(1, sides);
  }

  /** d10 roll, the standard check die. */
  d10(): number {
    return this.die(10);
  }

  /** d100 roll (1..100). */
  d100(): number {
    return this.die(100);
  }

  /** True with probability p (0..1). */
  chance(p: number): boolean {
    if (p <= 0) return false;
    if (p >= 1) return true;
    return this.next() < p;
  }

  /** Uniformly pick one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** Pick one element with probability proportional to its weight. */
  weighted<T>(entries: readonly Weighted<T>[]): T {
    let total = 0;
    for (const e of entries) total += Math.max(0, e.weight);
    if (total <= 0) throw new Error('Rng.weighted: no positive weights');
    let r = this.next() * total;
    for (const e of entries) {
      const w = Math.max(0, e.weight);
      if (r < w) return e.item;
      r -= w;
    }
    // Floating point edge case: return the last positive entry.
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i];
      if (e && e.weight > 0) return e.item;
    }
    throw new Error('Rng.weighted: unreachable');
  }

  /** Pick using a weight function over the items. */
  weightedBy<T>(items: readonly T[], weightOf: (item: T) => number): T {
    return this.weighted(items.map((item) => ({ item, weight: weightOf(item) })));
  }

  /** Return a new shuffled copy (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /** Pick n distinct elements (or fewer if the array is shorter). */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, n));
  }

  /** A 32-bit integer seed, useful for appearance seeds or child RNGs. */
  seed32(): number {
    return Math.floor(this.next() * 4294967296) >>> 0;
  }

  /**
   * Derive an independent child Rng. Advances this Rng by one step, so the
   * parent stays deterministic. Use a label to keep derivations readable.
   */
  fork(label = ''): Rng {
    return new Rng(`${this.seed32()}:${label}`);
  }
}
