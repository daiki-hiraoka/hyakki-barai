import { describe, expect, it } from 'vitest';
import { disarm, eventsOf, makeWorld, run } from './testkit';
import { inView, spawnEnemy, spawnShot } from './world';

describe('追跡', () => {
  it('プレイヤーへ向かって自分の速度で進む', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'hitotsume', 100, 0);
    run(world, 60);
    // 一つ目小僧は 42 px/秒
    expect(e.x).toBeCloseTo(58, 3);
    expect(e.y).toBeCloseTo(0, 6);
    expect(e.facing).toBe(-1);
  });

  it('凍結中は動かず、解けると動き出す', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'hitotsume', 100, 0);
    e.frozen = 30;
    run(world, 30);
    expect(e.x).toBe(100);
    run(world, 10);
    expect(e.x).toBeLessThan(100);
  });

  it('金縛りの間は全員が動かない', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'hitotsume', 100, 0);
    world.freezeTicks = 20;
    run(world, 20);
    expect(e.x).toBe(100);
    expect(world.freezeTicks).toBe(0);
    run(world, 5);
    expect(e.x).toBeLessThan(100);
  });

  it('ノックバックで押され、やがて止まる', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'hitotsume', 100, 0);
    e.frozen = 200;
    e.kx = 3;
    run(world, 100);
    // 速度 3 が毎 tick 0.82 倍に減衰 → 合計およそ 3 / (1 - 0.82)
    expect(e.x).toBeGreaterThan(114);
    expect(e.x).toBeLessThan(118);
    expect(e.kx).toBe(0);
  });

  it('重なった敵同士は押し合って離れる', () => {
    const world = disarm(makeWorld());
    const a = spawnEnemy(world, 'hitotsume', 150, 0);
    const b = spawnEnemy(world, 'hitotsume', 150, 0);
    run(world, 90);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(6);
  });
});

describe('接触ダメージ', () => {
  it('触れるとダメージを受け、無敵時間のあいだは受けない', () => {
    const world = disarm(makeWorld());
    spawnEnemy(world, 'chochin', 0, 0);
    const events = run(world, 1);
    expect(world.player.hp).toBe(96);
    expect(eventsOf(events, 'playerHit')).toHaveLength(1);
    run(world, 19);
    expect(world.player.hp).toBe(96);
    run(world, 10);
    expect(world.player.hp).toBe(92);
  });

  it('防御は 1 発ごとに引かれ、最低でも 1 は受ける', () => {
    const tough = disarm(makeWorld({ character: 'goukai' }));
    spawnEnemy(tough, 'chochin', 0, 0);
    run(tough, 1);
    expect(tough.player.hp).toBe(tough.player.maxHp - 3);

    const iron = disarm(makeWorld({ shop: { armor: 99 } }));
    spawnEnemy(iron, 'chochin', 0, 0);
    run(iron, 1);
    expect(iron.player.hp).toBe(iron.player.maxHp - 1);
  });

  it('体力が尽きると dead になる', () => {
    const world = disarm(makeWorld());
    world.player.hp = 1;
    spawnEnemy(world, 'chochin', 0, 0);
    const events = run(world, 1);
    expect(world.phase).toBe('dead');
    expect(world.player.hp).toBe(0);
    expect(eventsOf(events, 'death')).toHaveLength(1);
  });

  it('復活があれば半分の体力で蘇り、周囲の敵を弾き飛ばす', () => {
    const world = disarm(makeWorld({ shop: { revives: 1 } }));
    world.player.hp = 1;
    const e = spawnEnemy(world, 'hitotsume', 6, 0);
    const events = run(world, 1);
    expect(world.phase).toBe('playing');
    expect(world.player.hp).toBe(50);
    expect(world.player.revivesLeft).toBe(0);
    expect(eventsOf(events, 'revive')).toHaveLength(1);
    run(world, 20);
    expect(e.x).toBeGreaterThan(20);
  });
});

describe('行動型', () => {
  it('直進型はまっすぐ進み、寿命で消える（何も落とさない）', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'wanyudo', -200, 50);
    e.dirX = 1;
    e.dirY = 0;
    e.life = 30;
    run(world, 10);
    expect(e.x).toBeCloseTo(-200 + (220 / 60) * 10, 3);
    expect(e.y).toBeCloseTo(50, 6);
    run(world, 25);
    expect(world.enemies.items).toHaveLength(0);
    expect(world.pickups.items).toHaveLength(0);
    expect(world.run.kills).toBe(0);
  });

  it('包囲型は決められた中心へ迫る', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'nurikabe', 150, 0);
    e.cx = 0;
    e.cy = 0;
    world.player.x = 0;
    run(world, 60);
    expect(e.x).toBeCloseTo(136, 3);
  });

  it('跳躍型は跳ぶ・休むを繰り返す', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'karakasa', 300, 0);
    let moving = 0;
    let resting = 0;
    for (let i = 0; i < 120; i++) {
      const before = e.x;
      run(world, 1);
      if (Math.abs(e.x - before) > 0.01) moving++;
      else resting++;
    }
    expect(moving).toBeGreaterThan(20);
    expect(resting).toBeGreaterThan(20);
  });

  it('遠距離型は間合いを取って弾を撃つ', () => {
    const world = disarm(makeWorld());
    spawnEnemy(world, 'rokuro', 120, 0);
    let shots = 0;
    for (let i = 0; i < 400; i++) {
      run(world, 1);
      shots = Math.max(shots, world.shots.items.length);
    }
    expect(shots).toBeGreaterThan(0);
  });

  it('突進型は予備動作のあと素早く突っ込む', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'tengu', 140, 0);
    let fastest = 0;
    for (let i = 0; i < 300; i++) {
      const bx = e.x;
      const by = e.y;
      run(world, 1);
      fastest = Math.max(fastest, Math.hypot(e.x - bx, e.y - by));
    }
    // 通常は 1 px/tick。突進はその 3 倍以上
    expect(fastest).toBeGreaterThan(3);
  });

  it('遠くに取り残された敵は画面の縁へ再配置される', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'hitotsume', 3000, 0);
    run(world, 1);
    expect(inView(world, e.x, e.y, 60)).toBe(true);
    expect(inView(world, e.x, e.y, 0)).toBe(false);
  });
});

describe('敵の弾', () => {
  it('当たるとダメージを与えて消える。雪玉は鈍足にする', () => {
    const world = disarm(makeWorld());
    const shot = spawnShot(world, 'shot.snow', 0, 0, 0, 0, 7);
    shot.slow = 90;
    run(world, 1);
    expect(world.player.hp).toBe(93);
    expect(world.player.slow).toBeGreaterThan(0);
    expect(world.shots.items).toHaveLength(0);
  });

  it('寿命が尽きると消える', () => {
    const world = disarm(makeWorld());
    spawnShot(world, 'shot.onibi', 200, 0, 1, 0, 5, 3, 10);
    run(world, 11);
    expect(world.shots.items).toHaveLength(0);
    expect(world.player.hp).toBe(100);
  });
});
