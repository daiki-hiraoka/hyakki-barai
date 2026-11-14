/** シミュレーションは固定 60Hz で進める（描画のフレームレートに左右されない） */
export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/** 秒を tick に直す（最低 1 tick） */
export function ticks(seconds: number): number {
  return Math.max(1, Math.round(seconds * TICK_RATE));
}

/** プレイヤーの基本移動速度（px/秒） */
export const PLAYER_SPEED = 76;
export const PLAYER_RADIUS = 5;
/** 取得範囲の基本半径（px） */
export const BASE_MAGNET = 30;
/** 被弾後の無敵時間 */
export const IFRAME_TICKS = 24;

export const MAX_WEAPONS = 6;
export const MAX_PASSIVES = 6;

/** 一夜の長さ（秒）。この時刻に夜が明ける */
export const RUN_DURATION = 20 * 60;

/** 既定のカメラ範囲（論理解像度 640×360 の半分） */
export const VIEW_HW = 320;
export const VIEW_HH = 180;

/** 霊玉の上限。超えた分は 1 つの大きな玉に合体させる */
export const MAX_GEMS = 320;
/** 画面外のどれだけ外側に妖怪を湧かせるか（px） */
export const SPAWN_MARGIN = 28;
