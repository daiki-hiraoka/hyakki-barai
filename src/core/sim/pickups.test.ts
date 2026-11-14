import { describe, expect, it } from 'vitest';
import { step } from './step';
import { IDLE, disarm, eventsOf, makeWorld, run } from './testkit';
import { chooseUpgrade, closeChest } from './upgrades';
import { spawnEnemy, spawnPickup } from './world';

describe('霊玉', () => {
  it('取得範囲に入ると引き寄せられ、経験値になる', () => {
    const world = disarm(makeWorld());
    spawnPickup(world, 'gem', 20, 0, 1);
    const events = run(world, 60);
    expect(world.pickups.items).toHaveLength(0);
    expect(world.player.xp).toBe(1);
    expect(eventsOf(events, 'pickup')).toHaveLength(1);
  });

  it('取得範囲の外にあるものは動かない', () => {
    const world = disarm(makeWorld());
    const gem = spawnPickup(world, 'gem', 200, 0, 1);
    run(world, 60);
    expect(gem.alive).toBe(true);
    expect(gem.x).toBe(200);
  });

  it('成長の能力値で経験値が増える', () => {
    const world = disarm(makeWorld({ character: 'enku' }));
    spawnPickup(world, 'gem', 5, 0, 10);
    run(world, 30);
    // 10 × 1.1 = 11。Lv1→2 に 5 使い、残り 6
    expect(world.player.level).toBe(2);
    expect(world.player.xp).toBeCloseTo(6);
  });
});

describe('レベルアップ', () => {
  it('選択肢を出して止まり、選ぶと再開する', () => {
    const world = disarm(makeWorld());
    spawnPickup(world, 'gem', 5, 0, 5);
    const events = run(world, 30);
    expect(world.phase).toBe('levelup');
    expect(world.offer).toHaveLength(3);
    expect(eventsOf(events, 'levelUp')[0]!.level).toBe(2);

    const tick = world.tick;
    step(world, IDLE);
    expect(world.tick).toBe(tick);

    chooseUpgrade(world, 0);
    expect(world.phase).toBe('playing');
    expect(world.offer).toBeNull();
    expect(world.pendingLevels).toBe(0);
  });

  it('一度に 2 レベル上がると、選択肢が 2 回続く', () => {
    const world = disarm(makeWorld());
    spawnPickup(world, 'gem', 5, 0, 16);
    run(world, 30);
    expect(world.player.level).toBe(3);
    expect(world.pendingLevels).toBe(2);
    chooseUpgrade(world, 0);
    expect(world.phase).toBe('levelup');
    expect(world.offer).not.toBeNull();
    chooseUpgrade(world, 0);
    expect(world.phase).toBe('playing');
  });
});

describe('アイテム', () => {
  it('小判と小判袋は所持金になる（強欲で増える）', () => {
    const world = disarm(makeWorld());
    spawnPickup(world, 'coin', 5, 0, 1);
    spawnPickup(world, 'bag', 5, 0, 25);
    run(world, 30);
    expect(world.run.gold).toBe(26);

    const rich = disarm(makeWorld({ shop: { greed: 5 } }));
    spawnPickup(rich, 'bag', 5, 0, 25);
    run(rich, 30);
    expect(rich.run.gold).toBe(38);
  });

  it('おにぎりは体力を 30 回復する（最大体力まで）', () => {
    const world = disarm(makeWorld());
    world.player.hp = 50;
    spawnPickup(world, 'onigiri', 5, 0);
    run(world, 30);
    expect(world.player.hp).toBe(80);
    world.player.hp = world.player.maxHp - 10;
    spawnPickup(world, 'onigiri', 5, 0);
    run(world, 30);
    expect(world.player.hp).toBe(world.player.maxHp);
  });

  it('招霊の鈴は、遠くの霊玉もすべて引き寄せる', () => {
    const world = disarm(makeWorld());
    const far = spawnPickup(world, 'gem', 600, 300, 1);
    spawnPickup(world, 'bell', 5, 0);
    run(world, 30);
    expect(far.pulled).toBe(true);
    run(world, 400);
    expect(world.player.xp).toBe(1);
  });

  it('大祓の札は画面内の妖怪を一掃し、大妖は体力を削るだけ', () => {
    const world = disarm(makeWorld());
    spawnEnemy(world, 'tanuki', 100, 0);
    spawnEnemy(world, 'tanuki', -120, 80);
    const outside = spawnEnemy(world, 'nurikabe', 900, 0);
    outside.cx = 900;
    const boss = spawnEnemy(world, 'kanabo', 150, 100);
    boss.frozen = 999;
    spawnPickup(world, 'nuke', 5, 0);
    const events = run(world, 30);
    expect(eventsOf(events, 'nuke')).toHaveLength(1);
    expect(world.run.kills).toBe(2);
    expect(outside.alive).toBe(true);
    expect(boss.alive).toBe(true);
    expect(boss.hp).toBeLessThan(boss.maxHp);
  });

  it('金縛りの札は妖怪の動きを止める', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'hitotsume', 200, 0);
    spawnPickup(world, 'freeze', 2, 0);
    const events = run(world, 20);
    expect(eventsOf(events, 'freeze')).toHaveLength(1);
    expect(world.freezeTicks).toBeGreaterThan(0);
    const x = e.x;
    run(world, 30);
    expect(e.x).toBe(x);
  });

  it('つづらを拾うと中身が決まって止まり、閉じると再開する', () => {
    const world = disarm(makeWorld());
    spawnPickup(world, 'chest', 5, 0);
    const events = run(world, 30);
    expect(world.phase).toBe('chest');
    expect(world.chest!.items.length).toBeGreaterThanOrEqual(1);
    expect(eventsOf(events, 'chest')).toHaveLength(1);
    expect(world.run.chests).toBe(1);
    closeChest(world);
    expect(world.phase).toBe('playing');
    expect(world.chest).toBeNull();
  });
});
