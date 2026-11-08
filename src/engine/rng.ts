// Seeded random numbers (mulberry32), so a night can be replayed and a bot can measure balance.

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** 0 <= n < 1 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 0 <= n < max, whole */
  int(max: number): number {
    return Math.floor(this.next() * max);
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    const v = list[this.int(list.length)];
    if (v === undefined) throw new Error('pick from an empty list');
    return v;
  }

  /** Index into weights, chosen in proportion to them. */
  weighted(weights: readonly number[]): number {
    let r = this.next() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i] ?? 0;
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
}
