/**
 * 発音の部品。1 回の発音で作るノードを Voice にまとめ、最後に止まる音源の onended で全部切り離す。
 * ノードを発音ごとに使い捨てにするのは、Web Audio の音源ノードが一度しか start できないため。
 * 切り離しを忘れると、鳴り終わったノードがグラフに残り続けて重くなる。
 *
 * どの関数も BaseAudioContext と開始時刻を受け取るので、実時間（AudioContext）と
 * オフライン（OfflineAudioContext）で同じ発音コードを使える。
 */

/** 減衰の行き先。指数ランプは 0 を目標にできないので、聞こえない大きさ（-80dB）で代える */
export const FLOOR = 0.0001;

/** 決定的な乱数（mulberry32）。ノイズや残響を毎回同じにして、オフラインの測定を再現できるようにする */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- コンテキストごとに 1 回だけ作って共有するもの ----

const NOISE_SECONDS = 3;
const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** ホワイトノイズ（3 秒・ループ用）。毎回作るとメモリと GC の負担が大きいので共有する */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const len = Math.floor(ctx.sampleRate * NOISE_SECONDS);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const rnd = seededRandom(1);
    for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

const reverbCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/**
 * 残響のインパルス応答（約 2.6 秒・ステレオ）を合成する。音声ファイルを使わないための自作。
 * 左右で別の乱数にして広がりを出し、時間とともに高域を落として夜の山の空気のような暗い残響にする。
 */
export function reverbBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = reverbCache.get(ctx);
  if (!buf) {
    const sr = ctx.sampleRate;
    const seconds = 2.6;
    const len = Math.floor(sr * seconds);
    const preDelay = Math.floor(0.015 * sr);
    buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      const rnd = seededRandom(11 + ch);
      let lp = 0;
      for (let i = preDelay; i < len; i++) {
        const t = (i - preDelay) / sr;
        // 一次ローパスの係数を時間とともに小さくして、余韻ほど暗くする
        lp += (0.9 - 0.75 * Math.min(1, t / 2)) * (rnd() * 2 - 1 - lp);
        d[i] = lp * Math.exp(-t * 2.6);
      }
    }
    reverbCache.set(ctx, buf);
  }
  return buf;
}

const waveCache = new WeakMap<BaseAudioContext, Map<string, PeriodicWave>>();

/**
 * 倍音の強さの並びから波形を作る（1 個のオシレーターで倍音を鳴らせるので、重ねるより軽い）。
 * name ごとにコンテキスト内で共有する。
 */
export function harmonicWave(ctx: BaseAudioContext, name: string, amps: readonly number[]): PeriodicWave {
  let byName = waveCache.get(ctx);
  if (!byName) {
    byName = new Map();
    waveCache.set(ctx, byName);
  }
  let wave = byName.get(name);
  if (!wave) {
    const real = new Float32Array(amps.length + 1);
    const imag = new Float32Array(amps.length + 1);
    amps.forEach((a, i) => {
      imag[i + 1] = a;
    });
    wave = ctx.createPeriodicWave(real, imag);
    byName.set(name, wave);
  }
  return wave;
}

// ---- 包絡 ----

/** 撥・打撃の包絡：0 から attack 秒で peak、decay 秒かけて聞こえなくなるまで指数的に減衰。終わる時刻を返す */
export function pluck(p: AudioParam, t: number, peak: number, attack: number, decay: number): number {
  const pk = Math.max(peak, FLOOR * 2);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + attack);
  p.exponentialRampToValueAtTime(FLOOR, t + attack + decay);
  return t + attack + decay;
}

/** 持続音の包絡：attack 秒で peak、hold 秒まで保ち、release 秒で減衰。終わる時刻を返す */
export function swell(p: AudioParam, t: number, peak: number, attack: number, hold: number, release: number): number {
  const pk = Math.max(peak, FLOOR * 2);
  const holdEnd = t + Math.max(attack, hold);
  p.setValueAtTime(0, t);
  p.linearRampToValueAtTime(pk, t + attack);
  p.setValueAtTime(pk, holdEnd);
  p.exponentialRampToValueAtTime(FLOOR, holdEnd + release);
  return holdEnd + release;
}

