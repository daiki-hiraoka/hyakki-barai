import type { InstrumentId } from './song';
import { FLOOR, type Voice, glide, harmonicWave, pluck, swell } from './voice';

/**
 * 楽器の音色。すべてオシレーター・ノイズ・フィルターの組み合わせで合成する（音声ファイルは使わない）。
 * 振幅は vel = 1 でおおむね 0.3〜0.8 に揃え、曲の中の音量はトラックの gain で決める。
 */

export interface NoteParams {
  readonly freq: number;
  /** 音符の長さ（秒）。撥弦・打楽器は自然に減衰するので目安にだけ使う */
  readonly dur: number;
  /** 強さ（0〜1） */
  readonly vel: number;
}

export type InstrumentFn = (v: Voice, out: AudioNode, t: number, n: NoteParams) => void;

// ---- 効果音とも共有する部品 ----

/** 単純な減衰音（オシレーター → 包絡 → out） */
export function tone(
  v: Voice,
  out: AudioNode,
  type: OscillatorType | PeriodicWave,
  freq: number,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): OscillatorNode {
  const g = v.gain();
  const end = pluck(g.gain, t, peak, attack, decay);
  const o = v.osc(type, freq, t, end);
  o.connect(g).connect(out);
  return o;
}

/** フィルターを通した短いノイズ（打音・擦れ・息） */
export function noiseBurst(
  v: Voice,
  out: AudioNode,
  type: BiquadFilterType,
  freq: number,
  q: number,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): BiquadFilterNode {
  const g = v.gain();
  const end = pluck(g.gain, t, peak, attack, decay);
  const f = v.filter(type, freq, q);
  v.noise(t, end).connect(f).connect(g).connect(out);
  return f;
}

/** 管楽器の息の音。吹き始めを強く、その後は弱く続ける */
function breath(v: Voice, out: AudioNode, t: number, dur: number, end: number, center: number, q: number, peak: number): void {
  const g = v.gain();
  const settle = t + 0.2;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.03);
  g.gain.exponentialRampToValueAtTime(peak * 0.35, settle);
  g.gain.setValueAtTime(peak * 0.35, Math.max(settle, t + dur));
  g.gain.exponentialRampToValueAtTime(FLOOR, Math.max(end, settle + 0.05));
  const f = v.filter('bandpass', center, q);
  v.noise(t, Math.max(end, settle + 0.05)).connect(f).connect(g).connect(out);
}

/** 遅れて深くなるビブラート（尺八・笛の歌い方） */
function delayedVibrato(v: Voice, o: OscillatorNode, t: number, end: number, rate: number, depthHz: number, delay: number): void {
  const vib = v.lfo(o.frequency, rate, 0, t, end);
  vib.gain.setValueAtTime(0, t);
  vib.gain.linearRampToValueAtTime(depthHz, t + delay);
}

const KOTO_AMPS = [1, 0.55, 0.32, 0.22, 0.12, 0.08, 0.05, 0.03];
const SHAKUHACHI_AMPS = [1, 0.22, 0.1, 0.05, 0.02];
const FUE_AMPS = [1, 0.12, 0.06, 0.02];
const SHO_AMPS = [1, 0.5, 0.42, 0.3, 0.22, 0.16, 0.12, 0.08, 0.05];
/** [倍率, 強さ, 減衰秒]。基音のすぐ上に双子の部分音を置き、梵鐘らしいゆっくりした唸りを出す */
const BONSHO_PARTIALS: readonly (readonly [number, number, number])[] = [
  [0.5, 0.5, 6],
  [1, 0.55, 4.5],
  [1.004, 0.4, 4.5],
  [1.19, 0.3, 3.2],
  [1.51, 0.26, 2.6],
  [2.0, 0.2, 2.0],
  [2.52, 0.14, 1.5],
  [3.01, 0.1, 1.1],
  [4.07, 0.06, 0.7],
];

