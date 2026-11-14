import { MAX_PASSIVES, MAX_WEAPONS } from '../constants';
import { PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';
import {
  BASE_WEAPON_IDS,
  PASSIVE_IDS,
  type BaseWeaponId,
  type ChestResult,
  type PassiveId,
  type Upgrade,
  type World,
} from '../types';
import { healPlayer } from './combat';
import { refreshPlayer } from './stats';
import { emit, findPassive, findWeapon, grantPassive, grantWeapon, makeWeaponState } from './world';

type Growth = Extract<Upgrade, { kind: 'weapon' | 'passive' }>;

/** いま取得・強化できるものの一覧 */
function candidates(world: World): Growth[] {
  const p = world.player;
  const out: Growth[] = [];
  for (const w of p.weapons) {
    if (!w.def.evolved && w.level < w.def.maxLevel) {
      out.push({ kind: 'weapon', id: w.def.id, level: w.level + 1, isNew: false });
    }
  }
  for (const s of p.passives) {
    if (s.level < s.def.maxLevel) {
      out.push({ kind: 'passive', id: s.def.id, level: s.level + 1, isNew: false });
    }
  }
  if (p.weapons.length < MAX_WEAPONS) {
    for (const id of BASE_WEAPON_IDS) {
      const evolvedForm = WEAPONS[id].evolvesTo;
      // 覚醒させた武器の元を、もう一度取らせない
      if (findWeapon(p, id) || (evolvedForm && findWeapon(p, evolvedForm))) continue;
      out.push({ kind: 'weapon', id, level: 1, isNew: true });
    }
  }
  if (p.passives.length < MAX_PASSIVES) {
    for (const id of PASSIVE_IDS) {
      if (!findPassive(p, id)) out.push({ kind: 'passive', id, level: 1, isNew: true });
    }
  }
  return out;
}

/** 持っている武器の覚醒に必要な装身具 */
function wantedPassives(world: World): Set<PassiveId> {
  const wanted = new Set<PassiveId>();
  for (const w of world.player.weapons) {
    if (w.def.requires) wanted.add(w.def.requires);
  }
  return wanted;
}

/**
 * レベルアップの選択肢を引く。基本は 3 択、運が良いと 4 択。
 * 持っているものの強化と、覚醒に必要な装身具は少し出やすくする
 * （ビルドが完成しやすくなり、覚醒の仕組みに気づきやすい）。
 */
export function rollOffer(world: World): Upgrade[] {
  const p = world.player;
  const extra = world.rng.next() < Math.min(1, (p.stats.luck - 1) * 0.5) ? 1 : 0;
  const pool = candidates(world);
  if (pool.length === 0) {
    return [
      { kind: 'gold', amount: 25 },
      { kind: 'heal', amount: 30 },
    ];
  }
  const wanted = wantedPassives(world);
  const weight = (u: Growth): number => {
    let w = u.isNew ? 1 : 1.25;
    if (u.kind === 'passive' && wanted.has(u.id)) w *= 1.5;
    return w;
  };
  const out: Upgrade[] = [];
  const count = 3 + extra;
  while (out.length < count && pool.length > 0) {
    const pick = world.rng.weighted(pool, weight);
    out.push(pick);
    pool.splice(pool.indexOf(pick), 1);
  }
  return out;
}

export function applyUpgrade(world: World, u: Upgrade): void {
  const p = world.player;
  switch (u.kind) {
    case 'weapon': {
      const owned = findWeapon(p, u.id);
      if (owned) {
        owned.level = Math.min(u.level, owned.def.maxLevel);
        refreshPlayer(p);
      } else {
        grantWeapon(world, u.id);
      }
      break;
    }
    case 'passive': {
      const owned = findPassive(p, u.id);
      if (owned) {
        owned.level = Math.min(u.level, PASSIVES[u.id].maxLevel);
        refreshPlayer(p);
      } else {
        grantPassive(world, u.id);
      }
      break;
    }
    case 'evolve': {
      const index = p.weapons.findIndex((w) => w.def.id === u.from);
      if (index < 0) break;
      // 同じ枠のまま差し替える。元の武器が出していた弾（周回する珠など）は片づける
      p.weapons[index] = makeWeaponState(world, u.id);
      for (const proj of world.projectiles.items) {
        if (proj.weapon === u.from) proj.alive = false;
      }
      refreshPlayer(p);
      break;
    }
    case 'gold':
      world.run.gold += u.amount;
      break;
    case 'heal':
      healPlayer(world, u.amount);
      break;
  }
  emit(world, { t: 'upgrade', upgrade: u });
}

/** 選択を終えたあとの再開。レベルアップが残っていれば次の選択肢を出す */
function resume(world: World): void {
  if (world.pendingLevels > 0) {
    world.offer = rollOffer(world);
    world.phase = 'levelup';
  } else {
    world.offer = null;
    world.phase = 'playing';
  }
}

export function chooseUpgrade(world: World, index: number): void {
  if (world.phase !== 'levelup' || !world.offer) return;
  const choice = world.offer[index];
  if (!choice) return;
  applyUpgrade(world, choice);
  world.pendingLevels = Math.max(0, world.pendingLevels - 1);
  resume(world);
}

/** 選択肢を引き直す。回数が残っていなければ false */
export function rerollOffer(world: World): boolean {
  if (world.phase !== 'levelup' || world.player.rerollsLeft <= 0) return false;
  world.player.rerollsLeft--;
  world.offer = rollOffer(world);
  return true;
}

/** 何も取らずに見送る。回数が残っていなければ false */
export function skipOffer(world: World): boolean {
  if (world.phase !== 'levelup' || world.player.skipsLeft <= 0) return false;
  world.player.skipsLeft--;
  world.pendingLevels = Math.max(0, world.pendingLevels - 1);
  resume(world);
  return true;
}

/** いま覚醒できる武器 */
export function availableEvolutions(world: World): Extract<Upgrade, { kind: 'evolve' }>[] {
  const p = world.player;
  const out: Extract<Upgrade, { kind: 'evolve' }>[] = [];
  for (const w of p.weapons) {
    const def = w.def;
    if (def.evolved || w.level < def.maxLevel || !def.evolvesTo || !def.requires) continue;
    if (findPassive(p, def.requires)) {
      out.push({ kind: 'evolve', from: def.id as BaseWeaponId, id: def.evolvesTo });
    }
  }
  return out;
}

/**
 * つづらを開ける。中身は 1 個（運が良いと 3 個か 5 個）で、その場で適用する。
 * 覚醒できる武器があれば最優先、なければ持っているものの強化、それも無ければ小判。
 */
export function openChest(world: World): ChestResult {
  const p = world.player;
  const rng = world.rng;
  const roll = rng.next() / p.stats.luck;
  const count = roll < 0.03 ? 5 : roll < 0.15 ? 3 : 1;
  const items: Upgrade[] = [];
  for (let i = 0; i < count; i++) {
    const evolutions = availableEvolutions(world);
    let item: Upgrade;
    if (evolutions.length > 0) {
      item = evolutions[0]!;
    } else {
      const owned = candidates(world).filter((u) => !u.isNew);
      item = owned.length > 0 ? rng.pick(owned) : { kind: 'gold', amount: 30 };
    }
    applyUpgrade(world, item);
    items.push(item);
  }
  const gold = Math.round((30 + rng.int(30)) * p.stats.greed * (1 + world.time / 300));
  world.run.gold += gold;
  return { items, gold };
}

export function closeChest(world: World): void {
  if (world.phase !== 'chest') return;
  world.chest = null;
  resume(world);
}
