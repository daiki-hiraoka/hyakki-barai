import { paint } from '../paint';
import { sprite, type SpriteDef } from '../sprite';

/** 地面の飾り（当たり判定なし・足元が原点）。夜の山里の雰囲気を作る */

// 鳥居：朱の柱に黒い笠木
const TORII = paint(40, 40, (g) => {
  // 柱（右側を暗くして丸みを出す）
  g.rect(8, 9, 4, 28, 'r').rect(11, 9, 1, 28, 'R');
  g.rect(28, 9, 4, 28, 'r').rect(31, 9, 1, 28, 'R');
  // 根巻
  g.rect(7, 34, 6, 5, '2').rect(27, 34, 6, 5, '2');
  g.rect(7, 34, 6, 1, '3').rect(27, 34, 6, 1, '3');
  // 貫
  g.rect(4, 16, 32, 3, 'r').rect(4, 18, 32, 1, 'R');
  // 島木
  g.rect(3, 7, 34, 3, 'r').rect(3, 9, 34, 1, 'R');
  // 笠木（両端が反り上がる）
  g.rect(2, 4, 36, 3, '1').rect(2, 4, 36, 1, '3');
  g.rect(0, 2, 4, 3, '1').rect(36, 2, 4, 3, '1');
  g.rect(0, 2, 4, 1, '3').rect(36, 2, 4, 1, '3');
  // 額束
  g.rect(18, 10, 4, 6, 'Y').rect(19, 11, 2, 4, '1');
  g.outline();
});

// 松：横に張り出した枝ぶり
const PINE = paint(32, 48, (g) => {
  // 幹（少し曲がっている）
  g.line(16, 46, 15, 30, 'B', 4).line(15, 30, 17, 14, 'B', 3);
  g.line(15, 46, 14, 30, 'b', 1).line(14, 30, 16, 14, 'b', 1);
  // 枝
  g.line(16, 26, 7, 22, 'B', 2).line(17, 20, 25, 17, 'B', 2);
  // 葉の塊（下が暗く、上が明るい）
  g.ellipse(16, 9, 9, 5.5, 'H').ellipse(16, 8, 8, 4, 'G').ellipse(14, 6.5, 5, 2, 'g');
  g.ellipse(7, 21, 6.5, 4, 'H').ellipse(7, 20, 5.5, 3, 'G').ellipse(6, 19, 3.5, 1.5, 'g');
  g.ellipse(25, 16, 6.5, 4, 'H').ellipse(25, 15, 5.5, 3, 'G').ellipse(24, 14, 3.5, 1.5, 'g');
  g.ellipse(17, 30, 5, 3, 'H').ellipse(17, 29.5, 4, 2, 'G');
  g.outline();
});

// 枯れ木：葉の落ちた不気味な木
const DEAD_TREE = paint(30, 42, (g) => {
  g.line(15, 40, 14, 22, 'T', 4).line(14, 22, 15, 10, 'T', 3);
  g.line(14, 40, 13, 22, 'B', 1);
  g.line(14, 24, 6, 15, 'T', 2).line(6, 15, 3, 8, 'T', 1).line(6, 15, 2, 15, 'T', 1);
  g.line(15, 18, 23, 11, 'T', 2).line(23, 11, 27, 5, 'T', 1).line(23, 11, 28, 12, 'T', 1);
  g.line(15, 10, 12, 3, 'T', 1).line(15, 10, 18, 2, 'T', 1);
  g.line(11, 40, 8, 41, 'T', 2).line(18, 40, 21, 41, 'T', 2);
  g.outline();
});

// 竹：節のある細い幹と笹の葉
const BAMBOO = paint(18, 44, (g) => {
  const stalk = (x: number, top: number): void => {
    g.rect(x, top, 2, 44 - top, 'g').rect(x + 1, top, 1, 44 - top, 'G');
    for (let y = top + 5; y < 44; y += 7) g.rect(x, y, 2, 1, 'H');
  };
  stalk(4, 6);
  stalk(9, 1);
  stalk(13, 10);
  // 笹の葉
  g.line(5, 8, 0, 5, 'h').line(5, 12, 1, 12, 'h').line(10, 4, 16, 1, 'h');
  g.line(10, 9, 15, 7, 'h').line(14, 13, 17, 10, 'h').line(9, 15, 5, 17, 'h');
  g.outline();
});

