import type { Enemy, Pickup, SimInput, Upgrade, World } from '../types';

/**
 * 自動操縦。人の代わりに遊ばせて、バランスの検証や画面のデモに使う。
 * 上手なプレイヤーではなく「そこそこ逃げて、そこそこ拾う」程度の腕前を狙っている
 * （この腕前で 10 分前後、慣れた人なら夜明けまで、を調整の目安にするため）。
 */

const near: Enemy[] = [];
const out: SimInput = { mx: 0, my: 0 };

/** 妖怪を避け始める距離（体の縁どうしの間隔）と、落とし物を探しに行く距離 */
const WATCH = 46;
const SEEK = 260;

export function botInput(world: World): SimInput {
  const p = world.player;
  let fx = 0;
  let fy = 0;
  let danger = 0;

  // すぐそばの妖怪から離れる。遠くの群れは気にせず、隙間を縫って霊玉を拾いに行けるようにする
  const n = world.grid.query(p.x, p.y, WATCH + p.radius, near);
  for (let i = 0; i < n; i++) {
    const e = near[i]!;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const raw = Math.hypot(dx, dy) || 1;
    const gap = Math.max(0, raw - e.radius - p.radius);
    if (gap >= WATCH) continue;
    const k = (WATCH - gap) / WATCH;
    const w = k * k * (e.boss ? 4 : 1) * 2.4;
    fx += (dx / raw) * w;
    fy += (dy / raw) * w;
    danger += w;
  }

  // 予告つきの危険地帯から出る
  for (const h of world.hazards.items) {
    if (!h.alive || h.kind === 'line') continue;
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < h.radius + 18) {
      fx += (dx / d) * 6;
      fy += (dy / d) * 6;
      danger += 2;
    }
  }

  // 敵の弾は、飛んでくる向きと直角に避ける
  for (const s of world.shots.items) {
    if (!s.alive) continue;
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d > 60) continue;
    const sv = Math.hypot(s.vx, s.vy) || 1;
    const side = dx * -s.vy + dy * s.vx > 0 ? 1 : -1;
    fx += (-s.vy / sv) * side * 2.5;
    fy += (s.vx / sv) * side * 2.5;
  }

  // 近くの落とし物へ向かう（つづらとアイテムは霊玉より優先）
  let best: Pickup | null = null;
  let bestScore = Infinity;
  for (const k of world.pickups.items) {
    if (!k.alive || k.pulled) continue;
    const d = Math.hypot(k.x - p.x, k.y - p.y);
    if (d > SEEK) continue;
    // 大きな霊玉・アイテム・つづらほど、遠くても取りに行く
    const weight = k.kind === 'chest' ? 0.25 : k.kind !== 'gem' ? 0.4 : k.tier === 2 ? 0.45 : k.tier === 1 ? 0.7 : 1;
    const score = d * weight;
    if (score < bestScore) {
      bestScore = score;
      best = k;
    }
  }
  if (best) {
    const dx = best.x - p.x;
    const dy = best.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    // 囲まれて避ける向きが打ち消し合ったときは、拾いに行く向きが勝つ（＝押し通る）
    const pull = danger < 0.6 ? 1.6 : 1;
    fx += (dx / d) * pull;
    fy += (dy / d) * pull;
  }

  // 立ち止まらないよう、ゆるく円を描く
  const t = world.time * 0.35;
  fx += Math.cos(t) * 0.25;
  fy += Math.sin(t) * 0.25;

  const len = Math.hypot(fx, fy);
  out.mx = len > 0.001 ? fx / len : 0;
  out.my = len > 0.001 ? fy / len : 0;
  return out;
}

function score(world: World, u: Upgrade): number {
  const p = world.player;
  switch (u.kind) {
    case 'weapon':
      // 手数が少ないうちは新しい武器、揃ったら強化を優先
      return u.isNew ? (p.weapons.length < 3 ? 6 : 3.5) : 5;
    case 'passive': {
      const wanted = p.weapons.some((w) => w.def.requires === u.id);
      return wanted ? 5.5 : u.isNew ? 2 : 2.5;
    }
    case 'evolve':
      return 10;
    default:
      return 0;
  }
}

/** レベルアップの選択肢から 1 つ選ぶ */
export function botChoose(world: World): number {
  const offer = world.offer;
  if (!offer) return 0;
  let best = 0;
  let bestScore = -1;
  offer.forEach((u, i) => {
    const s = score(world, u);
    if (s > bestScore) {
      bestScore = s;
      best = i;
    }
  });
  return best;
}
