/**
 * スプライト一覧を 1 枚の PNG に書き出す確認用スクリプト。
 *
 *   npm run sprites -- [--match <正規表現>] [--out <パス>] [--scale <倍率>] [--bg <#rrggbb>] [--width <px>] [--glow]
 *
 * 各スプライトの全フレームを大きく（scale 倍）並べ、右隣にゲーム内の見え方に近い 2 倍表示を置く。
 * --glow を付けると、発光マスクだけを描いた行を追加する。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { hexToRgb } from '../src/art/palette';
import { frameToRgba, type PixelMode, type SpriteDef } from '../src/art/sprite';
import { ALL_SPRITES } from '../src/art/sprites/index';
import { encodePng } from './png';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const match = new RegExp(arg('match') ?? '.');
const outPath = resolve(arg('out') ?? 'sprite-sheet.png');
const scale = Number(arg('scale') ?? 6);
const maxWidth = Number(arg('width') ?? 1500);
const bg = hexToRgb(arg('bg') ?? '#1d2b33');
const showGlow = process.argv.includes('--glow');

// ---- 3x5 のラベル用フォント ---------------------------------------------
const FONT: Record<string, string> = {
  a: '010101111101101', b: '110101110101110', c: '011100100100011', d: '110101101101110',
  e: '111100110100111', f: '111100110100100', g: '011100101101011', h: '101101111101101',
  i: '111010010010111', j: '001001001101010', k: '101101110101101', l: '100100100100111',
  m: '101111111101101', n: '110101101101101', o: '010101101101010', p: '110101110100100',
  q: '010101101110011', r: '110101110101101', s: '011100010001110', t: '111010010010010',
  u: '101101101101111', v: '101101101101010', w: '101101111111101', x: '101101010101101',
  y: '101101010010010', z: '111001010100111',
  '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001110',
  '.': '000000000000010', _: '000000000000111', '-': '000000111000000',
};

// ---- 画像バッファ ---------------------------------------------------------
class Image {
  readonly data: Uint8Array;
  constructor(readonly w: number, readonly h: number, fill: [number, number, number]) {
    this.data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.data[i * 4] = fill[0];
      this.data[i * 4 + 1] = fill[1];
      this.data[i * 4 + 2] = fill[2];
      this.data[i * 4 + 3] = 255;
    }
  }

  rect(x: number, y: number, w: number, h: number, c: [number, number, number]): void {
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
        const i = (yy * this.w + xx) * 4;
        this.data[i] = c[0];
        this.data[i + 1] = c[1];
        this.data[i + 2] = c[2];
      }
    }
  }

  blit(px: Uint8ClampedArray, w: number, h: number, x: number, y: number, s: number): void {
    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx++) {
        const i = (sy * w + sx) * 4;
        if (px[i + 3] === 0) continue;
        this.rect(x + sx * s, y + sy * s, s, s, [px[i]!, px[i + 1]!, px[i + 2]!]);
      }
    }
  }

  text(str: string, x: number, y: number, s: number, c: [number, number, number]): void {
    let cx = x;
    for (const ch of str.toLowerCase()) {
      const glyph = FONT[ch];
      if (glyph) {
        for (let i = 0; i < 15; i++) {
          if (glyph[i] === '1') this.rect(cx + (i % 3) * s, y + Math.floor(i / 3) * s, s, s, c);
        }
      }
      cx += 4 * s;
    }
  }
}

// ---- レイアウト -----------------------------------------------------------
const GAP = 10;
const LABEL_SCALE = 2;
const LABEL_H = 5 * LABEL_SCALE + 6;
const SMALL = 2;

interface Cell {
  def: SpriteDef;
  w: number;
  h: number;
}

const sprites = ALL_SPRITES.filter((s) => match.test(s.id));
if (sprites.length === 0) {
  console.error(`一致するスプライトがありません: ${match}`);
  process.exit(1);
}

const modes: PixelMode[] = showGlow ? ['normal', 'glow'] : ['normal'];

const cells: Cell[] = sprites.map((def) => {
  const big = def.frames.length * (def.w * scale + 4);
  const small = def.w * SMALL + 6;
  const labelW = def.id.length * 4 * LABEL_SCALE;
  return {
    def,
    w: Math.max(big + small, labelW),
    h: def.h * scale * modes.length + LABEL_H,
  };
});

// 左から順に流し込み、幅を超えたら改行する
const placed: Array<Cell & { x: number; y: number }> = [];
let x = GAP;
let y = GAP;
let rowH = 0;
let sheetW = 0;
for (const cell of cells) {
  if (x > GAP && x + cell.w + GAP > maxWidth) {
    x = GAP;
    y += rowH + GAP;
    rowH = 0;
  }
  placed.push({ ...cell, x, y });
  x += cell.w + GAP;
  rowH = Math.max(rowH, cell.h);
  sheetW = Math.max(sheetW, x);
}
const sheetH = y + rowH + GAP;

const img = new Image(sheetW, sheetH, bg);
const frameBg: [number, number, number] = [bg[0] + 10, bg[1] + 10, bg[2] + 12];

for (const cell of placed) {
  const { def } = cell;
  modes.forEach((mode, mi) => {
    const top = cell.y + mi * def.h * scale;
    def.frames.forEach((_, f) => {
      const fx = cell.x + f * (def.w * scale + 4);
      img.rect(fx, top, def.w * scale, def.h * scale, frameBg);
      img.blit(frameToRgba(def, f, mode), def.w, def.h, fx, top, scale);
    });
  });
  // ゲーム内の見え方に近い 2 倍表示
  const sx = cell.x + def.frames.length * (def.w * scale + 4) + 2;
  img.blit(frameToRgba(def, 0), def.w, def.h, sx, cell.y, SMALL);
  img.text(def.id, cell.x, cell.y + def.h * scale * modes.length + 4, LABEL_SCALE, [190, 200, 215]);
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, encodePng(img.w, img.h, img.data));
console.log(`${sprites.length} 個のスプライトを ${sheetW}x${sheetH} で出力しました: ${outPath}`);
for (const s of sprites) console.log(`  ${s.id}  ${s.w}x${s.h}  ${s.frames.length} フレーム`);
