import { crc32, inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { encodePng, upscale } from './png';

interface Chunk {
  type: string;
  data: Buffer;
  crc: number;
}

/** PNG をチャンクに分ける（署名の 8 バイトの後ろから） */
function chunksOf(png: Buffer): Chunk[] {
  const out: Chunk[] = [];
  let at = 8;
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString('ascii', at + 4, at + 8);
    const data = png.subarray(at + 8, at + 8 + length);
    const crc = png.readUInt32BE(at + 8 + length);
    out.push({ type, data, crc });
    at += 12 + length;
  }
  return out;
}

// 2×2：赤・透明 / 半透明の緑・白
const RGBA = new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0, 0, 255, 0, 128, 255, 255, 255, 255]);

describe('encodePng', () => {
  it('PNG の署名で始まり、IHDR・IDAT・IEND の順に並ぶ', () => {
    const png = encodePng(2, 2, RGBA);
    expect(Array.from(png.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(chunksOf(png).map((c) => c.type)).toEqual(['IHDR', 'IDAT', 'IEND']);
  });

  it('IHDR に幅・高さと「8 ビットの RGBA」を書く', () => {
    const ihdr = chunksOf(encodePng(3, 5, new Uint8Array(3 * 5 * 4)))[0]!.data;
    expect(ihdr.readUInt32BE(0)).toBe(3);
    expect(ihdr.readUInt32BE(4)).toBe(5);
    expect(ihdr[8]).toBe(8); // ビット深度
    expect(ihdr[9]).toBe(6); // カラータイプ（RGBA）
  });

  it('IDAT を展開すると、各行の先頭にフィルタ 0 が付いた元の画素に戻る（透明度も保つ）', () => {
    const idat = chunksOf(encodePng(2, 2, RGBA))[1]!.data;
    const raw = inflateSync(idat);
    expect(Array.from(raw)).toEqual([
      0, 255, 0, 0, 255, 0, 0, 0, 0,
      0, 0, 255, 0, 128, 255, 255, 255, 255,
    ]);
  });

  it('各チャンクの CRC が、種別とデータから計算した値と一致する', () => {
    for (const c of chunksOf(encodePng(2, 2, RGBA))) {
      const expected = crc32(Buffer.concat([Buffer.from(c.type, 'ascii'), c.data]));
      expect(c.crc, c.type).toBe(expected);
    }
  });

  it('画素数が幅×高さと合わなければ例外を投げる', () => {
    expect(() => encodePng(2, 2, new Uint8Array(4))).toThrow();
  });
});

describe('upscale', () => {
  it('各画素を factor×factor の正方形に広げる（ぼかさない）', () => {
    // 2×1：赤・透明 → 2 倍で 4×2
    const out = upscale(new Uint8Array([255, 0, 0, 255, 0, 0, 0, 0]), 2, 1, 2);
    expect(out).toHaveLength(4 * 2 * 4);
    const px = (i: number): number[] => Array.from(out.subarray(i * 4, i * 4 + 4));
    const red = [255, 0, 0, 255];
    const clear = [0, 0, 0, 0];
    expect([px(0), px(1), px(2), px(3)]).toEqual([red, red, clear, clear]);
    expect([px(4), px(5), px(6), px(7)]).toEqual([red, red, clear, clear]);
  });

  it('1 倍なら同じ画素を返す', () => {
    expect(Array.from(upscale(RGBA, 2, 2, 1))).toEqual(Array.from(RGBA));
  });
});
