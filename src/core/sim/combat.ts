import { IFRAME_TICKS, MAX_GEMS } from '../constants';
import { waveAt } from '../data/waves';
import type { Enemy, Prop, WeaponId, World } from '../types';
import { emit, spawnEnemy, spawnPickup } from './world';

/** damageArea 用の検索バッファ（このモジュールの中でしか使わない） */
const buf: Enemy[] = [];

/** ノックバック速度の上限（px/tick）。重ね当てで画面外まで吹き飛ばないようにする */
const MAX_KNOCKBACK = 7;

/** 妖怪が小判を落とす確率（運で上がる） */
const COIN_CHANCE = 0.03;

/**
 * 敵にダメージを与える。倒したら true。
 * weapon は与ダメージの集計先（アイテムなど武器以外が原因なら null）。
 * kb はノックバックの初速、(dirX, dirY) はその向き。
 */
export function hitEnemy(
  world: World,
  e: Enemy,
  damage: number,
  weapon: WeaponId | null,
  kb = 0,
  dirX = 0,
  dirY = 0,
  crit = 0,
): boolean {
  if (!e.alive) return false;
  let dmg = damage;
  let isCrit = false;
  if (crit > 0 && world.rng.next() < crit) {
    dmg *= 2;
    isCrit = true;
  }
  dmg = Math.max(1, Math.round(dmg));
  if (weapon) {
    // 集計は実際に削れた分だけ（倒しすぎた分を数えると武器の比較が歪む）
    world.run.damage[weapon] = (world.run.damage[weapon] ?? 0) + Math.min(dmg, e.hp);
  }
  e.hp -= dmg;
  e.flash = 5;
  if (kb > 0 && e.def.kb > 0) {
    const k = kb * e.def.kb * (e.elite ? 0.5 : 1);
    e.kx += dirX * k;
    e.ky += dirY * k;
    const m = Math.hypot(e.kx, e.ky);
    if (m > MAX_KNOCKBACK) {
      e.kx *= MAX_KNOCKBACK / m;
      e.ky *= MAX_KNOCKBACK / m;
    }
  }
  emit(world, { t: 'hit', x: e.x, y: e.y, dmg, crit: isCrit, weapon });
  if (e.hp <= 0) {
    killEnemy(world, e);
    return true;
  }
  return false;
}

/**
 * 円の範囲にいる敵すべてにダメージを与え、当たった数を返す。範囲内の石灯籠も壊す。
 * ノックバックは円の中心から外向き。
 */
export function damageArea(
  world: World,
  x: number,
  y: number,
  r: number,
  damage: number,
  weapon: WeaponId | null,
  kb = 0,
  crit = 0,
): number {
  const n = world.grid.query(x, y, r, buf);
  for (let i = 0; i < n; i++) {
    const e = buf[i]!;
    const dx = e.x - x;
    const dy = e.y - y;
    const d = Math.hypot(dx, dy) || 1;
    hitEnemy(world, e, damage, weapon, kb, dx / d, dy / d, crit);
  }
  breakPropsIn(world, x, y, r);
  return n;
}

/** 敵を倒す。drops が false なら何も落とさず、撃破数にも数えない（夜明けで消える妖怪など） */
export function killEnemy(world: World, e: Enemy, drops = true): void {
  e.alive = false;
  emit(world, { t: 'kill', x: e.x, y: e.y, enemy: e.def.id, r: e.radius, boss: e.boss, elite: e.elite });
  if (!drops) return;

  world.run.kills++;
  dropGem(world, e.x, e.y, e.xp);
  if (world.rng.next() < COIN_CHANCE * world.player.stats.luck) {
    // 夜が深まるほど、落ちる小判の値打ちも上がる
    spawnPickup(world, 'coin', e.x + 4, e.y + 2, 1 + Math.floor(world.time / 240));
  }
  if (e.elite || e.boss) spawnPickup(world, 'chest', e.x, e.y + 4);
  if (e.boss) {
    world.run.bossKills.push(e.def.id);
    emit(world, { t: 'bossKill', enemy: e.def.id, x: e.x, y: e.y });
    spawnPickup(world, 'bag', e.x - 12, e.y, 100);
  }
  const split = e.def.split;
  if (split) {
    const hp = waveAt(world.time).hp;
    for (let i = 0; i < split.count; i++) {
      const a = world.rng.angle();
      spawnEnemy(world, split.into, e.x + Math.cos(a) * 8, e.y + Math.sin(a) * 8, { hp });
    }
  }
}

