import { describe, expect, it } from 'vitest';
import { describeDelta, formatTime, upgradeInfo } from './describe';

describe('describeDelta', () => {
  it('武器の上昇分を日本語の短い説明にする', () => {
    expect(describeDelta({ damage: 5 })).toBe('威力 +5');
    expect(describeDelta({ amount: 1 })).toBe('数 +1');
    expect(describeDelta({ cooldown: -0.15 })).toBe('冷却 -0.15秒');
    expect(describeDelta({ area: 0.15, speed: 0.15 })).toBe('範囲 +15%／速さ +15%');
    expect(describeDelta({ duration: 0.6, damage: 3 })).toBe('威力 +3／効果 +0.6秒');
    expect(describeDelta({ crit: 0.1, pierce: 2 })).toBe('貫通 +2／会心 +10%');
    expect(describeDelta({ interval: -0.1 })).toBe('間隔 -0.1秒');
  });
});

describe('upgradeInfo', () => {
  it('新しい武器は「新」と武器の説明を出す', () => {
    const info = upgradeInfo({ kind: 'weapon', id: 'juzu', level: 1, isNew: true });
    expect(info).toMatchObject({ icon: 'icon.w.juzu', name: '数珠', tag: '新' });
    expect(info.desc.length).toBeGreaterThan(0);
  });

  it('武器の強化は次のレベルと上昇分を出す', () => {
    const info = upgradeInfo({ kind: 'weapon', id: 'reifu', level: 2, isNew: false });
    expect(info).toMatchObject({ icon: 'icon.w.reifu', name: '霊符', tag: 'Lv2', desc: '数 +1' });
  });

  it('装身具・覚醒・小判・回復', () => {
    expect(upgradeInfo({ kind: 'passive', id: 'daruma', level: 3, isNew: false })).toMatchObject({
      icon: 'icon.p.daruma',
      name: 'だるま',
      tag: 'Lv3',
    });
    expect(upgradeInfo({ kind: 'evolve', from: 'reifu', id: 'yaoyorozu' })).toMatchObject({
      icon: 'icon.w.yaoyorozu',
      name: '神符・八百万',
      tag: '覚醒',
    });
    expect(upgradeInfo({ kind: 'gold', amount: 25 })).toMatchObject({ icon: 'icon.x.gold', desc: '小判 25 枚' });
    expect(upgradeInfo({ kind: 'heal', amount: 30 })).toMatchObject({ icon: 'icon.x.heal', desc: '体力を 30 回復' });
  });
});

describe('formatTime', () => {
  it('秒を mm:ss にする', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(75.9)).toBe('01:15');
    expect(formatTime(1200)).toBe('20:00');
  });
});
