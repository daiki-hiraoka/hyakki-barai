import { bob, sprite, type SpriteDef } from '../sprite';
import { sym } from './enemies';

/**
 * 大妖（右向き・足元が原点・2 フレーム以上）。
 * 大きな絵は 1 文字ずつ打つと形が崩れやすいので、楕円や太線を重ねて形を作り、
 * 顔などの見せ場だけを手打ちの絵（stamp）で仕上げる。
 */

type Paint = string | ((x: number, y: number) => string);

/** 図形を重ね描きしてパレット記号のグリッドを組み立てる作業台 */
class Grid {
  private readonly cells: string[][];

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.cells = Array.from({ length: h }, () => new Array<string>(w).fill('.'));
  }

  static parse(src: string): Grid {
    const rows = src
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const g = new Grid(rows[0]?.length ?? 0, rows.length);
    rows.forEach((row, y) => Array.from(row).forEach((ch, x) => g.set(x, y, ch)));
    return g;
  }

  /** 1 ピクセルを塗る。'_' を返す塗りは何もしない */
  set(x: number, y: number, paint: Paint): this {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return this;
    const ch = typeof paint === 'string' ? paint : paint(x, y);
    if (ch !== '_') this.cells[y]![x] = ch;
    return this;
  }

  get(x: number, y: number): string {
    return this.cells[y]?.[x] ?? '.';
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, paint: Paint): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, paint);
      }
    }
    return this;
  }

  /** 太さが r0 から r1 へ変わる線（円を並べて描く） */
  line(x0: number, y0: number, x1: number, y1: number, r0: number, r1: number, paint: Paint): this {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const r = r0 + (r1 - r0) * t;
      this.ellipse(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, paint);
    }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, paint: Paint): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, paint);
    return this;
  }

  /** 手打ちの絵を重ねる。'_' の位置は元の絵を残す */
  stamp(x: number, y: number, rows: string[]): this {
    rows.forEach((row, j) => Array.from(row).forEach((ch, i) => this.set(x + i, y + j, ch)));
    return this;
  }

  /** 絵の外周に 1px の輪郭を足す */
  outline(ch = '0'): this {
    const src = this.cells.map((row) => row.slice());
    const filled = (x: number, y: number): boolean => (src[y]?.[x] ?? '.') !== '.';
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (filled(x, y)) continue;
        if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) {
          this.cells[y]![x] = ch;
        }
      }
    }
    return this;
  }

  /** 別のグリッドの不透明部分を上に重ねる */
  blit(other: Grid): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const ch = other.get(x, y);
        if (ch !== '.') this.cells[y]![x] = ch;
      }
    }
    return this;
  }

  /** 左半分を右へ写して左右対称にする */
  mirrorX(): this {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w / 2; x++) this.cells[y]![this.w - 1 - x] = this.cells[y]![x]!;
    }
    return this;
  }

  toString(): string {
    return this.cells.map((row) => row.join('')).join('\n');
  }
}

// =============================================================================
// 金棒鬼（48×48）：巨大な暗赤の鬼。金の角、下顎の牙、虎柄の腰布、鋲つきの金棒
// =============================================================================

