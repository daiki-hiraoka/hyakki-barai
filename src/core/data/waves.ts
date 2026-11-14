import type { EnemyId } from '../types';

/** 通常の湧き方。at 秒から次の波までの間、この設定で湧かせる */
export interface WaveDef {
  at: number;
  /** 湧く間隔（秒） */
  interval: number;
  /** 1 回に湧く数 */
  batch: number;
  /** この数を下回ったらすぐ補充する */
  min: number;
  /** この数を超えては湧かせない */
  max: number;
  /** 体力の倍率（夜が深まるほど強くなる） */
  hp: number;
  /** 出現する妖怪と重み */
  pool: Array<[EnemyId, number]>;
}

export type EventDef =
  | { at: number; kind: 'boss'; enemy: EnemyId }
  | { at: number; kind: 'elite'; count: number }
  | { at: number; kind: 'stream'; enemy: EnemyId; count: number }
  | { at: number; kind: 'ring'; enemy: EnemyId; count: number }
  | { at: number; kind: 'rush'; enemy: EnemyId; count: number }
  | { at: number; kind: 'parade'; count: number }
  | { at: number; kind: 'swarm'; enemy: EnemyId; count: number }
  | { at: number; kind: 'dark'; duration: number };

const w = (
  at: number,
  interval: number,
  batch: number,
  min: number,
  max: number,
  hp: number,
  pool: Array<[EnemyId, number]>,
): WaveDef => ({ at, interval, batch, min, max, hp, pool });

/** 20 分間の進行表（1 分刻み） */
export const WAVES: WaveDef[] = [
  // 逢魔が時
  w(0, 1.2, 3, 14, 50, 1.0, [['chochin', 3], ['hitotsume', 1]]),
  w(60, 1.0, 4, 24, 80, 1.0, [['chochin', 2], ['hitotsume', 3], ['karakasa', 1]]),
  w(120, 0.9, 5, 34, 110, 1.0, [['hitotsume', 3], ['karakasa', 2], ['chochin', 1]]),
  // 宵
  w(180, 0.8, 5, 44, 130, 1.1, [['hitotsume', 2], ['karakasa', 2], ['kappa', 2]]),
  w(240, 0.8, 6, 54, 150, 1.2, [['kappa', 3], ['karakasa', 1], ['tanuki', 1]]),
  // 夜半
  w(300, 0.7, 6, 64, 170, 1.2, [['kappa', 2], ['tanuki', 2], ['nekomata', 2]]),
  w(360, 0.7, 7, 72, 190, 1.3, [['nekomata', 3], ['tanuki', 2], ['rokuro', 1], ['kappa', 1]]),
  w(420, 0.7, 7, 80, 210, 1.4, [['nekomata', 2], ['rokuro', 1], ['ittan', 3], ['tanuki', 1]]),
  w(480, 0.6, 7, 88, 230, 1.5, [['ittan', 2], ['dorotabo', 1], ['nekomata', 2], ['kappa', 2]]),
  w(540, 0.6, 8, 96, 250, 1.6, [['dorotabo', 1], ['tengu', 2], ['ittan', 2], ['nekomata', 1]]),
  // 子の刻
  w(600, 0.6, 8, 104, 270, 1.7, [['tengu', 2], ['dorotabo', 1], ['yukionna', 1], ['gaikotsu', 1], ['ittan', 2]]),
  w(660, 0.55, 8, 112, 290, 1.9, [['gaikotsu', 2], ['tengu', 2], ['yukionna', 1], ['nekomata', 2]]),
  w(720, 0.55, 9, 120, 310, 2.1, [['gaikotsu', 3], ['yukionna', 1], ['tengu', 2], ['dorotabo', 1]]),
  // 丑三つ時
  w(780, 0.5, 10, 130, 340, 2.2, [['gaki', 6], ['gaikotsu', 2], ['tengu', 1]]),
  w(840, 0.5, 10, 140, 360, 2.4, [['gaki', 6], ['gaikotsu', 2], ['yukionna', 1], ['dorotabo', 1]]),
  // 寅の刻
  w(900, 0.5, 10, 150, 380, 2.6, [['gaki', 3], ['nue', 1], ['oni_red', 1], ['gaikotsu', 3]]),
  w(960, 0.45, 10, 160, 400, 2.9, [['nue', 2], ['oni_red', 2], ['oni_blue', 1], ['gaki', 3], ['gaikotsu', 2]]),
  w(1020, 0.45, 11, 170, 420, 3.2, [['oni_red', 2], ['oni_blue', 2], ['nue', 2], ['gaki', 4]]),
  w(1080, 0.4, 11, 180, 440, 3.6, [['oni_red', 2], ['oni_blue', 2], ['nue', 2], ['gaki', 4], ['tengu', 2]]),
  // 暁
  w(1140, 0.4, 12, 190, 460, 4.0, [['oni_red', 2], ['oni_blue', 2], ['nue', 2], ['gaki', 5], ['gaikotsu', 2], ['tengu', 1]]),
];

/** 時刻で発生する出来事 */
export const EVENTS: EventDef[] = [
  { at: 90, kind: 'stream', enemy: 'onibi', count: 40 },
  { at: 180, kind: 'elite', count: 1 },
  { at: 300, kind: 'boss', enemy: 'kanabo' },
  { at: 345, kind: 'stream', enemy: 'onibi', count: 50 },
  { at: 420, kind: 'ring', enemy: 'nurikabe', count: 32 },
  { at: 510, kind: 'rush', enemy: 'wanyudo', count: 6 },
  { at: 600, kind: 'boss', enemy: 'tsuchigumo' },
  { at: 660, kind: 'elite', count: 1 },
  { at: 720, kind: 'stream', enemy: 'onibi', count: 70 },
  { at: 780, kind: 'dark', duration: 120 },
  { at: 782, kind: 'parade', count: 140 },
  { at: 840, kind: 'swarm', enemy: 'gaki', count: 80 },
  { at: 900, kind: 'boss', enemy: 'gasha' },
  { at: 960, kind: 'rush', enemy: 'wanyudo', count: 10 },
  { at: 1020, kind: 'elite', count: 2 },
  { at: 1080, kind: 'ring', enemy: 'nurikabe', count: 44 },
  { at: 1110, kind: 'swarm', enemy: 'gaki', count: 100 },
  { at: 1140, kind: 'boss', enemy: 'shuten' },
];

/** 時刻（秒）に対応する波 */
export function waveAt(time: number): WaveDef {
  let current = WAVES[0]!;
  for (const wave of WAVES) {
    if (wave.at <= time) current = wave;
    else break;
  }
  return current;
}

/** 夜の刻の名前（HUD に表示する） */
export function nightPhase(time: number, duration: number): string {
  const t = time / duration;
  if (t < 0.15) return '逢魔が時';
  if (t < 0.25) return '宵';
  if (t < 0.5) return '夜半';
  if (t < 0.65) return '子の刻';
  if (t < 0.75) return '丑三つ時';
  if (t < 0.95) return '寅の刻';
  if (t < 1) return '暁';
  return '夜明け';
}
