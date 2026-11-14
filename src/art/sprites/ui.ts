import { sprite, type SpriteDef } from '../sprite';

/** UI 用の小さな絵（中央が原点） */

// 髑髏（撃破数）
const SKULL = `
  .0000000.
  0zzzzzzz0
  0z00z00z0
  0z00z00z0
  0zzz0zzz0
  .0zzzzz0.
  .0z0z0z0.
  ..00000..
  .........
`;

// 月（夜の進み具合）
const MOON = `
  ...00000...
  ..0lllll0..
  .0llllll60.
  0lllll6ll60
  0llllllll60
  0ll6lllll60
  0llllllll60
  0lllll6l660
  .0lllll660.
  ..0666660..
  ...00000...
`;

// 朝日（夜明け）
const SUN = `
  .....o.....
  .o...o...o.
  ..o.....o..
  ....yyy....
  ...yylyy...
  oo.yllly.oo
  ...yylyy...
  ....yyy....
  ..o.....o..
  .o...o...o.
  .....o.....
`;

// 選択カーソル（右向きの三角）
const CURSOR = `
  00....
  0y0...
  0yy0..
  0yyy0.
  0yyyy0
  0yyy0.
  0yy0..
  0y0...
  00....
`;

// 画面外の目印（右向きの矢印。描画時に回転させる）
const ARROW = `
  .00....
  .0y00..
  .0yyy00
  .0yyyy0
  .0yyy00
  .0y00..
  .00....
`;

// 錠（未解放）
const LOCK = `
  ..00000..
  .0aaaaa0.
  .0a000a0.
  .0a0.0a0.
  000000000
  0yyyyyyy0
  0yy000yy0
  0yyy0yyy0
  0yyyyyyy0
  000000000
`;

export const UI_SPRITES: SpriteDef[] = [
  sprite('ui.skull', 9, 9, [SKULL], { anchor: 'center' }),
  sprite('ui.moon', 11, 11, [MOON], { anchor: 'center', glow: 'l' }),
  sprite('ui.sun', 11, 11, [SUN], { anchor: 'center', glow: 'oyl' }),
  sprite('ui.cursor', 6, 9, [CURSOR], { anchor: 'center' }),
  sprite('ui.arrow', 7, 7, [ARROW], { anchor: 'center' }),
  sprite('ui.lock', 9, 10, [LOCK], { anchor: 'center' }),
];
