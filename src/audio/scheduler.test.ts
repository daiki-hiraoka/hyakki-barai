import { describe, expect, it } from 'vitest';
import { planSteps } from './scheduler';

const stepDur = 0.1;
const opts = (now: number) => ({ now, lookahead: 0.25, stepDur, maxLate: 0.05 });

describe('planSteps（先読みスケジューラの純粋な計算部分）', () => {
  it('先読み窓に入るステップだけを返し、次の位置を進める', () => {
    const r = planSteps({ time: 1.0, step: 0 }, opts(1.0));
    expect(r.steps.map((s) => s.step)).toEqual([0, 1, 2]);
    r.steps.forEach((s, i) => expect(s.time).toBeCloseTo(1.0 + i * stepDur, 9));
    expect(r.next.step).toBe(3);
    expect(r.next.time).toBeCloseTo(1.3, 9);
  });

  it('まだ窓に入っていなければ何も返さない', () => {
    const r = planSteps({ time: 2.0, step: 5 }, opts(1.0));
    expect(r.steps).toEqual([]);
    expect(r.next).toEqual({ time: 2.0, step: 5 });
  });

  it('前回の続きから呼ぶと、同じステップを二重に返さない', () => {
    const a = planSteps({ time: 1.0, step: 0 }, opts(1.0));
    const b = planSteps(a.next, opts(1.025));
    const c = planSteps(b.next, opts(1.06));
    const all = [...a.steps, ...b.steps, ...c.steps].map((s) => s.step);
    expect(all).toEqual([...new Set(all)]);
    expect(all).toEqual([0, 1, 2, 3]);
  });

  it('タイマー揺れ程度のわずかな遅れは、そのまま鳴らす', () => {
    const r = planSteps({ time: 0.98, step: 0 }, opts(1.0));
    expect(r.steps[0]).toEqual({ step: 0, time: 0.98 });
  });

  it('タブ復帰などで大きく遅れたら、取りこぼした分は鳴らさずに飛ばす', () => {
    const r = planSteps({ time: 1.0, step: 0 }, opts(6.05));
    // 一気に鳴らさない：窓に入る数だけ
    expect(r.steps.length).toBeLessThanOrEqual(Math.ceil(0.25 / stepDur) + 1);
    // 飛ばした後も拍の位置は時間どおり（step と time の対応が崩れない）
    for (const s of r.steps) {
      expect(s.time).toBeGreaterThanOrEqual(6.05 - 1e-9);
      expect(s.time).toBeCloseTo(1.0 + s.step * stepDur, 9);
    }
    expect(r.steps[0]?.step).toBe(51);
  });
});
