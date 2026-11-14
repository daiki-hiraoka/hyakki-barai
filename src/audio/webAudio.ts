import { GemCombo, gemPitchRatio } from './gemCombo';
import { type MixGraph, applyPause, applyVolume, createMixGraph } from './graph';
import { type Levels, measureLevels } from './levels';
import type { AudioPort, MusicId, SfxId, SfxOptions } from './port';
import { SFX_DEFS, playSfx } from './sfx';
import { SongPlayer, clampIntensity } from './songPlayer';
import { SONGS } from './songs';
import { SfxThrottle } from './throttle';
import { seededRandom } from './voice';

/**
 * AudioPort の Web Audio 実装。
 * import しただけでは window にも AudioContext にも触れない（SSR・テスト・非対応ブラウザで落ちないように）。
 * AudioContext は unlock()（最初のユーザー操作）まで作らない。自動再生制限で、操作前に作ると止まったままになるため。
 */

export interface WebAudioDeps {
  /** AudioContext を作る。null を返したら音を出さない（非対応環境） */
  readonly createContext?: () => AudioContext | null;
  readonly setInterval?: (fn: () => void, ms: number) => unknown;
  readonly clearInterval?: (id: unknown) => void;
  /** 効果音のばらつき用 */
  readonly random?: () => number;
  /** タブが非表示か（既定は document.hidden） */
  readonly isHidden?: () => boolean;
}

/** スケジューラのタイマー間隔と先読み。タイマーが多少遅れても先読みの範囲で音が途切れない */
const TICK_MS = 25;
const LOOKAHEAD = 0.15;
/**
 * 非表示のタブではタイマーが 1 秒に 1 回程度まで間引かれることがあるので、その間を埋められるだけ先まで予約する。
 * 表示中に長くしないのは、曲の切り替えや intensity の変化への反応が遅れるため。
 */
const HIDDEN_LOOKAHEAD = 1.2;
/** fadeSec 0 の切り替えでも、鳴っている音をいきなり切るとプツッと鳴るので、最低限これだけかけて下げる */
const MIN_FADE_OUT = 0.05;
/** 曲の最初の音を予約するまでの余裕（過去の時刻に予約しないように） */
const START_DELAY = 0.06;
/** 効果音の発音を少しだけ後ろにずらす。currentTime ちょうどだと立ち上がりの数 ms が欠けてプツッと鳴るため */
const SFX_LATENCY = 0.01;
const DEFAULT_FADE = 1.0;
/** 止めた曲の余韻（梵鐘など）が消えるまで待ってから切り離す秒数 */
const TAIL = 6;
/** 効果音全体の同時発音数。終盤の乱戦でも CPU と音量が暴れないように */
const SFX_GLOBAL_MAX = 24;

function defaultCreateContext(): AudioContext | null {
  const g = globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = g.AudioContext ?? g.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor({ latencyHint: 'interactive' });
  } catch {
    return null;
  }
}

interface Retiring {
  readonly id: MusicId;
  readonly player: SongPlayer;
  /** この時刻まで予約を続ける（フェードアウト中も曲を進める） */
  readonly stopAt: number;
  readonly disposeAt: number;
}

class WebAudioEngine implements AudioPort {
  private ctx: AudioContext | null = null;
  private graph: MixGraph | null = null;
  /** 鳴らしたい曲（unlock 前の指定もここに覚える） */
  private wanted: MusicId | null = null;
  /** いま鳴っている（または鳴り終えた単発の）曲。同じ曲の再指定で頭出ししないための判定に使う */
  private currentId: MusicId | null = null;
  /** 再生中の曲。ループしない曲が鳴り終えたら null になる（currentId は残る） */
  private current: { readonly id: MusicId; readonly player: SongPlayer } | null = null;
  private retiring: Retiring[] = [];
  private intensity = 0;
  private readonly volumes = { sfx: 1, bgm: 1 };
  private paused = false;
  private timer: unknown = null;
  private readonly throttle = new SfxThrottle(SFX_DEFS, SFX_GLOBAL_MAX);
  private readonly gem = new GemCombo();

