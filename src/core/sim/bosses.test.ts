import { describe, expect, it } from 'vitest';
import type { EnemyId, World } from '../types';
import { disarm, makeWorld, run } from './testkit';
import { spawnEnemy } from './world';

/** 大妖を 1 体だけ置いた世界。プレイヤーは不死身にして、技の出方だけを観察する */
function arena(boss: EnemyId, x = 260, y = 0): World {
  const world = disarm(makeWorld());
  world.player.maxHp = 1e9;
  world.player.hp = 1e9;
  spawnEnemy(world, boss, x, y);
  return world;
}

/** n tick の間に一度でも条件を満たしたか */
function ever(world: World, n: number, check: () => boolean): boolean {
  let seen = false;
  for (let i = 0; i < n; i++) {
    run(world, 1);
    if (check()) seen = true;
  }
  return seen;
}

describe('金棒鬼', () => {
  it('プレイヤーの足元に予告つきの叩きつけを出す', () => {
    const world = arena('kanabo');
    expect(ever(world, 400, () => world.hazards.items.some((h) => h.kind === 'slam'))).toBe(true);
  });

  it('叩きつけは範囲内にいると当たり、離れれば当たらない', () => {
    const stay = arena('kanabo', 600, 0);
    let slam = false;
    for (let i = 0; i < 400 && !slam; i++) {
      run(stay, 1);
      slam = stay.hazards.items.some((h) => h.kind === 'slam');
    }
    const hpBefore = stay.player.hp;
    run(stay, 80);
    expect(stay.player.hp).toBeLessThan(hpBefore);

    const flee = arena('kanabo', 600, 0);
    slam = false;
    for (let i = 0; i < 400 && !slam; i++) {
      run(flee, 1);
      slam = flee.hazards.items.some((h) => h.kind === 'slam');
    }
    const hp = flee.player.hp;
    // 予告を見て大妖と反対側へ逃げる
    run(flee, 80, { mx: -1, my: 0 });
    expect(flee.player.hp).toBe(hp);
  });
});

describe('土蜘蛛', () => {
  it('鈍足の糸玉を吐き、子蜘蛛を産み、巣を張る', () => {
    const world = arena('tsuchigumo');
    let shots = false;
    let kids = false;
    let web = false;
    for (let i = 0; i < 900; i++) {
      run(world, 1);
      shots ||= world.shots.items.some((s) => s.slow > 0);
      kids ||= world.enemies.items.some((e) => e.def.id === 'kogumo');
      web ||= world.hazards.items.some((h) => h.kind === 'web');
    }
    expect(shots).toBe(true);
    expect(kids).toBe(true);
    expect(web).toBe(true);
  });
});

describe('がしゃどくろ', () => {
  it('骨の雨を降らせ、骸骨武者を呼ぶ', () => {
    const world = arena('gasha');
    let rain = 0;
    let summoned = false;
    for (let i = 0; i < 900; i++) {
      run(world, 1);
      rain = Math.max(rain, world.hazards.items.filter((h) => h.kind === 'bone').length);
      summoned ||= world.enemies.items.some((e) => e.def.id === 'gaikotsu');
    }
    expect(rain).toBeGreaterThanOrEqual(4);
    expect(summoned).toBe(true);
  });
});

describe('酒呑童子', () => {
  it('予告のあと突進し、鬼火を渦状に吐き、鬼を呼ぶ', () => {
    const world = arena('shuten');
    const boss = world.enemies.items[0]!;
    let telegraph = false;
    let fastest = 0;
    let shots = 0;
    let oni = false;
    for (let i = 0; i < 1200; i++) {
      const bx = boss.x;
      const by = boss.y;
      run(world, 1);
      telegraph ||= world.hazards.items.some((h) => h.kind === 'line');
      fastest = Math.max(fastest, Math.hypot(boss.x - bx, boss.y - by));
      shots = Math.max(shots, world.shots.items.length);
      oni ||= world.enemies.items.some((e) => e.def.id === 'oni_red' || e.def.id === 'oni_blue');
    }
    expect(telegraph).toBe(true);
    expect(fastest).toBeGreaterThan(4);
    expect(shots).toBeGreaterThan(6);
    expect(oni).toBe(true);
  });
});
