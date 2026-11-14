import { PF, type Enemy, type Projectile, type World } from '../types';
import { breakProp, breakPropsIn, damageArea, healPlayer, hitEnemy } from './combat';
import { emit, spawnProjectile } from './world';

const buf: Enemy[] = [];
const PI = Math.PI;
const TWO_PI = PI * 2;

/** 角度の差を -π〜π に収める */
function wrap(a: number): number {
  while (a > PI) a -= TWO_PI;
  while (a < -PI) a += TWO_PI;
  return a;
}

export function updateProjectiles(world: World): void {
  const list = world.projectiles.items;
  // この tick に生まれた弾（爆発が残す炎など）は次の tick から動かす
  const count = list.length;
  for (let i = 0; i < count; i++) {
    const p = list[i]!;
    if (!p.alive) continue;
    p.age++;
    switch (p.kind) {
      case 'bullet':
        bullet(world, p);
        break;
      case 'orbit':
        orbit(world, p);
        break;
      case 'lob':
        p.x += p.vx;
        p.y += p.vy;
        break;
      case 'zone':
        zone(world, p);
        break;
      case 'sweep':
        sweep(world, p);
        break;
      case 'ring':
        ring(world, p);
        break;
      case 'seeker':
        seeker(world, p);
        break;
      case 'boomerang':
        boomerang(world, p);
        break;
    }
    if (p.alive && --p.life <= 0) {
      if (p.kind === 'lob') explode(world, p);
      p.alive = false;
    }
  }
}

/**
 * 弾 p を敵 e に当てる。再ヒット間隔の内側なら何もしない。
 * hitInterval が 0 の弾は、同じ敵には 1 度しか当たらない。
 */
function tryHit(world: World, p: Projectile, e: Enemy, dirX: number, dirY: number): boolean {
  const last = p.hits.get(e.id);
  if (last !== undefined && (p.hitInterval === 0 || world.tick - last < p.hitInterval)) return false;
  p.hits.set(e.id, world.tick);
  const killed = hitEnemy(world, e, p.damage, p.weapon, p.knockback, dirX, dirY, p.crit);
  if (killed) {
    if (p.flags & PF.LEECH) healPlayer(world, 1);
  } else if (p.flags & PF.FREEZE && !e.boss) {
    e.frozen = Math.max(e.frozen, p.phase);
  }
  return true;
}

/** 弾が触れた石灯籠を壊す */
function hitProps(world: World, p: Projectile): void {
  for (const prop of world.props.items) {
    if (!prop.alive) continue;
    const dx = prop.x - p.x;
    const dy = prop.y - p.y;
    const rr = p.radius + prop.radius;
    if (dx * dx + dy * dy <= rr * rr) breakProp(world, prop);
  }
}

/** 目標へ向けて、1 tick に turn ラジアンまで向きを変える */
function steerTo(p: Projectile, tx: number, ty: number): void {
  const diff = wrap(Math.atan2(ty - p.y, tx - p.x) - p.angle);
  p.angle += Math.max(-p.turn, Math.min(p.turn, diff));
  p.vx = Math.cos(p.angle) * p.speed;
  p.vy = Math.sin(p.angle) * p.speed;
}

function validTarget(p: Projectile): Enemy | null {
  const t = p.target;
  return t && t.alive && t.id === p.targetId ? t : null;
}

function setTarget(p: Projectile, t: Enemy | null): void {
  p.target = t;
  p.targetId = t ? t.id : -1;
}

// ---- 直進・追尾する弾 -------------------------------------------------------

function bullet(world: World, p: Projectile): void {
  if (p.turn > 0) {
    let t = validTarget(p);
    if (!t) {
      t = world.grid.nearest(p.x, p.y, 140);
      setTarget(p, t);
    }
    if (t) steerTo(p, t.x, t.y);
  }
  p.x += p.vx;
  p.y += p.vy;

  const n = world.grid.query(p.x, p.y, p.radius, buf);
  if (n > 0) {
    const sp = Math.hypot(p.vx, p.vy) || 1;
    const dx = p.vx / sp;
    const dy = p.vy / sp;
    for (let i = 0; i < n; i++) {
      if (!tryHit(world, p, buf[i]!, dx, dy)) continue;
      if (p.pierce > 0 && --p.pierce === 0) {
        p.alive = false;
        return;
      }
    }
  }
  hitProps(world, p);
}

// ---- プレイヤーの周りを回る珠 -----------------------------------------------

function orbit(world: World, p: Projectile): void {
  const pl = world.player;
  p.angle += p.spin;
  p.x = pl.x + Math.cos(p.angle) * p.dist;
  p.y = pl.y + Math.sin(p.angle) * p.dist;
  const n = world.grid.query(p.x, p.y, p.radius, buf);
  for (let i = 0; i < n; i++) {
    const e = buf[i]!;
    const dx = e.x - pl.x;
    const dy = e.y - pl.y;
    const d = Math.hypot(dx, dy) || 1;
    tryHit(world, p, e, dx / d, dy / d);
  }
  hitProps(world, p);
}

// ---- 着弾して爆発する弾 -----------------------------------------------------

function explode(world: World, p: Projectile): void {
  damageArea(world, p.tx, p.ty, p.radius, p.damage, p.weapon, p.knockback, p.crit);
  emit(world, {
    t: 'fx', kind: 'explosion', x: p.tx, y: p.ty, r: p.radius,
    angle: 0, x2: 0, y2: 0, weapon: p.weapon,
  });
  if (p.flags & PF.BURN) {
    // 着弾点に燃え続ける炎を残す（phase に持続 tick、hitInterval に判定間隔が入っている）
    const z = spawnProjectile(world, 'zone', p.weapon, 'burn');
    z.x = p.tx;
    z.y = p.ty;
    z.radius = p.radius * 0.9;
    z.damage = p.damage * 0.3;
    z.life = p.phase;
    z.hitInterval = p.hitInterval;
    z.timer = p.hitInterval;
    z.pierce = -1;
    z.scale = p.scale;
  }
}

