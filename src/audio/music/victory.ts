import { concat, grid, phrase, repeat, rest, shift } from '../pattern';
import type { SongDef } from '../song';
import { YO_SCALE } from '../theory';

/**
 * 夜明け：92 BPM。陽旋法（D, E, G, A, B）の明るさで、夜の曲の陰旋法と対比させる。
 * 1〜2 小節はファンファーレ（笛と三味線のユニゾン＋太鼓＋鉦）。3〜10 小節の穏やかな部分だけをループする。
 */

const fanfare = phrase('0:2! 2:2 3:2 5:6! 4:2 5:2 | 7:4! 5:2 7:2 8:8 |');

const calm = phrase(`
  .:16 | 3:6 4:2 5:8 | 4:4 3:4 2:8 | .:16 |
  2:6 3:2 4:4 5:4 | 4:4 3:2 2:2 1:8 | 0:4 1:4 2:8 | .:16 |
`);

const arp = phrase('0:2 2:2 3:2 5:2 7:2 5:2 3:2 2:2');
const koto = concat(rest(32), repeat(arp, 2), repeat(shift(arp, 2), 2), repeat(shift(arp, 3), 2), repeat(arp, 2));

export const VICTORY: SongDef = {
  bpm: 92,
  stepsPerBar: 16,
  bars: 10,
  loopStartBar: 2,
  scale: YO_SCALE,
  root: 62,
  tracks: [
    { name: 'fue', inst: 'fue', root: 74, gain: 0.34, rev: 0.4, pan: 0.1, pattern: concat(fanfare, rest(128)) },
    { name: 'shamisen', inst: 'shamisen', root: 62, gain: 0.26, pan: -0.25, pattern: concat(fanfare, rest(128)) },
    { name: 'shakuhachi', inst: 'shakuhachi', root: 62, gain: 0.4, rev: 0.45, pan: 0.15, pattern: concat(rest(32), calm) },
    { name: 'koto', inst: 'koto', root: 50, gain: 0.36, rev: 0.35, pan: -0.3, pattern: koto },
    // 笙の和音（合竹）。2 度を含む塊の響きで、明け方の空気を出す
    { name: 'sho', inst: 'sho', root: 62, gain: 0.2, rev: 0.5, pattern: phrase('0+3+5:32 | 0+1+3:32 | 2+3+5:32 | 0+3+4:32 | 0+1+3:32 |') },
    {
      name: 'taiko',
      inst: 'odaiko',
      root: 38,
      gain: 0.55,
      rev: 0.2,
      pattern: concat(grid('X.......X...X... X...X...X.X.X...'), repeat(grid('x............... ................'), 4)),
    },
    {
      name: 'shime',
      inst: 'shime',
      root: 74,
      gain: 0.2,
      pan: 0.2,
      pattern: concat(grid('X.......XxxxXxxx X...X...XxXxXXXX'), repeat(grid('........o.......'), 8)),
    },
    { name: 'kane', inst: 'kane', root: 86, gain: 0.1, pan: -0.15, pattern: concat(grid('X.x.X.x.X.x.X.x. X.x.X.x.X...X...'), rest(128)) },
  ],
};
