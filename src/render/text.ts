import { hexToRgb } from '../art/palette';

const FONT = '16px "DotGothic16"';
/** フォントの読み込みが済むまでの代用 */
const FALLBACK = '16px "DotGothic16", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
/** 1 行の高さ（DotGothic16 は 16px 前提のドットフォント） */
export const LINE_H = 16;
/** 輪郭線のぶんの余白 */
const PAD = 1;
const MAX_CACHE = 900;

export type Align = 'left' | 'center' | 'right';

export interface TextStyle {
  color?: string;
  /** 輪郭線の色。null で輪郭なし */
  outline?: string | null;
  /** 整数倍の拡大（見出し用） */
  scale?: number;
  align?: Align;
}

/**
 * 日本語テキストの描画。
 * 低解像度のバッファに普通に fillText するとアンチエイリアスで滲むので、
 * 文字列ごとに一度だけ描いて 2 値化し（ドットをくっきりさせ）、画像としてキャッシュする。
 * 毎フレーム変わる数字は PixelFont を使う（キャッシュが膨らまないように）。
 */
export class TextRenderer {
  private readonly cache = new Map<string, HTMLCanvasElement>();
  private readonly loading = new Set<string>();
  private readonly scratch = document.createElement('canvas');
  private readonly sctx = this.scratch.getContext('2d', { willReadFrequently: true })!;

  /** 使う文字をまとめて渡し、必要な字形を先に読み込む */
  async preload(text: string): Promise<void> {
    try {
      await document.fonts.load(FONT, text);
    } catch {
      // 読み込めなくても代用フォントで表示は続けられる
    }
  }

  width(text: string, scale = 1): number {
    this.sctx.font = FONT;
    return Math.ceil(this.sctx.measureText(text).width) * scale;
  }

  draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle = {}): void {
    if (text.length === 0) return;
    const color = style.color ?? '#f5edd9';
    const outline = style.outline === undefined ? '#0b0b16' : style.outline;
    const scale = style.scale ?? 1;
    const key = `${color}|${outline ?? ''}|${text}`;
    let image = this.cache.get(key);
    if (!image) {
      const baked = this.bake(text, color, outline);
      if (!baked) {
        this.drawFallback(ctx, text, x, y, color, scale, style.align);
        return;
      }
      if (this.cache.size >= MAX_CACHE) this.cache.clear();
      this.cache.set(key, baked);
      image = baked;
    }
    const w = (image.width - PAD * 2) * scale;
    let left = x;
    if (style.align === 'center') left = x - w / 2;
    else if (style.align === 'right') left = x - w;
    ctx.drawImage(
      image,
      Math.round(left) - PAD * scale,
      Math.round(y) - PAD * scale,
      image.width * scale,
      image.height * scale,
    );
  }

  /** 文字列を描いて 2 値化した画像を作る。字形がまだ読み込まれていなければ null */
  private bake(text: string, color: string, outline: string | null): HTMLCanvasElement | null {
    if (!document.fonts.check(FONT, text)) {
      if (!this.loading.has(text)) {
        this.loading.add(text);
        void document.fonts.load(FONT, text).finally(() => this.loading.delete(text));
      }
      return null;
    }
    const s = this.sctx;
    s.font = FONT;
    const tw = Math.max(1, Math.ceil(s.measureText(text).width));
    const w = tw + PAD * 2;
    const h = LINE_H + PAD * 2;
    this.scratch.width = w;
    this.scratch.height = h;
    s.font = FONT;
    s.textBaseline = 'top';
    s.fillStyle = '#fff';
    s.fillText(text, PAD, PAD);
    const src = s.getImageData(0, 0, w, h).data;

    // 半透明の縁を切り捨てて、ドットを 2 値にする
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) mask[i] = src[i * 4 + 3]! >= 120 ? 1 : 0;

    const out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    const octx = out.getContext('2d')!;
    const image = octx.createImageData(w, h);
    const [r, g, b] = hexToRgb(color);
    const edge = outline ? hexToRgb(outline) : null;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const i = py * w + px;
        let c: readonly [number, number, number] | null = null;
        if (mask[i]) {
          c = [r, g, b];
        } else if (edge && touches(mask, w, h, px, py)) {
          c = edge;
        }
        if (!c) continue;
        image.data[i * 4] = c[0];
        image.data[i * 4 + 1] = c[1];
        image.data[i * 4 + 2] = c[2];
        image.data[i * 4 + 3] = 255;
      }
    }
    octx.putImageData(image, 0, 0);
    return out;
  }

  private drawFallback(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    scale: number,
    align: Align | undefined,
  ): void {
    ctx.save();
    ctx.font = FALLBACK.replace('16px', `${16 * scale}px`);
    ctx.textBaseline = 'top';
    ctx.textAlign = align ?? 'left';
    ctx.fillStyle = color;
    ctx.fillText(text, Math.round(x), Math.round(y));
    ctx.restore();
  }
}

