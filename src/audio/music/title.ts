import { concat, grid, phrase, repeat, rest } from '../pattern';
import type { SongDef } from '../song';
import { IN_SCALE } from '../theory';

/**
 * タイトル：夜の山里。66 BPM・16 小節（約 58 秒）のループ。陰旋法（D, E♭, G, A, B♭）。
 * 低いドローンの上に、箏がぽつりぽつりと鳴り、5 小節目から尺八が入る。
 * 音の無い時間（間）を多めに取り、9〜12 小節はドローンを半音上の E♭ にずらして不穏にする。
 */

const koto = phrase(`
  5+10:8 .:8 | 3:4 4:4 3:8 | .:16 | 2:4 1:4 0:8 |
  0+5:16 | .:16 | 3+8:16 | .:16 |
  6:4 5:4 .:8 | 6:2 5:2 4:4 .:8 | 1+6:16 | .:16 |
  5:4 7:4 8:8 | 7:4 5:4 3:8 | 4:4 3:4 2:4 1:4 | 0+5:16 |
`);

const shakuhachi = phrase(`
  .:64 |
  3:12 4:4 | 3:8 2:8 | 1:6 0:2 .:8 | .:16 |
  .:8 5:8 | 6:12 5:4 | 4:8 3:8 | .:16 |
  3:8 4:4 3:4 | 2:12 .:4 | 1:4 0:12 | .:16 |
`);

export const TITLE: SongDef = {
  bpm: 66,
  stepsPerBar: 16,
  bars: 16,
  loopStartBar: 0,
  scale: IN_SCALE,
  root: 62,
  tracks: [
    // D + A の空虚五度。9〜12 小節だけ E♭ + B♭ にずらす
    { name: 'drone', inst: 'drone', root: 38, gain: 0.5, rev: 0.3, pattern: phrase('0+3:128 | 1+4:64 | 0+3:64 |') },
    { name: 'bell', inst: 'bonsho', root: 50, gain: 0.32, rev: 0.55, pattern: concat(grid('X...............'), rest(112)) },
    { name: 'wind', inst: 'wind', root: 74, gain: 0.16, rev: 0.2, pan: 0.3, pattern: phrase('0:56 .:8 | 3:48 .:16 |') },
    { name: 'koto', inst: 'koto', root: 50, gain: 0.45, rev: 0.35, pan: -0.25, pattern: koto },
    { name: 'shakuhachi', inst: 'shakuhachi', root: 62, gain: 0.42, rev: 0.45, pan: 0.15, pattern: shakuhachi },
    // 尺八が入る小節だけ、鼓動のような弱い大太鼓
    {
      name: 'heartbeat',
      inst: 'odaiko',
      root: 38,
      gain: 0.32,
      rev: 0.25,
      pattern: concat(rest(64), repeat(grid('x..o............'), 4)),
    },
  ],
};
