import { describe, expect, it } from 'vitest';
import { Rng } from './rng';

describe('Rng', () => {
  it('同じシードなら同じ列を返す', () => {
    const a = new Rng(1234);
    const b = new Rng(1234);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('シードが違えば列も違う', () => {
    const a = new Rng(1);
    const b = new Rng(2);
    const same = Array.from({ length: 20 }, () => a.next() === b.next());
    expect(same.every(Boolean)).toBe(false);
  });

  it('next は [0, 1) に収まり、偏りが小さい', () => {
    const r = new Rng(42);
    let sum = 0;
    for (let i = 0; i < 10000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      sum += v;
    }
    expect(sum / 10000).toBeGreaterThan(0.48);
    expect(sum / 10000).toBeLessThan(0.52);
  });

  it('int(n) は 0 以上 n 未満の整数', () => {
    const r = new Rng(7);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = r.int(5);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('range(a, b) は a 以上 b 未満', () => {
    const r = new Rng(7);
    for (let i = 0; i < 200; i++) {
      const v = r.range(-3, 3);
      expect(v).toBeGreaterThanOrEqual(-3);
      expect(v).toBeLessThan(3);
    }
  });

  it('chance(0) は常に false、chance(1) は常に true', () => {
    const r = new Rng(9);
    for (let i = 0; i < 50; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it('weighted は重み 0 の要素を選ばず、重みに比例して選ぶ', () => {
    const r = new Rng(11);
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    const items = [
      { id: 'a', w: 0 },
      { id: 'b', w: 1 },
      { id: 'c', w: 3 },
    ];
    for (let i = 0; i < 4000; i++) counts[r.weighted(items, (it) => it.w).id]!++;
    expect(counts.a).toBe(0);
    expect(counts.c! / counts.b!).toBeGreaterThan(2.5);
    expect(counts.c! / counts.b!).toBeLessThan(3.5);
  });

  it('state を保存して戻すと続きが再現される', () => {
    const r = new Rng(5);
    r.next();
    const saved = r.state;
    const expected = [r.next(), r.next(), r.next()];
    r.state = saved;
    expect([r.next(), r.next(), r.next()]).toEqual(expected);
  });
});
