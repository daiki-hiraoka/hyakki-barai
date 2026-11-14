import { PALETTE, hexToRgb } from './palette';

/**
 * ドット絵 1 枚（複数フレーム）の定義。
 * 画像ファイルではなく、パレット記号のグリッドとして持つ。
 * 純粋なデータなので Node でも検証・PNG 出力でき、ブラウザでは起動時にアトラス化する。
 */
export interface SpriteDef {
  /** 一意な ID（例: enemy.chochin） */
  id: string;
  w: number;
  h: number;
  /** 原点。描画位置に合わせるピクセル（左上基準） */
  ax: number;
  ay: number;
  /** フレームごとの行文字列（各行は長さ w、行数は h） */
  frames: string[][];
  /** 発光として扱うパレット記号。闇の上に重ねて描かれる */
  glow: string;
}

export interface SpriteOptions {
  ax?: number;
  ay?: number;
  /** 既定は 'bottom'（足元を原点にする）。アイコンや弾は 'center' */
  anchor?: 'bottom' | 'center';
  glow?: string;
}

/** 'normal' は通常色、'glow' は発光部分だけ、'flash' は被弾時の白いシルエット */
export type PixelMode = 'normal' | 'glow' | 'flash';

function toRows(src: string): string[] {
  return src
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** テンプレート文字列で書いたグリッドを検証し、行の配列にする */
export function parseFrame(src: string, w: number, h: number, id = 'sprite'): string[] {
  const rows = toRows(src);
  if (rows.length !== h) {
    throw new Error(`${id}: 行数が ${rows.length} です（期待値 ${h}）`);
  }
  rows.forEach((row, y) => {
    if (row.length !== w) {
      throw new Error(`${id}: ${y} 行目の幅が ${row.length} です（期待値 ${w}）: "${row}"`);
    }
    for (const ch of row) {
      if (ch !== '.' && !(ch in PALETTE)) {
        throw new Error(`${id}: ${y} 行目にパレットにない記号 "${ch}" があります`);
      }
    }
  });
  return rows;
}

/** スプライトを定義する。frames には行を改行で区切った文字列を渡す */
export function sprite(
  id: string,
  w: number,
  h: number,
  frames: string[],
  opts: SpriteOptions = {},
): SpriteDef {
  const center = opts.anchor === 'center';
  return {
    id,
    w,
    h,
    ax: opts.ax ?? Math.floor(w / 2),
    ay: opts.ay ?? (center ? Math.floor(h / 2) : h - 1),
    frames: frames.map((src, i) => parseFrame(src, w, h, `${id}#${i}`)),
    glow: opts.glow ?? '',
  };
}

/** 1 フレームを RGBA（長さ w*h*4）に変換する */
export function frameToRgba(
  def: SpriteDef,
  frame: number,
  mode: PixelMode = 'normal',
): Uint8ClampedArray {
  const rows = def.frames[frame];
  if (!rows) throw new Error(`${def.id}: フレーム ${frame} はありません`);
  const out = new Uint8ClampedArray(def.w * def.h * 4);
  for (let y = 0; y < def.h; y++) {
    const row = rows[y]!;
    for (let x = 0; x < def.w; x++) {
      const ch = row[x]!;
      if (ch === '.') continue;
      if (mode === 'glow' && !def.glow.includes(ch)) continue;
      const i = (y * def.w + x) * 4;
      if (mode === 'flash') {
        out[i] = out[i + 1] = out[i + 2] = 255;
      } else {
        const [r, g, b] = hexToRgb(PALETTE[ch]!);
        out[i] = r;
        out[i + 1] = g;
        out[i + 2] = b;
      }
      out[i + 3] = 255;
    }
  }
  return out;
}

/**
 * 歩行・浮遊の 2 コマ目を作る補助。下端の keepBottom 行（足など）を残し、
 * それより上の塊を 1px 下げる。足のすぐ上の 1 行は押しつぶされて消える。
 */
export function bob(src: string, keepBottom = 1): string {
  const rows = toRows(src);
  const width = rows[0]?.length ?? 0;
  const split = rows.length - keepBottom;
  const upper = rows.slice(0, split);
  const lower = rows.slice(split);
  return ['.'.repeat(width), ...upper.slice(0, Math.max(0, upper.length - 1)), ...lower].join('\n');
}

/** startRow 行目から rows で置き換えたフレームを作る補助（足だけ差し替える等） */
export function patch(src: string, startRow: number, rows: string[]): string {
  const out = toRows(src);
  rows.forEach((row, i) => {
    out[startRow + i] = row;
  });
  return out.join('\n');
}

/** パレット記号を入れ替えた色違いを作る（赤鬼 → 青鬼など） */
export function recolor(def: SpriteDef, id: string, swap: Record<string, string>): SpriteDef {
  const map = (s: string): string =>
    Array.from(s, (ch) => swap[ch] ?? ch).join('');
  return {
    ...def,
    id,
    frames: def.frames.map((rows) => rows.map(map)),
    glow: map(def.glow),
  };
}
