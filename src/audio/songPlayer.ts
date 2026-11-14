import { INSTRUMENTS, type InstrumentFn } from './instruments';
import { type NoteEvent, eventsByStep } from './pattern';
import { type StepCursor, planSteps } from './scheduler';
import { type InstrumentId, type SongDef, type TrackDef, songPosition, stepDuration, trackStep } from './song';
import { degreeToMidi, midiToFreq } from './theory';
import { Voice } from './voice';

/**
 * 1 曲分の再生。実時間ではタイマーから pump(now) を呼び、オフラインでは先読みを全区間に広げて 1 回呼ぶ。
 * どちらも同じ予約処理・同じ楽器を通るので、オフラインで測った音量が実際の再生と一致する。
 */

export interface SongOutputs {
  /** 原音の出口（BGM バス） */
  readonly dry: AudioNode;
  /** 残響の入口。null なら残響を使わない */
  readonly wet: AudioNode | null;
}

export interface SongPlayerOptions {
  /** 最初の intensity（0〜3） */
  readonly intensity?: number;
  /** 0 から 1 へ立ち上げる秒数（クロスフェードの入り側） */
  readonly fadeIn?: number;
  /** 楽器の差し替え（テストで発音を記録するため） */
  readonly instruments?: Readonly<Record<InstrumentId, InstrumentFn>>;
  readonly rand?: () => number;
}

/** これ以上遅れた予約は鳴らさずに飛ばす（タブ復帰時に溜まった音を一度に鳴らさない） */
const MAX_LATE = 0.1;

interface TrackState {
  readonly def: TrackDef;
  readonly index: readonly NoteEvent[][];
  readonly input: GainNode;
}

// ステップ表はトラック定義ごとに 1 回だけ作る（曲を切り替えるたびに作り直さない）
const indexCache = new WeakMap<TrackDef, NoteEvent[][]>();

function indexFor(def: TrackDef): NoteEvent[][] {
  let index = indexCache.get(def);
  if (!index) {
    index = eventsByStep(def.pattern);
    indexCache.set(def, index);
  }
  return index;
}

export function clampIntensity(level: number): number {
  return Number.isFinite(level) ? Math.min(3, Math.max(0, Math.round(level))) : 0;
}

export class SongPlayer {
  /** 曲全体の出口。クロスフェードはこのゲインで行う */
  readonly output: GainNode;
  private readonly wetOut: GainNode | null;
  private readonly tracks: TrackState[];
  private readonly nodes: AudioNode[] = [];
  private readonly live = new Set<Voice>();
  private readonly instruments: Readonly<Record<InstrumentId, InstrumentFn>>;
  private readonly rand: () => number;
  private readonly stepDur: number;
  private cursor: StepCursor;
  private intensity: number;
  private pendingIntensity: number;
  private done = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    private readonly song: SongDef,
    outputs: SongOutputs,
    startTime: number,
    opts: SongPlayerOptions = {},
  ) {
    this.instruments = opts.instruments ?? INSTRUMENTS;
    this.rand = opts.rand ?? Math.random;
    this.stepDur = stepDuration(song);
    this.cursor = { time: startTime, step: 0 };
    this.intensity = this.pendingIntensity = clampIntensity(opts.intensity ?? 0);

    this.output = this.own(ctx.createGain());
    this.output.connect(outputs.dry);
    const fadeIn = opts.fadeIn ?? 0;
    if (fadeIn > 0) {
      this.output.gain.setValueAtTime(0, startTime);
      this.output.gain.linearRampToValueAtTime(1, startTime + fadeIn);
    }
    this.wetOut = outputs.wet ? this.own(ctx.createGain()) : null;
    if (this.wetOut && outputs.wet) {
      this.wetOut.connect(outputs.wet);
      if (fadeIn > 0) {
        this.wetOut.gain.setValueAtTime(0, startTime);
        this.wetOut.gain.linearRampToValueAtTime(1, startTime + fadeIn);
      }
    }

    // トラックごとの音量・定位・残響の送りは曲の間ずっと使うので、発音ごとではなく 1 回だけ作る
    this.tracks = song.tracks.map((def) => {
      const input = this.own(ctx.createGain());
      input.gain.value = def.gain;
      if (def.pan) {
        const p = this.own(ctx.createStereoPanner());
        p.pan.value = def.pan;
        input.connect(p).connect(this.output);
      } else {
        input.connect(this.output);
      }
      if (def.rev && this.wetOut) {
        const send = this.own(ctx.createGain());
        send.gain.value = def.rev;
        input.connect(send).connect(this.wetOut);
      }
      return { def, index: indexFor(def), input };
    });
  }

  /** ループしない曲が最後まで予約し終えたら true */
  get finished(): boolean {
    return this.done;
  }

  /** 次の小節の頭から反映する（途中から急に楽器が増えると不自然なため） */
  setIntensity(level: number): void {
    this.pendingIntensity = clampIntensity(level);
  }

  /** now から lookahead 秒先までのステップを予約する */
  pump(now: number, lookahead: number): void {
    if (this.done) return;
    const { steps, next } = planSteps(this.cursor, { now, lookahead, stepDur: this.stepDur, maxLate: MAX_LATE });
    this.cursor = next;
    for (const s of steps) {
      const pos = songPosition(this.song, s.step);
      if (!pos) {
        this.done = true;
        return;
      }
      if (pos.stepInBar === 0) this.intensity = this.pendingIntensity;
      // わずかに遅れた予約は「いま」鳴らす（過去の時刻に予約すると立ち上がりが欠けるため）
      const t = Math.max(s.time, now);
      for (const tr of this.tracks) {
        if ((tr.def.layer ?? 0) > this.intensity) continue;
        const events = tr.index[trackStep(tr.index.length, pos.step)];
        if (events) for (const e of events) this.play(tr, e, t);
      }
    }
  }

  /** 出口のゲインを to へ sec 秒でランプする（クロスフェード） */
  fade(to: number, now: number, sec: number): void {
    for (const node of [this.output, this.wetOut]) {
      if (!node) continue;
      const p = node.gain;
      const from = p.value;
      p.cancelScheduledValues(now);
      p.setValueAtTime(from, now);
      if (sec > 0) p.linearRampToValueAtTime(to, now + sec);
      else p.setValueAtTime(to, now);
    }
  }

  /** 鳴っている音を止め、作ったノードを全て切り離す */
  dispose(): void {
    this.done = true;
    const now = this.ctx.currentTime;
    for (const v of this.live) v.stopAt(now);
    for (const n of this.nodes) n.disconnect();
  }

  private play(tr: TrackState, e: NoteEvent, t: number): void {
    const scale = tr.def.scale ?? this.song.scale;
    const root = tr.def.root ?? this.song.root;
    const dur = e.len * this.stepDur;
    // 重音は 1 音ごとを小さくして、和音でも単音とおおむね同じ大きさにする
    const vel = e.vel / Math.sqrt(e.degrees.length);
    for (const d of e.degrees) {
      const v = new Voice(this.ctx, this.rand);
      this.instruments[tr.def.inst](v, tr.input, t, { freq: midiToFreq(degreeToMidi(scale, root, d)), dur, vel });
      this.live.add(v);
      v.finish(() => this.live.delete(v));
    }
  }

  private own<T extends AudioNode>(node: T): T {
    this.nodes.push(node);
    return node;
  }
}
