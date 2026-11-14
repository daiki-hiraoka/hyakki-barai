import type { Enemy, World } from '../types';
import { updateBoss } from './bosses';
import { damagePlayer } from './combat';
import { edgePoint, emit, spawnShot } from './world';

const buf: Enemy[] = [];
const TWO_PI = Math.PI * 2;

/** ノックバック速度の毎 tick の減衰率 */
const KNOCKBACK_DECAY = 0.82;
/** 画面からこれだけ離れた敵は、画面の縁へ置き直す（置き去りにしても密度が保たれる） */
const FAR_MARGIN = 300;

export function updateEnemies(world: World): void {
  const p = world.player;
  const stopped = world.freezeTicks > 0;
  if (stopped) world.freezeTicks--;
  // 丑三つ時は妖怪が活気づく
  const haste = world.director.darkTicks > 0 ? 1.15 : 1;
  const farX = world.view.hw + FAR_MARGIN;
  const farY = world.view.hh + FAR_MARGIN;

  const list = world.enemies.items;
  // この tick に湧いた敵（分裂や大妖の手下）は次の tick から動かす
  const count = list.length;
  for (let i = 0; i < count; i++) {
    const e = list[i]!;
    if (!e.alive) continue;
    e.age++;
    if (e.flash > 0) e.flash--;
    if (e.life > 0 && --e.life === 0) {
      // 寿命で去る（横切るだけの群れなど）。何も落とさない
      e.alive = false;
      continue;
    }

    if (e.frozen > 0) {
      e.frozen--;
    } else if (!stopped) {
      let sp = e.speed * haste;
      if (e.slow > 0) {
        e.slow--;
        sp *= 0.5;
      }
      move(world, e, sp);
    }

    if (e.kx !== 0 || e.ky !== 0) {
      e.x += e.kx;
      e.y += e.ky;
      e.kx *= KNOCKBACK_DECAY;
      e.ky *= KNOCKBACK_DECAY;
      if (Math.abs(e.kx) < 0.02) e.kx = 0;
      if (Math.abs(e.ky) < 0.02) e.ky = 0;
    }

    if (!e.boss && e.ai !== 'line') separate(world, e);

    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const rr = e.radius + p.radius;
    if (dx * dx + dy * dy < rr * rr) {
      damagePlayer(world, e.damage);
    } else if (e.life < 0 && e.ai !== 'ring') {
      const margin = e.boss ? 200 : 0;
      if (Math.abs(dx) > farX + margin || Math.abs(dy) > farY + margin) {
        const pt = edgePoint(world, 10);
        e.x = pt.x;
        e.y = pt.y;
      }
    }
  }
}

function move(world: World, e: Enemy, sp: number): void {
  switch (e.ai) {
    case 'chase':
      chase(world, e, sp);
      break;
    case 'hop':
      hop(world, e, sp);
      break;
    case 'line':
      line(e, sp);
      break;
    case 'sine':
      sine(world, e, sp);
      break;
    case 'zigzag':
      zigzag(world, e, sp);
      break;
    case 'charge':
      charge(world, e, sp);
      break;
    case 'ranged':
      ranged(world, e, sp);
      break;
    case 'ring':
      ring(e, sp);
      break;
    default:
      updateBoss(world, e, sp);
  }
}

/** プレイヤーへまっすぐ向かう。触れる距離まで来たら止まり、重ならずに取り囲む */
export function chase(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d > (e.radius + p.radius) * 0.7) {
    e.x += (dx / d) * sp;
    e.y += (dy / d) * sp;
  }
  if (Math.abs(dx) > 0.5) e.facing = dx > 0 ? 1 : -1;
}

/** 跳ぶ・休むを繰り返す。跳ぶ向きは踏み切りの瞬間に決める */
function hop(world: World, e: Enemy, sp: number): void {
  const CYCLE = 50;
  const AIR = 24;
  const t = (e.age + Math.floor(e.seed * CYCLE)) % CYCLE;
  if (t === 0 || (e.dirX === 0 && e.dirY === 0)) {
    const p = world.player;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.dirX = dx / d;
    e.dirY = dy / d;
    if (Math.abs(dx) > 0.5) e.facing = dx > 0 ? 1 : -1;
  }
  e.aiState = t < AIR ? 1 : 0;
  if (t < AIR) {
    e.x += e.dirX * sp * 2.1;
    e.y += e.dirY * sp * 2.1;
  }
}

/** 決められた向きへ直進する。aiTimer が残っている間は出番待ち */
function line(e: Enemy, sp: number): void {
  if (e.aiTimer > 0) {
    e.aiTimer--;
    return;
  }
  e.x += e.dirX * sp;
  e.y += e.dirY * sp;
  if (e.def.id === 'onibi') {
    // 鬼火は進行方向と直角にゆらめく
    const w = Math.cos(e.age * 0.12 + e.seed * TWO_PI) * 0.55;
    e.x += -e.dirY * w;
    e.y += e.dirX * w;
  }
  if (Math.abs(e.dirX) > 0.1) e.facing = e.dirX > 0 ? 1 : -1;
}

