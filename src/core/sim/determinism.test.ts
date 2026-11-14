import { describe, expect, it } from 'vitest';
import { botChoose, botInput } from '../bot/bot';
import type { World } from '../types';
import { hashWorld } from './hash';
import { step } from './step';
import { chooseUpgrade, closeChest } from './upgrades';
import { createWorld } from './world';

/** ボットに操作させて n tick 進める（選択肢やつづらもボットが処理する） */
function autoplay(world: World, n: number): void {
  for (let i = 0; i < n; i++) {
    if (world.phase === 'levelup') chooseUpgrade(world, botChoose(world));
    else if (world.phase === 'chest') closeChest(world);
    else if (world.phase !== 'playing' && world.phase !== 'dawn') return;
    step(world, botInput(world));
  }
}

describe('決定性', () => {
  it('同じシードと同じ操作なら、まったく同じ状態になる', () => {
    const a = createWorld({ seed: 42, character: 'chihaya' });
    const b = createWorld({ seed: 42, character: 'chihaya' });
    autoplay(a, 1500);
    autoplay(b, 1500);
    expect(hashWorld(a)).toBe(hashWorld(b));
    expect(a.run.kills).toBe(b.run.kills);
  });

  it('シードが違えば展開も変わる', () => {
    const a = createWorld({ seed: 1 });
    const b = createWorld({ seed: 2 });
    autoplay(a, 900);
    autoplay(b, 900);
    expect(hashWorld(a)).not.toBe(hashWorld(b));
  });
});

describe('通し走行', () => {
  it('ボットが 3 分間遊んでも、数値が壊れない', () => {
    const world = createWorld({ seed: 11, character: 'haruma', shop: { revives: 1 } });
    autoplay(world, 3 * 60 * 60);
    const p = world.player;
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
    expect(p.hp).toBeLessThanOrEqual(p.maxHp);
    expect(p.weapons.length).toBeLessThanOrEqual(6);
    expect(p.passives.length).toBeLessThanOrEqual(6);
    for (const e of world.enemies.items) {
      expect(Number.isFinite(e.x) && Number.isFinite(e.y), e.def.id).toBe(true);
    }
    for (const proj of world.projectiles.items) {
      expect(Number.isFinite(proj.x) && Number.isFinite(proj.y), proj.visual).toBe(true);
    }
    expect(world.run.kills).toBeGreaterThan(20);
    expect(p.level).toBeGreaterThan(3);
  });
});
