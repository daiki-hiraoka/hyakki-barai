/**
 * レンダリングした波形の音量を測る。耳で確かめられない代わりに、
 * 「無音でない（RMS > 0）」「クリップしていない（peak < 0.9）」を数値で確かめるため。
 */

export interface Levels {
  /** 全チャンネルの中の最大の絶対値 */
  readonly peak: number;
  /** 全体の RMS（全チャンネルをまとめて） */
  readonly rms: number;
  /** 1 秒ごとの RMS。曲の途中で音が途切れていないか・急に大きくならないかを見る */
  readonly rmsPerSecond: number[];
}

export function measureLevels(channels: readonly Float32Array[], sampleRate: number): Levels {
  const length = channels[0]?.length ?? 0;
  const windows = Math.max(1, Math.ceil(length / sampleRate));
  const windowSum = new Array<number>(windows).fill(0);
  const windowCount = new Array<number>(windows).fill(0);
  let peak = 0;
  let sum = 0;

  for (const data of channels) {
    for (let i = 0; i < data.length; i++) {
      const x = data[i] ?? 0;
      const a = Math.abs(x);
      if (a > peak) peak = a;
      const sq = x * x;
      sum += sq;
      const w = Math.floor(i / sampleRate);
      windowSum[w] = (windowSum[w] ?? 0) + sq;
      windowCount[w] = (windowCount[w] ?? 0) + 1;
    }
  }

  const total = length * channels.length;
  return {
    peak,
    rms: total > 0 ? Math.sqrt(sum / total) : 0,
    rmsPerSecond: windowSum.map((s, i) => {
      const n = windowCount[i] ?? 0;
      return n > 0 ? Math.sqrt(s / n) : 0;
    }),
  };
}
