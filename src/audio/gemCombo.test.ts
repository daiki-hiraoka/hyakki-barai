import { describe, expect, it } from 'vitest';
import { GemCombo, gemPitchRatio } from './gemCombo';

describe('GemCombo（霊玉の連続取得）', () => {
  it('最初の 1 個は 0 段目', () => {
    expect(new GemCombo().next(10)).toBe(0);
  });

  it('0.25 秒以内に続けて取ると 1 段ずつ上がる', () => {
    const c = new GemCombo();
    expect([0, 0.1, 0.2, 0.3].map((t) => c.next(t))).toEqual([0, 1, 2, 3]);
  });

  it('ちょうど 0.25 秒の間隔は連続とみなす', () => {
    const c = new GemCombo();
    c.next(1);
    expect(c.next(1.25)).toBe(1);
  });

  it('上限の段で止まる', () => {
    const c = new GemCombo({ window: 0.25, maxStep: 3 });
    const steps = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map((t) => c.next(t));
    expect(steps).toEqual([0, 1, 2, 3, 3, 3]);
  });

  it('間が空くと 0 段目に戻る', () => {
    const c = new GemCombo();
    expect([0, 0.1, 0.36, 0.4].map((t) => c.next(t))).toEqual([0, 1, 0, 1]);
  });
});

describe('gemPitchRatio', () => {
  it('0 段目は元の音程', () => {
    expect(gemPitchRatio(0)).toBe(1);
  });

  it('五音音階（ヨナ抜き長音階）に沿って上がり、5 段で 1 オクターブ', () => {
    expect(gemPitchRatio(1)).toBeCloseTo(2 ** (2 / 12), 9);
    expect(gemPitchRatio(2)).toBeCloseTo(2 ** (4 / 12), 9);
    expect(gemPitchRatio(3)).toBeCloseTo(2 ** (7 / 12), 9);
    expect(gemPitchRatio(5)).toBeCloseTo(2, 9);
  });

  it('段数が大きいほど音程は単調に上がる', () => {
    for (let i = 1; i < 12; i++) expect(gemPitchRatio(i)).toBeGreaterThan(gemPitchRatio(i - 1));
  });
});
