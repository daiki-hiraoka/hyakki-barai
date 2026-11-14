import { YONANUKI_MAJOR, degreeToMidi } from './theory';

/**
 * 霊玉の連続取得で音程を上げていく。まとめて吸い寄せたときに音階を駆け上がると
 * 「たくさん取れた」気持ちよさが音で伝わる。間が空いたら元の高さに戻す。
 */

export interface GemComboOptions {
  /** この秒数以内に次を取れば連続とみなす */
  readonly window: number;
  /** 何段目まで上げるか。上げすぎると耳に刺さる高さになるので頭打ちにする */
  readonly maxStep: number;
}

export const GEM_COMBO_DEFAULTS: GemComboOptions = { window: 0.25, maxStep: 8 };

// 浮動小数の誤差で「ちょうど window 秒」を途切れ扱いにしないための余裕
const EPS = 1e-9;

export class GemCombo {
  private last = Number.NEGATIVE_INFINITY;
  private step = 0;

  constructor(private readonly opts: GemComboOptions = GEM_COMBO_DEFAULTS) {}

  /** 1 個取ったことを記録し、その音を何段目で鳴らすかを返す */
  next(now: number): number {
    this.step = now - this.last <= this.opts.window + EPS ? Math.min(this.step + 1, this.opts.maxStep) : 0;
    this.last = now;
    return this.step;
  }
}

/**
 * 段数 → 音程の倍率。明るいヨナ抜き長音階に沿って上げる（5 段で 1 オクターブ）。
 * 半音ずつ上げるより「旋律」に聞こえ、BGM の五音音階ともぶつかりにくい。
 */
export function gemPitchRatio(step: number): number {
  return 2 ** (degreeToMidi(YONANUKI_MAJOR, 0, step) / 12);
}
