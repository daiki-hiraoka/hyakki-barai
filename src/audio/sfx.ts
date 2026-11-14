import { INSTRUMENTS, noiseBurst, tone } from './instruments';
import type { SfxId, SfxOptions } from './port';
import { YONANUKI_MAJOR, YO_SCALE, degreeToMidi, midiToFreq } from './theory';
import type { SfxRule } from './throttle';
import { Voice, glide, pluck, swell } from './voice';

/**
 * 効果音。すべて短く、木・紙・金属・太鼓といった和の質感で合成する。
 * 頻出する音（hit・kill・gem・武器）ほど小さく短くし、乱戦で重なっても BGM を覆わないようにする。
 * 高い音は同じ振幅でも大きく聞こえるので、鈴や金属音は振幅を小さめにしている。
 */

export interface SfxParams {
  /** 音程の倍率 */
  readonly pitch: number;
  /** ばらつき用の乱数（オフラインの測定では固定できるように外から渡す） */
  readonly rand: () => number;
}

export interface SfxDef extends SfxRule {
  /** 公称の長さ（秒）。同時発音数を数えるのに使う */
  readonly len: number;
  readonly play: (v: Voice, out: AudioNode, t: number, p: SfxParams) => void;
}

const freqOf = (scale: readonly number[], root: number, degree: number) => midiToFreq(degreeToMidi(scale, root, degree));

/** 小さな鈴・金属の粒 */
function bell(v: Voice, out: AudioNode, f: number, t: number, peak: number, decay: number): void {
  tone(v, out, 'sine', f, t, peak, 0.001, decay);
  tone(v, out, 'sine', f * 2.4, t, peak * 0.4, 0.001, decay * 0.5);
}

/** 小判の「チャリン」：非整数倍の部分音と、触れた瞬間の高いノイズ */
function coin(v: Voice, out: AudioNode, f: number, t: number, peak: number): void {
  [1, 1.5, 2.21, 2.95].forEach((r, i) => tone(v, out, 'sine', f * r, t, peak / (i + 1), 0.0008, 0.35 / (1 + i * 0.4)));
  noiseBurst(v, out, 'highpass', 6000, 0.7, t, peak * 0.4, 0.0005, 0.01);
}

/** ノイズのフィルターを f0 → f1 へ掃引する（風切り・炎・紙の擦れ） */
function sweep(
  v: Voice,
  out: AudioNode,
  type: BiquadFilterType,
  f0: number,
  f1: number,
  q: number,
  t: number,
  peak: number,
  attack: number,
  decay: number,
): void {
  const f = noiseBurst(v, out, type, f0, q, t, peak, attack, decay);
  glide(f.frequency, t, f0, f1, attack + decay);
}

/** 音程が下がる打音（太鼓・衝撃） */
function drop(v: Voice, out: AudioNode, type: OscillatorType, f0: number, f1: number, t: number, peak: number, decay: number): void {
  tone(v, out, type, f0, t, peak, 0.002, decay).frequency.exponentialRampToValueAtTime(f1, t + decay * 0.9);
}

const W = 0.06; // 武器音の最小間隔

