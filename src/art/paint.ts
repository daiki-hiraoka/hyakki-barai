/**
 * 図形を重ねてパレット記号のグリッドを組み立てる作業台。
 * 鳥居や木のように大きく単純な形は、1 文字ずつ打つより図形で組むほうが崩れにくい。
 */
export class PixelGrid {
  private readonly cells: string[][];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = Array.from({ length: h }, () => new Array<string>(w).fill('.'));
  }

  set(x: number, y: number, ch: string): this {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix >= 0 && iy >= 0 && ix < this.w && iy < this.h) this.cells[iy]![ix] = ch;
    return this;
  }

  get(x: number, y: number): string {
    return this.cells[y]?.[x] ?? '.';
  }

  rect(x: number, y: number, w: number, h: number, ch: string): this {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, ch);
    }
    return this;
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, ch: string): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, ch);
      }
    }
    return this;
  }

  /** 太さ t の線 */
  line(x0: number, y0: number, x1: number, y1: number, ch: string, t = 1): this {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = x0 + (x1 - x0) * k;
      const y = y0 + (y1 - y0) * k;
      if (t <= 1) this.set(x, y, ch);
      else this.rect(Math.round(x - t / 2), Math.round(y - t / 2), t, t, ch);
    }
    return this;
  }

  /** 手打ちの絵を重ねる。'_' の位置は元の絵を残す */
  stamp(x: number, y: number, rows: string[]): this {
    rows.forEach((row, j) => {
      Array.from(row).forEach((ch, i) => {
        if (ch !== '_') this.set(x + i, y + j, ch);
      });
    });
    return this;
  }

  /** 絵の外周に 1px の輪郭を足す */
  outline(ch = '0'): this {
    const src = this.cells.map((row) => row.slice());
    const filled = (x: number, y: number): boolean => (src[y]?.[x] ?? '.') !== '.';
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          this.cells[y]![x] = ch;
        }
      }
    }
    return this;
  }

  toString(): string {
    return this.cells.map((row) => row.join('')).join('\n');
  }
}

export function paint(w: number, h: number, draw: (g: PixelGrid) => void): string {
  const grid = new PixelGrid(w, h);
  draw(grid);
  return grid.toString();
}
