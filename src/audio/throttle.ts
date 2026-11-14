/**
 * 効果音の間引き。終盤は命中音だけで毎秒数十回呼ばれるので、そのまま鳴らすと
 * 音が団子になって音量も跳ね上がる。ID ごとの最小間隔と同時発音数で間引く。
 * 時刻は外から受け取る（テストで時間を自由に進められるように）。
 */

export interface SfxRule {
  /** 同じ音を鳴らす最小間隔（秒） */
  readonly minInterval: number;
  /** 同じ音の同時発音数の上限 */
  readonly maxVoices: number;
  /** true なら全体の上限を無視する。UI や進行の合図は乱戦中でも欠けると困るため */
  readonly priority?: boolean;
}

// 浮動小数の誤差で「ちょうど最小間隔」の呼び出しを捨てないための余裕
const EPS = 1e-9;

export class SfxThrottle<K extends string> {
  private readonly lastStart = new Map<K, number>();
  /** 鳴っている音の終了時刻（ID ごと） */
  private readonly endTimes = new Map<K, number[]>();

  constructor(
    private readonly rules: Readonly<Record<K, SfxRule>>,
    private readonly globalMax: number,
  ) {}

  /** 鳴らしてよければ発音を記録して true。捨てた呼び出しは何も記録しない */
  tryStart(id: K, now: number, duration: number): boolean {
    const rule = this.rules[id];
    const last = this.lastStart.get(id);
    if (last !== undefined && now - last < rule.minInterval - EPS) return false;

    this.prune(now);
    const mine = this.endTimes.get(id) ?? [];
    if (mine.length >= rule.maxVoices) return false;
    if (!rule.priority && this.total() >= this.globalMax) return false;

    mine.push(now + duration);
    this.endTimes.set(id, mine);
    this.lastStart.set(id, now);
    return true;
  }

  /** いま鳴っている数（id を省くと全体） */
  activeCount(now: number, id?: K): number {
    this.prune(now);
    return id === undefined ? this.total() : (this.endTimes.get(id)?.length ?? 0);
  }

  private total(): number {
    let n = 0;
    for (const ends of this.endTimes.values()) n += ends.length;
    return n;
  }

  private prune(now: number): void {
    for (const [id, ends] of this.endTimes) {
      if (ends.some((e) => e <= now)) this.endTimes.set(id, ends.filter((e) => e > now));
    }
  }
}
