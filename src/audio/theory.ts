/**
 * 音階と周波数の計算。AudioContext に依存しない純粋な関数だけを置く。
 *
 * 旋律は「音階の何番目か（度数）」で書く。音名で書くより移高や変奏が楽で、
 * 五音音階から外れた音をうっかり書く事故も防げるため。
 */

/** 主音からの半音数の並び（1 オクターブ分） */
export type Scale = readonly number[];

/** 陰旋法（都節音階）。D 基準で D, E♭, G, A, B♭。不気味さ・哀しさの基調 */
export const IN_SCALE: Scale = [0, 1, 5, 7, 8];
/** 陽旋法。D 基準で D, E, G, A, B。民謡風の明るさ */
export const YO_SCALE: Scale = [0, 2, 5, 7, 9];
/** ヨナ抜き長音階。C 基準で C, D, E, G, A。いちばん明るく開けた響き */
export const YONANUKI_MAJOR: Scale = [0, 2, 4, 7, 9];
/** 半音階。度数 = 半音数。大妖戦の低音の半音進行に使う */
export const CHROMATIC: Scale = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** MIDI ノート番号を周波数（Hz）に変える。平均律・A4 = 440Hz */
export function midiToFreq(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/**
 * 音階の度数を MIDI ノート番号に変える。
 * 度数が音階の長さを超えたら上のオクターブ、負なら下のオクターブへ折り返す。
 */
export function degreeToMidi(scale: Scale, rootMidi: number, degree: number): number {
  if (!Number.isInteger(degree)) throw new Error(`度数は整数で指定する: ${degree}`);
  const n = scale.length;
  const octave = Math.floor(degree / n);
  const index = degree - octave * n;
  return rootMidi + octave * 12 + (scale[index] ?? 0);
}
