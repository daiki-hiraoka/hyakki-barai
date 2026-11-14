import { sprite, type SpriteDef } from '../sprite';

/**
 * 落とし物と壊せる置物。
 * 光るものは黒い輪郭ではなく同系色の暗い縁取りにして、闇の上で柔らかく見せる。
 * 霊玉は色だけでなく形（丸・菱・大玉）でも見分けられるようにしている。
 */

// 霊玉（小）：青い魂の玉
const GEM0_A = `
  ..UUUU..
  .UuccuU.
  Uuc7icuU
  UucicuuU
  UuccuuUU
  UuuuuUUU
  .UuUUUU.
  ..UUUU..
`;
const GEM0_B = `
  ..UUUU..
  .UucuuU.
  Uuci7cuU
  Uuc7icuU
  UuuccuUU
  UuuuuUUU
  .UuUUUU.
  ..UUUU..
`;

// 霊玉（中）：翠の菱形
const GEM1_A = `
  ...GG...
  ..GhhG..
  .Gh7hgG.
  Ghh7hggG
  GhhhgggG
  .GhgggG.
  ..GggG..
  ...GG...
`;
const GEM1_B = `
  ...GG...
  ..GhhG..
  .Ghh7gG.
  Ghhh7ggG
  Ghh7gggG
  .GhgggG.
  ..GggG..
  ...GG...
`;

// 霊玉（大）：金の大玉
const GEM2_A = `
  ...YYYY...
  ..YyyyyY..
  .Yyl7lyyY.
  Yyl777lyyY
  Yyyl7lyyOY
  YyyylyyyOY
  YyyyyyyOOY
  .YyyyyOOY.
  ..YOOOOY..
  ...YYYY...
`;
const GEM2_B = `
  ...YYYY...
  ..YyylyY..
  .Yyyl7lyY.
  Yyyl777lyY
  Yyyyl7lyOY
  YyyyylyyOY
  YyyyyyyOOY
  .YyyyyOOY.
  ..YOOOOY..
  ...YYYY...
`;

// 小判：表と、回って細く見える瞬間
const COIN_A = `
  ..0000..
  .0yyyy0.
  0ylyyyY0
  0yYYYyY0
  0yyyyyY0
  0yYYYyY0
  .0yyyY0.
  ..0000..
`;
const COIN_B = `
  ...00...
  ..0yY0..
  ..0lY0..
  ..0yY0..
  ..0yY0..
  ..0yY0..
  ..0yY0..
  ...00...
`;

// 小判袋：紫の巾着
const BAG = `
  ....0..0....
  ...0p00p0...
  ....0pp0....
  ....0rr0....
  ...0pppp0...
  ..0pppppP0..
  .0ppyyyypP0.
  .0pyyYYyyP0.
  .0pyYyyYyP0.
  .0ppyyyyPP0.
  ..0ppppPP0..
  ...000000...
`;

// おにぎり（回復）
const ONIGIRI = `
  .....00.....
  ....0770....
  ...077770...
  ...077760...
  ..07777760..
  ..07777660..
  .0700000060.
  .0702222060.
  077022220660
  077022220660
  .0000000000.
  ............
`;

// 招霊の鈴：朱の緒の金鈴
const BELL = `
  ....0000....
  ...0rrrr0...
  ....0rr0....
  ...00yy00...
  ..0yyyyyy0..
  .0ylyyyyyY0.
  .0yllyyyyY0.
  .0yyyyyyyY0.
  .0yy0000YY0.
  .0yyy00YYY0.
  ..0yyyYYY0..
  ...000000...
`;

// 大祓の札：金の天と大きな朱印
const NUKE = `
  .00000000.
  0yyyyyyyy0
  0wwwwwwww0
  0wwrrrrww0
  0wrrwwrrw0
  0wwrrrrww0
  0wwwrrwww0
  0wrrrrrrw0
  0wwwrrwww0
  0wwrwwrww0
  0wrwwwwrw0
  0wwwwwwww0
  0WWWWWWWW0
  .00000000.
`;

// 金縛りの札：氷色の紙に青い封印
const FREEZE = `
  .00000000.
  0CCCCCCCC0
  0iiiiiiii0
  0iiuiiuii0
  0iiiuuiii0
  0iuuuuuui0
  0iiiuuiii0
  0iiuiiuii0
  0iiiiiiii0
  0iUUUUUUi0
  0iiiiiiii0
  0iiUUUUii0
  0cccccccc0
  .00000000.
`;