/** 値を from から to へ dur 秒で指数的に動かす（音程の下降やフィルターの掃引） */
export function glide(p: AudioParam, t: number, from: number, to: number, dur: number): void {
  p.setValueAtTime(from, t);
  p.exponentialRampToValueAtTime(to, t + dur);
}

// ---- 1 回分の発音 ----

/**
 * DOM の型定義では PeriodicWave が空のインターフェースなので、typeof で絞り込むと string と区別できない。
 * 型の述語で「波形か、波形の名前か」を分ける（PeriodicWave のグローバルを参照しないので Node でも動く）。
 */
function isPeriodicWave(type: OscillatorType | PeriodicWave): type is PeriodicWave {
  return typeof type !== 'string';
}

export class Voice {
  private readonly nodes: AudioNode[] = [];
  private readonly sources: { readonly src: AudioScheduledSourceNode; readonly stop: number }[] = [];
  private last: AudioScheduledSourceNode | null = null;
  private lastStop = 0;

  constructor(
    readonly ctx: BaseAudioContext,
    /** ノイズの読み出し位置などのばらつき用 */
    readonly rand: () => number = Math.random,
  ) {}

  /** 作ったノードを登録する（finish で切り離す対象にする） */
  add<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }

  gain(value = 0): GainNode {
    const g = this.add(this.ctx.createGain());
    g.gain.value = value;
    return g;
  }

  filter(type: BiquadFilterType, freq: number, q = 0.707): BiquadFilterNode {
    const f = this.add(this.ctx.createBiquadFilter());
    f.type = type;
    f.frequency.value = Math.min(Math.max(freq, 20), this.ctx.sampleRate / 2 - 100);
    f.Q.value = q;
    return f;
  }

  panner(pan: number): StereoPannerNode {
    const p = this.add(this.ctx.createStereoPanner());
    p.pan.value = Math.min(1, Math.max(-1, pan));
    return p;
  }

  osc(type: OscillatorType | PeriodicWave, freq: number, start: number, stop: number): OscillatorNode {
    const o = this.add(this.ctx.createOscillator());
    if (isPeriodicWave(type)) o.setPeriodicWave(type);
    else o.type = type;
    o.frequency.setValueAtTime(freq, start);
    o.start(start);
    o.stop(stop);
    this.track(o, stop);
    return o;
  }

  /** 共有ノイズを、毎回違う位置から読み出す（同じ打音が機械的に聞こえないように） */
  noise(start: number, stop: number): AudioBufferSourceNode {
    const src = this.add(this.ctx.createBufferSource());
    const buf = noiseBuffer(this.ctx);
    src.buffer = buf;
    src.loop = true;
    src.start(start, this.rand() * (buf.duration - 0.5));
    src.stop(stop);
    this.track(src, stop);
    return src;
  }

  /** ゆっくり揺らす LFO を param につなぐ（ビブラートやフィルターの揺れ） */
  lfo(param: AudioParam, rate: number, depth: number, start: number, stop: number, type: OscillatorType = 'sine'): GainNode {
    const o = this.osc(type, rate, start, stop);
    const g = this.gain(depth);
    o.connect(g);
    g.connect(param);
    return g;
  }

  /**
   * 最後に止まる音源の onended で、作ったノードを全て切り離す。鳴り終わる時刻を返す。
   * onDone は切り離した後に呼ぶ（曲の再生側が、鳴っている音の一覧から外すため）。
   */
  finish(onDone?: () => void): number {
    const nodes = this.nodes;
    const release = () => {
      for (const n of nodes) n.disconnect();
      onDone?.();
    };
    if (this.last) this.last.onended = release;
    else release();
    return this.lastStop;
  }

  /** 予定より早く止める（曲を片付けるとき、長い音を鳴らしっぱなしにしないため）。onended で切り離される */
  stopAt(when: number): void {
    // stop() を呼び直すと停止時刻が置き換わるので、早めるときだけ呼ぶ（延ばさない）
    for (const s of this.sources) if (when < s.stop) s.src.stop(Math.max(0, when));
  }

  private track(src: AudioScheduledSourceNode, stop: number): void {
    this.sources.push({ src, stop });
    if (this.last === null || stop >= this.lastStop) {
      this.last = src;
      this.lastStop = stop;
    }
  }
}
