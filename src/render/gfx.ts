import type { Atlas, Frame, Variant } from './atlas';
import type { Screen } from './screen';
import { PixelFont, TextRenderer, type Align, type TextStyle } from './text';

/**
 * 描画の窓口。スプライト・文字・ドット絵らしい図形（アンチエイリアスなし）を描く。
 * 座標はすべてバッファ上のピクセルで、描く直前に整数へ丸める。
 */
export class Gfx {
  readonly text = new TextRenderer();
  readonly digits = new PixelFont();

  constructor(
    readonly screen: Screen,
    readonly atlas: Atlas,
  ) {}

  get ctx(): CanvasRenderingContext2D {
    return this.screen.ctx;
  }

  get w(): number {
    return this.screen.w;
  }

  get h(): number {
    return this.screen.h;
  }

  // ---- スプライト -----------------------------------------------------------

  private frame(id: string, index: number): Frame | undefined {
    const frames = this.atlas.get(id);
    if (!frames) return undefined;
    return frames[index % frames.length];
  }

  frameCount(id: string): number {
    return this.atlas.get(id)?.length ?? 0;
  }

  /** 原点を (x, y) に合わせて描く */
  sprite(id: string, index: number, x: number, y: number, flip = false, variant: Variant = 'normal'): void {
    const f = this.frame(id, index);
    if (!f) return;
    const ax = flip ? f.w - 1 - f.ax : f.ax;
    this.ctx.drawImage(
      this.atlas.sheet(variant, flip),
      f.x, f.y, f.w, f.h,
      Math.round(x) - ax, Math.round(y) - f.ay, f.w, f.h,
    );
  }

  /** 整数倍に拡大して描く（原点も拡大後の位置に合わせる） */
  spriteScaled(
    id: string,
    index: number,
    x: number,
    y: number,
    scale: number,
    flip = false,
    variant: Variant = 'normal',
  ): void {
    const f = this.frame(id, index);
    if (!f) return;
    const ax = flip ? f.w - 1 - f.ax : f.ax;
    this.ctx.drawImage(
      this.atlas.sheet(variant, flip),
      f.x, f.y, f.w, f.h,
      Math.round(x - ax * scale), Math.round(y - f.ay * scale),
      Math.round(f.w * scale), Math.round(f.h * scale),
    );
  }

  /** 原点を中心に回転させて描く（弾用） */
  spriteRot(id: string, index: number, x: number, y: number, angle: number, scale = 1, variant: Variant = 'normal'): void {
    const f = this.frame(id, index);
    if (!f) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y));
    ctx.rotate(angle);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.drawImage(this.atlas.sheet(variant, false), f.x, f.y, f.w, f.h, -f.ax - 0.5, -f.ay - 0.5, f.w, f.h);
    ctx.restore();
  }

  // ---- 図形 -----------------------------------------------------------------

  rect(x: number, y: number, w: number, h: number, color: string): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  /** 太さ t の枠線 */
  box(x: number, y: number, w: number, h: number, color: string, t = 1): void {
    this.rect(x, y, w, t, color);
    this.rect(x, y + h - t, w, t, color);
    this.rect(x, y + t, t, h - t * 2, color);
    this.rect(x + w - t, y + t, t, h - t * 2, color);
  }

  /** 塗りつぶした円（走査線で描くのでアンチエイリアスがかからない） */
  disc(cx: number, cy: number, r: number, color: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    const x0 = Math.round(cx);
    const y0 = Math.round(cy);
    const rr = Math.max(0, Math.round(r));
    for (let dy = -rr; dy <= rr; dy++) {
      const half = Math.floor(Math.sqrt(rr * rr - dy * dy));
      ctx.fillRect(x0 - half, y0 + dy, half * 2 + 1, 1);
    }
  }

  /**
   * 円弧に沿って点を打つ。gap を 1 より大きくすると点線になる。
   * a0〜a1 はラジアン。全周なら 0 と 2π。
   */
  arc(
    cx: number,
    cy: number,
    r: number,
    color: string,
    a0 = 0,
    a1 = Math.PI * 2,
    size = 1,
    gap = 1,
  ): void {
    if (r < 0.5) return;
    const ctx = this.ctx;
    ctx.fillStyle = color;
    const stepAngle = (0.9 / r) * gap;
    const off = Math.floor(size / 2);
    for (let a = a0; a <= a1; a += stepAngle) {
      ctx.fillRect(
        Math.round(cx + Math.cos(a) * r) - off,
        Math.round(cy + Math.sin(a) * r) - off,
        size,
        size,
      );
    }
  }

  /** 2 点を結ぶ線（1px ずつ点を打つ） */
  line(x0: number, y0: number, x1: number, y1: number, color: string, size = 1): void {
    const ctx = this.ctx;
    ctx.fillStyle = color;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
    const off = Math.floor(size / 2);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      ctx.fillRect(Math.round(x0 + dx * t) - off, Math.round(y0 + dy * t) - off, size, size);
    }
  }

  // ---- 文字 -----------------------------------------------------------------

  print(text: string, x: number, y: number, style?: TextStyle): void {
    this.text.draw(this.ctx, text, x, y, style);
  }

  /** 縦書き（1 文字ずつ下へ並べる） */
  printVertical(text: string, x: number, y: number, style: TextStyle = {}, advance = 16): void {
    const scale = style.scale ?? 1;
    let cy = y;
    for (const ch of text) {
      this.text.draw(this.ctx, ch, x, cy, { ...style, align: 'center' });
      cy += advance * scale;
    }
  }

  /** 数字・記号用の小さなフォントで描く */
  num(text: string, x: number, y: number, color?: string, scale = 1, align: Align = 'left'): void {
    this.digits.draw(this.ctx, text, x, y, color, scale, align);
  }

  /** 幅に収まるよう、文字単位で折り返した行の配列を返す */
  wrap(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let line = '';
    for (const ch of text) {
      if (ch === '\n') {
        lines.push(line);
        line = '';
        continue;
      }
      if (line.length > 0 && this.text.width(line + ch) > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line += ch;
      }
    }
    if (line.length > 0) lines.push(line);
    return lines;
  }
}