export const SFX_DEFS: Readonly<Record<SfxId, SfxDef>> = {
  // ---- UI ----
  ui_move: {
    minInterval: 0.03,
    maxVoices: 2,
    priority: true,
    len: 0.05,
    play(v, out, t, { pitch: k }) {
      tone(v, out, 'sine', 1500 * k, t, 0.1, 0.001, 0.035);
      noiseBurst(v, out, 'bandpass', 3200 * k, 4, t, 0.05, 0.0005, 0.015);
    },
  },
  ui_confirm: {
    minInterval: 0.05,
    maxVoices: 2,
    priority: true,
    len: 0.16,
    play(v, out, t, { pitch: k }) {
      // 拍子木の「チョン」。少し遅れた弱い 2 打目で木の跳ね返りを出す
      INSTRUMENTS.hyoshigi(v, out, t, { freq: 1150 * k, dur: 0.05, vel: 0.6 });
      INSTRUMENTS.hyoshigi(v, out, t + 0.085, { freq: 1180 * k, dur: 0.05, vel: 0.3 });
    },
  },
  ui_cancel: {
    minInterval: 0.05,
    maxVoices: 2,
    priority: true,
    len: 0.15,
    play(v, out, t, { pitch: k }) {
      drop(v, out, 'triangle', 900 * k, 700 * k, t, 0.12, 0.06);
      noiseBurst(v, out, 'bandpass', 1600 * k, 3, t, 0.08, 0.0005, 0.02);
      drop(v, out, 'triangle', 620 * k, 480 * k, t + 0.07, 0.1, 0.07);
      noiseBurst(v, out, 'bandpass', 1200 * k, 3, t + 0.07, 0.06, 0.0005, 0.02);
    },
  },
  ui_deny: {
    minInterval: 0.08,
    maxVoices: 2,
    priority: true,
    len: 0.22,
    play(v, out, t, { pitch: k }) {
      // ブザーではなく、木箱を叩いたような鈍い 2 打
      for (const [dt, f] of [
        [0, 220],
        [0.11, 190],
      ] as const) {
        drop(v, out, 'sine', f * k, f * 0.5 * k, t + dt, 0.3, 0.09);
        noiseBurst(v, out, 'lowpass', 500 * k, 0.7, t + dt, 0.15, 0.001, 0.04);
      }
    },
  },
  ui_buy: {
    minInterval: 0.06,
    maxVoices: 2,
    priority: true,
    len: 0.42,
    play(v, out, t, { pitch: k }) {
      coin(v, out, 2400 * k, t, 0.12);
      coin(v, out, 2650 * k, t + 0.07, 0.08);
    },
  },

  // ---- 戦闘 ----
  hit: {
    minInterval: 0.035,
    maxVoices: 4,
    len: 0.06,
    play(v, out, t, { pitch, rand }) {
      // 最頻出なので、ごく短く小さく。毎回少し音程を揺らして機械的な連打に聞こえないようにする
      const k = pitch * (0.94 + rand() * 0.12);
      noiseBurst(v, out, 'bandpass', 1700 * k, 1.2, t, 0.14, 0.0008, 0.035);
      drop(v, out, 'sine', 260 * k, 130 * k, t, 0.12, 0.045);
    },
  },
  crit: {
    minInterval: 0.05,
    maxVoices: 3,
    len: 0.14,
    play(v, out, t, { pitch: k }) {
      noiseBurst(v, out, 'highpass', 3200 * k, 0.7, t, 0.16, 0.0005, 0.05);
      drop(v, out, 'triangle', 1900 * k, 1500 * k, t, 0.12, 0.09);
      tone(v, out, 'sine', 3100 * k, t, 0.05, 0.0008, 0.13);
      drop(v, out, 'sine', 300 * k, 120 * k, t, 0.12, 0.06);
    },
  },
  kill: {
    minInterval: 0.045,
    maxVoices: 4,
    len: 0.24,
    play(v, out, t, { pitch, rand }) {
      // 煙になって消える柔らかい「ポフ」：ローパスを閉じていくノイズ
      const k = pitch * (0.92 + rand() * 0.16);
      sweep(v, out, 'lowpass', 1800 * k, 250 * k, 1, t, 0.2, 0.012, 0.2);
      drop(v, out, 'sine', 180 * k, 90 * k, t, 0.1, 0.1);
    },
  },
  player_hurt: {
    minInterval: 0.12,
    maxVoices: 2,
    priority: true,
    len: 0.3,
    play(v, out, t, { pitch: k }) {
      drop(v, out, 'sine', 150 * k, 55 * k, t, 0.4, 0.25);
      noiseBurst(v, out, 'lowpass', 700 * k, 0.7, t, 0.22, 0.001, 0.12);
      tone(v, out, 'triangle', 82 * k, t, 0.1, 0.003, 0.2);
    },
  },
  break: {
    minInterval: 0.08,
    maxVoices: 3,
    len: 0.33,
    play(v, out, t, { pitch: k, rand }) {
      // 石灯籠が崩れる：鈍い衝撃のあと、大小の石が崩れ落ちる粒
      drop(v, out, 'sine', 120 * k, 60 * k, t, 0.3, 0.15);
      noiseBurst(v, out, 'lowpass', 1500 * k, 0.7, t, 0.22, 0.002, 0.12);
      for (let i = 0; i < 6; i++) {
        const dt = i * 0.045 + rand() * 0.025;
        noiseBurst(v, out, 'bandpass', (900 + rand() * 1500) * k, 3, t + dt, 0.18 * (1 - i / 7), 0.001, 0.03 + rand() * 0.03);
      }
    },
  },

  // ---- 取得 ----
  gem: {
    minInterval: 0.03,
    maxVoices: 4,
    len: 0.16,
    play(v, out, t, { pitch: k }) {
      // 澄んだ短い音。連続取得の音程は呼び出し側が pitch で渡す
      tone(v, out, 'sine', 880 * k, t, 0.14, 0.002, 0.14);
      tone(v, out, 'sine', 1760 * k, t, 0.04, 0.002, 0.07);
    },
  },
  coin: {
    minInterval: 0.04,
    maxVoices: 3,
    len: 0.36,
    play(v, out, t, { pitch: k }) {
      coin(v, out, 2600 * k, t, 0.11);
    },
  },
  item: {
    minInterval: 0.08,
    maxVoices: 2,
    len: 0.34,
    play(v, out, t, { pitch: k }) {
      [0, 2, 3].forEach((d, i) => {
        const f = freqOf(YO_SCALE, 81, d) * k;
        tone(v, out, 'triangle', f, t + i * 0.06, 0.12, 0.002, 0.2);
        tone(v, out, 'sine', f * 2, t + i * 0.06, 0.03, 0.002, 0.1);
      });
    },
  },
  heal: {
    minInterval: 0.15,
    maxVoices: 2,
    len: 0.6,
    play(v, out, t, { pitch: k }) {
      const g = v.gain();
      const end = swell(g.gain, t, 0.16, 0.08, 0.25, 0.3);
      const o = v.osc('sine', 440 * k, t, end);
      o.frequency.exponentialRampToValueAtTime(990 * k, t + 0.45);
      o.connect(g).connect(out);
      [1320, 1760, 1980].forEach((f, i) => tone(v, out, 'sine', f * k, t + 0.1 + i * 0.1, 0.05, 0.002, 0.25));
    },
  },

  // ---- 進行 ----
  level_up: {
    minInterval: 0.2,
    maxVoices: 1,
    priority: true,
    len: 0.72,
    play(v, out, t, { pitch: k }) {
      // ヨナ抜き長音階を駆け上がるアルペジオ。最後の音だけ長く残す
      for (let i = 0; i < 6; i++) {
        const f = freqOf(YONANUKI_MAJOR, 74, i) * k;
        const last = i === 5;
        tone(v, out, 'triangle', f, t + i * 0.055, last ? 0.14 : 0.11, 0.002, last ? 0.45 : 0.2);
        tone(v, out, 'sine', f * 2, t + i * 0.055, 0.03, 0.002, last ? 0.3 : 0.12);
      }
      INSTRUMENTS.kane(v, out, t + 0.275, { freq: 2349 * k, dur: 0.2, vel: 0.25 });
    },
  },
  chest_open: {
    minInterval: 0.5,
    maxVoices: 1,
    priority: true,
    len: 1.2,
    play(v, out, t, { pitch: k }) {
      // つづらの蓋がきしんで開き、きらめきが昇っていく（期待感）
      sweep(v, out, 'bandpass', 420 * k, 900 * k, 9, t, 0.12, 0.05, 0.22);
      drop(v, out, 'sine', 300 * k, 150 * k, t + 0.26, 0.2, 0.12);
      for (let i = 0; i < 8; i++) {
        tone(v, out, 'sine', freqOf(YO_SCALE, 81, i) * k, t + 0.3 + i * 0.08, 0.04 + i * 0.004, 0.002, 0.3);
      }
    },
  },
  chest_item: {
    minInterval: 0.12,
    maxVoices: 2,
    priority: true,
    len: 0.45,
    play(v, out, t, { pitch: k }) {
      tone(v, out, 'sine', 520 * k, t, 0.22, 0.004, 0.12).frequency.exponentialRampToValueAtTime(780 * k, t + 0.1);
      tone(v, out, 'sine', 1568 * k, t + 0.05, 0.07, 0.002, 0.35);
      tone(v, out, 'sine', 3136 * k, t + 0.05, 0.02, 0.002, 0.18);
    },
  },
  evolve: {
    minInterval: 0.8,
    maxVoices: 1,
    priority: true,
    len: 2.6,
    play(v, out, t, { pitch: k, rand }) {
      // 武器の覚醒：大太鼓の一打、笙の和音がふくらみ、神楽鈴が降る
      INSTRUMENTS.odaiko(v, out, t, { freq: 55 * k, dur: 1, vel: 0.9 });
      for (const m of [62, 69, 74, 76]) INSTRUMENTS.sho(v, out, t + 0.05, { freq: midiToFreq(m) * k, dur: 1.1, vel: 0.8 });
      for (let i = 0; i < 7; i++) bell(v, out, (3000 + rand() * 1500) * k, t + 0.35 + rand() * 0.12, 0.035, 0.5);
    },
  },
  revive: {
    minInterval: 0.8,
    maxVoices: 1,
    priority: true,
    len: 1.4,
    play(v, out, t, { pitch: k }) {
      sweep(v, out, 'bandpass', 300 * k, 3000 * k, 2, t, 0.16, 0.25, 0.5);
      [62, 69, 74, 81].forEach((m, i) => {
        const tt = t + 0.1 + i * 0.12;
        const g = v.gain();
        const end = swell(g.gain, tt, 0.09, 0.03, 0.3, 0.6);
        v.osc('triangle', midiToFreq(m) * k, tt, end).connect(g).connect(out);
      });
      bell(v, out, 1760 * k, t + 0.46, 0.06, 0.8);
    },
  },
  death: {
    minInterval: 1.0,
    maxVoices: 1,
    priority: true,
    len: 1.9,
    play(v, out, t, { pitch: k }) {
      // 力尽きる：暗くなりながら沈んでいく音と、弱い大太鼓
      const g = v.gain();
      const end = swell(g.gain, t, 0.22, 0.02, 0.6, 1.2);
      const f = v.filter('lowpass', 900 * k, 1);
      glide(f.frequency, t, 900 * k, 200 * k, 1.6);
      const o = v.osc('sawtooth', 220 * k, t, end);
      o.frequency.exponentialRampToValueAtTime(55 * k, t + 1.6);
      o.connect(f).connect(g).connect(out);
      INSTRUMENTS.odaiko(v, out, t, { freq: 49 * k, dur: 1, vel: 0.7 });
    },
  },
  dawn: {
    minInterval: 1.5,
    maxVoices: 1,
    priority: true,
    len: 3.1,
    play(v, out, t, { pitch: k }) {
      // 夜明けの勝利：明るい笙の和音と、ヨナ抜き長音階で昇るきらめき
      for (const m of [74, 76, 81, 83, 86]) INSTRUMENTS.sho(v, out, t, { freq: midiToFreq(m) * k, dur: 1.6, vel: 0.7 });
      for (let i = 0; i < 8; i++) {
        const f = freqOf(YONANUKI_MAJOR, 74, i) * k;
        tone(v, out, 'triangle', f, t + 0.2 + i * 0.09, 0.08, 0.002, 0.5);
        tone(v, out, 'sine', f * 2, t + 0.2 + i * 0.09, 0.02, 0.002, 0.25);
      }
      INSTRUMENTS.odaiko(v, out, t, { freq: 62 * k, dur: 1, vel: 0.5 });
    },
  },
  boss_warn: {
    minInterval: 1.5,
    maxVoices: 1,
    priority: true,
    len: 2.5,
    play(v, out, t, { pitch: k }) {
      // 大妖の接近：大太鼓 3 打と、揺れる低い唸り
      [0, 0.42, 0.84].forEach((dt, i) => INSTRUMENTS.odaiko(v, out, t + dt, { freq: 46 * k, dur: 1, vel: i === 2 ? 1 : 0.75 }));
      const g = v.gain();
      const end = swell(g.gain, t, 0.2, 0.6, 1.6, 0.8);
      const f = v.filter('lowpass', 240 * k, 4);
      for (const cents of [-12, 10]) v.osc('sawtooth', 46 * k * 2 ** (cents / 1200), t, end).connect(f);
      const trem = v.gain(0.7);
      v.lfo(trem.gain, 7, 0.3, t, end);
      f.connect(trem).connect(g).connect(out);
    },
  },
  boss_kill: {
    minInterval: 1.0,
    maxVoices: 1,
    priority: true,
    len: 2.2,
    play(v, out, t, { pitch: k }) {
      sweep(v, out, 'lowpass', 4000 * k, 180 * k, 0.8, t, 0.4, 0.004, 1.3);
      INSTRUMENTS.odaiko(v, out, t, { freq: 44 * k, dur: 1, vel: 1 });
      [880, 1318.5, 1760].forEach((f, i) => bell(v, out, f * k, t + 0.25 + i * 0.12, 0.07, 1.6));
      INSTRUMENTS.kane(v, out, t + 0.25, { freq: 1175 * k, dur: 0.3, vel: 0.5 });
    },
  },
  event_warn: {
    minInterval: 1.0,
    maxVoices: 1,
    priority: true,
    len: 1.8,
    play(v, out, t, { pitch: k }) {
      // 異変の予兆：半音でぶつかる 2 つの鐘（D と E♭）が震え、低い音が膨らむ
      for (const m of [74, 75]) {
        const g = v.gain();
        const end = pluck(g.gain, t, 0.08, 0.01, 1.6);
        const trem = v.gain(0.7);
        v.lfo(trem.gain, 6, 0.3, t, end);
        v.osc('sine', midiToFreq(m) * k, t, end).connect(trem).connect(g).connect(out);
        tone(v, out, 'sine', midiToFreq(m) * 2.76 * k, t, 0.02, 0.005, 0.6);
      }
      const g = v.gain();
      const end = swell(g.gain, t, 0.12, 0.4, 0.8, 0.9);
      const f = v.filter('lowpass', 300 * k, 1);
      v.osc('sawtooth', 73.4 * k, t, end).connect(f).connect(g).connect(out);
    },
  },
  nuke: {
    minInterval: 0.5,
    maxVoices: 1,
    priority: true,
    len: 2.2,
    play(v, out, t, { pitch: k, rand }) {
      // 大祓の札：吸い込むように昇るノイズ → 大太鼓と鈴と笙で一掃する
      sweep(v, out, 'bandpass', 200 * k, 5000 * k, 1.5, t, 0.18, 0.45, 0.15);
      const hit = t + 0.5;
      INSTRUMENTS.odaiko(v, out, hit, { freq: 50 * k, dur: 1, vel: 1 });
      noiseBurst(v, out, 'lowpass', 2500 * k, 0.7, hit, 0.3, 0.002, 0.5);
      for (let i = 0; i < 8; i++) bell(v, out, (2800 + rand() * 2000) * k, hit + rand() * 0.15, 0.03, 0.6);
      for (const m of [74, 81, 86]) INSTRUMENTS.sho(v, out, hit, { freq: midiToFreq(m) * k, dur: 0.3, vel: 0.6 });
    },
  },
  freeze: {
    minInterval: 0.5,
    maxVoices: 1,
    priority: true,
    len: 1.4,
    play(v, out, t, { pitch: k }) {
      // 金縛りの札：高く澄んだ音がわずかに下がりながら凍りつく
      for (const [f, dt] of [
        [2637, 0],
        [2650, 0],
        [3520, 0.03],
        [3951, 0.06],
      ] as const) {
        const g = v.gain();
        const end = pluck(g.gain, t + dt, 0.045, 0.004, 1.3);
        const o = v.osc('sine', f * k, t + dt, end);
        o.frequency.exponentialRampToValueAtTime(f * 0.94 * k, end);
        o.connect(g).connect(out);
      }
      noiseBurst(v, out, 'highpass', 6000 * k, 0.7, t, 0.07, 0.01, 0.6);
      tone(v, out, 'triangle', 1760 * k, t, 0.05, 0.002, 0.9);
    },
  },

  // ---- 武器（頻出するので短く小さく）----
  w_ofuda: {
    minInterval: W,
    maxVoices: 3,
    len: 0.1,
    play(v, out, t, { pitch, rand }) {
      const k = pitch * (0.95 + rand() * 0.1);
      sweep(v, out, 'bandpass', 1200 * k, 3500 * k, 2, t, 0.14, 0.006, 0.08);
    },
  },
  w_arrow: {
    minInterval: W,
    maxVoices: 3,
    len: 0.18,
    play(v, out, t, { pitch: k }) {
      drop(v, out, 'triangle', 196 * k, 180 * k, t, 0.16, 0.12);
      sweep(v, out, 'bandpass', 3500 * k, 1800 * k, 6, t + 0.01, 0.12, 0.01, 0.15);
    },
  },
  w_staff: {
    minInterval: W,
    maxVoices: 2,
    len: 0.26,
    play(v, out, t, { pitch: k, rand }) {
      // 錫杖：重い振りの風切りと、遊環が鳴る小さな金属音
      sweep(v, out, 'bandpass', 650 * k, 300 * k, 1, t, 0.2, 0.03, 0.16);
      for (const f of [3100, 3600, 4200, 3350]) bell(v, out, f * k, t + 0.04 + rand() * 0.05, 0.035, 0.16);
    },
  },
  w_bead: {
    minInterval: W,
    maxVoices: 3,
    len: 0.1,
    play(v, out, t, { pitch: k, rand }) {
      for (let i = 0; i < 3; i++) {
        const tt = t + i * 0.028 + rand() * 0.01;
        tone(v, out, 'sine', (1800 + rand() * 600) * k, tt, 0.07, 0.0005, 0.03);
        noiseBurst(v, out, 'bandpass', 4000 * k, 2, tt, 0.04, 0.0003, 0.008);
      }
    },
  },
  w_fire: {
    minInterval: W,
    maxVoices: 2,
    len: 0.28,
    play(v, out, t, { pitch: k }) {
      sweep(v, out, 'bandpass', 400 * k, 2200 * k, 1.5, t, 0.2, 0.03, 0.22);
      tone(v, out, 'sine', 90 * k, t, 0.1, 0.01, 0.15).frequency.exponentialRampToValueAtTime(60 * k, t + 0.15);
    },
  },
  w_explode: {
    minInterval: W,
    maxVoices: 3,
    len: 0.4,
    play(v, out, t, { pitch: k }) {
      sweep(v, out, 'lowpass', 3000 * k, 200 * k, 0.8, t, 0.26, 0.003, 0.35);
      drop(v, out, 'sine', 110 * k, 40 * k, t, 0.26, 0.3);
    },
  },
  w_salt: {
    minInterval: W,
    maxVoices: 2,
    len: 0.16,
    play(v, out, t, { pitch: k, rand }) {
      // 塩をまく：細かい粒が散らばる
      for (let i = 0; i < 10; i++) {
        noiseBurst(v, out, 'highpass', (5000 + rand() * 3000) * k, 0.7, t + i * 0.014 + rand() * 0.01, 0.05, 0.0005, 0.012);
      }
    },
  },
  w_wind: {
    minInterval: W,
    maxVoices: 2,
    len: 0.15,
    play(v, out, t, { pitch: k }) {
      sweep(v, out, 'bandpass', 900 * k, 4000 * k, 5, t, 0.16, 0.012, 0.12);
    },
  },
  w_thunder: {
    minInterval: 0.1,
    maxVoices: 2,
    len: 0.95,
    play(v, out, t, { pitch: k }) {
      // 落雷：鋭い破裂、太鼓、遠くへ転がる低い響き
      noiseBurst(v, out, 'highpass', 1800 * k, 0.7, t, 0.28, 0.0005, 0.06);
      noiseBurst(v, out, 'bandpass', 3000 * k, 1, t + 0.02, 0.16, 0.0005, 0.04);
      INSTRUMENTS.odaiko(v, out, t, { freq: 55 * k, dur: 1, vel: 0.5 });
      noiseBurst(v, out, 'lowpass', 260 * k, 0.7, t + 0.03, 0.2, 0.05, 0.8);
    },
  },
  w_crane: {
    minInterval: W,
    maxVoices: 2,
    len: 0.17,
    play(v, out, t, { pitch: k }) {
      // 折り鶴の羽ばたき：紙の擦れを 2 回
      for (let i = 0; i < 2; i++) noiseBurst(v, out, 'bandpass', 1100 * k, 1.2, t + i * 0.085, 0.12, 0.015, 0.06);
    },
  },
  w_bell: {
    minInterval: W,
    maxVoices: 2,
    len: 0.38,
    play(v, out, t, { pitch: k, rand }) {
      // 神楽鈴：小さな鈴がわずかにずれて鳴る
      for (let i = 0; i < 6; i++) bell(v, out, (3200 + rand() * 1800) * k, t + rand() * 0.06, 0.03, 0.25 + rand() * 0.1);
    },
  },
  w_slash: {
    minInterval: W,
    maxVoices: 3,
    len: 0.23,
    play(v, out, t, { pitch: k }) {
      // 刀の一閃：鋭い風切りと、刃の澄んだ響き
      sweep(v, out, 'bandpass', 2500 * k, 7000 * k, 1.5, t, 0.18, 0.005, 0.09);
      tone(v, out, 'sine', 4200 * k, t + 0.01, 0.035, 0.001, 0.2);
      tone(v, out, 'sine', 6300 * k, t + 0.01, 0.015, 0.001, 0.12);
    },
  },
};

