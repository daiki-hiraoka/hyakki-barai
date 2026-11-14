/**
 * 楽譜の記法と、パターン → ノートイベントへの展開。AudioContext に依存しない。
 *
 * 曲データを TypeScript の文字列で手書きするので、数え間違いを早く見つけられるよう
 * 小節線 | を書けるようにし、その位置が小節の境目でなければ例外にする。
 */

/** 強さの 3 段階。数を絞るのは、手書きの楽譜で強弱の意図をはっきりさせるため */
export const ACCENT = 1;
export const NORMAL = 0.7;
export const SOFT = 0.4;

export interface NoteEvent {
  /** パターン先頭からのステップ位置 */
  readonly at: number;
  /** 長さ（ステップ数） */
  readonly len: number;
  /** 音階の度数。重音なら複数。打楽器では [0] */
  readonly degrees: readonly number[];
  /** 強さ（0〜1） */
  readonly vel: number;
}

export interface Pattern {
  /** 全体の長さ（ステップ数） */
  readonly length: number;
  readonly events: readonly NoteEvent[];
}

function checkBarLine(pos: number, stepsPerBar: number, src: string): void {
  if (pos % stepsPerBar !== 0) {
    throw new Error(`小節線 | が小節の境目にない（${pos} ステップ目・1 小節 ${stepsPerBar} ステップ）: ${src}`);
  }
}

const GRID_VEL: Readonly<Record<string, number>> = { X: ACCENT, x: NORMAL, o: SOFT };

/**
 * 打楽器向けの記法。1 文字が 1 ステップ：X = 強、x = 中、o = 弱、. = 休み。
 * 空白と | は区切り（長さに数えない）。
 */
export function grid(src: string, stepsPerBar = 16): Pattern {
  const events: NoteEvent[] = [];
  let pos = 0;
  for (const ch of src) {
    if (/\s/.test(ch)) continue;
    if (ch === '|') {
      checkBarLine(pos, stepsPerBar, src);
      continue;
    }
    if (ch !== '.') {
      const vel = GRID_VEL[ch];
      if (vel === undefined) throw new Error(`grid: 知らない文字 "${ch}": ${src}`);
      events.push({ at: pos, len: 1, degrees: [0], vel });
    }
    pos++;
  }
  return { length: pos, events };
}

// 度数（+ で重音）または休符 . 、続けて任意の :長さ と強弱記号 ! / ?
const NOTE_TOKEN = /^(\.|-?\d+(?:\+-?\d+)*)(?::(\d+))?([!?])?$/;

/**
 * 旋律向けの記法。空白区切りのトークンを順に並べる。
 * - `3:6` … 3 度の音を 6 ステップ。長さを省くと 1 ステップ
 * - `0+5:4` … 重音
 * - `.:4` … 4 ステップ休み
 * - 末尾の `!` で強く、`?` で弱く
 * 長い音は小節線をまたいでよい（尺八の伸ばしやドローンのため）。
 */
export function phrase(src: string, stepsPerBar = 16): Pattern {
  const events: NoteEvent[] = [];
  let pos = 0;
  for (const token of src.trim().split(/\s+/)) {
    if (token === '') continue;
    if (token === '|') {
      checkBarLine(pos, stepsPerBar, src);
      continue;
    }
    const m = NOTE_TOKEN.exec(token);
    if (!m) throw new Error(`phrase: 解釈できないトークン "${token}"`);
    const body: string = m[1] ?? '.';
    const lenText: string | undefined = m[2];
    const mark: string | undefined = m[3];
    const len = lenText === undefined ? 1 : Number(lenText);
    if (len < 1) throw new Error(`phrase: 長さは 1 以上: "${token}"`);
    if (body !== '.') {
      const vel = mark === '!' ? ACCENT : mark === '?' ? SOFT : NORMAL;
      events.push({ at: pos, len, degrees: body.split('+').map(Number), vel });
    }
    pos += len;
  }
  return { length: pos, events };
}

/** 指定した長さの休み */
export function rest(steps: number): Pattern {
  return { length: steps, events: [] };
}

/** 順につなぐ。後ろのパターンほど位置をずらす */
export function concat(...parts: readonly Pattern[]): Pattern {
  const events: NoteEvent[] = [];
  let offset = 0;
  for (const p of parts) {
    for (const e of p.events) events.push({ ...e, at: e.at + offset });
    offset += p.length;
  }
  return { length: offset, events };
}

/** 同じパターンを n 回くり返す */
export function repeat(p: Pattern, times: number): Pattern {
  return concat(...Array.from({ length: times }, () => p));
}

/** 全ての度数をずらす。音階の中での移高なので、五音音階から外れない */
export function shift(p: Pattern, by: number): Pattern {
  return {
    length: p.length,
    events: p.events.map((e) => ({ ...e, degrees: e.degrees.map((d) => d + by) })),
  };
}

/** ステップ位置 → そこで始まる音、の表にする。再生中に毎ステップ探さずに済むように */
export function eventsByStep(p: Pattern): NoteEvent[][] {
  const index: NoteEvent[][] = Array.from({ length: p.length }, () => []);
  for (const e of p.events) index[e.at]?.push(e);
  return index;
}