// 祠：小さな木の社
const HOKORA = paint(22, 26, (g) => {
  // 屋根
  g.rect(1, 6, 20, 2, '2').rect(3, 4, 16, 2, '2').rect(6, 2, 10, 2, '2');
  g.rect(6, 2, 10, 1, '3').rect(3, 4, 16, 1, '3').rect(1, 6, 20, 1, '3');
  // 社殿
  g.rect(5, 8, 12, 12, 'b').rect(15, 8, 2, 12, 'B');
  // 扉と注連縄
  g.rect(8, 11, 6, 9, 'T').rect(10, 11, 1, 9, 'B');
  g.rect(6, 9, 10, 1, 'w').rect(8, 10, 1, 2, 'w').rect(13, 10, 1, 2, 'w');
  // 台座
  g.rect(3, 20, 16, 2, 'a').rect(2, 22, 18, 3, 'A').rect(2, 22, 18, 1, 'a');
  g.outline();
});

// 地蔵：赤い前掛けの石仏
const JIZO = `
  ....0000....
  ...0aaaa0...
  ..0aaaaaa0..
  ..0a0aa0a0..
  ..0aaaaaa0..
  ..0aa00aa0..
  ...0aaaa0...
  ..00rrrr00..
  .0arrrrrrA0.
  .0aarrrrAA0.
  .0aaarrAAA0.
  .0aaaaaAAA0.
  .0aaaaaAAA0.
  .0aaaaaAAA0.
  .0aaaaAAAA0.
  ..0aaaAAA0..
  .0dddddddd0.
  .0000000000.
`;

// 墓石
const GRAVE = `
  ............
  ...000000...
  ..0aaaaaA0..
  ..0aAAAAA0..
  ..0aA00AA0..
  ..0aA00AA0..
  ..0aAAAAA0..
  ..0aA00AA0..
  ..0aA00AA0..
  ..0aAAAAA0..
  ..0aAAAAA0..
  ..0amAAAA0..
  .0000000000.
  .0aaaaaaAA0.
  .0adddddAA0.
  000000000000
  0aaaaaaaaAA0
  000000000000
`;

// 卒塔婆：細長い木の板
const SOTOBA = `
  ..00..
  .0tt0.
  0ttnt0
  .0tt0.
  0ttnt0
  .0tt0.
  .0t00.
  .0tt0.
  .0t00.
  .0tt0.
  .0t00.
  .0tt0.
  .0tb0.
  .0tb0.
  .0tb0.
  .0tb0.
  .0bb0.
  .0bb0.
  .0bB0.
  .0000.
`;

// 岩
const ROCK = `
  ................
  .....000000.....
  ...00aaaaaA00...
  ..0aaaaaAAAAA0..
  .0aa6aaAAAAAAd0.
  .0aaaaAAAAAddd0.
  0aaaAAAAAAAdddd0
  0aAAAAAmAAddddD0
  .0AAAAddddddDD0.
  ..000000000000..
`;

// 彼岸花（2 種）
const HIGAN_A = `
  .r..r..r.
  r.r.r.r.r
  .rrsrsrr.
  r.rsssr.r
  ..rrrrr..
  ....G....
  ....G....
  ....g....
  ....G....
  ....G....
`;
const HIGAN_B = `
  .........
  ..r.r.r..
  .r.rsr.r.
  ..rsssr..
  .r.rrr.r.
  ....G....
  ....g....
  ....G....
  ....G....
  .........
`;

// すすき
const SUSUKI = `
  ......n...
  .....nn..n
  ....nn..nn
  ...nn..nn.
  ...n..nn..
  ..t..tn...
  ..t..t..n.
  ..t.t..nn.
  ...tt..n..
  ...t..t...
  ...t.t....
  ...tt.....
  ...tt.....
  ...t......
`;

export const DECOR_SPRITES: SpriteDef[] = [
  sprite('decor.torii', 40, 40, [TORII]),
  sprite('decor.pine', 32, 48, [PINE], { ax: 15 }),
  sprite('decor.dead_tree', 30, 42, [DEAD_TREE], { ax: 14 }),
  sprite('decor.bamboo', 18, 44, [BAMBOO]),
  sprite('decor.hokora', 22, 26, [HOKORA]),
  sprite('decor.jizo', 12, 18, [JIZO]),
  sprite('decor.grave', 12, 18, [GRAVE]),
  sprite('decor.sotoba', 6, 20, [SOTOBA]),
  sprite('decor.rock', 16, 10, [ROCK]),
  sprite('decor.higan', 9, 10, [HIGAN_A, HIGAN_B]),
  sprite('decor.susuki', 10, 14, [SUSUKI]),
];