// ---- 地面に残る陣 -----------------------------------------------------------

function zone(world: World, p: Projectile): void {
  if (p.flags & PF.PULL) {
    const n = world.grid.query(p.x, p.y, p.radius * 1.25, buf);
    for (let i = 0; i < n; i++) {
      const e = buf[i]!;
      if (e.boss || e.def.kb <= 0) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d > 3) {
        e.x += (dx / d) * 0.45;
        e.y += (dy / d) * 0.45;
      }
    }
  }
  if (--p.timer > 0) return;
  p.timer = p.hitInterval;
  damageArea(world, p.x, p.y, p.radius, p.damage, p.weapon, p.knockback, p.crit);
}

// ---- 扇形のなぎ払い・斬撃 ---------------------------------------------------

function sweep(world: World, p: Projectile): void {
  const pl = world.player;
  p.x = pl.x;
  p.y = pl.y;
  const reach = p.dist;
  const full = (p.flags & PF.FULL) !== 0;
  const n = world.grid.query(p.x, p.y, reach, buf);
  for (let i = 0; i < n; i++) {
    const e = buf[i]!;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    // 密着している敵には向きに関係なく当てる（真横にいる敵を空振りしないため）
    if (!full && d > 12 && Math.abs(wrap(Math.atan2(dy, dx) - p.angle)) > p.spin) continue;
    tryHit(world, p, e, dx / d, dy / d);
  }
  if (p.age === 1) {
    if (full) breakPropsIn(world, p.x, p.y, reach);
    else {
      const half = reach / 2;
      breakPropsIn(world, p.x + Math.cos(p.angle) * half, p.y + Math.sin(p.angle) * half, half);
    }
  }
}

// ---- 広がる輪 ---------------------------------------------------------------

/** 輪の厚み。これより内側に取り残された敵には当たらない */
const RING_BAND = 10;

function ring(world: World, p: Projectile): void {
  p.dist += p.speed;
  const n = world.grid.query(p.x, p.y, p.dist, buf);
  for (let i = 0; i < n; i++) {
    const e = buf[i]!;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < p.dist - RING_BAND - e.radius) continue;
    tryHit(world, p, e, dx / d, dy / d);
  }
  breakPropsIn(world, p.x, p.y, p.dist);
}

// ---- 敵を追う式神 -----------------------------------------------------------

/** 式神がプレイヤーから離れてよい距離 */
const LEASH = 260;

function seeker(world: World, p: Projectile): void {
  const pl = world.player;
  let t = validTarget(p);
  if (t && Math.hypot(t.x - pl.x, t.y - pl.y) > LEASH) t = null;
  if (!t) {
    t = world.grid.nearest(p.x, p.y, 170, (e) => Math.hypot(e.x - pl.x, e.y - pl.y) <= LEASH);
    setTarget(p, t);
  }
  if (t) {
    steerTo(p, t.x, t.y);
  } else {
    // 敵がいないときはプレイヤーの周りを舞う
    const a = p.age * 0.05 + p.phase;
    steerTo(p, pl.x + Math.cos(a) * 34, pl.y + Math.sin(a) * 34);
  }
  p.x += p.vx;
  p.y += p.vy;

  const n = world.grid.query(p.x, p.y, p.radius, buf);
  for (let i = 0; i < n; i++) {
    const e = buf[i]!;
    const hit = tryHit(world, p, e, Math.cos(p.angle), Math.sin(p.angle));
    // 当てたら別の敵へ移る（1 体に張りつかず、群れ全体を削る）
    if (hit && e === t) setTarget(p, null);
  }

  if (p.flags & PF.COLLECT) {
    for (const k of world.pickups.items) {
      if (!k.alive || k.pulled || k.kind !== 'gem') continue;
      const dx = k.x - p.x;
      const dy = k.y - p.y;
      if (dx * dx + dy * dy < 14 * 14) k.pulled = true;
    }
  }
}

// ---- 行って戻る刃 -----------------------------------------------------------

function boomerang(world: World, p: Projectile): void {
  const pl = world.player;
  if (p.phase === 0) {
    // 行き：減速しながら飛ぶ（spin があれば渦を巻く）
    p.angle += p.spin;
    p.x += Math.cos(p.angle) * p.speed;
    p.y += Math.sin(p.angle) * p.speed;
    p.speed -= p.turn;
    if (p.speed <= 0) {
      p.phase = 1;
      p.speed = 0;
    }
  } else {
    // 帰り：加速しながらプレイヤーへ戻り、手元で消える
    const dx = pl.x - p.x;
    const dy = pl.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    p.speed = Math.min(8, p.speed + 0.22);
    if (d <= p.speed + 8) {
      p.alive = false;
      return;
    }
    p.x += (dx / d) * p.speed;
    p.y += (dy / d) * p.speed;
  }
  const n = world.grid.query(p.x, p.y, p.radius, buf);
  for (let i = 0; i < n; i++) {
    const e = buf[i]!;
    const dx = e.x - pl.x;
    const dy = e.y - pl.y;
    const d = Math.hypot(dx, dy) || 1;
    tryHit(world, p, e, dx / d, dy / d);
  }
  hitProps(world, p);
}
