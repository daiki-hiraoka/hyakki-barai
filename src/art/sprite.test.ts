import { describe, expect, it } from 'vitest';
import { PALETTE } from './palette';
import { bob, frameToRgba, parseFrame, patch, recolor, sprite } from './sprite';

describe('PALETTE', () => {
  it('すべて 1 文字の記号と #rrggbb 形式の色で定義されている', () => {
    for (const [key, hex] of Object.entries(PALETTE)) {
      expect(key).toHaveLength(1);
      expect(key).not.toBe('.');
      expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe('parseFrame', () => {
  it('インデントと前後の空行を取り除いて行の配列にする', () => {
    const rows = parseFrame(
      `
        .0.
        r7r
      `,
      3,
      2,
    );
    expect(rows).toEqual(['.0.', 'r7r']);
  });

  it('行の幅が違うと例外を投げる', () => {
    expect(() => parseFrame('.0.\nr7', 3, 2, 'test.sprite')).toThrow(/test\.sprite/);
  });

  it('行数が違うと例外を投げる', () => {
    expect(() => parseFrame('.0.', 3, 2)).toThrow();
  });

  it('パレットにない記号があると例外を投げる', () => {
    expect(() => parseFrame('.0.\nr!r', 3, 2)).toThrow(/!/);
  });
});

describe('sprite', () => {
  it('原点の既定値は下端中央', () => {
    const def = sprite('t.a', 4, 3, ['....\n.00.\n.00.']);
    expect(def.ax).toBe(2);
    expect(def.ay).toBe(2);
    expect(def.frames).toHaveLength(1);
  });

  it("anchor: 'center' で中央を原点にする", () => {
    const def = sprite('t.b', 4, 4, ['....\n.00.\n.00.\n....'], { anchor: 'center' });
    expect(def.ax).toBe(2);
    expect(def.ay).toBe(2);
  });

  it('ax / ay を直接指定できる', () => {
    const def = sprite('t.c', 4, 4, ['....\n.00.\n.00.\n....'], { ax: 0, ay: 1 });
    expect(def.ax).toBe(0);
    expect(def.ay).toBe(1);
  });
});

describe('frameToRgba', () => {
  it("'.' は透明、記号はパレットの色で不透明になる", () => {
    const def = sprite('t.d', 2, 1, ['.r']);
    const px = frameToRgba(def, 0);
    expect(Array.from(px.slice(0, 4))).toEqual([0, 0, 0, 0]);
    const hex = PALETTE.r!;
    expect(Array.from(px.slice(4, 8))).toEqual([
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
      255,
    ]);
  });

  it("mode: 'glow' は発光記号だけを残す", () => {
    const def = sprite('t.e', 2, 1, ['ry'], { glow: 'y' });
    const px = frameToRgba(def, 0, 'glow');
    expect(px[3]).toBe(0);
    expect(px[7]).toBe(255);
  });

  it("mode: 'flash' は不透明部分を白一色にする", () => {
    const def = sprite('t.f', 2, 1, ['.r']);
    const px = frameToRgba(def, 0, 'flash');
    expect(Array.from(px)).toEqual([0, 0, 0, 0, 255, 255, 255, 255]);
  });
});

describe('フレームの派生', () => {
  it('bob は下端の行を残して上を 1px 下げる', () => {
    const src = `
      .r.
      .y.
      .0.
      0.0
    `;
    // 下端 1 行（足）を残し、それより上を 1px 下げる。足のすぐ上の行は押しつぶされて消える
    expect(parseFrame(bob(src, 1), 3, 4)).toEqual(['...', '.r.', '.y.', '0.0']);
  });

  it('patch は指定した行から置き換える', () => {
    const src = '.r.\n.y.\n0.0';
    expect(parseFrame(patch(src, 2, ['.00']), 3, 3)).toEqual(['.r.', '.y.', '.00']);
  });

  it('recolor は記号を入れ替えた別スプライトを作る', () => {
    const red = sprite('t.red', 2, 1, ['rR'], { glow: 'r' });
    const blue = recolor(red, 't.blue', { r: 'u', R: 'U' });
    expect(blue.id).toBe('t.blue');
    expect(blue.frames[0]).toEqual(['uU']);
    expect(blue.glow).toBe('u');
    expect(red.frames[0]).toEqual(['rR']);
  });
});
