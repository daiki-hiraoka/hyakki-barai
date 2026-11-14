import { describe, expect, it } from 'vitest';
import { compressorMakeupGain, volumeToGain } from './mix';

describe('compressorMakeupGain', () => {
  it('しきい値 0dB なら持ち上げは無い', () => {
    expect(compressorMakeupGain(0, 20)).toBeCloseTo(1, 9);
  });

  it('レシオ 1（圧縮しない）なら持ち上げは無い', () => {
    expect(compressorMakeupGain(-24, 1)).toBeCloseTo(1, 9);
  });

  it('しきい値 -10dB・レシオ 20 では約 +5.7dB（約 1.93 倍）持ち上がる', () => {
    // 0dB の入力は -10 + 10/20 = -9.5dB になる。その逆数の 0.6 乗が持ち上げ量
    expect(compressorMakeupGain(-10, 20)).toBeCloseTo(10 ** ((9.5 * 0.6) / 20), 6);
  });
});

describe('volumeToGain', () => {
  it('0 と 1 はそのまま', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
  });

  it('聴感に合わせて 2 乗のカーブにする', () => {
    expect(volumeToGain(0.5)).toBeCloseTo(0.25, 9);
  });

  it('範囲外や NaN は 0〜1 に収める', () => {
    expect(volumeToGain(-1)).toBe(0);
    expect(volumeToGain(2)).toBe(1);
    expect(volumeToGain(Number.NaN)).toBe(0);
  });
});