// つづら（閉）：竹編みの葛籠に朱の紐
const CHEST_CLOSED = `
  ....................
  ....................
  ....................
  ....................
  ..0000000000000000..
  .0tntntntntntntntb0.
  .0ntntntnrrntntnbb0.
  .00000000rr00000000.
  .0tbtbtbtrrtbtbtbb0.
  .0btbtbtbrrbtbtbbb0.
  .0tbtbtbYrrYbtbtbb0.
  .0btbtbtbrrbtbtbbb0.
  .0tbtbtbtrrtbtbtbb0.
  .0btbtbtbrrbtbtbbb0.
  .0TTTTTTTrrTTTTTTT0.
  .000000000000000000.
`;

// つづら（開）：蓋が外れ、中から光があふれる
const CHEST_OPEN = `
  .....l...l...l......
  .l......l7l.......l.
  ...l....l777l...l...
  .......ly777yl......
  ......lly777yll.....
  ..0000000000000000..
  .0TlyyllllllllyylT0.
  .000000000000000000.
  .0tbtbtbtbtbtbtbbb0.
  .0btbtbtbtbtbtbtbb0.
  .0tbtbtbtbtbtbtbbb0.
  .0btbtbtbtbtbtbtbb0.
  .0tbtbtbtbtbtbtbbb0.
  .0btbtbtbtbtbtbtbb0.
  .0TTTTTTTTTTTTTTTT0.
  .000000000000000000.
`;

// 石灯籠：苔むした石に、火袋の灯り
const LANTERN_A = `
  ................
  .......00.......
  ......0aa0......
  ......0aA0......
  ....00000000....
  ...0aaaaaaaa0...
  ..0aaaAAAAAAd0..
  .0amAAAAAmAAAd0.
  .00000000000000.
  ...0aAAAAAAd0...
  ...0a0yyyy0d0...
  ...0a0ylly0d0...
  ...0a0yyyy0d0...
  ...0aAAAAAAd0...
  ..000000000000..
  ..0aaAAAAAAAd0..
  ...0000000000...
  .....0aAAd0.....
  .....0aAAd0.....
  .....0amAd0.....
  .....0aAAd0.....
  ....00000000....
  ...0aaAAAAAd0...
  ...0000000000...
`;
const LANTERN_B = `
  ................
  .......00.......
  ......0aa0......
  ......0aA0......
  ....00000000....
  ...0aaaaaaaa0...
  ..0aaaAAAAAAd0..
  .0amAAAAAmAAAd0.
  .00000000000000.
  ...0aAAAAAAd0...
  ...0a0ylly0d0...
  ...0a0llll0d0...
  ...0a0ylly0d0...
  ...0aAAAAAAd0...
  ..000000000000..
  ..0aaAAAAAAAd0..
  ...0000000000...
  .....0aAAd0.....
  .....0aAAd0.....
  .....0amAd0.....
  .....0aAAd0.....
  ....00000000....
  ...0aaAAAAAd0...
  ...0000000000...
`;

export const ITEM_SPRITES: SpriteDef[] = [
  sprite('item.gem0', 8, 8, [GEM0_A, GEM0_B], { anchor: 'center', glow: 'uc7i' }),
  sprite('item.gem1', 8, 8, [GEM1_A, GEM1_B], { anchor: 'center', glow: 'gh7' }),
  sprite('item.gem2', 10, 10, [GEM2_A, GEM2_B], { anchor: 'center', glow: 'yl7O' }),
  sprite('item.coin', 8, 8, [COIN_A, COIN_B], { anchor: 'center', glow: 'l' }),
  sprite('item.bag', 12, 12, [BAG], { anchor: 'center' }),
  sprite('item.onigiri', 12, 12, [ONIGIRI], { anchor: 'center' }),
  sprite('item.bell', 12, 12, [BELL], { anchor: 'center', glow: 'l' }),
  sprite('item.nuke', 10, 14, [NUKE], { anchor: 'center' }),
  sprite('item.freeze', 10, 14, [FREEZE], { anchor: 'center' }),
  sprite('item.chest', 20, 16, [CHEST_CLOSED, CHEST_OPEN], { glow: 'l7y' }),
  sprite('prop.lantern', 16, 24, [LANTERN_A, LANTERN_B], { glow: 'yl' }),
];
