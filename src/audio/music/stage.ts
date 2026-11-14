import { concat, grid, phrase, repeat, rest, shift } from '../pattern';
import type { SongDef } from '../song';
import { IN_SCALE } from '../theory';

/**
 * 道中：132 BPM・32 小節（約 58 秒）のループ。陰旋法（D, E♭, G, A, B♭）。
 * 20 分聴き続けるので A（1〜8）／B（9〜16、低音が G → B♭ → A → D と動く）／
 * A'（17〜24、A の変奏）／C（25〜32、音を減らした間の部分から盛り返す）の 4 部にする。
 *
 * intensity（夜の進行）で上に重ねる。どの段も同じ低音の動きに乗るので、途中から重なっても破綻しない。
 * 0：低音のオスティナート＋まばらな太鼓 / 1：＋三味線の刻み / 2：＋篠笛の主旋律 / 3：＋速い太鼓・当たり鉦・箏の対旋律
 */

const p = (src: string) => phrase(src);

// ---- 低音（D2 基準）----
const osti = p('0:2 0:1 0:1 5:2 0:2 3:2 0:2 4:1 3:1 0:2');
const osti2 = p('0:2 5:1 0:1 5:2 0:2 3:2 5:2 4:1 3:1 0:2');
const turnA = p('4:2 4:2 3:2 3:2 1:2 1:2 0:4');
const turnB = p('3:2 3:2 4:2 4:2 3:2 1:2 0:4');
/** 根音とオクターブだけの型。どの根音に移しても旋法から外れない */
const octFig = (r: number) => shift(p('0:2 0:1 0:1 5:2 0:2 0:2 5:2 0:2 5:2'), r);

const bass = concat(
  repeat(osti, 7), turnA,
  repeat(octFig(2), 2), repeat(octFig(4), 2), repeat(octFig(3), 2), osti, turnB,
  repeat(osti2, 7), turnA,
  p(`0:8 .:8 | 1:8 .:8 | 0:8 .:8 | -1:8 -2:8 | 0:4 .:4 0:4 .:4 | 1:4 .:4 1:4 .:4 |
     0:2 0:2 0:2 0:2 0:2 0:2 0:2 0:2 | 3:2 3:2 3:2 3:2 4:2 4:2 1:2 1:2 |`),
);

// ---- 三味線の刻み（D3 基準）。低音の根音に合わせて型を選ぶ ----
const kD = p('5! . 3 5 . 5 3 . 5! . 3 5 7 5 3 .');
const kD2 = p('5! 5 3 5 . 5 3 5 5! . 3 5 7 8 7 5');
const kG = p('7! . 5 7 . 7 5 . 7! . 5 7 9 7 5 .');
const kBb = p('9! . 7 9 . 9 7 . 9! . 7 9 10 9 7 .');
const kA = p('8! . 5 8 . 8 5 . 8! . 5 8 9 8 5 .');
const kTurnA = p('9! . 8 . 8! . 7 . 6! . 6 . 5:4');
const kTurnB = p('8! . 9 . 8! . 6 . 5! . 5 . 5:4');

const shamisen = concat(
  repeat(kD, 7), kTurnA,
  repeat(kG, 2), repeat(kBb, 2), repeat(kA, 2), kD, kTurnB,
  repeat(kD2, 7), kTurnA,
  p('5:4! .:12 | 6:4! .:12 | 5:4! .:12 | 4:4! 3:4 .:8 |'), kD, kD, kD2, kD2,
);

