/**
 * 音の出口（ポート）。ゲーム本体はこのインターフェースだけに依存し、
 * Web Audio を使う実装は外から注入する。テストやヘッドレス実行では NullAudio を使う。
 */

export const SFX_IDS = [
  // UI
  'ui_move',
  'ui_confirm',
  'ui_cancel',
  'ui_deny',
  'ui_buy',
  // 戦闘
  'hit',
  'crit',
  'kill',
  'player_hurt',
  'break',
  // 取得
  'gem',
  'coin',
  'item',
  'heal',
  // 進行
  'level_up',
  'chest_open',
  'chest_item',
  'evolve',
  'revive',
  'death',
  'dawn',
  'boss_warn',
  'boss_kill',
  'event_warn',
  'nuke',
  'freeze',
  // 武器
  'w_ofuda',
  'w_arrow',
  'w_staff',
  'w_bead',
  'w_fire',
  'w_explode',
  'w_salt',
  'w_wind',
  'w_thunder',
  'w_crane',
  'w_bell',
  'w_slash',
] as const;

export type SfxId = (typeof SFX_IDS)[number];

export const MUSIC_IDS = ['title', 'stage', 'boss', 'victory', 'defeat'] as const;

export type MusicId = (typeof MUSIC_IDS)[number];

export interface SfxOptions {
  /** 左右の定位（-1 〜 1） */
  pan?: number;
  /** 音量の倍率（既定 1） */
  volume?: number;
  /** 音程の倍率（既定 1） */
  pitch?: number;
}

export interface AudioPort {
  /** 最初のユーザー操作で呼ぶ（ブラウザの自動再生制限を解除する） */
  unlock(): void;
  /** 効果音を鳴らす。同じ音の連打は実装側で間引く */
  sfx(id: SfxId, opts?: SfxOptions): void;
  /** BGM を切り替える。null で停止 */
  music(id: MusicId | null, fadeSec?: number): void;
  /** 'stage' 曲の盛り上がり（0〜3）。夜の進行に合わせてレイヤーを増やす */
  setIntensity(level: number): void;
  /** 音量（0〜1） */
  setVolume(channel: 'sfx' | 'bgm', volume: number): void;
  /** ポーズ中は BGM を絞る */
  setPaused(paused: boolean): void;
}

/** 何も鳴らさない実装 */
export class NullAudio implements AudioPort {
  unlock(): void {}
  sfx(): void {}
  music(): void {}
  setIntensity(): void {}
  setVolume(): void {}
  setPaused(): void {}
}
