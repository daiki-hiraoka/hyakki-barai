import { describe, expect, it } from 'vitest';
import { measureLevels } from './levels';

const SR = 1000;
const fill = (n: number, f: (i: number) => number) => Float32Array.from({ length: n }, (_, i) => f(i));

describe('measureLevels（レンダリング結果の音量）', () => {
  it('無音なら全て 0', () => {
    const r = measureLevels([new Float32Array(SR)], SR);
    expect(r).toEqual({ peak: 0, rms: 0, rmsPerSecond: [0] });
  });

  it('振幅 0.5 の矩形波は peak・RMS とも 0.5', () => {
    const r = measureLevels([fill(SR, (i) => (i % 2 ? 0.5 : -0.5))], SR);
    expect(r.peak).toBeCloseTo(0.5, 6);
    expect(r.rms).toBeCloseTo(0.5, 6);
  });

  it('サイン波の RMS は振幅 / √2', () => {
    const r = measureLevels([fill(SR, (i) => 0.8 * Math.sin((2 * Math.PI * 10 * i) / SR))], SR);
    expect(r.rms).toBeCloseTo(0.8 / Math.SQRT2, 3);
  });

  it('peak は全チャンネルの中の最大の絶対値', () => {
    const r = measureLevels([fill(SR, () => 0.1), fill(SR, (i) => (i === 7 ? -0.7 : 0))], SR);
    expect(r.peak).toBeCloseTo(0.7, 6);
  });

  it('1 秒ごとの RMS を返す（最後の端数の区間も含む）', () => {
    const r = measureLevels([fill(SR * 1.5, (i) => (i < SR ? 0.2 : 0))], SR);
    expect(r.rmsPerSecond).toHaveLength(2);
    expect(r.rmsPerSecond[0]).toBeCloseTo(0.2, 6);
    expect(r.rmsPerSecond[1]).toBe(0);
  });
});
