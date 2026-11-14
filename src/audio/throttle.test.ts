import { describe, expect, it } from 'vitest';
import { SfxThrottle } from './throttle';

const rules = {
  hit: { minInterval: 0.035, maxVoices: 2 },
  kill: { minInterval: 0.045, maxVoices: 3 },
  ui: { minInterval: 0.02, maxVoices: 2, priority: true },
};

describe('SfxThrottle（効果音の間引き）', () => {
  it('最初の 1 回は鳴らす', () => {
    const t = new SfxThrottle(rules, 8);
    expect(t.tryStart('hit', 0, 0.05)).toBe(true);
  });

  it('最小間隔より短い連打は捨てる', () => {
    const t = new SfxThrottle(rules, 8);
    expect(t.tryStart('hit', 1.0, 0.01)).toBe(true);
    expect(t.tryStart('hit', 1.02, 0.01)).toBe(false);
    expect(t.tryStart('hit', 1.035, 0.01)).toBe(true);
  });

  it('捨てた呼び出しは間隔の起点にならない', () => {
    const t = new SfxThrottle(rules, 8);
    t.tryStart('hit', 0, 0.01);
    t.tryStart('hit', 0.03, 0.01);
    expect(t.tryStart('hit', 0.04, 0.01)).toBe(true);
  });

  it('同じ音の同時発音数が上限に達していたら捨て、鳴り終われば再び鳴らす', () => {
    const t = new SfxThrottle(rules, 8);
    expect(t.tryStart('hit', 0, 1.0)).toBe(true);
    expect(t.tryStart('hit', 0.1, 1.0)).toBe(true);
    expect(t.tryStart('hit', 0.2, 1.0)).toBe(false);
    expect(t.tryStart('hit', 1.05, 1.0)).toBe(true);
  });

  it('ID ごとに独立して判定する', () => {
    const t = new SfxThrottle(rules, 8);
    expect(t.tryStart('hit', 0, 0.1)).toBe(true);
    expect(t.tryStart('kill', 0.001, 0.1)).toBe(true);
  });

  it('全体の同時発音数が上限なら捨てるが、優先度の高い音は通す', () => {
    const t = new SfxThrottle(rules, 3);
    expect(t.tryStart('hit', 0, 1)).toBe(true);
    expect(t.tryStart('kill', 0, 1)).toBe(true);
    expect(t.tryStart('kill', 0.05, 1)).toBe(true);
    expect(t.tryStart('kill', 0.1, 1)).toBe(false);
    expect(t.tryStart('ui', 0.1, 1)).toBe(true);
  });

  it('activeCount は鳴っている数を返す', () => {
    const t = new SfxThrottle(rules, 8);
    t.tryStart('hit', 0, 0.5);
    t.tryStart('kill', 0, 1.0);
    expect(t.activeCount(0.1)).toBe(2);
    expect(t.activeCount(0.6)).toBe(1);
    expect(t.activeCount(0.6, 'hit')).toBe(0);
  });
});
