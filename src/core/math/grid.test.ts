import { describe, expect, it } from 'vitest';
import { SpatialGrid } from './grid';

interface Dot {
  x: number;
  y: number;
  radius: number;
  alive: boolean;
  name: string;
}

const dot = (name: string, x: number, y: number, radius = 5): Dot => ({
  name,
  x,
  y,
  radius,
  alive: true,
});

function names(items: Dot[]): string[] {
  return items.map((d) => d.name).sort();
}

describe('SpatialGrid', () => {
  it('円が重なる要素だけを返す', () => {
    const grid = new SpatialGrid<Dot>();
    const items = [dot('near', 10, 0), dot('edge', 24, 0), dot('far', 200, 0)];
    grid.rebuild(items, 0, 0);
    const out: Dot[] = [];
    // 半径 10 の円。edge は中心距離 24・半径 5 なので届かない
    grid.query(0, 0, 10, out);
    expect(names(out)).toEqual(['near']);
    // 半径 20 なら edge の縁（24 - 5 = 19）に届く
    grid.query(0, 0, 20, out);
    expect(names(out)).toEqual(['edge', 'near']);
  });

  it('負の座標やセルをまたぐ位置でも正しく返す', () => {
    const grid = new SpatialGrid<Dot>(32, 16, 16);
    const items = [dot('a', -31, -33), dot('b', -40, -40), dot('c', 60, 60)];
    grid.rebuild(items, 0, 0);
    const out: Dot[] = [];
    grid.query(-35, -35, 8, out);
    expect(names(out)).toEqual(['a', 'b']);
  });

  it('大きな要素は、中心が遠いセルにあっても縁が触れれば返す', () => {
    const grid = new SpatialGrid<Dot>();
    const boss = dot('boss', 100, 0, 40);
    grid.rebuild([boss, dot('small', -50, 0)], 0, 0);
    const out: Dot[] = [];
    grid.query(55, 0, 6, out);
    expect(names(out)).toEqual(['boss']);
  });

  it('alive でない要素は返さない', () => {
    const grid = new SpatialGrid<Dot>();
    const a = dot('a', 0, 0);
    grid.rebuild([a], 0, 0);
    a.alive = false;
    const out: Dot[] = [];
    expect(grid.query(0, 0, 10, out)).toBe(0);
  });

  it('rebuild のたびに中身が入れ替わる', () => {
    const grid = new SpatialGrid<Dot>();
    grid.rebuild([dot('old', 0, 0)], 0, 0);
    grid.rebuild([dot('new', 3, 3)], 0, 0);
    const out: Dot[] = [];
    grid.query(0, 0, 20, out);
    expect(names(out)).toEqual(['new']);
  });

  it('グリッドの窓の外にある要素も、端のセルに入れて見つけられる', () => {
    const grid = new SpatialGrid<Dot>(32, 4, 4);
    const items = [dot('out', 500, 0)];
    grid.rebuild(items, 0, 0);
    const out: Dot[] = [];
    grid.query(500, 0, 10, out);
    expect(names(out)).toEqual(['out']);
  });

  describe('nearest', () => {
    it('最も近い要素を返す', () => {
      const grid = new SpatialGrid<Dot>();
      grid.rebuild([dot('a', 50, 0), dot('b', -20, 0), dot('c', 0, 90)], 0, 0);
      expect(grid.nearest(0, 0, 300)?.name).toBe('b');
    });

    it('範囲内に無ければ null', () => {
      const grid = new SpatialGrid<Dot>();
      grid.rebuild([dot('a', 200, 0)], 0, 0);
      expect(grid.nearest(0, 0, 50)).toBeNull();
    });

    it('条件に合うものだけから選ぶ', () => {
      const grid = new SpatialGrid<Dot>();
      grid.rebuild([dot('a', 10, 0), dot('b', 30, 0)], 0, 0);
      expect(grid.nearest(0, 0, 100, (d) => d.name !== 'a')?.name).toBe('b');
    });
  });
});