const KANABO_HALF = `
  ............00..........
  ...........0yy0.........
  ...........0yyy0........
  ............0yyY0.......
  ............0yyYY0.00000
  .............0yyYY001111
  .............0yyyYY01111
  ............000YYYY01211
  ...........0111000012111
  ..........01121111111111
  ..........011RRRRRRRRRRR
  .........0111R00RRRRRRRR
  .........011RR000000RRSS
  .........011RRSll0l0RRSS
  .........011RRRSl0lRRrrR
  .........0111RRRSSRSrrrS
  ..........011wR000000000
  ..........011wW0wwSwwSww
  ..........011wW0SSSSSSSS
  ...........011W0SSSrrrrr
  ...........0111R00000000
  ....00000000111RRRRRRRRR
  ..00RrrRRRR0011RRRRRSRRR
  .0RrrrRRRRRR0000RRRR0000
  0RrrrRRRRRRRSRRRRRRRRRRR
  0RrrRRRRRRRS0RRrrRRRRRRR
  0RrRRRRRRRSS0RrrrRRRRRRR
  0RrRRRRRRRSS0RrrRRRRRRSS
  0RRRRRRRRSS00SRRRRRRSSRR
  0RRRRRRRSS0.0RSSSSSSRRRR
  0yyyyyyyy0..0RRrRRRRRRRS
  0YYYYYYYY0..0RRrRRRSSRRS
  0RrrRRRRS0..0RRRRRRRRRRS
  0RrrRRRRS0..0RRrRRRSSRRS
  0RrRRRRRS0.0yyyyyyyyyyyy
  0RrrRRRSS0.0y0yyy0yyy0yy
  0RRRRRRSS0.0yy0yyy0yyy0y
  0R0R0R0RS0.0Yyy0yyy0yyy0
  .00000000..0YYyy0yYy0yyY
  ...........00YYYy0YYy0YY
  ............0RRRRRRRRS00
  ............0RrRRRRRRS0.
  ............0RrRRRRRSS0.
  ............0RrRRRRRSS0.
  ...........0RRrRRRRRSS0.
  ..........0RrrRRRRRRSS0.
  .........0RRrRRRRRRRSSS0
  .........000000000000000
`;

// 金棒（右手に立てて持つ）。鋲の列と、左右に突き出た棘
const KANABO_CLUB = [
  '__000000__',
  '_0adddDD0_',
  'a0a6dd6D0a',
  '_0adddDD0_',
  '_0ad6dDD0_',
  '_0adddDD0_',
  'a0a6dd6D0a',
  '_0adddDD0_',
  '_0ad6dDD0_',
  '_0adddDD0_',
  '_0a6dd6D0a',
  '_0adddDD0_',
  '_0ad6dDD0_',
  '_0adddDD0_',
  '_0a6dd6D0a',
  '_0adddDD0_',
  '__0addD0__',
  '__0yyyY0__',
  '___0bB0___',
  '___0bB0___',
  '___0bB0___',
  '___0TT0___',
  '___0bB0___',
  '___0bB0___',
  '___0TT0___',
  '___0bB0___',
  '___0bB0___',
  '___0TT0___',
  '___0bB0___',
  '___0bB0___',
  '___0TT0___',
  '___0bB0___',
  '___0bB0___',
];

function kanabo(): string {
  return Grid.parse(sym(KANABO_HALF))
    .stamp(38, 1, KANABO_CLUB)
    .stamp(38, 38, ['___0bB0___', '___0yY0___', '____00____'])
    .toString();
}

// =============================================================================
// 土蜘蛛（64×44）：巨大な蜘蛛。虎縞の腹、鬼面の顔、光る複眼、縞の 8 本脚
// =============================================================================

