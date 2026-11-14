import { describe, expect, it } from 'vitest';
import { grid } from './pattern';
import { type SongDef, songDuration, songPosition, stepDuration, trackStep } from './song';
import { IN_SCALE } from './theory';

const base: SongDef = {
  bpm: 120,
  stepsPerBar: 16,
  bars: 4,
  loopStartBar: 1,
  scale: IN_SCALE,
  root: 62,
  tracks: [{ name: 'drum', inst: 'odaiko', gain: 1, pattern: grid('X...x...x...x...') }],
};

describe('stepDuration / songDuration', () => {
  it('16 分音符 1 つ分の秒数', () => {
    expect(stepDuration({ ...base, bpm: 120 })).toBeCloseTo(0.125, 9);
  });

  it('曲全体の秒数', () => {
    expect(songDuration({ ...base, bpm: 120 })).toBeCloseTo(8, 9);
  });
});

describe('songPosition（通しのステップ番号 → 曲の中の位置）', () => {
  it('最初の一巡はそのまま', () => {
    expect(songPosition(base, 0)).toEqual({ step: 0, bar: 0, stepInBar: 0 });
    expect(songPosition(base, 37)).toEqual({ step: 37, bar: 2, stepInBar: 5 });
  });

  it('最後まで行ったらループの開始小節へ戻る（前奏は繰り返さない）', () => {
    expect(songPosition(base, 64)).toEqual({ step: 16, bar: 1, stepInBar: 0 });
    expect(songPosition(base, 64 + 48)).toEqual({ step: 16, bar: 1, stepInBar: 0 });
    expect(songPosition(base, 64 + 47)).toEqual({ step: 63, bar: 3, stepInBar: 15 });
  });

  it('ループしない曲は最後の先で null', () => {
    const once = { ...base, loopStartBar: null };
    expect(songPosition(once, 63)).not.toBeNull();
    expect(songPosition(once, 64)).toBeNull();
  });
});

describe('trackStep', () => {
  it('曲より短いパターンはその長さでくり返す', () => {
    expect(trackStep(16, 0)).toBe(0);
    expect(trackStep(16, 21)).toBe(5);
    expect(trackStep(64, 21)).toBe(21);
  });
});
