import type { Hazard, Player, World } from '../types';
import { damagePlayer } from './combat';
import { emit } from './world';

/** 敵の弾を進め、プレイヤーに当たったらダメージを与える */
export function updateShots(world: World): void {
  const p = world.player;
  for (const s of world.shots.items) {
    if (!s.alive) continue;
    s.age++;
    s.x += s.vx;
    s.y += s.vy;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const rr = s.radius + p.radius;
    if (dx * dx + dy * dy <= rr * rr) {
      if (p.iframes === 0) {
        damagePlayer(world, s.damage);
        if (s.slow > 0) p.slow = Math.max(p.slow, s.slow);
      }
      s.alive = false;
      continue;
    }
    if (--s.life <= 0) s.alive = false;
  }
}

function inside(p: Player, h: Hazard): boolean {
  const dx = p.x - h.x;
  const dy = p.y - h.y;
  const rr = h.radius + p.radius * 0.5;
  return dx * dx + dy * dy <= rr * rr;
}

/**
 * 予告つきの危険地帯を進める。
 * delay の間は予告（見えるだけ）。0 になった瞬間に発動し、その後 life の間だけ残る。
 */
export function updateHazards(world: World): void {
  const p = world.player;
  for (const h of world.hazards.items) {
    if (!h.alive) continue;
    if (h.delay > 0) {
      if (--h.delay > 0) continue;
      // 発動の瞬間
      if (h.kind === 'slam' || h.kind === 'bone') {
        if (inside(p, h)) damagePlayer(world, h.damage);
        emit(world, {
          t: 'fx', kind: 'shockwave', x: h.x, y: h.y, r: h.radius,
          angle: 0, x2: 0, y2: 0, weapon: null,
        });
      }
      continue;
    }
    if (h.kind === 'web') {
      // 蜘蛛の巣は踏んでいる間だけ足を鈍らせる
      if (inside(p, h)) p.slow = Math.max(p.slow, 20);
    } else if (h.kind === 'fire') {
      if (inside(p, h)) damagePlayer(world, h.damage);
    }
    if (--h.life <= 0) h.alive = false;
  }
}
