/**
 * 夜の闇と灯り。
 * 画面と同じ大きさの「闇の幕」を闇の色で塗り、灯りのある場所を丸く消してから、
 * 描き終えた画面に乗算で重ねる。幕に穴が開いた場所だけ元の色が見える。
 * 幕は低解像度のままなので、灯りの縁もドット絵らしい階段状になる。
 */
export class Lighting {
  readonly canvas = document.createElement('canvas');
  private readonly ctx = this.canvas.getContext('2d')!;
  private readonly brushes = new Map<number, HTMLCanvasElement>();

  /** 闇の色で塗りつぶして始める */
  begin(w: number, h: number, color: string): void {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
      this.ctx.imageSmoothingEnabled = false;
    }
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-out';
  }

  /** (x, y) を中心に半径 r の灯りをともす。power は明るさ（0〜1） */
  light(x: number, y: number, r: number, power = 1): void {
    if (r < 2) return;
    const brush = this.brush(r);
    this.ctx.globalAlpha = power;
    this.ctx.drawImage(brush, Math.round(x - r), Math.round(y - r), Math.round(r * 2), Math.round(r * 2));
  }

  /** 幕を画面に重ねる。strength は闇の濃さ（0 で昼、1 で幕の色そのまま） */
  apply(target: CanvasRenderingContext2D, strength: number): void {
    if (strength <= 0.01) return;
    target.save();
    target.globalCompositeOperation = 'multiply';
    target.globalAlpha = Math.min(1, strength);
    target.drawImage(this.canvas, 0, 0);
    target.restore();
  }

  /** 半径に近い大きさの筆を選ぶ（拡大率を小さく抑えて、縁の粗さを揃える） */
  private brush(r: number): HTMLCanvasElement {
    const size = r <= 24 ? 24 : r <= 48 ? 48 : r <= 96 ? 96 : 160;
    let brush = this.brushes.get(size);
    if (!brush) {
      brush = makeBrush(size);
      this.brushes.set(size, brush);
    }
    return brush;
  }
}

/** 4×4 の組織的ディザ。階調の境目を点描でぼかす */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const LEVELS = 5;

function makeBrush(r: number): HTMLCanvasElement {
  const size = r * 2;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - r, y + 0.5 - r) / r;
      if (d >= 1) continue;
      // 中心は明るく、縁へ向けてなだらかに落とす
      const fall = Math.pow(1 - d, 0.9) * 1.25;
      const threshold = (BAYER[(y % 4) * 4 + (x % 4)]! + 0.5) / 16;
      const level = Math.min(LEVELS, Math.floor(fall * LEVELS + threshold));
      const i = (y * size + x) * 4;
      image.data[i + 3] = Math.round((level / LEVELS) * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// 夜の色
// ---------------------------------------------------------------------------

export interface NightLook {
  /** 闇の幕の色 */
  color: string;
  /** 闇の濃さ */
  strength: number;
  /** プレイヤーの灯りの半径 */
  lantern: number;
}

/** 夜の進み具合（0〜1）ごとの見た目。間は線形に補間する */
const KEYS: Array<[number, [number, number, number], number, number]> = [
  [0.0, [112, 78, 128], 0.5, 118], // 逢魔が時：紫がかった夕闇
  [0.12, [70, 74, 150], 0.72, 108], // 宵
  [0.4, [52, 62, 140], 0.84, 100], // 夜半
  [0.65, [40, 44, 118], 0.9, 96], // 丑三つ時
  [0.78, [52, 60, 138], 0.84, 100], // 寅の刻
  [0.94, [104, 84, 138], 0.6, 112], // 暁：東の空が白む
  [1.0, [150, 112, 120], 0.3, 130],
];

export function nightLook(progress: number, deepDark: boolean): NightLook {
  const t = Math.max(0, Math.min(1, progress));
  let a = KEYS[0]!;
  let b = KEYS[KEYS.length - 1]!;
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i]![0] && t <= KEYS[i + 1]![0]) {
      a = KEYS[i]!;
      b = KEYS[i + 1]!;
      break;
    }
  }
  const k = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
  const mix = (x: number, y: number): number => x + (y - x) * k;
  let r = mix(a[1][0], b[1][0]);
  let g = mix(a[1][1], b[1][1]);
  let bl = mix(a[1][2], b[1][2]);
  let strength = mix(a[2], b[2]);
  let lantern = mix(a[3], b[3]);
  if (deepDark) {
    // 丑三つ時の異変：闇がさらに深まり、灯りが届く範囲が狭まる
    r *= 0.7;
    g *= 0.7;
    bl *= 0.8;
    strength = Math.min(1, strength + 0.07);
    lantern *= 0.74;
  }
  return {
    color: `rgb(${Math.round(r)},${Math.round(g)},${Math.round(bl)})`,
    strength,
    lantern,
  };
}