export const INSTRUMENTS: Readonly<Record<InstrumentId, InstrumentFn>> = {
  /** 大太鼓：サイン波の音程を素早く下げた胴鳴り＋皮を打つ短いノイズ */
  odaiko(v, out, t, { freq, vel }) {
    const body = v.gain();
    const end = pluck(body.gain, t, 0.8 * vel, 0.003, 0.9);
    const o = v.osc('sine', freq * 2.2, t, end);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.07);
    o.frequency.exponentialRampToValueAtTime(freq * 0.85, end);
    o.connect(body).connect(out);
    // ノートパソコンのスピーカーでも聞こえるよう、2 倍音を短く足す
    tone(v, out, 'sine', freq * 2.02, t, 0.22 * vel, 0.002, 0.18);
    noiseBurst(v, out, 'lowpass', 1100, 0.7, t, 0.3 * vel, 0.001, 0.05);
  },

  /** 締太鼓：高めのノイズをバンドパスで絞った乾いた打音＋短い膜の音 */
  shime(v, out, t, { freq, vel }) {
    noiseBurst(v, out, 'bandpass', freq * 4.5, 1.6, t, 0.55 * vel, 0.0008, 0.07);
    const o = tone(v, out, 'triangle', freq * 1.2, t, 0.3 * vel, 0.0008, 0.08);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.03);
  },

  /** 当たり鉦：非整数倍の倍音で金属らしく。耳に刺さらないよう小さく短く */
  kane(v, out, t, { freq, vel }) {
    tone(v, out, 'sine', freq, t, 0.5 * vel, 0.0008, 0.22);
    tone(v, out, 'sine', freq * 2.76, t, 0.3 * vel, 0.0008, 0.12);
    tone(v, out, 'sine', freq * 5.4, t, 0.15 * vel, 0.0008, 0.06);
    noiseBurst(v, out, 'highpass', 6000, 0.7, t, 0.15 * vel, 0.0005, 0.012);
  },

  /** 拍子木：硬い木の打音。共鳴の強いバンドパスで「カッ」という音程感を出す */
  hyoshigi(v, out, t, { freq, vel }) {
    noiseBurst(v, out, 'bandpass', freq * 2, 7, t, 0.5 * vel, 0.0005, 0.045);
    tone(v, out, 'sine', freq, t, 0.3 * vel, 0.0005, 0.06);
    tone(v, out, 'sine', freq * 2.49, t, 0.1 * vel, 0.0005, 0.03);
  },

  /** 低音：のこぎり波＋サブのサイン波。撥で弾いたように、フィルターを明るい → 暗いへ閉じる */
  bass(v, out, t, { freq, dur, vel }) {
    const a = Math.max(vel, 0.01);
    const hold = Math.max(0.06, dur * 0.85);
    const end = t + hold + 0.12;
    const g = v.gain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5 * a, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.22 * a, t + hold);
    g.gain.exponentialRampToValueAtTime(FLOOR, end);
    const f = v.filter('lowpass', freq * 3, 2.5);
    glide(f.frequency, t, Math.min(freq * 14, 3000), freq * 3, 0.18);
    v.osc('sawtooth', freq, t, end).connect(f);
    const sub = v.gain(0.6);
    v.osc('sine', freq, t, end).connect(sub).connect(f);
    f.connect(g).connect(out);
  },

  /** 三味線風：のこぎり波を共鳴の強いローパスで速く閉じる＋撥の当たりの上ずり＋撥のノイズ */
  shamisen(v, out, t, { freq, dur, vel }) {
    const decay = Math.min(0.5, Math.max(0.18, dur * 1.5));
    const g = v.gain();
    const end = pluck(g.gain, t, 0.36 * vel, 0.002, decay);
    const f = v.filter('lowpass', freq * 2.2, 3);
    glide(f.frequency, t, Math.min(freq * 14, 9000), freq * 2.2, decay * 0.7);
    const o = v.osc('sawtooth', freq * 1.012, t, end);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.035);
    o.connect(f).connect(g).connect(out);
    noiseBurst(v, out, 'highpass', 2500, 0.7, t, 0.18 * vel, 0.0005, 0.018);
  },

  /** 箏風：倍音を持たせた波形を、弾いた直後だけ明るくして中くらいの長さで減衰させる */
  koto(v, out, t, { freq, vel }) {
    const g = v.gain();
    const end = pluck(g.gain, t, 0.38 * vel, 0.002, 1.4);
    const f = v.filter('lowpass', freq * 1.8, 1);
    glide(f.frequency, t, Math.min(freq * 10, 8000), freq * 1.8, 0.8);
    const o = v.osc(harmonicWave(v.ctx, 'koto', KOTO_AMPS), freq * 1.006, t, end);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.04);
    o.connect(f).connect(g).connect(out);
    noiseBurst(v, out, 'bandpass', 3200, 1.5, t, 0.12 * vel, 0.0005, 0.012);
  },

  /** 尺八風：倍音の少ない柔らかい音を、メリ（少し低い音）から持ち上げる。遅れてかかるビブラートと息の音 */
  shakuhachi(v, out, t, { freq, dur, vel }) {
    const a = Math.max(vel, 0.01);
    const g = v.gain();
    const end = swell(g.gain, t, 0.36 * a, 0.09, dur, 0.28);
    const o = v.osc(harmonicWave(v.ctx, 'shakuhachi', SHAKUHACHI_AMPS), freq * 2 ** (-0.8 / 12), t, end);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.14);
    delayedVibrato(v, o, t, end, 4.8, freq * 0.007, Math.min(0.6, Math.max(0.05, dur)));
    o.connect(g).connect(out);
    breath(v, out, t, dur, end, freq * 2, 1.2, 0.16 * a);
  },

  /** 篠笛風：尺八より明るく速い立ち上がり。高音が耳に刺さらないようローパスをかける */
  fue(v, out, t, { freq, dur, vel }) {
    const a = Math.max(vel, 0.01);
    const g = v.gain();
    const end = swell(g.gain, t, 0.3 * a, 0.03, dur, 0.14);
    const o = v.osc(harmonicWave(v.ctx, 'fue', FUE_AMPS), freq * 2 ** (-0.35 / 12), t, end);
    o.frequency.exponentialRampToValueAtTime(freq, t + 0.05);
    delayedVibrato(v, o, t, end, 5.6, freq * 0.005, Math.min(0.4, Math.max(0.05, dur)));
    const lp = v.filter('lowpass', 5000, 0.5);
    o.connect(lp).connect(g).connect(out);
    breath(v, out, t, dur, end, freq * 1.5, 0.9, 0.07 * a);
  },

  /** ドローン：わずかにずらした低いのこぎり波 2 本をローパスで丸め、カットオフをゆっくり揺らす */
  drone(v, out, t, { freq, dur, vel }) {
    const a = Math.max(vel, 0.01);
    const g = v.gain();
    const end = swell(g.gain, t, 0.22 * a, Math.min(2.5, dur * 0.5), dur, 2.5);
    const f = v.filter('lowpass', freq * 4.5, 0.8);
    v.lfo(f.frequency, 0.07, freq * 1.2, t, end);
    for (const cents of [-7, 6]) v.osc('sawtooth', freq * 2 ** (cents / 1200), t, end).connect(f);
    f.connect(g).connect(out);
  },

  /** 笙風：倍音の多いリードの音を 2 本わずかにずらして重ね、ゆっくり膨らませる */
  sho(v, out, t, { freq, dur, vel }) {
    const a = Math.max(vel, 0.01);
    const g = v.gain();
    const end = swell(g.gain, t, 0.12 * a, Math.min(1.2, dur * 0.4), dur, 1.4);
    const f = v.filter('lowpass', 2600, 0.5);
    const wave = harmonicWave(v.ctx, 'sho', SHO_AMPS);
    for (const cents of [0, 5]) v.osc(wave, freq * 2 ** (cents / 1200), t, end).connect(f);
    f.connect(g).connect(out);
  },

  /** 梵鐘：非整数倍の部分音を長く鳴らす。高い部分音ほど早く消える */
  bonsho(v, out, t, { freq, vel }) {
    for (const [ratio, amp, decay] of BONSHO_PARTIALS) tone(v, out, 'sine', freq * ratio, t, 0.18 * amp * vel, 0.004, decay);
    noiseBurst(v, out, 'lowpass', 600, 0.7, t, 0.18 * vel, 0.002, 0.12);
  },

  /** 夜風：ノイズをバンドパスで絞り、中心周波数と強さをゆっくり揺らす */
  wind(v, out, t, { freq, dur, vel }) {
    const a = Math.max(vel, 0.01);
    const g = v.gain();
    const end = swell(g.gain, t, 0.5 * a, Math.min(3, dur * 0.4), dur, 3);
    const f = v.filter('bandpass', freq, 2.2);
    v.lfo(f.frequency, 0.13, freq * 0.4, t, end);
    // 突風の揺れは包絡とは別の段でかける（包絡に直接足すと、消え際に音が残って最後に途切れるため）
    const gust = v.gain(0.75);
    v.lfo(gust.gain, 0.21, 0.25, t, end);
    v.noise(t, end).connect(f).connect(gust).connect(g).connect(out);
  },
};
