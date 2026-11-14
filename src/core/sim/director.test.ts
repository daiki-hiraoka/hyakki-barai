import { describe, expect, it } from 'vitest';
import { ENEMIES } from '../data/enemies';
import { waveAt } from '../data/waves';
import type { RunConfig, World } from '../types';
import { skipTo } from './debug';
import { eventsOf, run } from './testkit';
import { createWorld, inView } from './world';

/** 湧きを有効にした世界。プレイヤーは武器なし・不死身にして、湧き方だけを観察する */
function observe(config: Partial<RunConfig> = {}): World {
  const world = createWorld({ seed: 3, ...config });
  world.player.weapons.length = 0;
  world.player.maxHp = 1e9;
  world.player.hp = 1e9;
  return world;
}

describe('通常の湧き', () => {
  it('画面の外に湧く', () => {
    const world = observe();
    const seen = new Set<number>();
    for (let i = 0; i < 300; i++) {
      run(world, 1);
      for (const e of world.enemies.items) {
        if (seen.has(e.id)) continue;
        seen.add(e.id);
        expect(inView(world, e.x, e.y, 0)).toBe(false);
      }
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('その時刻の波に含まれる妖怪だけが湧く', () => {
    const world = observe();
    run(world, 600);
    const allowed = new Set(waveAt(0).pool.map(([id]) => id));
    expect(world.enemies.items.length).toBeGreaterThan(0);
    for (const e of world.enemies.items) expect(allowed.has(e.def.id)).toBe(true);
  });

  it('下限を保ち、上限を超えない', () => {
    const world = observe();
    run(world, 30 * 60);
    const wave = waveAt(0);
    expect(world.enemies.items.length).toBeGreaterThanOrEqual(wave.min);
    expect(world.enemies.items.length).toBeLessThanOrEqual(wave.max + wave.batch);
  });

  it('夜が深まると体力が増える', () => {
    const world = observe();
    skipTo(world, 610);
    run(world, 120);
    const wave = waveAt(world.time);
    expect(wave.hp).toBeGreaterThan(1);
    const sample = world.enemies.items.find((e) => !e.boss && !e.elite && e.ai !== 'line')!;
    expect(sample.maxHp).toBe(Math.round(ENEMIES[sample.def.id].hp * wave.hp));
  });

  it('spawns: false なら何も湧かない', () => {
    const world = observe({ spawns: false });
    run(world, 1200);
    expect(world.enemies.items).toHaveLength(0);
    expect(world.props.items).toHaveLength(0);
  });

  it('石灯籠が時々置かれる', () => {
    const world = observe();
    run(world, 60 * 60);
    expect(world.props.items.length).toBeGreaterThanOrEqual(1);
    expect(world.props.items.length).toBeLessThanOrEqual(5);
  });
});

describe('時刻で起きる出来事', () => {
  it('大妖は決まった時刻に一度だけ現れる', () => {
    const world = observe();
    skipTo(world, 299);
    const events = run(world, 600);
    const spawns = eventsOf(events, 'bossSpawn');
    expect(spawns).toHaveLength(1);
    expect(spawns[0]!.enemy).toBe('kanabo');
    expect(world.enemies.items.filter((e) => e.boss)).toHaveLength(1);
  });

  it('鬼火の流れ：同じ向きに横切る群れが現れる', () => {
    const world = observe();
    skipTo(world, 89);
    const events = run(world, 120);
    expect(eventsOf(events, 'warn').map((w) => w.kind)).toContain('stream');
    const stream = world.enemies.items.filter((e) => e.def.id === 'onibi');
    expect(stream.length).toBeGreaterThanOrEqual(40);
    expect(new Set(stream.map((e) => `${e.dirX},${e.dirY}`)).size).toBe(1);
    for (const e of stream) expect(e.life).toBeGreaterThan(0);
  });

  it('精鋭：つづらを落とす強い個体が現れる', () => {
    const world = observe();
    skipTo(world, 179);
    run(world, 120);
    expect(world.enemies.items.some((e) => e.elite)).toBe(true);
  });

  it('塗り壁の包囲：プレイヤーを取り囲む輪が現れる', () => {
    const world = observe();
    skipTo(world, 419);
    const events = run(world, 90);
    expect(eventsOf(events, 'warn').map((w) => w.kind)).toContain('ring');
    const walls = world.enemies.items.filter((e) => e.def.id === 'nurikabe');
    expect(walls).toHaveLength(32);
    for (const e of walls) {
      const d = Math.hypot(e.x - e.cx, e.y - e.cy);
      expect(d).toBeGreaterThan(150);
      expect(d).toBeLessThan(200);
    }
  });

  it('輪入道の暴走：予告の線のあと、順番に駆け抜ける', () => {
    const world = observe();
    skipTo(world, 509);
    run(world, 70);
    const wheels = world.enemies.items.filter((e) => e.def.id === 'wanyudo');
    expect(wheels).toHaveLength(6);
    expect(new Set(wheels.map((e) => e.aiTimer)).size).toBe(6);
    expect(world.hazards.items.filter((h) => h.kind === 'line')).toHaveLength(6);
  });

  it('丑三つ時：闇が深まる', () => {
    const world = observe();
    skipTo(world, 779);
    const events = run(world, 90);
    expect(eventsOf(events, 'warn').map((w) => w.kind)).toContain('dark');
    expect(world.director.darkTicks).toBeGreaterThan(0);
  });

  it('百鬼夜行：大行列が横切る', () => {
    const world = observe();
    skipTo(world, 781);
    const before = world.enemies.items.length;
    const events = run(world, 90);
    expect(eventsOf(events, 'warn').map((w) => w.kind)).toContain('parade');
    const marchers = world.enemies.items.filter((e) => e.ai === 'line');
    expect(marchers.length).toBeGreaterThanOrEqual(140);
    expect(world.enemies.items.length - before).toBeGreaterThanOrEqual(140);
  });

  it('餓鬼の大群：一斉に押し寄せる', () => {
    const world = observe();
    skipTo(world, 839);
    run(world, 90);
    expect(world.enemies.items.filter((e) => e.def.id === 'gaki').length).toBeGreaterThanOrEqual(80);
  });
});

describe('夜明け', () => {
  it('時間になると妖怪が消え、勝利になる', () => {
    const world = observe({ duration: 5 });
    const events = run(world, 5 * 60 + 400);
    expect(eventsOf(events, 'dawn')).toHaveLength(1);
    expect(eventsOf(events, 'victory')).toHaveLength(1);
    expect(world.phase).toBe('victory');
    expect(world.enemies.items).toHaveLength(0);
    // 夜明けで消えた妖怪は撃破数に数えない
    expect(world.run.kills).toBe(0);
    // 経過時間は夜の長さで止まる
    expect(world.time).toBeCloseTo(5, 1);
  });
});
