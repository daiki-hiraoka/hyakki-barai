import { concat, grid, phrase, repeat } from '../pattern';
import type { SongDef } from '../song';
import { CHROMATIC, IN_SCALE } from '../theory';

/**
 * 大妖戦：156 BPM・16 小節（約 25 秒）のループ。旋律は陰旋法、低音だけ半音階。
 * A（1〜8）は低音が D から半音ずつ下がる（ラメント・バス）。上で三味線が D と E♭ の半音をこすり続けて緊張を保つ。
 * B（9〜16）は低音が D–E♭ の半音を往復してから G → A♭ → A と競り上がり、頭の D に戻る。
 * 締太鼓は 16 分の連打、大太鼓は毎拍。
 */

/** 根音 r（半音）の 8 分刻み。オクターブと 5 度だけなので、半音進行のどこに置いても濁らない */
const fig = (r: number) => phrase(`${r}:2 ${r}:1 ${r}:1 ${r + 12}:2 ${r}:2 ${r}:1 ${r}:1 ${r + 12}:2 ${r}:2 ${r + 7}:2`);

const bass = concat(...[0, -1, -2, -3, -4, -5, -4, -5, 0, 1, 0, 1, 5, 6, 7, 7].map(fig));

const t1 = phrase('5! 5 6 5 . 5 6 5 5! 5 6 5 8 6 5 .');
const t2 = phrase('6! 6 5 6 . 6 5 6 6! 6 5 6 9 8 6 .');
const shamisen = concat(repeat(t1, 8), repeat(t2, 4), repeat(t1, 4));

const fue = phrase(`
  .:8 3:2! 4:2 3:4 | .:16 | .:8 4:2! 5:2 4:4 | .:16 |
  5:4! 4:4 3:4 1:4 | 0:12 .:4 | .:16 | 1:2 0:2 -1:4 0:8 |
  5:8! 6:8 | 5:4 4:4 3:8 | 6:8! 7:8 | 6:4 5:4 4:8 |
  3:2 4:2 5:2 6:2 7:4 6:4 | 5:16 | 4:4 3:4 1:4 0:4 | .:16 |
`);

export const BOSS: SongDef = {
  bpm: 156,
  stepsPerBar: 16,
  bars: 16,
  loopStartBar: 0,
  scale: IN_SCALE,
  root: 62,
  tracks: [
    { name: 'bass', inst: 'bass', root: 38, scale: CHROMATIC, gain: 0.55, pattern: bass },
    { name: 'drone', inst: 'drone', root: 38, gain: 0.22, rev: 0.2, pattern: phrase('0:128 | 0:64 1:64 |') },
    {
      name: 'taiko',
      inst: 'odaiko',
      root: 38,
      gain: 0.5,
      rev: 0.12,
      pattern: grid(`
        X...X...X...X... X...X...X...X... X...X...X...X... X...X...X..xX.x.
        X...X...X...X... X...X...X...X... X...X...X...X... X...X...X..xX.x.
        X.x.X.x.X.x.X.xx X.x.X.x.X.x.X.xx X.x.X.x.X.x.X.xx X.x.X.x.XxxxXXXX
        X.x.X.x.X.x.X.xx X.x.X.x.X.x.X.xx X.x.X.x.X.x.X.xx X.x.X.x.XxxxXXXX
      `),
    },
    { name: 'shime', inst: 'shime', root: 74, gain: 0.26, pan: 0.2, pattern: grid('XoxoxoxoXoxoxoxX') },
    { name: 'shamisen', inst: 'shamisen', root: 50, gain: 0.3, pan: -0.3, rev: 0.08, pattern: shamisen },
    { name: 'fue', inst: 'fue', root: 74, gain: 0.32, pan: 0.15, rev: 0.25, pattern: fue },
  ],
};
