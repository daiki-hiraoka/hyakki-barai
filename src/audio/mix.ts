/**
 * ミキサーの音量設計と、その計算。数値はここに集めて、聴いて調整するときに 1 か所で済むようにする。
 */

/**
 * DynamicsCompressorNode が自動で掛ける持ち上げ（メイクアップゲイン）の倍率。
 * 仕様と各ブラウザ（Chromium / WebKit / Gecko は同じ実装が元）では、0dBFS の入力が
 * 圧縮後に何倍になるかの逆数を 0.6 乗した分だけ全体を持ち上げる。
 * リミッターとして使うには、この分を後段で打ち消さないと、しきい値未満の音まで大きくなる。
 * ニー 0 を前提にした式（ニーがあると曲線が変わる）。
 */
export function compressorMakeupGain(thresholdDb: number, ratio: number): number {
  const fullScaleOutDb = thresholdDb + (0 - thresholdDb) / ratio;
  const fullRangeGain = 10 ** (fullScaleOutDb / 20);
  return (1 / fullRangeGain) ** 0.6;
}

/**
 * 音量スライダーの値（0〜1）→ ゲイン。人の耳は対数的に感じるので 2 乗のカーブにして、
 * スライダーの真ん中あたりで「半分くらいの大きさ」に聞こえるようにする。
 */
export function volumeToGain(volume: number): number {
  if (!(volume > 0)) return 0;
  const v = Math.min(1, volume);
  return v * v;
}

/**
 * 音量設計。長時間聴いても疲れないよう、出力のピークは 0.5 前後に収める。
 * BGM だけならリミッターのしきい値（-6dB ≒ 0.5）を超えないようにし、効果音が重なったときだけ抑える。
 * BGM 単独でしきい値を超えると、太鼓のたびに曲全体が沈む「ポンピング」が起きるため。
 * Chromium 系のコンプレッサーは 6ms 先読みしてから attack 内に抑え終えるので、ピークは 0.9 に届かない想定。
 */
export const MIX = {
  /** マスター（リミッターの手前） */
  master: 0.9,
  /** setVolume(…, 1) のときのバスの大きさ */
  sfxBus: 0.7,
  // 0.5 だと最も厚い曲でもピークが 0.36 止まりだったので、しきい値（0.5）の手前まで上げる
  bgmBus: 0.65,
  /** ポーズ中の BGM（音量の倍率とローパスの周波数） */
  pausedGain: 0.4,
  pausedCutoff: 700,
  /** 曲の残響の戻り（BGM バスの中） */
  reverbReturn: 0.9,
  /** リミッター的なコンプレッサー設定。ニー 0 で持ち上げ量を計算どおりにする */
  limiter: { threshold: -6, knee: 0, ratio: 20, attack: 0.002, release: 0.25 },
} as const;
