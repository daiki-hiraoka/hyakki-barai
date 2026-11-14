import type { EnemyId, PickupKind, Upgrade, WeaponId } from './types';

/** 描画側が演出を選ぶためのキー */
export type FxKind =
  | 'explosion' // 爆発（r: 半径）
  | 'lightning' // 落雷（r: 半径）
  | 'chain' // 連鎖する雷（x2, y2 へ）
  | 'slash' // 斬撃・なぎ払い（angle, r）
  | 'spin' // 全周のなぎ払い（r）
  | 'puff' // 煙
  | 'salt' // 塩が撒かれた
  | 'spawn' // 妖怪が湧いた
  | 'charge' // 突進の予備動作（angle）
  | 'shockwave'; // 衝撃波（r）

/**
 * シミュレーションが 1 tick の間に起こした出来事。
 * コアは音も画面も知らない。外側（音・パーティクル・画面揺れ・バナー）がこれを読んで反応する。
 */
export type SimEvent =
  | { t: 'hit'; x: number; y: number; dmg: number; crit: boolean; weapon: WeaponId | null }
  | { t: 'kill'; x: number; y: number; enemy: EnemyId; r: number; boss: boolean; elite: boolean }
  | { t: 'fire'; weapon: WeaponId }
  | { t: 'fx'; kind: FxKind; x: number; y: number; r: number; angle: number; x2: number; y2: number; weapon: WeaponId | null }
  | { t: 'playerHit'; dmg: number }
  | { t: 'heal'; amount: number }
  | { t: 'pickup'; kind: PickupKind; value: number; x: number; y: number }
  | { t: 'levelUp'; level: number }
  | { t: 'upgrade'; upgrade: Upgrade }
  | { t: 'chest' }
  | { t: 'bossSpawn'; enemy: EnemyId }
  | { t: 'bossKill'; enemy: EnemyId; x: number; y: number }
  | { t: 'warn'; kind: 'stream' | 'ring' | 'rush' | 'parade' | 'swarm' | 'dark' | 'elite' }
  | { t: 'propBreak'; x: number; y: number }
  | { t: 'nuke' }
  | { t: 'freeze' }
  | { t: 'revive' }
  | { t: 'death' }
  | { t: 'dawn' }
  | { t: 'victory' };
