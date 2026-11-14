/** 論理解像度の高さ（固定）と、幅の取りうる範囲 */
export const SCREEN_H = 360;
const MIN_W = 480;
const MAX_W = 800;

/**
 * 画面。ゲームは低解像度のバッファ（高さ 360px）に描き、それを拡大して表示する。
 * こうすると、どの大きさのウィンドウでも「同じドットの世界」がくっきり見える。
 * 幅だけはウィンドウの縦横比に合わせて変え、黒帯なしで画面いっぱいに使う。
 */
export class Screen {
  /** 低解像度の描画先 */
  readonly buffer: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  w = 640;
  readonly h = SCREEN_H;

  private readonly out: CanvasRenderingContext2D;
  /** バッファ 1px を実画面の何 px に拡大して描くか（整数） */
  private zoom = 2;
  /** CSS 上の表示倍率（ポインタ座標の変換に使う） */
  private cssScale = 2;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.out = canvas.getContext('2d', { alpha: false })!;
    this.buffer = document.createElement('canvas');
    this.ctx = this.buffer.getContext('2d', { alpha: false })!;
    window.addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize(): void {
    const cw = Math.max(1, window.innerWidth);
    const ch = Math.max(1, window.innerHeight);
    const dpr = window.devicePixelRatio || 1;

    // 幅は偶数に丸める（中央揃えの計算で半端が出ないように）
    const wanted = Math.round((SCREEN_H * cw) / ch / 2) * 2;
    this.w = Math.max(MIN_W, Math.min(MAX_W, wanted));

    this.cssScale = Math.min(cw / this.w, ch / this.h);
    const cssW = Math.floor(this.w * this.cssScale);
    const cssH = Math.floor(this.h * this.cssScale);

    // 実ピクセルでの倍率を整数に切り上げて拡大し、足りない分は CSS で縮める。
    // 整数倍で拡大 → なめらかに縮小、の順にすると、半端な倍率でもドットの大きさが揃って見える
    const exact = this.cssScale * dpr;
    this.zoom = Math.max(1, Math.ceil(exact - 0.01));
    const isInteger = Math.abs(exact - Math.round(exact)) < 0.01;

    this.canvas.width = this.w * this.zoom;
    this.canvas.height = this.h * this.zoom;
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
    this.canvas.style.imageRendering = isInteger ? 'pixelated' : 'auto';

    this.buffer.width = this.w;
    this.buffer.height = this.h;
    // canvas の大きさを変えると描画設定が初期化されるので、毎回設定し直す
    this.out.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
  }

  /** バッファを画面へ転送する */
  present(): void {
    this.out.drawImage(this.buffer, 0, 0, this.w * this.zoom, this.h * this.zoom);
  }

  /** ブラウザ上の座標を、バッファ上の座標に直す */
  toLogical(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * this.w,
      y: ((clientY - rect.top) / rect.height) * this.h,
    };
  }
}
