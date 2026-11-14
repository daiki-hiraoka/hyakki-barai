import type { World } from '../types';

/**
 * 世界の状態を 1 つの数に要約する（FNV-1a）。
 * 「同じシードと同じ入力なら同じ結果になる」ことを確かめるためのもの。
 */
export function hashWorld(world: World): number {
  let h = 2166136261;
  const mix = (value: number): void => {
    h ^= Math.round(value * 100) | 0;
    h = Math.imul(h, 16777619);
  };
  const p = world.player;
  mix(world.tick);
  mix(world.rng.state);
  mix(p.x);
  mix(p.y);
  mix(p.hp);
  mix(p.level);
  mix(p.xp);
  mix(world.run.kills);
  mix(world.run.gold);
  mix(world.enemies.items.length);
  for (const e of world.enemies.items) {
    mix(e.x);
    mix(e.y);
    mix(e.hp);
  }
  mix(world.projectiles.items.length);
  for (const proj of world.projectiles.items) {
    mix(proj.x);
    mix(proj.y);
  }
  mix(world.pickups.items.length);
  for (const k of world.pickups.items) {
    mix(k.x);
    mix(k.y);
    mix(k.value);
  }
  return h >>> 0;
}