  constructor(private readonly deps: Required<WebAudioDeps>) {}

  unlock(): void {
    if (!this.ctx) {
      let ctx: AudioContext | null = null;
      try {
        ctx = this.deps.createContext();
      } catch {
        ctx = null;
      }
      if (!ctx) return;
      this.ctx = ctx;
      this.graph = createMixGraph(ctx, { sfxVolume: this.volumes.sfx, bgmVolume: this.volumes.bgm, paused: this.paused });
      this.syncMusic(0);
    }
    if (this.ctx.state === 'suspended') {
      // resume は操作の中で呼ぶ必要がある。失敗しても次の操作でまた呼ばれる
      void this.ctx.resume().catch(() => undefined);
    }
  }

  sfx(id: SfxId, opts: SfxOptions = {}): void {
    const ctx = this.ctx;
    const graph = this.graph;
    // unlock 前と、AudioContext が止まっている間（iOS の割り込みなど）の呼び出しは捨てる。
    // 時刻が進まないので、溜めると再開時にまとめて鳴ってしまう。setPaused 中は捨てない（ポーズ画面の UI 音のため）
    if (!ctx || !graph || ctx.state !== 'running') return;
    const def = SFX_DEFS[id];
    if (!def || !((opts.volume ?? 1) > 0)) return;
    const now = ctx.currentTime;
    if (!this.throttle.tryStart(id, now, def.len)) return;
    let pitch = opts.pitch ?? 1;
    // 霊玉は鳴らしたときだけ連続取得を数える（間引いた分まで数えると一気に最高音まで飛ぶため）
    if (id === 'gem') pitch *= gemPitchRatio(this.gem.next(now));
    playSfx(ctx, graph.sfx, id, now + SFX_LATENCY, { ...opts, pitch, rand: this.deps.random });
  }

  music(id: MusicId | null, fadeSec = DEFAULT_FADE): void {
    this.wanted = id;
    this.syncMusic(Number.isFinite(fadeSec) && fadeSec > 0 ? fadeSec : 0);
  }

  setIntensity(level: number): void {
    this.intensity = clampIntensity(level);
    this.current?.player.setIntensity(this.intensity);
  }

  setVolume(channel: 'sfx' | 'bgm', volume: number): void {
    this.volumes[channel] = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 0;
    if (this.ctx && this.graph) applyVolume(this.graph, this.ctx.currentTime, channel, this.volumes[channel]);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (this.ctx && this.graph) applyPause(this.graph, this.ctx.currentTime, paused);
  }

  /** wanted に合わせて曲を切り替える（unlock 前は何もしない） */
  private syncMusic(fadeSec: number): void {
    const ctx = this.ctx;
    const graph = this.graph;
    if (!ctx || !graph) return;
    if (this.currentId === this.wanted) return; // 同じ曲は頭出ししない
    const now = ctx.currentTime;
    if (this.current) this.retire(this.current.id, this.current.player, now, fadeSec);
    this.current = null;
    this.currentId = this.wanted;

    const id = this.wanted;
    if (id) {
      // フェードアウト中の同じ曲があれば、頭出しせずに呼び戻す
      const back = this.retiring.find((r) => r.id === id && !r.player.finished);
      let player: SongPlayer;
      if (back) {
        this.retiring = this.retiring.filter((r) => r !== back);
        back.player.fade(1, now, fadeSec);
        player = back.player;
      } else {
        player = new SongPlayer(ctx, SONGS[id], { dry: graph.bgm, wet: graph.reverb }, now + START_DELAY, {
          intensity: this.intensity,
          fadeIn: fadeSec,
          rand: this.deps.random,
        });
      }
      player.setIntensity(this.intensity);
      this.current = { id, player };
    }
    this.tick();
  }

