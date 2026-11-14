import { describe, expect, it } from 'vitest';
import { ACCENT, NORMAL, SOFT, concat, eventsByStep, grid, phrase, repeat, rest, shift } from './pattern';

describe('grid（打楽器向けの 1 文字 = 1 ステップの記法）', () => {
  it('X / x / o を強さ別の打点に、. を休符に展開する', () => {
    const p = grid('X...x...o...x...');
    expect(p.length).toBe(16);
    expect(p.events).toEqual([
      { at: 0, len: 1, degrees: [0], vel: ACCENT },
      { at: 4, len: 1, degrees: [0], vel: NORMAL },
      { at: 8, len: 1, degrees: [0], vel: SOFT },
      { at: 12, len: 1, degrees: [0], vel: NORMAL },
    ]);
  });

  it('| と空白は読みやすさのための区切りで、長さに数えない', () => {
    const p = grid('X.x. x...|....', 8);
    expect(p.length).toBe(12);
    expect(p.events.map((e) => e.at)).toEqual([0, 2, 4]);
  });

  it('小節線 | が小節の境目にないと例外を投げる', () => {
    expect(() => grid('X...|X...', 16)).toThrow(/小節/);
  });

  it('知らない文字があると例外を投げる', () => {
    expect(() => grid('X..?')).toThrow(/\?/);
  });
});

describe('phrase（旋律向けの「度数:長さ」の記法）', () => {
  it('度数:長さを順に並べ、休符 . で間を空ける', () => {
    const p = phrase('3:6 4:2 .:4 2:4');
    expect(p.length).toBe(16);
    expect(p.events).toEqual([
      { at: 0, len: 6, degrees: [3], vel: NORMAL },
      { at: 6, len: 2, degrees: [4], vel: NORMAL },
      { at: 12, len: 4, degrees: [2], vel: NORMAL },
    ]);
  });

  it('長さを省くと 1 ステップ', () => {
    const p = phrase('0 . 2 3');
    expect(p.length).toBe(4);
    expect(p.events.map((e) => [e.at, e.len])).toEqual([
      [0, 1],
      [2, 1],
      [3, 1],
    ]);
  });

  it('負の度数と、+ でつないだ重音を扱える', () => {
    const p = phrase('-1+4:2 -3');
    expect(p.events[0]).toMatchObject({ at: 0, len: 2, degrees: [-1, 4] });
    expect(p.events[1]).toMatchObject({ at: 2, len: 1, degrees: [-3] });
  });

  it('! は強く、? は弱く鳴らす', () => {
    const p = phrase('0! 1? 2:2!');
    expect(p.events.map((e) => e.vel)).toEqual([ACCENT, SOFT, ACCENT]);
  });

  it('小節線 | が小節の境目にないと例外を投げる（数え間違いを早く見つけるため）', () => {
    expect(() => phrase('0:4 | 0:12', 16)).toThrow(/小節/);
    expect(() => phrase('0:16 | 0:12 2:4 |', 16)).not.toThrow();
  });

  it('長い音は小節線をまたいでよい', () => {
    const p = phrase('0:24 .:8 |', 16);
    expect(p.length).toBe(32);
    expect(p.events).toHaveLength(1);
  });

  it('解釈できないトークンは例外を投げる', () => {
    expect(() => phrase('0:0')).toThrow();
    expect(() => phrase('a:2')).toThrow(/a:2/);
    expect(() => phrase('1.5')).toThrow();
  });
});

describe('パターンの組み立て', () => {
  it('rest は指定した長さの休み', () => {
    expect(rest(32)).toEqual({ length: 32, events: [] });
  });

  it('concat は順につなぎ、後ろのパターンの位置をずらす', () => {
    const p = concat(phrase('0:2 1:2'), rest(4), phrase('2:4'));
    expect(p.length).toBe(12);
    expect(p.events.map((e) => [e.at, e.degrees[0]])).toEqual([
      [0, 0],
      [2, 1],
      [8, 2],
    ]);
  });

  it('repeat は同じパターンを n 回くり返す', () => {
    const p = repeat(grid('X.x.'), 3);
    expect(p.length).toBe(12);
    expect(p.events.map((e) => e.at)).toEqual([0, 2, 4, 6, 8, 10]);
  });

  it('shift は全ての度数をずらす（旋法の中での移高）', () => {
    const p = shift(phrase('0+5 3'), 2);
    expect(p.events.map((e) => e.degrees)).toEqual([[2, 7], [5]]);
  });
});

describe('eventsByStep', () => {
  it('各ステップで始まる音を引けるようにする', () => {
    const idx = eventsByStep(phrase('0:2 . 3'));
    expect(idx).toHaveLength(4);
    expect(idx[0]).toHaveLength(1);
    expect(idx[1]).toHaveLength(0);
    expect(idx[2]).toHaveLength(0);
    expect(idx[3]?.[0]?.degrees).toEqual([3]);
  });
});
