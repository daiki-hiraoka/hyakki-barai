import { BASE_MAGNET, TICK_RATE } from '../constants';
import type { Pickup, World } from '../types';
import { healPlayer, hitEnemy } from './combat';
import { gainXp } from './leveling';
import { openChest } from './upgrades';
import { emit, inView } from './world';

/** この距離まで来たら取得する */
const COLLECT_DIST = 7;
/** つづらは吸い寄せず、踏んだときだけ開ける */
const CHEST_REACH = 12;
/** 引き寄せ始めに一瞬だけ外へ弾む tick 数（「吸い込まれる」手触りのため） */
const HOP_TICKS = 7;

export function updatePickups(world: World): void {
  const p = world.player;
  const magnet = BASE_MAGNET * p.stats.magnet;
  for (const k of world.pickups.items) {
    if (!k.alive) continue;
    k.age++;
    const dx = p.x - k.x;
    const dy = p.y - k.y;
    const d2 = dx * dx + dy * dy;
    if (!k.pulled) {
      const reach = k.kind === 'chest' ? CHEST_REACH : magnet;
      if (d2 > reach * reach) continue;
      k.pulled = true;
      k.age = 0;
      const d0 = Math.sqrt(d2) || 1;
      k.vx = (-dx / d0) * 1.5;
      k.vy = (-dy / d0) * 1.5;
    }
    const d = Math.sqrt(d2);
    if (d < COLLECT_DIST || k.kind === 'chest') {
      collect(world, k);
      continue;
    }
    if (k.age < HOP_TICKS) {
      k.x += k.vx;
      k.y += k.vy;
      k.vx *= 0.8;
      k.vy *= 0.8;
      continue;
    }
    // 逃げるプレイヤーにも必ず追いつくよう、時間とともに加速する
    const sp = Math.min(7, 1.4 + (k.age - HOP_TICKS) * 0.14);
    if (sp >= d) {
      collect(world, k);
      continue;
    }
    k.x += (dx / d) * sp;
    k.y += (dy / d) * sp;
  }
}

function collect(world: World, k: Pickup): void {
  k.alive = false;
  const p = world.player;
  switch (k.kind) {
    case 'gem':
      world.gemCount--;
      gainXp(world, k.value);
      break;
    case 'coin':
    case 'bag':
      world.run.gold += Math.max(1, Math.round(k.value * p.stats.greed));
      break;
    case 'onigiri':
      healPlayer(world, 30);
      break;
    case 'bell':
      for (const o of world.pickups.items) {
        if (o.alive && o.kind === 'gem') o.pulled = true;
      }
      break;
    case 'nuke':
      nuke(world);
      break;
    case 'freeze':
      world.freezeTicks = 8 * TICK_RATE;
      emit(world, { t: 'freeze' });
      break;
    case 'chest':
      world.run.chests++;
      world.chest = openChest(world);
      world.phase = 'chest';
      emit(world, { t: 'chest' });
      break;
  }
  emit(world, { t: 'pickup', kind: k.kind, value: k.value, x: k.x, y: k.y });
}

/** 大祓の札：画面内の妖怪を一掃する。大妖と精鋭は体力を削るだけ */
function nuke(world: World): void {
  emit(world, { t: 'nuke' });
  for (const e of world.enemies.items) {
    if (!e.alive || !inView(world, e.x, e.y, 40)) continue;
    if (e.boss) hitEnemy(world, e, e.maxHp * 0.08, null);
    else if (e.elite) hitEnemy(world, e, e.maxHp * 0.5, null);
    else hitEnemy(world, e, e.hp + 1, null);
  }
}
