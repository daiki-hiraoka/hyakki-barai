import type { Pattern } from './pattern';
import type { Scale } from './theory';

/**
 * 曲の形と、曲の中の位置の計算。曲データ（songs.ts）と再生（songPlayer.ts）の間の約束ごと。
 * AudioContext に依存しないので、ループの継ぎ目などをテストで確かめられる。
 */

/** 楽器の種類。音色の実装は instruments.ts（Record で全種の実装を強制する） */
export const INSTRUMENT_IDS = [
  'odaiko',
  'shime',
  'kane',
  'hyoshigi',
  'bass',
  'shamisen',
  'koto',
  'shakuhachi',
  'fue',
  'drone',
  'sho',
  'bonsho',
  'wind',
] as const;

export type InstrumentId = (typeof INSTRUMENT_IDS)[number];

export interface TrackDef {
  readonly name: string;
  readonly inst: InstrumentId;
  /** 曲より短ければくり返す（曲の長さとループ開始位置を割り切れる長さにする） */
  readonly pattern: Pattern;
  /** トラックの音量 */
  readonly gain: number;
  /** この intensity 以上で鳴る（'stage' 用。既定 0） */
  readonly layer?: number;
  /** 度数 0 の MIDI ノート番号（既定は曲の root） */
  readonly root?: number;
  /** 既定は曲の scale */
  readonly scale?: Scale;
  /** 定位（-1〜1） */
  readonly pan?: number;
  /** 残響へ送る量（0〜1） */
  readonly rev?: number;
}

export interface SongDef {
  readonly bpm: number;
  /** 1 小節のステップ数（16 分音符単位） */
  readonly stepsPerBar: number;
  readonly bars: number;
  /** 最後まで行ったら戻る小節。null ならループしない */
  readonly loopStartBar: number | null;
  readonly scale: Scale;
  readonly root: number;
  readonly tracks: readonly TrackDef[];
}

export interface SongPosition {
  /** 曲の先頭からのステップ */
  readonly step: number;
  readonly bar: number;
  readonly stepInBar: number;
}

/** 1 ステップ（16 分音符）の秒数 */
export function stepDuration(song: SongDef): number {
  return 60 / song.bpm / 4;
}

export function songTotalSteps(song: SongDef): number {
  return song.bars * song.stepsPerBar;
}

/** 一巡の秒数（音の余韻は含まない） */
export function songDuration(song: SongDef): number {
  return songTotalSteps(song) * stepDuration(song);
}

/**
 * 再生開始からの通しのステップ番号 → 曲の中の位置。
 * ループ時は前奏（loopStartBar より前）を飛ばして戻る。ループしない曲は終わりの先で null。
 */
export function songPosition(song: SongDef, absStep: number): SongPosition | null {
  const total = songTotalSteps(song);
  let step = absStep;
  if (step >= total) {
    if (song.loopStartBar === null) return null;
    const loopStart = song.loopStartBar * song.stepsPerBar;
    step = loopStart + ((step - loopStart) % (total - loopStart));
  }
  return { step, bar: Math.floor(step / song.stepsPerBar), stepInBar: step % song.stepsPerBar };
}

/** 曲の中の位置 → トラックのパターン内の位置（短いパターンはくり返す） */
export function trackStep(patternLength: number, songStep: number): number {
  return songStep % patternLength;
}