function tsuchigumo(phase: 0 | 1): string {
  const W = 64;
  const H = 44;

  // ---- 脚（左側の 4 本。付け根 → 膝 → 足先）。1 本おきに持ち上げて歩かせる
  const legs = new Grid(W, H);
  const LEGS: Array<[number, number, number, number, number, number]> = [
    [24, 34, 13, 31, 8, 43],
    [23, 31, 8, 22, 2, 39],
    [23, 28, 7, 12, 1, 28],
    [24, 25, 11, 4, 4, 16],
  ];
  LEGS.forEach(([hx, hy, kx, ky, fx, fy], i) => {
    const lift = i % 2 === phase ? -2 : 0;
    const band: Paint = (x, y) =>
      Math.floor(Math.hypot(x - hx, y - hy) / 3) % 2 === 0 ? 'b' : 'T';
    legs.line(hx, hy, kx, ky + lift, 1.9, 1.6, band);
    legs.line(kx, ky + lift, fx, fy + lift, 1.5, 0.6, band);
    legs.ellipse(kx, ky + lift, 2.2, 2.2, 't');
  });
  legs.outline();

  // ---- 腹（虎縞。縞は輪郭に沿って弓なりに曲げる）
  const abdomen = new Grid(W, H);
  abdomen.ellipse(32, 12.5, 15.5, 12, (x, y) => {
    const curve = ((x + 0.5 - 32) / 15.5) ** 2 * 5;
    const stripe = Math.floor((y + curve) / 3) % 2 === 0;
    if (!stripe) return 'T';
    return y < 8 ? 'y' : y < 16 ? 'Y' : 'O';
  });
  abdomen.outline();

  // ---- 頭胸部と鬼面
  const head = new Grid(W, H);
  head.ellipse(32, 30, 11.5, 10, (x, y) => (y < 24 || x < 23 ? 'b' : 'B'));
  head.stamp(24, 23, [
    '_____l__',
    '__l_0000',
    '__00rrrr',
    '_0rrrrrr',
    '0r00rrrr',
    '0rrr00rR',
    '0rlll0rR',
    '0rrllrrR',
    '0rrrrrRR',
    '_0r00000',
    '_0rwSwSw',
    '__0rSSSS',
    '___00000',
  ]);
  // 毛
  head.set(26, 21, 'T').set(29, 20, 'T').set(31, 21, 'T').set(22, 26, 'T').set(21, 30, 'T');
  // 触肢と牙（開閉する）
  const open = phase === 1 ? 1.5 : 0;
  head.line(23, 36, 20.5 - open, 41.5, 1.1, 0.8, 'b');
  head.line(28.5, 36, 27 - open, 40, 1.4, 1.0, 'W');
  head.line(27 - open, 40, 29.5 - open, 43, 1.0, 0.5, 'w');
  head.line(28.2, 36, 26.7 - open, 39.5, 0.7, 0.6, 'w');
  head.outline();

  return new Grid(W, H).blit(legs).blit(abdomen).blit(head).mirrorX().toString();
}

// =============================================================================
// がしゃどくろ（64×64）：巨大な骸骨の上半身。眼窩に妖しい火が灯る
// =============================================================================

