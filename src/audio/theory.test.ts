import { describe, expect, it } from 'vitest';
import { CHROMATIC, IN_SCALE, YONANUKI_MAJOR, YO_SCALE, degreeToMidi, midiToFreq } from './theory';

describe('midiToFreq', () => {
  it('A4（69）は 440Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
  });

  it('12 上がると周波数は 2 倍', () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
  });

  it('D4（62）は約 293.66Hz', () => {
    expect(midiToFreq(62)).toBeCloseTo(293.665, 2);
  });
});

describe('degreeToMidi', () => {
  it('都節音階（D 基準）の 0〜4 度は D, E♭, G, A, B♭', () => {
    expect([0, 1, 2, 3, 4].map((d) => degreeToMidi(IN_SCALE, 62, d))).toEqual([62, 63, 67, 69, 70]);
  });

  it('5 度で 1 オクターブ上の主音に戻る', () => {
    expect(degreeToMidi(IN_SCALE, 62, 5)).toBe(74);
    expect(degreeToMidi(IN_SCALE, 62, 7)).toBe(79);
  });

  it('負の度数は下のオクターブへ折り返す', () => {
    expect(degreeToMidi(IN_SCALE, 62, -1)).toBe(58);
    expect(degreeToMidi(IN_SCALE, 62, -5)).toBe(50);
    expect(degreeToMidi(IN_SCALE, 62, -6)).toBe(46);
  });

  it('陽旋法（D 基準）は D, E, G, A, B', () => {
    expect([0, 1, 2, 3, 4].map((d) => degreeToMidi(YO_SCALE, 62, d))).toEqual([62, 64, 67, 69, 71]);
  });

  it('ヨナ抜き長音階（C 基準）は C, D, E, G, A', () => {
    expect([0, 1, 2, 3, 4].map((d) => degreeToMidi(YONANUKI_MAJOR, 60, d))).toEqual([60, 62, 64, 67, 69]);
  });

  it('半音階では度数がそのまま半音の数になる', () => {
    expect(degreeToMidi(CHROMATIC, 38, 13)).toBe(51);
    expect(degreeToMidi(CHROMATIC, 38, -1)).toBe(37);
  });

  it('整数でない度数は受け付けない', () => {
    expect(() => degreeToMidi(IN_SCALE, 62, 0.5)).toThrow();
  });
});
