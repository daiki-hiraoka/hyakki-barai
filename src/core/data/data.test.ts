import { describe, expect, it } from 'vitest';
import {
  BASE_WEAPON_IDS,
  CHARACTER_IDS,
  ENEMY_IDS,
  EVOLVED_WEAPON_IDS,
  PASSIVE_IDS,
  SHOP_IDS,
} from '../types';
import { CHARACTERS } from './characters';
import { ENEMIES } from './enemies';
import { PASSIVES } from './passives';
import { SHOP } from './shop';
import { EVENTS, WAVES } from './waves';
import { WEAPONS, weaponStatsAt } from './weapons';

describe('祓い手', () => {
  it('全員が定義され、初期武器は基本武器である', () => {
    for (const id of CHARACTER_IDS) {
      const c = CHARACTERS[id];
      expect(c.id).toBe(id);
      expect(c.baseHp).toBeGreaterThan(0);
      expect(BASE_WEAPON_IDS).toContain(c.weapon);
    }
  });

  it('初期武器は全員違う', () => {
    const weapons = CHARACTER_IDS.map((id) => CHARACTERS[id].weapon);
    expect(new Set(weapons).size).toBe(weapons.length);
  });
});

describe('武器', () => {
  it('基本武器は Lv8 までの上昇分と、覚醒先・必要な装身具を持つ', () => {
    for (const id of BASE_WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w.id).toBe(id);
      expect(w.evolved).toBe(false);
      expect(w.maxLevel).toBe(8);
      expect(w.levels).toHaveLength(7);
      expect(EVOLVED_WEAPON_IDS).toContain(w.evolvesTo);
      expect(PASSIVE_IDS).toContain(w.requires);
      for (const delta of w.levels) expect(Object.keys(delta).length).toBeGreaterThan(0);
    }
  });

  it('覚醒武器は Lv1 のみで、同じ型の基本武器ちょうど 1 つから覚醒する', () => {
    for (const id of EVOLVED_WEAPON_IDS) {
      const w = WEAPONS[id];
      expect(w.evolved).toBe(true);
      expect(w.maxLevel).toBe(1);
      expect(w.levels).toHaveLength(0);
      const sources = BASE_WEAPON_IDS.filter((b) => WEAPONS[b].evolvesTo === id);
      expect(sources).toHaveLength(1);
      expect(WEAPONS[sources[0]!].kind).toBe(w.kind);
    }
  });

  it('覚醒に必要な装身具は武器ごとに違い、12 種の装身具すべてに対応する武器がある', () => {
    const required = BASE_WEAPON_IDS.map((id) => WEAPONS[id].requires);
    expect(new Set(required).size).toBe(BASE_WEAPON_IDS.length);
    expect(new Set(required)).toEqual(new Set(PASSIVE_IDS));
  });

  it('weaponStatsAt は Lv1 で基本値、以降は上昇分を累積する', () => {
    const w = WEAPONS.reifu;
    expect(weaponStatsAt(w, 1)).toEqual(w.base);
    const lv2 = weaponStatsAt(w, 2);
    expect(lv2.amount).toBe(w.base.amount + (w.levels[0]!.amount ?? 0));
    const max = weaponStatsAt(w, 8);
    const sumDamage = w.levels.reduce((s, d) => s + (d.damage ?? 0), w.base.damage);
    expect(max.damage).toBe(sumDamage);
    // 元の定義を書き換えない
    expect(weaponStatsAt(w, 1)).toEqual(w.base);
  });

  it('どのレベルでもクールダウンと間隔は正の値を保つ', () => {
    for (const id of BASE_WEAPON_IDS) {
      for (let lv = 1; lv <= 8; lv++) {
        const s = weaponStatsAt(WEAPONS[id], lv);
        expect(s.cooldown, `${id} Lv${lv}`).toBeGreaterThan(0);
        expect(s.interval, `${id} Lv${lv}`).toBeGreaterThan(0);
        expect(s.damage, `${id} Lv${lv}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('装身具・社', () => {
  it('装身具がすべて定義されている', () => {
    for (const id of PASSIVE_IDS) {
      const p = PASSIVES[id];
      expect(p.id).toBe(id);
      expect(p.maxLevel).toBeGreaterThanOrEqual(1);
      expect(Object.keys(p.perLevel).length).toBeGreaterThan(0);
    }
  });

  it('社の加護がすべて定義されている', () => {
    for (const id of SHOP_IDS) {
      const s = SHOP[id];
      expect(s.id).toBe(id);
      expect(s.maxRank).toBeGreaterThanOrEqual(1);
      expect(s.baseCost).toBeGreaterThan(0);
    }
  });
});

describe('妖怪', () => {
  it('すべて定義され、数値が正である', () => {
    for (const id of ENEMY_IDS) {
      const e = ENEMIES[id];
      expect(e.id).toBe(id);
      expect(e.hp).toBeGreaterThan(0);
      expect(e.speed).toBeGreaterThan(0);
      expect(e.radius).toBeGreaterThan(0);
      if (e.split) expect(ENEMY_IDS).toContain(e.split.into);
    }
  });

  it('大妖は 4 体', () => {
    const bosses = ENEMY_IDS.filter((id) => ENEMIES[id].boss);
    expect(bosses.sort()).toEqual(['gasha', 'kanabo', 'shuten', 'tsuchigumo']);
  });
});

describe('進行表', () => {
  it('波は 0 秒から始まり、時刻順に並ぶ', () => {
    expect(WAVES[0]!.at).toBe(0);
    for (let i = 1; i < WAVES.length; i++) {
      expect(WAVES[i]!.at).toBeGreaterThan(WAVES[i - 1]!.at);
    }
  });

  it('波に出る妖怪は通常の妖怪だけ', () => {
    for (const w of WAVES) {
      expect(w.pool.length).toBeGreaterThan(0);
      for (const [id] of w.pool) expect(ENEMIES[id].boss ?? false).toBe(false);
      expect(w.max).toBeGreaterThanOrEqual(w.min);
    }
  });

  it('イベントは時刻順に並び、大妖は 4 体とも登場する', () => {
    for (let i = 1; i < EVENTS.length; i++) {
      expect(EVENTS[i]!.at).toBeGreaterThanOrEqual(EVENTS[i - 1]!.at);
    }
    const bosses = EVENTS.flatMap((e) => (e.kind === 'boss' ? [e.enemy] : []));
    expect(bosses).toEqual(['kanabo', 'tsuchigumo', 'gasha', 'shuten']);
  });
});
