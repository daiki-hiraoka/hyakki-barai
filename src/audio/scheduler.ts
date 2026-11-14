/**
 * 先読み型スケジューラの計算部分。時刻は外から受け取り、AudioContext には触れない。
 *
 * setInterval は遅れたり（重い処理・非表示タブでは 1 秒以上）止まったりするので、
 * 発音時刻はタイマーではなく audioContext.currentTime を基準に少し先まで予約しておく。
 */

export interface StepCursor {
  /** 次に予約するステップの発音時刻（秒） */
  readonly time: number;
  /** 次に予約するステップの通し番号 */
  readonly step: number;
}

export interface PlanOptions {
  /** いまの時刻（audioContext.currentTime） */
  readonly now: number;
  /** どこまで先を予約するか（秒） */
  readonly lookahead: number;
  /** 1 ステップの長さ（秒） */
  readonly stepDur: number;
  /** これ以上遅れていたら、取りこぼした分を鳴らさずに飛ばす（秒） */
  readonly maxLate: number;
}

export interface PlannedStep {
  readonly step: number;
  readonly time: number;
}

export function planSteps(cursor: StepCursor, o: PlanOptions): { steps: PlannedStep[]; next: StepCursor } {
  if (!(o.stepDur > 0)) throw new Error(`stepDur は正の数: ${o.stepDur}`);
  let { time, step } = cursor;

  // タブ復帰などで大きく遅れていたら、溜まった分を一気に鳴らすと音の塊になるので飛ばす。
  // 飛ばした数だけ step も進め、曲の位置を時間どおりに保つ（復帰後も拍がずれない）。
  if (time < o.now - o.maxLate) {
    const skip = Math.ceil((o.now - time) / o.stepDur);
    time += skip * o.stepDur;
    step += skip;
  }

  const steps: PlannedStep[] = [];
  const horizon = o.now + o.lookahead;
  while (time < horizon) {
    steps.push({ step, time });
    time += o.stepDur;
    step++;
  }
  return { steps, next: { time, step } };
}