  private retire(id: MusicId, player: SongPlayer, now: number, fadeSec: number): void {
    const sec = Math.max(fadeSec, MIN_FADE_OUT);
    player.fade(0, now, sec);
    this.retiring.push({ id, player, stopAt: now + sec, disposeAt: now + sec + TAIL });
  }

  private readonly tick = (): void => {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    const lookahead = this.deps.isHidden() ? HIDDEN_LOOKAHEAD : LOOKAHEAD;

    const cur = this.current;
    if (cur) {
      cur.player.pump(now, lookahead);
      if (cur.player.finished) {
        // ループしない曲（defeat）は最後まで予約したら片付けに回す。currentId は残し、再指定で鳴り直さないようにする
        this.retiring.push({ id: cur.id, player: cur.player, stopAt: now, disposeAt: now + TAIL });
        this.current = null;
      }
    }

    for (const r of this.retiring) if (now < r.stopAt) r.player.pump(now, lookahead);
    this.retiring = this.retiring.filter((r) => {
      if (now < r.disposeAt) return true;
      r.player.dispose();
      return false;
    });

    // 鳴らすものが無ければタイマーを止める（何もしないタイマーを回し続けない）
    if (this.current || this.retiring.length > 0) this.startTimer();
    else this.stopTimer();
  };

  private startTimer(): void {
    if (this.timer === null) this.timer = this.deps.setInterval(this.tick, TICK_MS);
  }

  private stopTimer(): void {
    if (this.timer !== null) {
      this.deps.clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export function createWebAudio(deps: WebAudioDeps = {}): AudioPort {
  return new WebAudioEngine({
    createContext: deps.createContext ?? defaultCreateContext,
    setInterval: deps.setInterval ?? ((fn, ms) => globalThis.setInterval(fn, ms)),
    clearInterval: deps.clearInterval ?? ((id) => globalThis.clearInterval(id as ReturnType<typeof setInterval>)),
    random: deps.random ?? Math.random,
    isHidden: deps.isHidden ?? (() => typeof document !== 'undefined' && document.hidden),
  });
}

/**
 * OfflineAudioContext で、実時間の再生と同じ発音コード・同じミキサー（バス・リミッター）を通してレンダリングし、
 * ピークと RMS を返す。ブラウザのコンソールなどで「無音でない・クリップしていない」を確かめる用。
 * 例: `await renderOffline({ music: 'stage', intensity: 3 }, 30)` / `await renderOffline({ sfx: 'hit' }, 1)`
 */
export async function renderOffline(
  what: { music: MusicId; intensity?: number } | { sfx: SfxId },
  seconds: number,
): Promise<Levels> {
  const Offline = (globalThis as unknown as { OfflineAudioContext?: typeof OfflineAudioContext }).OfflineAudioContext;
  if (!Offline) throw new Error('OfflineAudioContext が無い環境では使えない（ブラウザで実行する）');
  const sampleRate = 44100;
  const ctx = new Offline(2, Math.max(1, Math.ceil(seconds * sampleRate)), sampleRate);
  const graph = createMixGraph(ctx, { sfxVolume: 1, bgmVolume: 1, paused: false });
  // 毎回同じ結果になるよう乱数を固定する
  const rand = seededRandom(7);
  if ('music' in what) {
    const player = new SongPlayer(ctx, SONGS[what.music], { dry: graph.bgm, wet: graph.reverb }, START_DELAY, {
      intensity: what.intensity ?? 0,
      rand,
    });
    // 実時間のタイマーと同じ pump を、先読みを全区間に広げて 1 回だけ呼ぶ
    player.pump(0, seconds);
  } else {
    playSfx(ctx, graph.sfx, what.sfx, START_DELAY, { rand });
  }
  const buffer = await ctx.startRendering();
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  return measureLevels(channels, sampleRate);
}
