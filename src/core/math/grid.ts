export interface GridItem {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
}

/**
 * 近傍検索用の一様グリッド（空間ハッシュ）。
 * 敵が数百〜千体いても「この円に触れる敵」を全件走査せずに引けるようにする。
 * 毎 tick rebuild して使う。窓（cols×rows セル）はプレイヤー中心に置き、
 * 窓の外の要素は端のセルに詰める（距離判定は実座標で行うので誤検出はしない）。
 */
export class SpatialGrid<T extends GridItem> {
  private readonly cells: T[][];
  private readonly used: number[] = [];
  private ox = 0;
  private oy = 0;
  /** 登録中の要素の最大半径。問い合わせ範囲をこの分だけ広げて取りこぼしを防ぐ */
  private maxRadius = 0;

  constructor(
    readonly cellSize = 32,
    readonly cols = 80,
    readonly rows = 80,
  ) {
    this.cells = Array.from({ length: cols * rows }, () => []);
  }

  rebuild(items: readonly T[], centerX: number, centerY: number): void {
    for (const i of this.used) this.cells[i]!.length = 0;
    this.used.length = 0;
    this.ox = centerX - (this.cols * this.cellSize) / 2;
    this.oy = centerY - (this.rows * this.cellSize) / 2;
    this.maxRadius = 0;
    for (const item of items) {
      if (!item.alive) continue;
      const index = this.row(item.y) * this.cols + this.col(item.x);
      const cell = this.cells[index]!;
      if (cell.length === 0) this.used.push(index);
      cell.push(item);
      if (item.radius > this.maxRadius) this.maxRadius = item.radius;
    }
  }

  /**
   * 円 (x, y, r) に触れる要素を out に詰めて件数を返す（out は毎回空にする）。
   * 配列を使い回せるよう、結果は引数で受け取る。
   */
  query(x: number, y: number, r: number, out: T[]): number {
    out.length = 0;
    const reach = r + this.maxRadius;
    const c0 = this.col(x - reach);
    const c1 = this.col(x + reach);
    const r0 = this.row(y - reach);
    const r1 = this.row(y + reach);
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const cell = this.cells[cy * this.cols + cx]!;
        for (let i = 0; i < cell.length; i++) {
          const item = cell[i]!;
          if (!item.alive) continue;
          const dx = item.x - x;
          const dy = item.y - y;
          const rr = r + item.radius;
          if (dx * dx + dy * dy <= rr * rr) out.push(item);
        }
      }
    }
    return out.length;
  }

  /** 中心距離が最も近い要素（maxDist 以内）。無ければ null */
  nearest(x: number, y: number, maxDist: number, accept?: (item: T) => boolean): T | null {
    const c0 = this.col(x - maxDist);
    const c1 = this.col(x + maxDist);
    const r0 = this.row(y - maxDist);
    const r1 = this.row(y + maxDist);
    let best: T | null = null;
    let bestD = maxDist * maxDist;
    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const cell = this.cells[cy * this.cols + cx]!;
        for (let i = 0; i < cell.length; i++) {
          const item = cell[i]!;
          if (!item.alive) continue;
          const dx = item.x - x;
          const dy = item.y - y;
          const d = dx * dx + dy * dy;
          if (d <= bestD && (!accept || accept(item))) {
            best = item;
            bestD = d;
          }
        }
      }
    }
    return best;
  }

  private col(x: number): number {
    const c = Math.floor((x - this.ox) / this.cellSize);
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  private row(y: number): number {
    const r = Math.floor((y - this.oy) / this.cellSize);
    return r < 0 ? 0 : r >= this.rows ? this.rows - 1 : r;
  }
}
