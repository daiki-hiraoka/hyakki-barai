import { bob, patch, recolor, sprite, type SpriteDef } from '../sprite';

/**
 * 妖怪（右向き・足元が原点・2 フレーム以上）。
 * 闇の中でも見分けられるよう、種類ごとに主色を変え、目などは発光記号（glow）にする。
 */

// ---- 描画の補助 -----------------------------------------------------------

function rowsOf(src: string): string[] {
  return src
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/** 左半分だけを書き、左右対称のフレームにする */
export function sym(half: string): string {
  return rowsOf(half)
    .map((row) => row + Array.from(row).reverse().join(''))
    .join('\n');
}

/** 右側に透明の列を足す（武器を持たせる余白など） */
function padRight(src: string, cols: number): string {
  return rowsOf(src)
    .map((row) => row + '.'.repeat(cols))
    .join('\n');
}

/** (x, y) を左上として rows を重ねる。'_' の位置は元の絵を残す */
function stamp(src: string, x: number, y: number, rows: string[]): string {
  const out = rowsOf(src).map((row) => Array.from(row));
  rows.forEach((row, j) => {
    Array.from(row).forEach((ch, i) => {
      const line = out[y + j];
      if (ch !== '_' && line && x + i < line.length) line[x + i] = ch;
    });
  });
  return out.map((row) => row.join('')).join('\n');
}

// ---- 提灯お化け：一つ目と長い舌の赤提灯。ふわふわ浮く ------------------------
const CHOCHIN = `
  ......0000......
  .....0dAAd0.....
  ....00000000....
  ...0soooooooO0..
  ..0slooooooooO0.
  ..0soo77777ooO0.
  ..0so7700077oO0.
  ..0soo77777ooO0.
  ..0sOOOOOOOOOO0.
  ..0oS7S7S7S7SO0.
  ..0oSSrrrrSSoO0.
  ...0ooSrssSoO0..
  ....0000rs0000..
  ......0rss0.....
  .......0rs0.....
  ........00......
`;

// ---- 一つ目小僧：大きな一つ目の小坊主。青い着物 ------------------------------
const HITOTSUME = `
  .....000000.....
  ....0ffffff0....
  ...0fffffffF0...
  ...0ff7777fF0...
  ...0f770077F0...
  ...0ff7777fF0...
  ...0fffffffF0...
  ....0ffrrfF0....
  .....000000.....
  ....0uuuuuu0....
  ...0uUuuuuUu0...
  ..0f0uwwwwu0f0..
  ...00uuuuuu00...
  ....0uUuuUu0....
  ....0uu00uu0....
  ....000..000....
`;

// ---- 唐傘お化け：紫の傘に一つ目、舌、一本足の下駄 ----------------------------
const KARAKASA = `
  .......00.......
  ......0vp0......
  ......0vp0......
  .....0vppP0.....
  .....0vppP0.....
  ....0vpppPP0....
  ....0v7777P0....
  ...0vp7007pP0...
  ...0vp7777pP0...
  ..0vpppppppPP0..
  ..0vpSSSSSSpP0..
  .0vppSSrrrSppP0.
  .0vpPppprsPpPP0.
  ..000000rs00000.
  ......0f0rs0....
  ......0fF00.....
  ......0fF0......
  ......0fF0......
  ....0bbbbbb0....
  .....0B00B0.....
`;

// ---- 鬼火：水色の人魂。輪郭なしで全体が光る ----------------------------------
const ONIBI = `
  .......C....
  ......CcC...
  .....CciC...
  ....CciiC...
  ...CciiicC..
  ..Cci77iicC.
  ..Ci7777icC.
  .Cci7U7U7cC.
  .Cci77777cC.
  .CcciiiiccC.
  ..CCccccCC..
  ...CCCCCC...
`;

// ---- 河童：緑の体、黄色い嘴、頭の皿、背中の甲羅 ------------------------------
const KAPPA = `
  .....000000.....
  ....0H6666H0....
  ...0HhH66HhH0...
  ...0hggggggg0...
  ...0gg70gg70g0..
  ...0ggggyyyyy0..
  ...0gggYyyyy0...
  ....0gggggg0....
  ...00hggggg00...
  ..0BB0hwwwg0g0..
  ..0BbB0wWwg0g0..
  ..0BbB0wWwg00...
  ...0BB0gggg0....
  ....000gGgG0....
  ....0gg00gg0....
  ...0yyy00yyy0...
`;

// ---- 化け狸：藁の笠、白い腹、縞の太い尾 --------------------------------------
const TANUKI = `
  .......000000.......
  .....00nnnnnn00.....
  ...00nntnnnntnn00...
  ..0tttttttttttttt0..
  ....000bbbbbb000....
  ....0bTTbbbbTTb0....
  ....0bT7TbbT7Tb0....
  ....0bbbnnnnbbb0....
  .....0bbnn0nnb0.....
  ....00bbbbbbbb00....
  ...0bbbnnnnnnbbb0...
  .000bbnnnwwnnnbb0...
  0TbT0bnnwwwwnnbb0...
  0bTb0bnnwwwwnnbb0...
  0TbT0BbnnwwnnbbB0...
  .000.0BbbnnbbbB0....
  .....0BB0..0BB0.....
  .....0000..0000.....
`;

// ---- 猫又：正面を向いて座る白猫。左右に広げた二股の尾の先に怪火 --------------
const NEKOMATA = sym(`
  ........
  .o......
  0w0..0..
  0w0.0w0.
  0w0.0ww0
  .0w00www
  .0w00wyw
  ..0w0wyw
  ..0w0wwk
  ...0w000
  ...0w0ww
  ...0wwww
  ...0wWww
  ...0wWww
  ...0w0ww
  ...00000
`);
// 尾を外へ振った 2 コマ目
const NEKOMATA_B = sym(`
  ........
  o.......
  w0...0..
  w0..0w0.
  0w0.0ww0
  0w0.0www
  .0w00wyw
  .0w00wyw
  ..0w0wwk
  ..0w0000
  ...0w0ww
  ...0wwww
  ...0wWww
  ...0wWww
  ...0w0ww
  ...00000
`);

// ---- ろくろ首：臙脂の着物、長く伸びてうねる首、赤く光る目 --------------------
const ROKURO = `
  ......000000....
  .....01111110...
  ....0111111110..
  ....011fffff10..
  ....01fqffqf10..
  ....01ffffff10..
  ....011frrf110..
  .....0110ff010..
  .....010ff0.0...
  ......0ff0......
  .....0ff0.......
  ....0ff0........
  ....0ff0........
  .....0ff0.......
  ......0ff0......
  ....00RffR00....
  ...0RRRwwRRR0...
  ..0RRSRRRRSRR0..
  ..0RS0RRRR0SR0..
  ..0f00RyyR00f0..
  ...0.0RRRR0.0...
  .....0RSRR0.....
  ....0RRSRRR0....
  ....00000000....
`;

// ---- 一反木綿：うねって飛ぶ白い布。赤く光る目 --------------------------------
const ITTAN_A = `
  ........................
  .................00000..
  ......0000.....00wwwww0.
  ....00wwww00..0wwwwwwww0
  ...0wwwwwwww00wwrwwrwww0
  ..0wwWWWWwwwwwwwrwwrwww0
  .0wwW0000WwwwwwwwwwwwwW0
  0wwW0....0WWwwwwwwwwwW0.
  0wW0......00WWWWWWWWW0..
  0W0.........000000000...
  .0......................
  ........................
`;
const ITTAN_B = `
  ........................
  .................00000..
  ...............00wwwww0.
  ..0000........0wwwwwwww0
  .0wwww00....00wwrwwrwww0
  0wwwwwww0000wwwwrwwrwww0
  0wWWwwwwwwwwwwwwwwwwwwW0
  .00WWWwwwwWWWwwwwwwwwW0.
  ...000WWWW000WWWWWWWW0..
  ......0000...00000000...
  ........................
  ........................
`;

// ---- 泥田坊：泥から突き出た上半身。一つ目と三本指の両手 ----------------------
const DOROTABO = `
  ........................
  .0.0.0............0.0.0.
  0b0b0b0..........0b0b0b0
  0b0b0b0..000000..0b0b0b0
  0bbbbb0.0tbbbbb0.0bbbbb0
  .0bbb0.0tbbbbbbB0.0bbb0.
  .0bbb0.0bb7777bB0.0bbb0.
  .0bBb0.0b77yy77B0.0bBb0.
  .0bBb00bb77y077bB00bBb0.
  .0bBbb0bbb7777bbB0bbBb0.
  ..0bBbbbbbbbbbbbbbbBb0..
  ...0bBbbb000000bbbBb0...
  ....00bbb0SSSS0bbb00....
  .....0bbbb0000bbbbB0....
  .....0bbBbbbbbbbBbB0....
  .....0bbBbbbbbbbBbB0....
  ....0bbbBbbbbbbbBbBB0...
  ....0bbBBbbbbbbBBbBB0...
  ...0bbbBBbbbbbbBBBbBB0..
  ..00bbBBBbbbbbBBBBBBB00.
  .0TTBBBBBBBBBBBBBBBBTT0.
  0TTTTBBBBBBBBBBBBBTTTTT0
  .0TTTTTTTTTTTTTTTTTTTT0.
  ..00000000000000000000..
`;

// ---- 泥田坊の分裂体 ----------------------------------------------------------
const DOROTABO_S = `
  ............
  ....0000....
  ...0tbbb0...
  ..0tbbbbB0..
  ..0b7777B0..
  .0bb7y07bB0.
  .0bb7777bB0.
  .0bbbbbbbB0.
  0bbb0000bBB0
  0TBBBBBBBBT0
  .0TTTTTTTT0.
  ..00000000..
`;

// ---- 烏天狗：黒い翼、赤い顔、黄の嘴、金の頭襟 --------------------------------
const TENGU = stamp(
  sym(`
    ..........
    ......0000
    .....02222
    .00..0222y
    0340.0rrrr
    033400r7rr
    033340rrrr
    0233340rrr
    0223334000
    .022330222
    ..0222022w
    ...0000222
    ......022w
    ......0222
    ......0222
    ......0122
    .......000
    .......0y0
    ......0yy0
    ......0000
  `),
  9,
  6,
  ['yyy_', '_yyY', '__0_'],
);

// ---- 輪入道：燃える車輪の中央に髭面 ------------------------------------------
const WANYUDO_A = sym(`
  ...........r
  ...........y
  ..........ry
  .....r...roy
  ....ro...oyl
  ...roy.ooyyy
  ...royoyoooO
  ....oyooSSSO
  .r..oyOOSSS0
  ro.oySSO0111
  royyoSS0ffff
  .ooySSS01fff
  ..yoSS0ff11f
  r.oyOO0f70fF
  royoOO0FfffF
  .ooySS010www
  ..oySSS010rr
  ...oySS01111
  .r.yoSSO0111
  ro..oyOOSSS0
  .o...oyoSSSO
  ...ro.oyoooO
  ....o..ooyoo
  ..........oo
`);
const WANYUDO_B = sym(`
  ............
  ...........r
  ....r.....oy
  ....ro...ryy
  ...royo..oyl
  ....oy.ooyyy
  ..r.oyoyoooO
  .ro.oyooSSSO
  .o..oyOOSSS0
  ...oySSO0111
  r.yyoSS0ffff
  rooySSS01fff
  .oyoSS0ff11f
  ..oyOO0f70fF
  .oyoOO0FfffF
  rooySS010www
  r.oySSS010rr
  ...oySS01111
  ...yoSSO0111
  .r..oyOOSSS0
  ro...oyoSSSO
  .o.r..oyoooO
  ...o...ooyoo
  ..........oo
`);

// ---- 雪女：白い着物、長い黒髪、氷のように光る目 ------------------------------
const YUKIONNA = sym(`
  .....000
  ....0111
  ...01111
  ...01111
  ...01666
  ...016c6
  ...01666
  ...0116u
  ...01106
  ..011776
  .0711775
  07711777
  07611777
  0761uuu5
  0765UUUU
  .0007777
  ...07776
  ...07776
  ...07766
  ..077766
  ..077765
  .0776665
  .0766655
  .0000000
`);

// ---- 骸骨武者：金の前立ての兜、朱の威の鎧、振りかざした刀 --------------------
const GAIKOTSU = stamp(
  padRight(
    sym(`
      y.......
      yy......
      .yy.0000
      ..yy0ddd
      ..0dAAdd
      .0dAdddd
      0DDDDDDD
      0D0zzzzz
      0D0zq0zz
      000zzzz0
      ..0z0z0z
      ...00000
      0dd0ddrd
      0rd0drdr
      0dd0ddrd
      0rD0DDDD
      00z0dydd
      .0z0rdrd
      .0z0DrDr
      .000.0z0
      .....0z0
      ....0zz0
    `),
    4,
  ),
  14,
  6,
  [
    '_____6',
    '_____6',
    '_____6',
    '____6a',
    '____6a',
    '___6a_',
    '___6a_',
    '__6a__',
    '__6a__',
    '_6a___',
    '_6a___',
    'yyy___',
    'T_____',
  ],
);

// ---- 赤鬼：朱の肌、金の角、虎柄の腰布、鋲つきの金棒 --------------------------
const ONI = stamp(
  padRight(
    sym(`
      ...00.....
      ...0y0....
      ...0yy0000
      .000yyY011
      0111000111
      011rrrrrrr
      01rr000rrr
      01rrrl0rrR
      01rrrrrrRR
      01rr000000
      .0RrwSSSSS
      ..0Rr00000
      .00srrrrrr
      0ssrrrrRrr
      0srr0rrRRr
      0srR0rrrrR
      0rrR0rRrRr
      0rrR0rrrrR
      0rrR0yyyyy
      0rrR0y0yy0
      0rr00yy0yy
      .000Y0yY0y
      ...0rrrrR0
      ...0rrrrR0
      ..0srrrrR0
      ..00000000
    `),
    4,
  ),
  20,
  4,
  [
    '.00.',
    '0da0',
    '0ad0',
    '0da0',
    '0ad0',
    '0da0',
    '0ad0',
    '0da0',
    '0ad0',
    '0da0',
    '0ad0',
    '0dD0',
    '0b0.',
    '0b0.',
    '0b0.',
    '0b0.',
    '0b0.',
    '0b0.',
    '0B0.',
    '0y0.',
    '.0..',
  ],
);

// ---- 塗り壁：灰色の壁に小さな目と手足 ----------------------------------------
const NURIKABE = sym(`
  ...000000000
  ..0aaaaaaaaa
  ..0a6aaaaaaa
  ..0aaaaaadaa
  ..0aaaaaaada
  ..0aaaaaaaaa
  ..0aAaaaaaaa
  ..0aaaaaaaaa
  ..0aaaaa07aa
  ..0aaaaa00aa
  ..0aaaaaaaaa
  .00aaaaaaaAA
  0a0aaaaaaa00
  0A0aaaaaaaaa
  .00aAaaaaaaa
  ..0aaaaaaaaa
  ..0aaaadaaaa
  ..0aaaaadaaA
  ..0AaaaaaaAA
  ..0AAaaaaAAA
  ..0AAAAAAAAA
  ..0000000000
  ....0AA0....
  ....0000....
`);

// ---- 鵺：猿の赤い顔、虎縞の胴、蛇の尾 ----------------------------------------
const NUE = `
  ............................
  .000........................
  0ggg0...............00000...
  0glg0..............0bbbbb0..
  0ggG0.............0bbbbbbb0.
  .0gG0.............0brrrrrb0.
  .0gG0..000000000000bl0rl0b0.
  .0ggG00oToooToooTo0brrrrrb0.
  ..0gG00oToooToooTo0brRRRrb0.
  ...0gG0ooToooToooT00brwwb0..
  ....000ooToooToooT0000000...
  ......0onnTnnnTnnnn0........
  .......0nnnnnnnnnnn0........
  ......0oT0OO000oT0OO0.......
  ......0oo0OO0.0oo0OO0.......
  ......0oT0OO0.0oT0OO0.......
  ......0oo0O0..0oo0O0........
  ......0oT000..0oT000........
  ......0nn0....0nn0..........
  ......0000....0000..........
`;

// ---- 餓鬼：痩せた灰緑の体に膨れた腹、黄色く光る目 ----------------------------
const GAKI = sym(`
  ..0000
  .0mmmm
  0mmmmm
  0m0ymm
  0mmmmm
  .0m000
  ..000m
  ..00mM
  .0m0mM
  0m0mjj
  0m0mjj
  .00mmj
  ...0m0
  ..0mm0
`);

// ---- 小蜘蛛：紫の体に黄の模様、赤く光る目。脚は明るい紫で左右に 4 本ずつ ------
const KOGUMO_A = sym(`
  ......
  .pp.00
  p..0pP
  .pp0Py
  p..0PP
  .pp0PP
  p...0P
  .pp0PP
  p..0qP
  ....00
`);
const KOGUMO_B = sym(`
  .pp...
  p...00
  .pp0pP
  p..0Py
  .pp0PP
  p..0PP
  .pp.0P
  p..0PP
  ...0qP
  ....00
`);

// ---- 敵の弾（暗闇でも見えるよう全体を光らせる）-------------------------------
const SHOT_ONIBI_A = `
  ..RR..
  .Rq7R.
  Rq77qR
  RqQ7qR
  .RqqR.
  ..RR..
`;
const SHOT_ONIBI_B = `
  ..RR..
  .RqqR.
  Rq7QqR
  Rq77qR
  .R7qR.
  ..RR..
`;
const SHOT_SNOW = `
  ..5555..
  .567765.
  56777765
  57777765
  57777665
  56776655
  .566555.
  ..5555..
`;
const SHOT_WEB = `
  ...6666...
  ..6w66w6..
  .6w6ww6w6.
  66w6666w66
  6w66ww66w6
  6w66ww66w6
  66w6666w66
  .6w6ww6w6.
  ..6w66w6..
  ...6666...
`;
const SHOT_BONE = [
  `
  ..........
  ..........
  ..........
  zz......zz
  zzzzzzzzzz
  ZZzzzzzzZZ
  ZZ......ZZ
  ..........
  ..........
  ..........
`,
  `
  .zz.......
  zzz.......
  zzzz......
  ..zzz.....
  ...zzz....
  ....zzz...
  .....zzz..
  ......zzzz
  .......zzz
  .......zz.
`,
  `
  ...zzZZ...
  ...zzZZ...
  ....zZ....
  ....zZ....
  ....zZ....
  ....zZ....
  ....zZ....
  ....zZ....
  ...zzZZ...
  ...zzZZ...
`,
  `
  .......zz.
  .......zzz
  ......zzzz
  .....zzz..
  ....zzz...
  ...zzz....
  ..zzz.....
  zzzz......
  zzz.......
  .zz.......
`,
];

const ONI_RED = sprite('enemy.oni_red', 24, 26, [ONI, bob(ONI, 4)], { glow: 'l', ax: 10 });

export const ENEMY_SPRITES: SpriteDef[] = [
  sprite(
    'enemy.chochin',
    16,
    16,
    [CHOCHIN, patch(bob(CHOCHIN, 3), 13, ['.....0rss0......', '.....0rs0.......', '......00........'])],
    { glow: '7l' },
  ),
  sprite(
    'enemy.hitotsume',
    16,
    16,
    [HITOTSUME, patch(bob(HITOTSUME, 2), 14, ['...0uu0..0uu0...', '...000....000...'])],
    { glow: '7' },
  ),
  sprite('enemy.karakasa', 16, 20, [KARAKASA, bob(KARAKASA, 3)], { glow: '7' }),
  sprite(
    'enemy.onibi',
    12,
    12,
    [ONIBI, patch(ONIBI, 0, ['....C.......', '....CcC.....', '....CciC....', '....CciiC...'])],
    { glow: 'Cci7' },
  ),
  sprite(
    'enemy.kappa',
    16,
    16,
    [KAPPA, patch(bob(KAPPA, 2), 14, ['...0gg0..0gg0...', '..0yyy0..0yyy0..'])],
    { glow: '7' },
  ),
  sprite(
    'enemy.tanuki',
    20,
    18,
    [TANUKI, patch(bob(TANUKI, 2), 16, ['....0BB0....0BB0....', '....0000....0000....'])],
    { glow: '7' },
  ),
  sprite(
    'enemy.nekomata',
    16,
    16,
    [NEKOMATA, NEKOMATA_B],
    { glow: 'yo' },
  ),
  sprite(
    'enemy.rokuro',
    16,
    24,
    [
      ROKURO,
      patch(ROKURO, 9, [
        '......0ff0......',
        '.......0ff0.....',
        '........0ff0....',
        '........0ff0....',
        '.......0ff0.....',
        '......0ff0......',
      ]),
    ],
    { glow: 'q' },
  ),
  sprite('enemy.ittan', 24, 12, [ITTAN_A, ITTAN_B], { glow: 'r' }),
  sprite('enemy.dorotabo', 24, 24, [DOROTABO, bob(DOROTABO, 4)], { glow: '7y' }),
  sprite('enemy.dorotabo_s', 12, 12, [DOROTABO_S, bob(DOROTABO_S, 3)], { glow: '7y' }),
  sprite('enemy.tengu', 20, 20, [TENGU, bob(TENGU, 3)], { glow: '7' }),
  sprite('enemy.wanyudo', 24, 24, [WANYUDO_A, WANYUDO_B], { glow: 'royl7' }),
  sprite('enemy.yukionna', 16, 24, [YUKIONNA, bob(YUKIONNA, 1)], { glow: 'c' }),
  sprite('enemy.gaikotsu', 20, 22, [GAIKOTSU, bob(GAIKOTSU, 3)], { glow: 'q', ax: 8 }),
  ONI_RED,
  recolor(ONI_RED, 'enemy.oni_blue', { r: 'u', R: 'U', s: '5' }),
  sprite('enemy.nurikabe', 24, 24, [NURIKABE, bob(NURIKABE, 2)], { glow: '7' }),
  sprite('enemy.nue', 28, 20, [NUE, bob(NUE, 7)], { glow: 'l' }),
  sprite('enemy.gaki', 12, 14, [GAKI, bob(GAKI, 2)], { glow: 'y' }),
  sprite('enemy.kogumo', 12, 10, [KOGUMO_A, KOGUMO_B], { glow: 'q' }),

  sprite('shot.onibi', 6, 6, [SHOT_ONIBI_A, SHOT_ONIBI_B], { anchor: 'center', glow: 'RqQ7' }),
  sprite('shot.snow', 8, 8, [SHOT_SNOW], { anchor: 'center', glow: '567' }),
  sprite('shot.web', 10, 10, [SHOT_WEB], { anchor: 'center', glow: '6w' }),
  sprite('shot.bone', 10, 10, SHOT_BONE, { anchor: 'center', glow: 'zZ' }),
];