export interface PlaySfxOptions extends SfxOptions {
  readonly rand?: () => number;
}

/**
 * 効果音ごとの音量の補正（倍率）。
 * ブラウザのオフラインレンダリングで 1 発ぶんのピークを測ると、紙や風の音（w_ofuda は 0.01、
 * w_wind は 0.008）などがほとんど聞こえない大きさだったため、測定値をもとに持ち上げている。
 * 目安は「頻出する音は 1 発で 0.08〜0.1、合図になる音は 0.2 以上」。
 * 聴いて調整するときは、音色（SFX_DEFS）に触らずここだけ変えればよい。
 */
const TRIM: Partial<Record<SfxId, number>> = {
  ui_move: 2.5,
  ui_confirm: 1.5,
  ui_cancel: 2,
  ui_buy: 1.4,
  hit: 1.8,
  crit: 1.3,
  kill: 1.5,
  player_hurt: 1.5,
  break: 1.2,
  gem: 1.8,
  coin: 1.6,
  item: 1.8,
  heal: 1.3,
  level_up: 1.3,
  chest_open: 1.6,
  chest_item: 1.6,
  event_warn: 2.2,
  freeze: 1.6,
  w_ofuda: 8,
  w_arrow: 1.6,
  w_staff: 2.4,
  w_bead: 2.4,
  w_fire: 2.4,
  w_explode: 1.2,
  w_salt: 3,
  w_wind: 8,
  w_crane: 3.5,
  w_bell: 1.6,
  w_slash: 3,
};

/**
 * 効果音を 1 回鳴らす（間引きはしない。間引きは呼び出し側の SfxThrottle で行う）。
 * 鳴り終わる時刻を返す。音量 0 なら何も作らない。
 */
export function playSfx(ctx: BaseAudioContext, dest: AudioNode, id: SfxId, t: number, opts: PlaySfxOptions = {}): number {
  const volume = opts.volume ?? 1;
  if (!(volume > 0)) return t;
  const rand = opts.rand ?? Math.random;
  const pitch = opts.pitch !== undefined && opts.pitch > 0 && Number.isFinite(opts.pitch) ? Math.min(4, Math.max(0.25, opts.pitch)) : 1;
  const v = new Voice(ctx, rand);
  // 呼び出し側の倍率が大きすぎてもリミッターを叩き続けないよう、2 倍で頭打ちにする
  const out = v.gain(Math.min(volume, 2) * (TRIM[id] ?? 1));
  const pan = opts.pan ?? 0;
  if (Number.isFinite(pan) && pan !== 0) out.connect(v.panner(pan)).connect(dest);
  else out.connect(dest);
  SFX_DEFS[id].play(v, out, t, { pitch, rand });
  return v.finish();
}
