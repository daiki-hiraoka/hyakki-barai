import { grid, phrase } from '../pattern';
import type { SongDef } from '../song';
import { IN_SCALE } from '../theory';

/**
 * 力尽きたとき：64 BPM・2 小節（7.5 秒）の哀歌。ループしない。
 * 梵鐘の一打のあと、尺八が A → B♭ → A → G → E♭ と下りて主音 D で消える（都節の典型的な終止）。
 */
export const DEFEAT: SongDef = {
  bpm: 64,
  stepsPerBar: 16,
  bars: 2,
  loopStartBar: null,
  scale: IN_SCALE,
  root: 62,
  tracks: [
    { name: 'bell', inst: 'bonsho', root: 50, gain: 0.34, rev: 0.5, pattern: grid('X............... ................') },
    { name: 'drone', inst: 'drone', root: 38, gain: 0.4, rev: 0.3, pattern: phrase('0+3:28 .:4 |') },
    { name: 'shakuhachi', inst: 'shakuhachi', root: 62, gain: 0.45, rev: 0.5, pan: 0.1, pattern: phrase('3:4 4:2 3:2 2:6 1:2 | 0:12 .:4 |') },
    { name: 'koto', inst: 'koto', root: 50, gain: 0.34, rev: 0.4, pan: -0.25, pattern: phrase('.:8 5:4 4:4 | 1:8 0:8 |') },
  ],
};
