/**
 * テスト用の AudioContext の代役（音は出さない）。
 * - Web Audio の仕様で例外になる使い方（指数ランプで 0 を目標にする、負の時刻、二重の start など）を同じく例外にする
 * - 仕様上は例外にならないが音が壊れる使い方（0 から始まる指数ランプは動かずに最後で跳ぶ）も例外にする
 * - 接続の数を数えて、鳴り終わった音の切り離し漏れ（リーク）を検出できるようにする
 * ブラウザで鳴らせない環境でも、発音コードの誤りをテストで見つけるため。
 */

type Dest = FakeNode | FakeParam;

export class FakeParam {
  readonly events: { type: string; value: number; time: number }[] = [];

  constructor(public value: number) {}

  private check(what: string, value: number, time: number): void {
    if (!Number.isFinite(value)) throw new TypeError(`${what}: 値が有限でない: ${value}`);
    if (!Number.isFinite(time) || time < 0) throw new RangeError(`${what}: 時刻が不正: ${time}`);
  }

  private lastValue(): number {
    return this.events.length > 0 ? (this.events[this.events.length - 1]?.value ?? this.value) : this.value;
  }

  setValueAtTime(value: number, time: number): this {
    this.check('setValueAtTime', value, time);
    this.events.push({ type: 'set', value, time });
    return this;
  }

  linearRampToValueAtTime(value: number, time: number): this {
    this.check('linearRampToValueAtTime', value, time);
    this.events.push({ type: 'linear', value, time });
    return this;
  }

  exponentialRampToValueAtTime(value: number, time: number): this {
    this.check('exponentialRampToValueAtTime', value, time);
    if (value === 0) throw new RangeError('exponentialRampToValueAtTime: 目標値 0 は仕様で例外');
    const from = this.lastValue();
    if (!(from * value > 0)) {
      throw new Error(`exponentialRampToValueAtTime: 直前の値 ${from} から ${value} へは指数ランプできない（動かずに最後で跳ぶ）`);
    }
    this.events.push({ type: 'exp', value, time });
    return this;
  }

  setTargetAtTime(value: number, time: number, timeConstant: number): this {
    this.check('setTargetAtTime', value, time);
    if (!(timeConstant >= 0)) throw new RangeError(`setTargetAtTime: 時定数が不正: ${timeConstant}`);
    this.events.push({ type: 'target', value, time });
    return this;
  }

  cancelScheduledValues(time: number): this {
    this.check('cancelScheduledValues', 0, time);
    for (let i = this.events.length - 1; i >= 0; i--) {
      if ((this.events[i]?.time ?? 0) >= time) this.events.splice(i, 1);
    }
    return this;
  }

  /** 予約されたイベントの中での最大値（イベントが無ければ初期値）。音量や周波数の確認に使う */
  maxValue(): number {
    return this.events.length > 0 ? Math.max(...this.events.map((e) => e.value)) : this.value;
  }
}

export class FakeNode {
  readonly outputs = new Set<Dest>();

  constructor(
    readonly ctx: FakeAudioContext,
    readonly kind: string,
  ) {
    ctx.created.push(this);
  }

  connect<T extends Dest>(dest: T): T {
    if (dest instanceof FakeNode && dest.ctx !== this.ctx) throw new Error('別の AudioContext のノードにはつなげない');
    this.outputs.add(dest);
    return dest;
  }

  disconnect(): void {
    this.outputs.clear();
  }
}

export class FakeSource extends FakeNode {
  startTime: number | null = null;
  stopTime: number | null = null;
  ended = false;
  onended: (() => void) | null = null;

  start(when = 0): void {
    if (this.startTime !== null) throw new Error('InvalidStateError: start は 1 回だけ');
    if (!(when >= 0)) throw new RangeError(`start: 時刻が不正: ${when}`);
    this.startTime = when;
  }

  stop(when = 0): void {
    if (this.startTime === null) throw new Error('InvalidStateError: start より前に stop');
    if (!(when >= 0)) throw new RangeError(`stop: 時刻が不正: ${when}`);
    this.stopTime = when;
  }
}

