import { SHOP } from '../data/shop';
import type { SaveStorage } from '../ports';
import {
  CHARACTER_IDS,
  SHOP_IDS,
  type CharacterId,
  type EnemyId,
  type ShopId,
  type ShopLevels,
} from '../types';

export const SAVE_KEY = 'hyakki-barai.save';
const VERSION = 1;

export interface Settings {
  /** 音量（0〜1） */
  bgm: number;
  sfx: number;
  /** 画面の揺れ */
  shake: boolean;
  /** ダメージ数字の表示 */
  damageNumbers: boolean;
}

export interface SaveData {
  version: number;
  gold: number;
  shop: ShopLevels;
  unlocked: CharacterId[];
  stats: {
    runs: number;
    kills: number;
    /** 最長の生存時間（秒） */
    bestTime: number;
    /** 夜明けを迎えた回数 */
    dawns: number;
  };
  settings: Settings;
}

/** 一夜の結果（セーブへ反映する分だけ） */
export interface RunSummary {
  character: CharacterId;
  time: number;
  kills: number;
  level: number;
  gold: number;
  bossKills: EnemyId[];
  victory: boolean;
}

/** 最初から使える祓い手 */
const STARTERS: CharacterId[] = ['haruma', 'chihaya'];

/** 祓い手の解放条件（一夜の結果で判定する） */
export const UNLOCKS: Array<{ id: CharacterId; hint: string; test: (r: RunSummary) => boolean }> = [
  { id: 'goukai', hint: '5 分間生き延びる', test: (r) => r.time >= 300 },
  { id: 'kon', hint: '一夜で 1500 体の妖怪を祓う', test: (r) => r.kills >= 1500 },
  { id: 'jubei', hint: '大妖「金棒鬼」を討つ', test: (r) => r.bossKills.includes('kanabo') },
  { id: 'enku', hint: '夜明けを迎える', test: (r) => r.victory },
];

export function defaultSave(): SaveData {
  return {
    version: VERSION,
    gold: 0,
    shop: {},
    unlocked: [...STARTERS],
    stats: { runs: 0, kills: 0, bestTime: 0, dawns: 0 },
    settings: { bgm: 0.8, sfx: 0.8, shake: true, damageNumbers: true },
  };
}

// ---------------------------------------------------------------------------
// 読み書き
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function count(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

function unit(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
}

function flag(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

/**
 * セーブを読み込む。保存先が使えない・中身が壊れている・版が違うときは初期値を返し、
 * 一部だけおかしいときは使える部分だけ引き継ぐ（手で書き換えられても落ちないように）。
 */
export function loadSave(storage: SaveStorage): SaveData {
  const save = defaultSave();
  let raw: unknown;
  try {
    const text = storage.getItem(SAVE_KEY);
    if (!text) return save;
    raw = JSON.parse(text);
  } catch {
    return save;
  }
  if (!isRecord(raw) || raw.version !== VERSION) return save;

  save.gold = count(raw.gold, 0);

  if (isRecord(raw.shop)) {
    for (const id of SHOP_IDS) {
      const rank = Math.min(count(raw.shop[id], 0), SHOP[id].maxRank);
      if (rank > 0) save.shop[id] = rank;
    }
  }

  if (Array.isArray(raw.unlocked)) {
    for (const id of CHARACTER_IDS) {
      if (raw.unlocked.includes(id) && !save.unlocked.includes(id)) save.unlocked.push(id);
    }
  }

  if (isRecord(raw.stats)) {
    save.stats.runs = count(raw.stats.runs, 0);
    save.stats.kills = count(raw.stats.kills, 0);
    save.stats.bestTime = count(raw.stats.bestTime, 0);
    save.stats.dawns = count(raw.stats.dawns, 0);
  }

  if (isRecord(raw.settings)) {
    const d = save.settings;
    d.bgm = unit(raw.settings.bgm, d.bgm);
    d.sfx = unit(raw.settings.sfx, d.sfx);
    d.shake = flag(raw.settings.shake, d.shake);
    d.damageNumbers = flag(raw.settings.damageNumbers, d.damageNumbers);
  }
  return save;
}

export function storeSave(storage: SaveStorage, save: SaveData): void {
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // プライベートブラウズなどで保存できなくても、ゲームは続けられる
  }
}

// ---------------------------------------------------------------------------
// 社の加護
// ---------------------------------------------------------------------------

/** rank の状態から次の 1 ランクを買う値段 */
export function shopCost(id: ShopId, rank: number): number {
  return Math.round(SHOP[id].baseCost * (1 + 0.8 * rank));
}

export function buy(save: SaveData, id: ShopId): boolean {
  const rank = save.shop[id] ?? 0;
  if (rank >= SHOP[id].maxRank) return false;
  const cost = shopCost(id, rank);
  if (save.gold < cost) return false;
  save.gold -= cost;
  save.shop[id] = rank + 1;
  return true;
}

/** 買った加護をすべて手放し、使った小判を全額戻す。戻した額を返す */
export function refundAll(save: SaveData): number {
  let total = 0;
  for (const id of SHOP_IDS) {
    const rank = save.shop[id] ?? 0;
    for (let r = 0; r < rank; r++) total += shopCost(id, r);
  }
  save.shop = {};
  save.gold += total;
  return total;
}

// ---------------------------------------------------------------------------
// 一夜の結果
// ---------------------------------------------------------------------------

/** 結果をセーブへ反映し、このとき新しく解放された祓い手を返す */
export function applyRun(save: SaveData, run: RunSummary): { unlocked: CharacterId[] } {
  save.gold += Math.max(0, Math.floor(run.gold));
  save.stats.runs++;
  save.stats.kills += run.kills;
  save.stats.bestTime = Math.max(save.stats.bestTime, Math.floor(run.time));
  if (run.victory) save.stats.dawns++;

  const unlocked: CharacterId[] = [];
  for (const rule of UNLOCKS) {
    if (!save.unlocked.includes(rule.id) && rule.test(run)) {
      save.unlocked.push(rule.id);
      unlocked.push(rule.id);
    }
  }
  return { unlocked };
}