function gasha(open: boolean): string {
  const W = 64;
  const H = 64;
  const jaw = open ? 2 : 0;
  const glow = open ? 3.4 : 2.6;

  // ---- 背面：背骨・鎖骨・肋骨・腕（左半分を描き、最後に左右対称にする）
  const back = new Grid(W, H);
  back.rect(30, 42, 2, 22, (_x, y) => (y % 3 === 2 ? 'x' : 'z'));
  back.line(31, 44.5, 11, 45.5, 1.2, 1.2, 'Z');
  back.line(31, 44, 11, 45, 0.6, 0.6, 'z');
  for (let i = 0; i < 4; i++) {
    const y = 48.5 + i * 4.2;
    back.line(30, y, 19 + i, y + 1, 1.1, 1.0, 'Z');
    back.line(19 + i, y + 1, 16.5 + i, y + 3.2, 1.0, 0.7, 'Z');
    back.line(30, y - 0.5, 19 + i, y + 0.5, 0.55, 0.55, 'z');
  }
  // 肩 → 肘 → 手
  back.ellipse(10, 46, 2.8, 2.8, 'z');
  back.line(10, 46, 4.5, 54, 1.8, 1.5, 'Z');
  back.line(9.4, 46, 3.9, 54, 0.7, 0.6, 'z');
  back.ellipse(4.5, 54.5, 2.3, 2.3, 'z');
  back.line(3.5, 55.5, 7.5, 61, 0.9, 0.9, 'Z');
  back.line(6, 55, 10, 60.5, 0.9, 0.9, 'z');
  back.ellipse(10, 61.5, 2.4, 2.2, 'z');
  // 指
  back.line(11.5, 60.5, 16, 57.5, 0.8, 0.6, 'z');
  back.line(12, 61.5, 18, 60.5, 0.8, 0.6, 'z');
  back.line(12, 62.5, 18.5, 63.2, 0.8, 0.6, 'Z');
  back.line(9, 59.5, 11.5, 56, 0.8, 0.6, 'z');
  back.outline();

  // ---- 頭蓋骨
  const skull = new Grid(W, H);
  // 額の中央上を明るく、こめかみと下側を暗く。階調の境目は市松に散らして丸みを出す
  const bone: Paint = (x, y) => {
    const dx = (x + 0.5 - 32) / 19.5;
    const dy = (y + 0.5 - 11) / 22;
    const v = dx * dx + dy * dy + ((x + y) % 2 === 0 ? 0.05 : -0.05);
    return v < 0.42 ? 'z' : v < 1.02 ? 'Z' : 'x';
  };
  const teeth: Paint = (x) => ((30 - x) % 3 === 0 ? 'x' : 'z');
  // 下顎
  skull.ellipse(32, 42.5 + jaw, 10.5, 5, (x, y) => (y > 44 + jaw || x < 25 ? 'x' : 'Z'));
  // 頭頂と上顎
  skull.ellipse(32, 18, 19.5, 16.5, bone);
  skull.ellipse(32, 31, 13.5, 8, (x, y) => (x < 22 || y > 36 ? 'x' : 'Z'));
  // 口の中と歯
  skull.rect(24, 37, 8, 2 + jaw, '1');
  skull.rect(23, 34, 9, 3, teeth);
  skull.rect(24, 39 + jaw, 8, 3, teeth);
  // 頬のくぼみ
  skull.ellipse(17.5, 30.5, 2.6, 3.4, 'x');
  skull.line(14.5, 27.5, 20.5, 31.5, 0.4, 0.4, 'x');
  // 眼窩と妖火
  skull.ellipse(22.5, 21.5, 7.2, 7, 'x');
  skull.ellipse(22.5, 21.5, 6.2, 6, '1');
  skull.ellipse(22.8, 22, 4.4, 4.4, '0');
  skull.ellipse(23.5, 23, glow, glow, 'q');
  skull.rect(23, 22, 2, 2, 'Q');
  // 眉の骨を眼窩にかぶせ、内側を下げて怒り顔にする
  skull.line(13.5, 13.5, 29.5, 19, 1.5, 1.7, 'Z');
  skull.line(13.5, 12.8, 29.5, 18.2, 0.7, 0.8, 'z');
  skull.line(14.5, 15.6, 28.5, 20.6, 0.4, 0.4, 'x');
  // 鼻孔
  skull.stamp(29, 26, ['__1', '_11', '_11', '111', '11x']);
  skull.outline();

  const g = new Grid(W, H).blit(back).blit(skull).mirrorX();
  // 左右対称を崩す傷：額のひびと欠けた歯
  g.line(38.5, 3.5, 40.5, 8.5, 0.4, 0.4, 'x');
  g.line(40.5, 8.5, 38.5, 11.5, 0.4, 0.4, 'x');
  g.line(38.5, 11.5, 41.5, 14.5, 0.4, 0.4, 'x');
  g.rect(36, 34, 2, 3, '1');
  return g.toString();
}

// =============================================================================
// 酒呑童子（48×56）：赤髪の鬼の王。金の角、紫に金襴の衣、大盃と瓢箪
// =============================================================================