/** うねりながら向かってくる */
function sine(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < 1) return;
  const nx = dx / d;
  const ny = dy / d;
  const wob = Math.sin(e.age * 0.09 + e.seed * TWO_PI) * sp * 1.2;
  e.x += nx * sp - ny * wob;
  e.y += ny * sp + nx * wob;
  e.facing = dx > 0 ? 1 : -1;
}

/** 左右に切り返しながら向かってくる。近づいたらまっすぐ飛びかかる */
function zigzag(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy);
  if (d < (e.radius + p.radius) * 0.7) return;
  let ang = Math.atan2(dy, dx);
  if (d > 44) ang += Math.floor((e.age + e.seed * 80) / 40) % 2 === 0 ? 0.75 : -0.75;
  e.x += Math.cos(ang) * sp;
  e.y += Math.sin(ang) * sp;
  if (Math.abs(dx) > 0.5) e.facing = dx > 0 ? 1 : -1;
}

/** 近づく → 溜める → 一直線に突っ込む → 息を整える */
function charge(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  switch (e.aiState) {
    case 0: {
      chase(world, e, sp);
      if (e.aiTimer > 0) {
        e.aiTimer--;
        break;
      }
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const d = Math.hypot(dx, dy);
      if (d < 150 && d > 30) {
        e.aiState = 1;
        e.aiTimer = 36;
        e.dirX = dx / d;
        e.dirY = dy / d;
        emit(world, {
          t: 'fx', kind: 'charge', x: e.x, y: e.y, r: e.radius,
          angle: Math.atan2(dy, dx), x2: 0, y2: 0, weapon: null,
        });
      }
      break;
    }
    case 1:
      if (--e.aiTimer <= 0) {
        e.aiState = 2;
        e.aiTimer = 30;
      }
      break;
    case 2:
      e.x += e.dirX * sp * 4.2;
      e.y += e.dirY * sp * 4.2;
      if (Math.abs(e.dirX) > 0.1) e.facing = e.dirX > 0 ? 1 : -1;
      if (--e.aiTimer <= 0) {
        e.aiState = 3;
        e.aiTimer = 70;
      }
      break;
    default:
      chase(world, e, sp * 0.6);
      if (--e.aiTimer <= 0) {
        e.aiState = 0;
        e.aiTimer = 50;
      }
  }
}

/** 間合いを保ち、横へ回り込みながら弾を撃つ */
function ranged(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  const nx = dx / d;
  const ny = dy / d;
  if (d > 135) {
    e.x += nx * sp;
    e.y += ny * sp;
  } else if (d < 85) {
    e.x -= nx * sp * 0.6;
    e.y -= ny * sp * 0.6;
  } else {
    const side = e.seed < 0.5 ? 1 : -1;
    e.x += -ny * sp * 0.5 * side;
    e.y += nx * sp * 0.5 * side;
  }
  e.facing = dx > 0 ? 1 : -1;

  // 湧いてすぐには撃たない
  if (e.age === 1) e.aiTimer = 70;
  if (e.aiTimer > 0) {
    e.aiTimer--;
    return;
  }
  if (d > 240) return;
  e.aiTimer = 150 + Math.floor(world.rng.next() * 70);
  if (e.def.id === 'yukionna') {
    const shot = spawnShot(world, 'shot.snow', e.x, e.y - e.radius, nx * 1.05, ny * 1.05, e.damage * 0.8, 4);
    shot.slow = 100;
  } else {
    spawnShot(world, 'shot.onibi', e.x, e.y - e.radius, nx * 1.25, ny * 1.25, e.damage, 3);
  }
}

/** 包囲の中心へじりじり迫り、内側の縁で止まる */
function ring(e: Enemy, sp: number): void {
  const dx = e.cx - e.x;
  const dy = e.cy - e.y;
  const d = Math.hypot(dx, dy);
  if (d > 46) {
    e.x += (dx / d) * sp;
    e.y += (dy / d) * sp;
  }
}

/** 重なった敵を押し離す。相手も同じ処理をするので、自分の側だけ半分動かせばよい */
function separate(world: World, e: Enemy): void {
  const n = world.grid.query(e.x, e.y, e.radius, buf);
  for (let j = 0; j < n; j++) {
    const o = buf[j]!;
    if (o === e || o.ai === 'line') continue;
    const dx = e.x - o.x;
    const dy = e.y - o.y;
    const rr = e.radius + o.radius;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) continue;
    if (d2 < 0.0001) {
      // 完全に重なっているときは、個体ごとに違う向きへ散らす
      const a = e.seed * TWO_PI;
      e.x += Math.cos(a) * 0.5;
      e.y += Math.sin(a) * 0.5;
      continue;
    }
    const d = Math.sqrt(d2);
    // 大妖は動かないので、小さい側が大きく避ける
    const push = (rr - d) * (o.boss ? 0.4 : 0.15);
    e.x += (dx / d) * push;
    e.y += (dy / d) * push;
  }
}