/** 周囲 8 方向のどこかに文字のドットがあるか */
function touches(mask: Uint8Array, w: number, h: number, x: number, y: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (mask[ny * w + nx]) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 数字用のピクセルフォント（5×7）
// ---------------------------------------------------------------------------

const GLYPH_W = 5;
const GLYPH_H = 7;
/** 輪郭込みのセルの大きさと、文字送り */
const CELL_W = GLYPH_W + 2;
const CELL_H = GLYPH_H + 2;
const ADVANCE = GLYPH_W + 1;

const GLYPHS: Record<string, string> = {
  '0': '01110100011001110101110011000101110',
  '1': '00100011000010000100001000010001110',
  '2': '01110100010000100010001000100011111',
  '3': '11110000010000101110000010000111110',
  '4': '00010001100101010010111110001000010',
  '5': '11111100001111000001000011000101110',
  '6': '00110010001000011110100011000101110',
  '7': '11111000010001000100010000100001000',
  '8': '01110100011000101110100011000101110',
  '9': '01110100011000101111000010001001100',
  ':': '00000001000010000000001000010000000',
  '.': '00000000000000000000000000110001100',
  '+': '00000001000010011111001000010000000',
  '-': '00000000000000011111000000000000000',
  '%': '11001110100001000100010000101110011',
  '/': '00001000100001000100010000100010000',
  x: '00000000001000101010001000101010001',
  L: '10000100001000010000100001000011111',
  v: '00000000001000110001100010101000100',
  '!': '00100001000010000100001000000000100',
  K: '10001100101010011000101001001010001',
};
const ORDER = Object.keys(GLYPHS);

/**
 * 数字・記号だけの小さなフォント。ダメージ数字や時計など、毎フレーム変わる表示に使う。
 * 色ごとに全グリフを 1 枚に焼いておき、1 文字ずつ貼る。
 */
export class PixelFont {
  private readonly strips = new Map<string, HTMLCanvasElement>();

  width(text: string, scale = 1): number {
    return (text.length * ADVANCE - 1) * scale;
  }

  draw(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color = '#f5edd9',
    scale = 1,
    align: Align = 'left',
    outline: string | null = '#0b0b16',
  ): void {
    const strip = this.strip(color, outline);
    const w = this.width(text, scale);
    let left = Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x);
    const top = Math.round(y);
    for (const ch of text) {
      const index = ORDER.indexOf(ch);
      if (index >= 0) {
        ctx.drawImage(
          strip,
          index * CELL_W, 0, CELL_W, CELL_H,
          left - scale, top - scale, CELL_W * scale, CELL_H * scale,
        );
      }
      left += ADVANCE * scale;
    }
  }

  private strip(color: string, outline: string | null): HTMLCanvasElement {
    const key = `${color}|${outline ?? ''}`;
    let canvas = this.strips.get(key);
    if (canvas) return canvas;
    canvas = document.createElement('canvas');
    canvas.width = ORDER.length * CELL_W;
    canvas.height = CELL_H;
    const ctx = canvas.getContext('2d')!;
    ORDER.forEach((ch, index) => {
      const bits = GLYPHS[ch]!;
      const ox = index * CELL_W + 1;
      if (outline) {
        ctx.fillStyle = outline;
        for (let i = 0; i < bits.length; i++) {
          if (bits[i] === '1') ctx.fillRect(ox + (i % GLYPH_W) - 1, Math.floor(i / GLYPH_W), 3, 3);
        }
      }
      ctx.fillStyle = color;
      for (let i = 0; i < bits.length; i++) {
        if (bits[i] === '1') ctx.fillRect(ox + (i % GLYPH_W), 1 + Math.floor(i / GLYPH_W), 1, 1);
      }
    });
    this.strips.set(key, canvas);
    return canvas;
  }
}
