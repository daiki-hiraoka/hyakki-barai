import { describe, expect, it } from 'vitest';
import { Pool } from './pool';

interface Thing {
  alive: boolean;
  tag: string;
}

const make = (): Thing => ({ alive: false, tag: '' });

describe('Pool', () => {
  it('alloc した要素は alive になり、items に並ぶ', () => {
    const pool = new Pool(make);
    const a = pool.alloc();
    a.tag = 'a';
    const b = pool.alloc();
    b.tag = 'b';
    expect(pool.items.map((t) => t.tag)).toEqual(['a', 'b']);
    expect(a.alive && b.alive).toBe(true);
  });

  it('compact は alive でない要素を取り除き、残りの順序を保つ', () => {
    const pool = new Pool(make);
    const things = ['a', 'b', 'c', 'd'].map((tag) => {
      const t = pool.alloc();
      t.tag = tag;
      return t;
    });
    things[1]!.alive = false;
    things[2]!.alive = false;
    pool.compact();
    expect(pool.items.map((t) => t.tag)).toEqual(['a', 'd']);
  });

  it('取り除いたオブジェクトは次の alloc で再利用する', () => {
    const pool = new Pool(make);
    const a = pool.alloc();
    a.alive = false;
    pool.compact();
    const b = pool.alloc();
    expect(b).toBe(a);
    expect(b.alive).toBe(true);
  });

  it('clear で空になる', () => {
    const pool = new Pool(make);
    pool.alloc();
    pool.alloc();
    pool.clear();
    expect(pool.items).toHaveLength(0);
  });
});