/**
 * 霊玉を落とす。場の霊玉が上限に達していたら、新しく作らずに 1 つの玉へ合算する
 * （終盤に数千個の玉が残って重くなるのを防ぐ。経験値の合計は変わらない）。
 */
export function dropGem(world: World, x: number, y: number, value: number): void {
  if (world.gemCount < MAX_GEMS) {
    spawnPickup(world, 'gem', x, y, value);
    return;
  }
  let bank = world.gemBank;
  if (!bank || !bank.alive || bank.id !== world.gemBankId) {
    bank = spawnPickup(world, 'gem', x, y, 0);
    world.gemBank = bank;
    world.gemBankId = bank.id;
  }
  bank.value += value;
  bank.tier = 2;
}

// ---------------------------------------------------------------------------
// 石灯籠
// ---------------------------------------------------------------------------

export function breakProp(world: World, prop: Prop): void {
  if (!prop.alive) return;
  prop.alive = false;
  emit(world, { t: 'propBreak', x: prop.x, y: prop.y });
  const rng = world.rng;
  const roll = rng.next();
  if (roll < 0.4) {
    const n = 1 + rng.int(3);
    for (let i = 0; i < n; i++) {
      spawnPickup(world, 'coin', prop.x + rng.range(-8, 8), prop.y + rng.range(-5, 5), 2);
    }
  } else if (roll < 0.62) spawnPickup(world, 'onigiri', prop.x, prop.y);
  else if (roll < 0.74) spawnPickup(world, 'bag', prop.x, prop.y, 25);
  else if (roll < 0.84) spawnPickup(world, 'bell', prop.x, prop.y);
  else if (roll < 0.92) spawnPickup(world, 'freeze', prop.x, prop.y);
  else spawnPickup(world, 'nuke', prop.x, prop.y);
}

export function breakPropsIn(world: World, x: number, y: number, r: number): void {
  for (const prop of world.props.items) {
    if (!prop.alive) continue;
    const dx = prop.x - x;
    const dy = prop.y - y;
    const rr = r + prop.radius;
    if (dx * dx + dy * dy <= rr * rr) breakProp(world, prop);
  }
}

// ---------------------------------------------------------------------------
// プレイヤー
// ---------------------------------------------------------------------------

/** 復活した直後の無敵時間と、周囲を弾き飛ばす範囲 */
const REVIVE_IFRAMES = 180;
const REVIVE_BLAST = 150;

export function damagePlayer(world: World, amount: number): void {
  const p = world.player;
  if (p.iframes > 0 || world.phase !== 'playing') return;
  const dmg = Math.max(1, Math.round(amount - p.stats.armor));
  p.hp -= dmg;
  p.iframes = IFRAME_TICKS;
  world.run.damageTaken += dmg;
  emit(world, { t: 'playerHit', dmg });
  if (p.hp > 0) return;

  if (p.revivesLeft > 0) {
    p.revivesLeft--;
    p.hp = Math.ceil(p.maxHp / 2);
    p.iframes = REVIVE_IFRAMES;
    emit(world, { t: 'revive' });
    // 囲まれたまま蘇ってもすぐやられるので、周りの妖怪を弾き飛ばす
    for (const e of world.enemies.items) {
      if (!e.alive || e.boss) continue;
      const dx = e.x - p.x;
      const dy = e.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > REVIVE_BLAST) continue;
      const k = 6 * Math.max(0.3, e.def.kb);
      e.kx = (dx / d) * k;
      e.ky = (dy / d) * k;
    }
    return;
  }
  p.hp = 0;
  world.phase = 'dead';
  emit(world, { t: 'death' });
}

export function healPlayer(world: World, amount: number): void {
  const p = world.player;
  const healed = Math.min(amount, p.maxHp - p.hp);
  if (healed <= 0) return;
  p.hp += healed;
  emit(world, { t: 'heal', amount: healed });
}