export class FakeOscillator extends FakeSource {
  type = 'sine';
  readonly frequency = new FakeParam(440);
  readonly detune = new FakeParam(0);

  setPeriodicWave(): void {
    this.type = 'custom';
  }
}

export class FakeBufferSource extends FakeSource {
  buffer: FakeBuffer | null = null;
  loop = false;
  readonly playbackRate = new FakeParam(1);
  readonly detune = new FakeParam(0);
}

export class FakeBuffer {
  private readonly data: Float32Array[];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number,
  ) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }

  get duration(): number {
    return this.length / this.sampleRate;
  }

  getChannelData(ch: number): Float32Array {
    const d = this.data[ch];
    if (!d) throw new RangeError(`チャンネル ${ch} は無い`);
    return d;
  }
}

class FakeGain extends FakeNode {
  readonly gain = new FakeParam(1);
}

class FakeBiquad extends FakeNode {
  type = 'lowpass';
  readonly frequency = new FakeParam(350);
  readonly Q = new FakeParam(1);
  readonly gain = new FakeParam(0);
  readonly detune = new FakeParam(0);
}

class FakePanner extends FakeNode {
  readonly pan = new FakeParam(0);
}

class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam(-24);
  readonly knee = new FakeParam(30);
  readonly ratio = new FakeParam(12);
  readonly attack = new FakeParam(0.003);
  readonly release = new FakeParam(0.25);
  readonly reduction = 0;
}

class FakeConvolver extends FakeNode {
  buffer: FakeBuffer | null = null;
  normalize = true;
}

export class FakeAudioContext {
  currentTime = 0;
  readonly sampleRate = 48000;
  state: 'running' | 'suspended' | 'closed' = 'running';
  readonly created: FakeNode[] = [];
  readonly destination: FakeNode;

  constructor() {
    this.destination = new FakeNode(this, 'destination');
  }

  createGain(): FakeGain {
    return new FakeGain(this, 'gain');
  }
  createOscillator(): FakeOscillator {
    return new FakeOscillator(this, 'oscillator');
  }
  createBufferSource(): FakeBufferSource {
    return new FakeBufferSource(this, 'bufferSource');
  }
  createBiquadFilter(): FakeBiquad {
    return new FakeBiquad(this, 'biquad');
  }
  createStereoPanner(): FakePanner {
    return new FakePanner(this, 'panner');
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor(this, 'compressor');
  }
  createConvolver(): FakeConvolver {
    return new FakeConvolver(this, 'convolver');
  }
  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    if (!(length > 0)) throw new RangeError(`createBuffer: 長さが不正: ${length}`);
    return new FakeBuffer(channels, length, sampleRate);
  }
  createPeriodicWave(real: Float32Array, imag: Float32Array): object {
    if (real.length !== imag.length || real.length < 2) throw new Error('createPeriodicWave: 配列の長さが不正');
    return { real, imag };
  }
  resume(): Promise<void> {
    this.state = 'running';
    return Promise.resolve();
  }

  /** 時刻を進め、その時刻までに止まる音源の onended を呼ぶ */
  advance(time: number): void {
    this.currentTime = time;
    for (const n of this.created) {
      if (!(n instanceof FakeSource) || n.ended || n.startTime === null) continue;
      let end = n.stopTime;
      if (end === null && n instanceof FakeBufferSource && !n.loop && n.buffer) end = n.startTime + n.buffer.duration;
      if (end !== null && end <= time) {
        n.ended = true;
        n.onended?.();
      }
    }
  }

  /** いま生きている接続の数 */
  connectionCount(): number {
    return this.created.reduce((sum, n) => sum + n.outputs.size, 0);
  }

  /** 作られた音源（発音の確認用） */
  sources(): FakeSource[] {
    return this.created.filter((n): n is FakeSource => n instanceof FakeSource);
  }

  /** テストから実装に渡すときの型の付け替え */
  asBase(): BaseAudioContext {
    return this as unknown as BaseAudioContext;
  }
}
