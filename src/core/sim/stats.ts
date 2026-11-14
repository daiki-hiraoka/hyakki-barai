import { SHOP } from '../data/shop';
import { weaponStatsAt } from '../data/weapons';
import {
  SHOP_IDS,
  type CharacterDef,
  type PassiveState,
  type Player,
  type ShopLevels,
  type StatMods,
  type Stats,
  type WeaponDef,
  type WeaponStats,
} from '../types';

/** 冷却倍率の下限。重ねがけしても連射が際限なく速くならないようにする */
const MIN_COOLDOWN = 0.4;

export function baseStats(): Stats {
  return {
    hp: 1,
    regen: 0,
    armor: 0,
    moveSpeed: 1,
    might: 1,
    area: 1,
    projSpeed: 1,
    duration: 1,
    amount: 0,
    cooldown: 1,
    luck: 1,
    growth: 1,
    greed: 1,
    magnet: 1,
    revives: 0,
    rerolls: 0,
    skips: 0,
  };
}

function addMods(stats: Stats, mods: StatMods, times: number): void {
  for (const key of Object.keys(mods) as (keyof Stats)[]) {
    stats[key] += mods[key]! * times;
  }
}

/** 祓い手の固有能力・社の加護・装身具を合算した能力値 */
export function computeStats(
  char: CharacterDef,
  shop: ShopLevels,
  passives: readonly PassiveState[],
): Stats {
  const stats = baseStats();
  addMods(stats, char.mods, 1);
  for (const id of SHOP_IDS) {
    const rank = shop[id] ?? 0;
    if (rank > 0) addMods(stats, SHOP[id].perRank, rank);
  }
  for (const p of passives) addMods(stats, p.def.perLevel, p.level);
  stats.cooldown = Math.max(MIN_COOLDOWN, stats.cooldown);
  stats.moveSpeed = Math.max(0.3, stats.moveSpeed);
  return stats;
}

/** 武器の基本値にプレイヤーの能力値を掛けた最終値 */
export function resolveWeaponStats(def: WeaponDef, level: number, stats: Stats): WeaponStats {
  const w = weaponStatsAt(def, level);
  w.damage *= stats.might;
  w.cooldown = Math.max(0.08, w.cooldown * stats.cooldown);
  if (def.scalesAmount) w.amount += stats.amount;
  w.area *= stats.area;
  w.speed *= stats.projSpeed;
  w.duration *= stats.duration;
  return w;
}

/**
 * 装備が変わったときに呼ぶ。能力値・最大体力・各武器の最終値を計算し直す。
 * 最大体力が増えたときは増えた分だけ回復する（上限だけ伸びて瀕死のまま、を避ける）。
 */
export function refreshPlayer(player: Player): void {
  const before = player.maxHp;
  player.stats = computeStats(player.char, player.shop, player.passives);
  player.maxHp = Math.round(player.char.baseHp * player.stats.hp);
  if (player.maxHp > before) player.hp += player.maxHp - before;
  if (player.hp > player.maxHp) player.hp = player.maxHp;
  for (const w of player.weapons) {
    w.stats = resolveWeaponStats(w.def, w.level, player.stats);
  }
}
