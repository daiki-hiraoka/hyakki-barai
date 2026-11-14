/**
 * シード付き乱数（mulberry32）。
 * シミュレーションは Math.random を使わずこれだけを使う。同じシードと同じ入力から
 * 同じ結果が再現できるので、テストやバランス検証が安定する。
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** 内部状態。保存して書き戻すと続きが再現される */
  get state(): number {
    return this.s;
  }

  set state(value: number) {
    this.s = value >>> 0;
  }

  /** [0, 1) の一様乱数 */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max) の実数 */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** 0 以上 n 未満の整数 */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  /** 確率 p で true */
  chance(p: number): boolean {
    return this.next() < p;
  }

  /** [0, 2π) の角度 */
  angle(): number {
    return this.next() * Math.PI * 2;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)]!;
  }

  /** 重みに比例して 1 つ選ぶ。重みの合計が 0 以下なら先頭を返す */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const item of items) total += Math.max(0, weight(item));
    if (total <= 0) return items[0]!;
    let roll = this.next() * total;
    for (const item of items) {
      const w = Math.max(0, weight(item));
      if (w <= 0) continue;
      roll -= w;
      if (roll < 0) return item;
    }
    return items[items.length - 1]!;
  }
}