// ---- 篠笛の主旋律（D5 基準）----
const fue = p(`
  3:6 4:2 3:4 2:4 | 3:4 .:2 2:2 1:4 0:4 | 0:2 2:2 3:4 5:4 4:2 3:2 | 4:4 3:2 2:2 3:8 |
  5:6 7:2 5:4 4:4 | 3:4 4:2 3:2 2:4 3:4 | 2:2 1:2 0:4 1:2 0:2 -1:4 | 0:12 .:4 |

  2:4 3:4 4:6 5:2 | 4:4 3:4 2:8 | 4:4 5:4 7:6 5:2 | 6:4 5:4 4:8 |
  3:2 4:2 3:2 2:2 3:4 5:4 | 4:2 3:2 2:4 1:4 .:4 | 0:4 1:2 0:2 -1:4 -2:4 | -1:2 0:2 1:4 0:8 |

  3:4 4:1 3:1 4:2 3:4 2:4 | 3:4 5:2 4:2 3:4 2:2 1:2 | 0:2 2:2 3:2 5:2 7:4 5:4 | 6:2 5:2 4:4 5:8 |
  5:6 7:2 5:4 4:4 | 3:2 4:2 5:4 3:8 | 2:2 3:2 1:2 0:2 -1:2 0:2 1:4 | 0:16 |

  .:4 -2:2 -1:2 0:4 -1:4 | -2:8 .:8 | .:4 0:2 1:2 2:4 1:4 | 0:8 .:8 |
  3:2 3:2 4:4 3:2 3:2 5:4 | 4:2 4:2 5:4 7:8 | 5:4 4:4 3:4 2:4 | 3:12 .:4 |
`);

// ---- 箏の対旋律（D3 基準）。笛の長い音の隙間を 8 分音符で埋める ----
const arpD = p('5:2 3:2 2:2 3:2 5:2 7:2 5:2 3:2');
const arpD2 = p('5:2 7:2 8:2 7:2 5:2 3:2 2:2 3:2');
const arpA = p('8:2 5:2 4:2 5:2 8:2 9:2 8:2 5:2');
const arpTurnA = p('4:2 3:2 1:2 0:2 1:2 3:2 5:4');
const arpTurnB = p('3:2 4:2 3:2 1:2 0:4 .:4');

const koto = concat(
  repeat(arpD, 7), arpTurnA,
  repeat(shift(arpD, 2), 2), repeat(shift(arpD, 4), 2), repeat(arpA, 2), arpD, arpTurnB,
  repeat(arpD2, 7), arpTurnA,
  rest(64), arpD, arpD, arpD2, arpD2,
);

export const STAGE: SongDef = {
  bpm: 132,
  stepsPerBar: 16,
  bars: 32,
  loopStartBar: 0,
  scale: IN_SCALE,
  root: 62,
  tracks: [
    // intensity 0
    { name: 'bass', inst: 'bass', root: 38, gain: 0.55, pattern: bass },
    {
      name: 'taiko',
      inst: 'odaiko',
      root: 38,
      gain: 0.5,
      rev: 0.15,
      pattern: grid('X.......x....... X.......x....... X.......x....... X.......x...x.x.'),
    },
    {
      name: 'shime',
      inst: 'shime',
      root: 74,
      gain: 0.28,
      pan: 0.2,
      pattern: grid('............x... ............x... ............x... ........x.xxX.x.'),
    },
    // intensity 1
    { name: 'shamisen', inst: 'shamisen', layer: 1, root: 50, gain: 0.32, pan: -0.3, rev: 0.1, pattern: shamisen },
    // intensity 2
    { name: 'fue', inst: 'fue', layer: 2, root: 74, gain: 0.34, pan: 0.1, rev: 0.35, pattern: fue },
    // intensity 3
    {
      name: 'shimeFast',
      inst: 'shime',
      layer: 3,
      root: 74,
      gain: 0.24,
      pan: 0.25,
      pattern: grid('X.xoX.xoX.xoX.xx X.xoX.xoX.xoX.xx X.xoX.xoX.xoX.xx X.xoX.xoXxXxXXXX'),
    },
    {
      name: 'taikoSync',
      inst: 'odaiko',
      layer: 3,
      root: 41,
      gain: 0.36,
      rev: 0.15,
      pattern: grid('....x.....x..... ....x.....x..... ....x.....x..... ....x.....x.x.X.'),
    },
    { name: 'kane', inst: 'kane', layer: 3, root: 86, gain: 0.1, pan: -0.15, pattern: grid('X.ox.xo.X.ox.xo.') },
    { name: 'koto', inst: 'koto', layer: 3, root: 50, gain: 0.3, pan: -0.35, rev: 0.3, pattern: koto },
  ],
};
