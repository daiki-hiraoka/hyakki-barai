import { waveAt } from '../data/waves';
import type { Enemy, World } from '../types';
import { chase } from './enemies';
import { spawnEnemy, spawnHazard, spawnShot } from './world';

const TWO_PI = Math.PI * 2;

/**
 * 大妖の行動。どの技も「予告 → 発動」の形にして、見てから避けられるようにする。
 * タイマーは aiTimer / t2 / t3 を技ごとに使い分け、aiState が 0 以外のあいだは技の最中。
 * 技の最中の残り時間には cx を使う（大妖は包囲の中心を持たないので空いている）。
 */
export function updateBoss(world: World, e: Enemy, sp: number): void {
  if (e.age === 1) {
    // 現れてすぐ全部の技が重ならないよう、最初の発動をずらす
    e.aiTimer = 110;
    e.t2 = 200;
    e.t3 = 300;
  }
  switch (e.ai) {
    case 'boss_kanabo':
      kanabo(world, e, sp);
      break;
    case 'boss_tsuchigumo':
      tsuchigumo(world, e, sp);
      break;
    case 'boss_gasha':
      gasha(world, e, sp);
      break;
    case 'boss_shuten':
      shuten(world, e, sp);
      break;
    default:
      chase(world, e, sp);
  }
}

// ---- 金棒鬼：足元への叩きつけ ------------------------------------------------

function kanabo(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  const enraged = e.hp < e.maxHp * 0.5;
  if (e.aiState === 1) {
    // 振りかぶっている間は足を止める
    if (--e.cx <= 0) e.aiState = 0;
    return;
  }
  chase(world, e, sp * (enraged ? 1.25 : 1));
  if (--e.aiTimer > 0) return;
  e.aiTimer = enraged ? 150 : 230;
  e.aiState = 1;
  e.cx = 34;
  spawnHazard(world, 'slam', p.x, p.y, 44, 52, 14, e.damage + 4);
  if (enraged) {
    // 体力が半分を切ると、周りにも追い打ちを落とす
    for (let i = 0; i < 2; i++) {
      const a = world.rng.angle();
      const d = world.rng.range(50, 90);
      spawnHazard(world, 'slam', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 36, 70 + i * 12, 14, e.damage);
    }
  }
}

// ---- 土蜘蛛：糸玉・子蜘蛛・蜘蛛の巣 ------------------------------------------

function tsuchigumo(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  // かさかさと進んでは止まる
  if (e.age % 90 < 56) chase(world, e, sp * 1.7);

  if (--e.aiTimer <= 0) {
    e.aiTimer = 170;
    const base = Math.atan2(p.y - e.y, p.x - e.x);
    for (let i = -2; i <= 2; i++) {
      const a = base + i * 0.22;
      const shot = spawnShot(world, 'shot.web', e.x, e.y, Math.cos(a) * 1.5, Math.sin(a) * 1.5, 10, 4, 260);
      shot.slow = 120;
    }
  }
  if (--e.t2 <= 0) {
    e.t2 = 400;
    const hp = waveAt(world.time).hp;
    for (let i = 0; i < 6; i++) {
      const a = world.rng.angle();
      spawnEnemy(world, 'kogumo', e.x + Math.cos(a) * 26, e.y + Math.sin(a) * 26, { hp });
    }
  }
  if (--e.t3 <= 0) {
    e.t3 = 290;
    spawnHazard(world, 'web', p.x, p.y, 40, 40, 420, 0);
  }
}

// ---- がしゃどくろ：骨の雨・骸骨武者・骨の輪 ----------------------------------

function gasha(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  const rng = world.rng;
  chase(world, e, sp);

  if (--e.aiTimer <= 0) {
    e.aiTimer = 200;
    // 1 発は必ず足元へ。残りは周りへばらまき、逃げ道を選ばせる
    spawnHazard(world, 'bone', p.x, p.y, 30, 60, 14, e.damage);
    for (let i = 0; i < 5; i++) {
      const a = rng.angle();
      const d = rng.range(40, 120);
      spawnHazard(world, 'bone', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 30, 66 + i * 6, 14, e.damage);
    }
  }
  if (--e.t2 <= 0) {
    e.t2 = 480;
    const hp = waveAt(world.time).hp;
    for (let i = 0; i < 4; i++) {
      const a = rng.angle();
      spawnEnemy(world, 'gaikotsu', e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, { hp });
    }
  }
  if (--e.t3 <= 0) {
    e.t3 = 330;
    const offset = rng.angle();
    for (let i = 0; i < 10; i++) {
      const a = offset + (i / 10) * TWO_PI;
      spawnShot(world, 'shot.bone', e.x, e.y, Math.cos(a) * 1.3, Math.sin(a) * 1.3, 16, 4, 300);
    }
  }
}

// ---- 酒呑童子：突進・鬼火の渦・鬼の召喚 --------------------------------------

/** 突進の倍率と長さ（tick） */
const DASH_SPEED = 5.5;
const DASH_TICKS = 24;

function shuten(world: World, e: Enemy, sp: number): void {
  const p = world.player;
  const rate = e.hp < e.maxHp * 0.4 ? 0.7 : 1;

  if (e.aiState === 1) {
    // 突進の溜め
    if (--e.cx <= 0) {
      e.aiState = 2;
      e.cx = DASH_TICKS;
    }
    return;
  }
  if (e.aiState === 2) {
    e.x += e.dirX * sp * DASH_SPEED;
    e.y += e.dirY * sp * DASH_SPEED;
    if (Math.abs(e.dirX) > 0.1) e.facing = e.dirX > 0 ? 1 : -1;
    if (--e.cx <= 0) e.aiState = 0;
    return;
  }
  if (e.aiState === 3) {
    // 鬼火を二筋の渦にして吐く（cy に吐く向きを持つ）
    if (e.cx % 4 === 0) {
      for (let k = 0; k < 2; k++) {
        const a = e.cy + k * Math.PI;
        spawnShot(world, 'shot.onibi', e.x, e.y - 10, Math.cos(a) * 1.6, Math.sin(a) * 1.6, 14, 3, 260);
      }
      e.cy += 0.33;
    }
    chase(world, e, sp * 0.4);
    if (--e.cx <= 0) e.aiState = 0;
    return;
  }

  chase(world, e, sp);
  if (--e.aiTimer <= 0) {
    e.aiTimer = Math.round(200 * rate);
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.dirX = dx / d;
    e.dirY = dy / d;
    e.aiState = 1;
    e.cx = 40;
    const h = spawnHazard(world, 'line', e.x, e.y, 12, 40, DASH_TICKS, 0);
    h.angle = Math.atan2(dy, dx);
    h.length = sp * DASH_SPEED * DASH_TICKS + 20;
    return;
  }
  if (--e.t2 <= 0) {
    e.t2 = Math.round(330 * rate);
    e.aiState = 3;
    e.cx = 88;
    e.cy = world.rng.angle();
    return;
  }
  if (--e.t3 <= 0) {
    e.t3 = Math.round(620 * rate);
    const hp = waveAt(world.time).hp;
    for (let i = 0; i < 3; i++) {
      const a = world.rng.angle();
      spawnEnemy(world, i % 2 === 0 ? 'oni_red' : 'oni_blue', e.x + Math.cos(a) * 36, e.y + Math.sin(a) * 36, { hp });
    }
  }
}
