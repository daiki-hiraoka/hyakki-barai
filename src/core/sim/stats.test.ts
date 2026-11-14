import { describe, expect, it } from 'vitest';
import { CHARACTERS } from '../data/characters';
import { PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';
import { baseStats, computeStats, resolveWeaponStats } from './stats';

describe('computeStats', () => {
  it('祓い手の固有能力を基準値に加える', () => {
    const s = computeStats(CHARACTERS.haruma, {}, []);
    expect(s.cooldown).toBeCloseTo(0.92);
    expect(s.might).toBe(1);
    const k = computeStats(CHARACTERS.kon, {}, []);
    expect(k.area).toBeCloseTo(1.15);
    expect(k.luck).toBeCloseTo(1.25);
  });

  it('社の加護をランク分だけ加える', () => {
    const s = computeStats(CHARACTERS.chihaya, { might: 2, armor: 1 }, []);
    expect(s.might).toBeCloseTo(1.1);
    expect(s.armor).toBe(1);
  });

  it('装身具をレベル分だけ加える', () => {
    const s = computeStats(CHARACTERS.chihaya, {}, [
      { def: PASSIVES.magatama, level: 3 },
      { def: PASSIVES.fude, level: 2 },
    ]);
    expect(s.might).toBeCloseTo(1.3);
    expect(s.amount).toBe(2);
  });

  it('クールダウン倍率には下限がある', () => {
    const s = computeStats(CHARACTERS.haruma, { cooldown: 2 }, [
      { def: PASSIVES.kyokan, level: 5 },
      { def: PASSIVES.kyokan, level: 5 },
    ]);
    expect(s.cooldown).toBeGreaterThanOrEqual(0.4);
  });
});

describe('resolveWeaponStats', () => {
  it('攻撃力・冷却・範囲・弾速・持続を能力値で掛ける', () => {
    const stats = { ...baseStats(), might: 1.5, cooldown: 0.8, area: 1.2, projSpeed: 1.1, duration: 1.3 };
    const base = WEAPONS.juzu.base;
    const w = resolveWeaponStats(WEAPONS.juzu, 1, stats);
    expect(w.damage).toBeCloseTo(base.damage * 1.5);
    expect(w.cooldown).toBeCloseTo(base.cooldown * 0.8);
    expect(w.area).toBeCloseTo(base.area * 1.2);
    expect(w.speed).toBeCloseTo(base.speed * 1.1);
    expect(w.duration).toBeCloseTo(base.duration * 1.3);
  });

  it('弾数ボーナスは、対応する武器にだけ加える', () => {
    const stats = { ...baseStats(), amount: 2 };
    expect(resolveWeaponStats(WEAPONS.reifu, 1, stats).amount).toBe(WEAPONS.reifu.base.amount + 2);
    expect(resolveWeaponStats(WEAPONS.kekkai, 1, stats).amount).toBe(WEAPONS.kekkai.base.amount);
  });

  it('レベルに応じた基本値を使う', () => {
    const w = resolveWeaponStats(WEAPONS.reifu, 3, baseStats());
    expect(w.amount).toBe(2);
    expect(w.damage).toBe(15);
  });
});
