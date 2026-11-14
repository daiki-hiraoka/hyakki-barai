import { deflateSync } from 'node:zlib';

/**
 * 開発用スクリプトのための最小限の PNG エンコーダ（8 ビット RGBA・フィルタなし）。
 * スプライト一覧やファビコンを書き出すためだけに、画像ライブラリを依存に加えずに済ませる。
 */

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

/** チャンク 1 つ（長さ・種別・データ・CRC）。CRC は種別とデータに対して計算する */
function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const body = Buffer.concat([head.subarray(4), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([head.subarray(0, 4), body, crc]);
}

/**
 * 画素を整数倍に拡大する。各画素をそのまま factor×factor の正方形に広げるので、
 * ドット絵の輪郭がぼけない。
 */
export function upscale(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  factor: number,
): Uint8Array {
  const out = new Uint8Array(width * factor * height * factor * 4);
  for (let y = 0; y < height * factor; y++) {
    const sy = Math.floor(y / factor);
    for (let x = 0; x < width * factor; x++) {
      const src = (sy * width + Math.floor(x / factor)) * 4;
      const dst = (y * width * factor + x) * 4;
      out[dst] = rgba[src]!;
      out[dst + 1] = rgba[src + 1]!;
      out[dst + 2] = rgba[src + 2]!;
      out[dst + 3] = rgba[src + 3]!;
    }
  }
  return out;
}

/** RGBA の画素（左上から行ごと、長さ width*height*4）を PNG にする */
export function encodePng(width: number, height: number, rgba: Uint8Array | Uint8ClampedArray): Buffer {
  if (rgba.length !== width * height * 4) {
    throw new Error(`画素数が合いません: ${rgba.length} バイト（期待値 ${width * height * 4}）`);
  }
  // 各行の先頭に「フィルタなし」を表す 0 を置く
  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0;
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * stride + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // ビット深度
  ihdr[9] = 6; // カラータイプ（RGBA）
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}
