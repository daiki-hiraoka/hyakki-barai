import { describe, expect, it } from 'vitest';
import { MANIFEST } from './manifest';
import { ALL_SPRITES, getSprite } from './sprites/index';

describe('スプライト一式', () => {
  it('ID が重複していない', () => {
    const ids = ALL_SPRITES.map((s) => s.id);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dup).toEqual([]);
  });

  it('原点がスプライトの内側にある', () => {
    for (const s of ALL_SPRITES) {
      expect(s.ax, s.id).toBeGreaterThanOrEqual(0);
      expect(s.ax, s.id).toBeLessThan(s.w);
      expect(s.ay, s.id).toBeGreaterThanOrEqual(0);
      expect(s.ay, s.id).toBeLessThan(s.h);
    }
  });

  it.each(MANIFEST)('$id が $w×$h・$frames フレーム以上で定義されている', (entry) => {
    const s = getSprite(entry.id);
    expect(s, `${entry.id} が未定義`).toBeDefined();
    expect(s!.w).toBe(entry.w);
    expect(s!.h).toBe(entry.h);
    expect(s!.frames.length).toBeGreaterThanOrEqual(entry.frames);
  });
});
