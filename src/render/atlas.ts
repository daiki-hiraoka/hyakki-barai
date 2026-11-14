import { frameToRgba, type PixelMode, type SpriteDef } from '../art/sprite';

export interface Frame {
  x: number;
  y: number;
  w: number;
  h: number;
  ax: number;
  ay: number;
}

/** 通常・被弾フラッシュ（白）・発光部分のみ */
export type Variant = 'normal' | 'flash' | 'glow';

const ATLAS_W = 1024;
const PAD = 1;

/**
 * 全スプライトを 1 枚の画像にまとめたもの。
 * 起動時に 1 度だけ作り、描画は「この画像の一部を貼る」だけにする
 * （数百体を毎フレーム描いても速い）。
 * 通常／白／発光 × 左右反転の 6 枚を同じ配置で持つので、
 * 見た目の切り替えは貼り元の画像を変えるだけで済む。
 */
export class Atlas {
  private readonly frames = new Map<string, Frame[]>();
  private readonly sheets: Record<Variant, [HTMLCanvasElement, HTMLCanvasElement]>;

  constructor(sprites: readonly SpriteDef[]) {
    // 高い順に棚へ並べていく単純な詰め方
    const order = sprites
      .flatMap((def) => def.frames.map((_, index) => ({ def, index })))
      .sort((a, b) => b.def.h - a.def.h);
    let x = PAD;
    let y = PAD;
    let shelf = 0;
    const placed: Array<{ def: SpriteDef; index: number; x: number; y: number }> = [];
    for (const item of order) {
      const { w, h } = item.def;
      if (x + w + PAD > ATLAS_W) {
        x = PAD;
        y += shelf + PAD;
        shelf = 0;
      }
      placed.push({ ...item, x, y });
      x += w + PAD;
      shelf = Math.max(shelf, h);
    }
    const height = y + shelf + PAD;

    const make = (): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = ATLAS_W;
      c.height = height;
      return c;
    };
    this.sheets = {
      normal: [make(), make()],
      flash: [make(), make()],
      glow: [make(), make()],
    };

    for (const item of placed) {
      const { def, index } = item;
      let list = this.frames.get(def.id);
      if (!list) {
        list = [];
        this.frames.set(def.id, list);
      }
      list[index] = { x: item.x, y: item.y, w: def.w, h: def.h, ax: def.ax, ay: def.ay };
      for (const mode of ['normal', 'flash', 'glow'] as PixelMode[]) {
        const px = frameToRgba(def, index, mode);
        const [plain, flipped] = this.sheets[mode];
        put(plain, px, def.w, def.h, item.x, item.y, false);
        put(flipped, px, def.w, def.h, item.x, item.y, true);
      }
    }
  }

  /** スプライトのフレーム一覧。未定義の ID なら undefined */
  get(id: string): Frame[] | undefined {
    return this.frames.get(id);
  }

  sheet(variant: Variant, flip: boolean): HTMLCanvasElement {
    return this.sheets[variant][flip ? 1 : 0];
  }
}

function put(
  canvas: HTMLCanvasElement,
  px: Uint8ClampedArray,
  w: number,
  h: number,
  x: number,
  y: number,
  flip: boolean,
): void {
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(w, h);
  if (!flip) {
    image.data.set(px);
  } else {
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const src = (row * w + col) * 4;
        const dst = (row * w + (w - 1 - col)) * 4;
        image.data[dst] = px[src]!;
        image.data[dst + 1] = px[src + 1]!;
        image.data[dst + 2] = px[src + 2]!;
        image.data[dst + 3] = px[src + 3]!;
      }
    }
  }
  ctx.putImageData(image, x, y);
}
