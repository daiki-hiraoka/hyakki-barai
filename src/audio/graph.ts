import { MIX, compressorMakeupGain, volumeToGain } from './mix';
import { reverbBuffer } from './voice';

/**
 * 信号経路（実時間とオフラインで共通）
 *
 *   効果音 ──────────────→ sfx バス ─────────────────────┐
 *   曲（原音）──→ bgm バス → ポーズ用ローパス → ポーズ用ゲイン ─┼→ master → リミッター → 補正 → 出力
 *   曲（残響の送り）→ 残響 ─┘(bgm バスへ戻す)              │
 *
 * 残響の戻りを bgm バスの手前に入れるのは、BGM の音量・ポーズが残響にも効くようにするため。
 * 効果音には残響をかけない（短く頻繁な音はくっきりしている方が手応えが分かりやすい）。
 */

export interface MixGraph {
  /** 効果音の入口（sfx バス） */
  readonly sfx: GainNode;
  /** 曲の原音の入口（bgm バス） */
  readonly bgm: GainNode;
  /** 曲の残響の入口 */
  readonly reverb: AudioNode;
  readonly pauseFilter: BiquadFilterNode;
  readonly pauseGain: GainNode;
}

export interface MixState {
  readonly sfxVolume: number;
  readonly bgmVolume: number;
  readonly paused: boolean;
}

/** ポーズしていないときのローパス（実質素通し） */
const OPEN_CUTOFF = 20000;
/** 音量・ポーズの切り替えの時定数（秒）。瞬時に変えるとプツッと鳴るので少しだけ滑らかにする */
const VOLUME_SMOOTH = 0.03;
const PAUSE_SMOOTH = 0.08;

export function createMixGraph(ctx: BaseAudioContext, state: MixState): MixGraph {
  const sfx = ctx.createGain();
  sfx.gain.value = MIX.sfxBus * volumeToGain(state.sfxVolume);
  const bgm = ctx.createGain();
  bgm.gain.value = MIX.bgmBus * volumeToGain(state.bgmVolume);

  const pauseFilter = ctx.createBiquadFilter();
  pauseFilter.type = 'lowpass';
  pauseFilter.Q.value = 0.707;
  pauseFilter.frequency.value = state.paused ? MIX.pausedCutoff : OPEN_CUTOFF;
  const pauseGain = ctx.createGain();
  pauseGain.gain.value = state.paused ? MIX.pausedGain : 1;

  const convolver = ctx.createConvolver();
  convolver.buffer = reverbBuffer(ctx);
  const reverbReturn = ctx.createGain();
  reverbReturn.gain.value = MIX.reverbReturn;

  const master = ctx.createGain();
  master.gain.value = MIX.master;
  // リミッターとして使う：しきい値を超えた分だけを強く抑える。ニー 0 で持ち上げ量を計算どおりにする
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = MIX.limiter.threshold;
  limiter.knee.value = MIX.limiter.knee;
  limiter.ratio.value = MIX.limiter.ratio;
  limiter.attack.value = MIX.limiter.attack;
  limiter.release.value = MIX.limiter.release;
  // コンプレッサーが自動で掛ける持ち上げを打ち消し、しきい値未満の音はそのままの大きさで通す
  const trim = ctx.createGain();
  trim.gain.value = 1 / compressorMakeupGain(MIX.limiter.threshold, MIX.limiter.ratio);

  sfx.connect(master);
  convolver.connect(reverbReturn).connect(bgm);
  bgm.connect(pauseFilter).connect(pauseGain).connect(master);
  master.connect(limiter).connect(trim).connect(ctx.destination);

  return { sfx, bgm, reverb: convolver, pauseFilter, pauseGain };
}

export function applyVolume(graph: MixGraph, now: number, channel: 'sfx' | 'bgm', volume: number): void {
  const bus = channel === 'sfx' ? graph.sfx : graph.bgm;
  const base = channel === 'sfx' ? MIX.sfxBus : MIX.bgmBus;
  bus.gain.setTargetAtTime(base * volumeToGain(volume), now, VOLUME_SMOOTH);
}

export function applyPause(graph: MixGraph, now: number, paused: boolean): void {
  graph.pauseFilter.frequency.setTargetAtTime(paused ? MIX.pausedCutoff : OPEN_CUTOFF, now, PAUSE_SMOOTH);
  graph.pauseGain.gain.setTargetAtTime(paused ? MIX.pausedGain : 1, now, PAUSE_SMOOTH);
}
