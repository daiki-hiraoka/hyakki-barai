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
import { deflateSync } from 'node:zlib';
import { hexToRgb } from '../src/art/palette';
import { frameToRgba, type PixelMode, type SpriteDef } from '../src/art/sprite';
import { ALL_SPRITES } from '../src/art/sprites/index';

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

// ---- PNG エンコード -------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const body = Buffer.concat([head.subarray(4), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head.subarray(0, 4), body, crc]);
}

function encodePng(img: Image): Buffer {
  const stride = img.w * 4 + 1;
  const raw = Buffer.alloc(stride * img.h);
  for (let y = 0; y < img.h; y++) {
    raw[y * stride] = 0;
    raw.set(img.data.subarray(y * img.w * 4, (y + 1) * img.w * 4), y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
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
writeFileSync(outPath, encodePng(img));
console.log(`${sprites.length} 個のスプライトを ${sheetW}x${sheetH} で出力しました: ${outPath}`);
for (const s of sprites) console.log(`  ${s.id}  ${s.w}x${s.h}  ${s.frames.length} フレーム`);
