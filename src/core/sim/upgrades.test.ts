import { describe, expect, it } from 'vitest';
import { BASE_WEAPON_IDS, PASSIVE_IDS, type Upgrade } from '../types';
import { refreshPlayer } from './stats';
import { makeWorld } from './testkit';
import {
  applyUpgrade,
  chooseUpgrade,
  openChest,
  rerollOffer,
  rollOffer,
  skipOffer,
} from './upgrades';
import { findPassive, findWeapon, grantPassive, grantWeapon } from './world';

const key = (u: Upgrade): string => ('id' in u ? `${u.kind}:${u.id}` : u.kind);

describe('rollOffer', () => {
  it('既定では重複のない 3 択を出す', () => {
    const world = makeWorld();
    for (let i = 0; i < 50; i++) {
      const offer = rollOffer(world);
      expect(offer).toHaveLength(3);
      expect(new Set(offer.map(key)).size).toBe(3);
    }
  });

  it('最大レベルの武器・装身具は出さない', () => {
    const world = makeWorld();
    world.player.weapons[0]!.level = 8;
    grantPassive(world, 'magatama').level = 5;
    for (let i = 0; i < 100; i++) {
      for (const u of rollOffer(world)) {
        expect(key(u)).not.toBe('weapon:reifu');
        expect(key(u)).not.toBe('passive:magatama');
      }
    }
  });

  it('枠が埋まっていれば、新しい武器・装身具は出さない', () => {
    const world = makeWorld();
    for (const id of BASE_WEAPON_IDS.slice(1, 6)) grantWeapon(world, id);
    for (const id of PASSIVE_IDS.slice(0, 6)) grantPassive(world, id);
    expect(world.player.weapons).toHaveLength(6);
    for (let i = 0; i < 100; i++) {
      for (const u of rollOffer(world)) {
        expect(u.kind === 'weapon' || u.kind === 'passive').toBe(true);
        if (u.kind === 'weapon' || u.kind === 'passive') expect(u.isNew).toBe(false);
      }
    }
  });

  it('覚醒済みの武器の元になった武器は、もう出さない', () => {
    const world = makeWorld();
    world.player.weapons.length = 0;
    grantWeapon(world, 'yaoyorozu');
    for (let i = 0; i < 200; i++) {
      for (const u of rollOffer(world)) expect(key(u)).not.toBe('weapon:reifu');
    }
  });

  it('上げるものが尽きたら、小判か回復を出す', () => {
    const world = makeWorld();
    world.player.weapons.length = 0;
    for (const id of BASE_WEAPON_IDS.slice(0, 6)) grantWeapon(world, id).level = 8;
    for (const id of PASSIVE_IDS.slice(2, 8)) {
      const p = grantPassive(world, id);
      p.level = p.def.maxLevel;
    }
    const offer = rollOffer(world);
    expect(offer.map((u) => u.kind).sort()).toEqual(['gold', 'heal']);
  });

  it('運が十分に高いと 4 択になる', () => {
    const world = makeWorld();
    world.player.stats.luck = 3;
    expect(rollOffer(world)).toHaveLength(4);
  });
});

describe('applyUpgrade', () => {
  it('新しい武器は枠に加わる', () => {
    const world = makeWorld();
    applyUpgrade(world, { kind: 'weapon', id: 'juzu', level: 1, isNew: true });
    expect(world.player.weapons.map((w) => w.def.id)).toEqual(['reifu', 'juzu']);
  });

  it('武器のレベルアップは最終値に反映される', () => {
    const world = makeWorld();
    applyUpgrade(world, { kind: 'weapon', id: 'reifu', level: 2, isNew: false });
    const w = findWeapon(world.player, 'reifu')!;
    expect(w.level).toBe(2);
    expect(w.stats.amount).toBe(2);
  });

  it('装身具は能力値に反映され、最大体力が増えた分は回復する', () => {
    const world = makeWorld();
    world.player.hp = 40;
    applyUpgrade(world, { kind: 'passive', id: 'daruma', level: 1, isNew: true });
    expect(world.player.maxHp).toBe(120);
    expect(world.player.hp).toBe(60);
    applyUpgrade(world, { kind: 'passive', id: 'daruma', level: 2, isNew: false });
    expect(findPassive(world.player, 'daruma')!.level).toBe(2);
    expect(world.player.maxHp).toBe(140);
  });

  it('小判と回復', () => {
    const world = makeWorld();
    world.player.hp = 10;
    applyUpgrade(world, { kind: 'gold', amount: 25 });
    applyUpgrade(world, { kind: 'heal', amount: 30 });
    expect(world.run.gold).toBe(25);
    expect(world.player.hp).toBe(40);
  });
});

describe('振り直しと見送り', () => {
  it('回数があるときだけ使え、使うと減る', () => {
    const world = makeWorld({ shop: { rerolls: 1, skips: 1 } });
    world.pendingLevels = 2;
    world.phase = 'levelup';
    world.offer = rollOffer(world);

    expect(rerollOffer(world)).toBe(true);
    expect(world.player.rerollsLeft).toBe(0);
    expect(rerollOffer(world)).toBe(false);

    expect(skipOffer(world)).toBe(true);
    expect(world.pendingLevels).toBe(1);
    expect(world.phase).toBe('levelup');
    expect(skipOffer(world)).toBe(false);

    chooseUpgrade(world, 0);
    expect(world.phase).toBe('playing');
  });
});

describe('つづら', () => {
  it('最大レベルの武器と対応する装身具が揃っていれば覚醒させる（同じ枠のまま）', () => {
    const world = makeWorld();
    grantWeapon(world, 'juzu');
    world.player.weapons[0]!.level = 8;
    grantPassive(world, 'fude');
    refreshPlayer(world.player);
    const result = openChest(world);
    expect(result.items[0]).toEqual({ kind: 'evolve', from: 'reifu', id: 'yaoyorozu' });
    expect(world.player.weapons.map((w) => w.def.id)).toEqual(['yaoyorozu', 'juzu']);
    expect(world.player.weapons[0]!.level).toBe(1);
  });

  it('装身具が無ければ覚醒しない', () => {
    const world = makeWorld();
    world.player.weapons[0]!.level = 8;
    refreshPlayer(world.player);
    const result = openChest(world);
    expect(result.items.some((u) => u.kind === 'evolve')).toBe(false);
  });

  it('覚醒できなければ、持っている武器・装身具のレベルを上げる', () => {
    const world = makeWorld();
    const result = openChest(world);
    expect(result.items[0]).toMatchObject({ kind: 'weapon', id: 'reifu', level: 2 });
    // 中身は 1・3・5 個のいずれか。持っているのは霊符だけなので、その数だけ上がる
    expect(world.player.weapons[0]!.level).toBe(1 + result.items.length);
    expect(result.gold).toBeGreaterThan(0);
    expect(world.run.gold).toBe(result.gold);
  });

  it('上げるものが無ければ小判になる', () => {
    const world = makeWorld();
    world.player.weapons[0]!.level = 8;
    refreshPlayer(world.player);
    const result = openChest(world);
    expect(result.items.every((u) => u.kind === 'gold')).toBe(true);
  });
});
