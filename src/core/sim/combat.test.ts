import { describe, expect, it } from 'vitest';
import { MAX_GEMS } from '../constants';
import { damageArea, dropGem, hitEnemy } from './combat';
import { disarm, eventsOf, makeWorld, run } from './testkit';
import { spawnEnemy, spawnProp } from './world';

describe('hitEnemy', () => {
  it('体力を減らし、hit を出し、武器ごとの与ダメージを集計する', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'hitotsume', 100, 0);
    expect(hitEnemy(world, e, 4, 'reifu')).toBe(false);
    expect(e.hp).toBe(6);
    expect(e.flash).toBeGreaterThan(0);
    const hits = eventsOf(world.events, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ dmg: 4, crit: false, weapon: 'reifu' });
    expect(world.run.damage.reifu).toBe(4);
  });

  it('倒すと霊玉を落とし、撃破数が増え、次の tick で取り除かれる', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'hitotsume', 100, 0);
    hitEnemy(world, e, 4, 'reifu');
    expect(hitEnemy(world, e, 10, 'reifu')).toBe(true);
    expect(e.alive).toBe(false);
    expect(world.run.kills).toBe(1);
    // 与ダメージは残り体力まで（倒しすぎた分は数えない）
    expect(world.run.damage.reifu).toBe(10);
    expect(eventsOf(world.events, 'kill')).toHaveLength(1);
    const gems = world.pickups.items.filter((k) => k.kind === 'gem');
    expect(gems).toHaveLength(1);
    expect(gems[0]).toMatchObject({ x: 100, y: 0, value: 1 });
    run(world, 1);
    expect(world.enemies.items).toHaveLength(0);
  });

  it('会心は 2 倍のダメージになる', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'tanuki', 100, 0);
    hitEnemy(world, e, 10, 'katana', 0, 0, 0, 1);
    expect(e.hp).toBe(55 - 20);
    expect(eventsOf(world.events, 'hit')[0]!.crit).toBe(true);
  });

  it('ノックバックは妖怪ごとの受けやすさに従う', () => {
    const world = disarm(makeWorld());
    const light = spawnEnemy(world, 'hitotsume', 100, 0);
    const heavy = spawnEnemy(world, 'wanyudo', 100, 50);
    hitEnemy(world, light, 1, 'shakujo', 5, 1, 0);
    hitEnemy(world, heavy, 1, 'shakujo', 5, 1, 0);
    expect(light.kx).toBeCloseTo(5);
    expect(heavy.kx).toBe(0);
  });
});

describe('damageArea', () => {
  it('円に触れる敵すべてに当たり、当たった数を返す', () => {
    const world = disarm(makeWorld());
    const a = spawnEnemy(world, 'tanuki', 10, 0);
    const b = spawnEnemy(world, 'tanuki', 34, 0);
    const c = spawnEnemy(world, 'tanuki', 100, 0);
    world.grid.rebuild(world.enemies.items, 0, 0);
    expect(damageArea(world, 0, 0, 30, 5, 'kitsunebi')).toBe(2);
    expect(a.hp).toBe(50);
    expect(b.hp).toBe(50);
    expect(c.hp).toBe(55);
  });

  it('範囲内の石灯籠を壊し、中身を落とす', () => {
    const world = disarm(makeWorld());
    spawnProp(world, 20, 0);
    world.grid.rebuild(world.enemies.items, 0, 0);
    damageArea(world, 0, 0, 30, 5, 'kitsunebi');
    expect(world.props.items[0]!.alive).toBe(false);
    expect(eventsOf(world.events, 'propBreak')).toHaveLength(1);
    expect(world.pickups.items.length).toBeGreaterThan(0);
  });
});

describe('撃破時の出来事', () => {
  it('泥田坊は倒されると 3 体に分かれる', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'dorotabo', 100, 0);
    hitEnemy(world, e, 9999, 'reifu');
    const kids = world.enemies.items.filter((x) => x.alive && x.def.id === 'dorotabo_s');
    expect(kids).toHaveLength(3);
  });

  it('精鋭はつづらを落とす', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'kappa', 100, 0, { elite: true });
    expect(e.maxHp).toBeGreaterThan(30 * 5);
    hitEnemy(world, e, 99999, 'reifu');
    expect(world.pickups.items.some((k) => k.kind === 'chest')).toBe(true);
  });

  it('大妖はつづらを落とし、討伐が記録される', () => {
    const world = disarm(makeWorld());
    const e = spawnEnemy(world, 'kanabo', 100, 0);
    expect(e.boss).toBe(true);
    hitEnemy(world, e, 999999, 'reifu');
    expect(world.run.bossKills).toEqual(['kanabo']);
    expect(eventsOf(world.events, 'bossKill')).toHaveLength(1);
    expect(world.pickups.items.some((k) => k.kind === 'chest')).toBe(true);
  });
});

describe('霊玉の上限', () => {
  it('上限を超えた分は 1 つの玉にまとめ、経験値の合計は変わらない', () => {
    const world = disarm(makeWorld());
    const total = MAX_GEMS + 80;
    for (let i = 0; i < total; i++) dropGem(world, 500 + i, 500, 2);
    const gems = world.pickups.items.filter((k) => k.kind === 'gem');
    expect(gems.length).toBeLessThanOrEqual(MAX_GEMS + 1);
    expect(gems.reduce((s, g) => s + g.value, 0)).toBe(total * 2);
  });
});