function shuten(): string {
  const W = 48;
  const H = 56;
  // 髪は頭頂から放射状に流れる房として塗り分ける（明るい房・影の房を交互に）
  const hairPaint: Paint = (x, y) => {
    const angle = Math.atan2(y + 0.5 - 12, x + 0.5 - 24);
    const strand = Math.floor((angle + Math.PI) / (Math.PI / 13)) % 4;
    return strand === 0 ? 's' : strand === 2 ? 'R' : 'r';
  };

  // ---- 後ろ髪（広がったたてがみと、肩へ流れる房）
  const hair = new Grid(W, H);
  hair.ellipse(24, 16, 16, 14, hairPaint);
  hair.line(10, 20, 6, 38, 3.2, 1.2, hairPaint);
  hair.line(14, 26, 11, 42, 2.4, 0.9, hairPaint);
  hair.line(9, 11, 3, 21, 2.2, 0.7, hairPaint);
  hair.outline();

  // ---- 衣
  const robe = new Grid(W, H);
  for (let y = 28; y < 56; y++) {
    const hw = 14.5 + (y - 28) * 0.24;
    for (let x = Math.round(24 - hw); x < 24; x++) {
      let ch = 'p';
      if (x < 24 - hw + 2.2) ch = 'P';
      if (y > 44 && (x + 1) % 5 === 0) ch = 'P';
      if (y === 52) ch = 'y';
      if (y > 52) ch = 'V';
      robe.set(x, y, ch);
    }
  }
  // 袖（裾口に金の縁取り）
  robe.ellipse(7.5, 37, 6.2, 8.5, (x, y) => (y > 43 ? 'y' : x < 4 ? 'P' : 'p'));
  robe.line(13.5, 30.5, 13.5, 44.5, 0.4, 0.4, 'V');
  // 胸元の肌と白い襟
  robe.ellipse(24, 31, 3.6, 5.5, 'F');
  robe.line(17.5, 28.5, 23.5, 38, 1.3, 1.3, 'w');
  // 金の帯と結び目
  robe.rect(11, 39, 13, 4, (x, y) => (y === 39 ? 'y' : (x + y) % 4 === 0 ? 'o' : 'Y'));
  robe.rect(22, 38, 2, 6, 'o');
  // 金襴の紋
  for (const [x, y] of [[9, 47], [15, 49], [19, 46], [11, 33], [5, 36], [8, 40]] as const) {
    robe.set(x, y, 'y');
  }
  robe.outline();

  // ---- 頭
  const head = new Grid(W, H);
  head.ellipse(14.8, 19.5, 1.7, 2.3, 'F');
  head.ellipse(24, 19, 8.5, 9.5, (x, y) => (y > 24 || x < 17 ? 'F' : 'f'));
  // 前髪
  head.ellipse(24, 10.5, 9.5, 4.2, hairPaint);
  head.set(16, 14, 'r').set(17, 15, 'r').set(20, 14, 'r').set(21, 15, 'r').set(23, 14, 's');
  // 目鼻立ち（左半分。最後に左右対称になる）
  head.stamp(16, 16, [
    '_00_____',
    '___000__',
    '__Rll0__',
    '___RR___',
    '_______F',
    'rr_____F',
    '_r____Fe',
    '________',
    '____0000',
    '____w__r',
    '______FF',
  ]);
  // 角
  head.line(19.5, 9.5, 15.5, 1.5, 1.7, 0.5, 'Y');
  head.line(19, 9.5, 15.2, 1.8, 0.9, 0.3, 'y');
  head.outline();

  const g = new Grid(W, H).blit(hair).blit(robe).blit(head).mirrorX();

  // ---- 左右非対称の持ち物：右手の大盃
  const cup = new Grid(W, H);
  cup.ellipse(42, 32, 2.2, 2.2, 'f');
  cup.ellipse(41, 28.8, 6.5, 2.6, 'R');
  cup.ellipse(41, 28, 6.5, 2.0, 'r');
  cup.ellipse(41, 27.8, 5, 1.3, '6');
  cup.outline();
  g.blit(cup);

  // ---- 左腰の瓢箪
  const gourd = new Grid(W, H);
  gourd.ellipse(6, 49, 3.6, 3.8, (x) => (x < 6 ? 't' : 'b'));
  gourd.ellipse(6, 44, 2.4, 2.4, (x) => (x < 6 ? 't' : 'b'));
  gourd.rect(5, 40, 2, 2, 'B');
  gourd.rect(5, 39, 2, 1, 'r');
  gourd.rect(4, 46, 4, 1, 'r');
  gourd.outline();
  g.blit(gourd);

  return g.toString();
}

const KANABO = kanabo();
const SHUTEN = shuten();

export const BOSS_SPRITES: SpriteDef[] = [
  sprite('boss.kanabo', 48, 48, [KANABO, bob(KANABO, 10)], { glow: 'l' }),
  sprite('boss.tsuchigumo', 64, 44, [tsuchigumo(0), tsuchigumo(1)], { glow: 'l' }),
  sprite('boss.gasha', 64, 64, [gasha(false), gasha(true)], { glow: 'qQ' }),
  sprite('boss.shuten', 48, 56, [SHUTEN, bob(SHUTEN, 4)], { glow: 'l' }),
];
