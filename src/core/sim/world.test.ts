import { describe, expect, it } from 'vitest';
import { PLAYER_SPEED } from '../constants';
import { xpToNext } from './leveling';
import { IDLE, makeWorld, run } from './testkit';
import { createWorld } from './world';

describe('createWorld', () => {
  it('祓い手は初期武器 Lv1 と満タンの体力で始まる', () => {
    const world = createWorld({ character: 'goukai' });
    const p = world.player;
    expect(world.phase).toBe('playing');
    expect(p.weapons).toHaveLength(1);
    expect(p.weapons[0]!.def.id).toBe('shakujo');
    expect(p.weapons[0]!.level).toBe(1);
    expect(p.maxHp).toBe(140);
    expect(p.hp).toBe(140);
    expect(p.level).toBe(1);
    expect(p.xpNext).toBe(xpToNext(1));
  });

  it('社の加護が能力値と回数に反映される', () => {
    const world = createWorld({ character: 'haruma', shop: { hp: 2, revives: 1, rerolls: 2, skips: 3 } });
    expect(world.player.maxHp).toBe(120);
    expect(world.player.revivesLeft).toBe(1);
    expect(world.player.rerollsLeft).toBe(2);
    expect(world.player.skipsLeft).toBe(3);
  });
});

describe('プレイヤーの移動', () => {
  it('1 秒で移動速度ぶん進み、向きが変わる', () => {
    const world = makeWorld();
    run(world, 60, { mx: 1, my: 0 });
    expect(world.player.x).toBeCloseTo(PLAYER_SPEED, 3);
    expect(world.player.y).toBeCloseTo(0, 6);
    expect(world.player.dir).toBe(1);
    expect(world.player.moving).toBe(true);
    expect(world.time).toBeCloseTo(1);

    run(world, 10, { mx: -1, my: 0 });
    expect(world.player.dir).toBe(-1);
    expect(world.player.faceX).toBeCloseTo(-1);
  });

  it('長さが 1 を超える入力は 1 に丸める（斜めが速くならない）', () => {
    const world = makeWorld();
    run(world, 60, { mx: 1, my: 1 });
    const dist = Math.hypot(world.player.x, world.player.y);
    expect(dist).toBeCloseTo(PLAYER_SPEED, 3);
  });

  it('止まっているときは向きを保つ', () => {
    const world = makeWorld();
    run(world, 5, { mx: 0, my: -1 });
    run(world, 5, IDLE);
    expect(world.player.faceY).toBeCloseTo(-1);
    expect(world.player.moving).toBe(false);
  });

  it('移動速度の能力値が効く', () => {
    const world = makeWorld({ character: 'kon' });
    run(world, 60, { mx: 1, my: 0 });
    expect(world.player.x).toBeCloseTo(PLAYER_SPEED * 1.08, 3);
  });

  it('自然回復は最大体力を超えない', () => {
    const world = makeWorld({ character: 'chihaya' });
    world.player.hp = 50;
    run(world, 630);
    // 千早は毎秒 0.3 回復 → 10.5 秒で 3（次の回復は 13.3 秒後）
    expect(world.player.hp).toBe(53);
    world.player.hp = world.player.maxHp;
    run(world, 600);
    expect(world.player.hp).toBe(world.player.maxHp);
  });
});

describe('xpToNext', () => {
  it('レベルが上がるほど必要な経験値が増える', () => {
    expect(xpToNext(1)).toBe(5);
    for (let lv = 1; lv < 80; lv++) expect(xpToNext(lv + 1)).toBeGreaterThan(xpToNext(lv));
  });
});
