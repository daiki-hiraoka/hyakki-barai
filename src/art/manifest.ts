/**
 * ゲームが必要とするスプライトの一覧（描く側と使う側の契約）。
 * ここにある ID・サイズ・最小フレーム数を満たすスプライトが src/art/sprites/ に無いと、
 * manifest.test.ts が失敗する。
 */
export interface ManifestEntry {
  id: string;
  w: number;
  h: number;
  /** 最小フレーム数 */
  frames: number;
}

const e = (id: string, w: number, h: number, frames = 1): ManifestEntry => ({ id, w, h, frames });

export const WEAPON_ICON_IDS = [
  'reifu', 'hamaya', 'shakujo', 'juzu', 'kitsunebi', 'kekkai',
  'shio', 'kamaitachi', 'taiko', 'orizuru', 'suzu', 'katana',
] as const;

export const EVOLVED_ICON_IDS = [
  'yaoyorozu', 'habaya', 'kongo', 'bonno', 'kyubi', 'shijin',
  'misogi', 'oroshi', 'kannari', 'senbazuru', 'iwato', 'oboro',
] as const;

export const PASSIVE_ICON_IDS = [
  'fude', 'kazakiri', 'daruma', 'senko', 'ogi', 'inro',
  'magatama', 'waraji', 'kyokan', 'hotaru', 'domaru', 'maneki',
] as const;

export const MANIFEST: ManifestEntry[] = [
  // ---- 祓い手（右向き・足元が原点。フレーム 0 は立ち姿、歩行中は全フレームを繰り返す）
  ...['haruma', 'chihaya', 'goukai', 'kon', 'jubei', 'enku'].map((n) => e(`char.${n}`, 16, 24, 2)),

  // ---- 妖怪（右向き・足元が原点）
  e('enemy.chochin', 16, 16, 2), // 提灯お化け
  e('enemy.hitotsume', 16, 16, 2), // 一つ目小僧
  e('enemy.karakasa', 16, 20, 2), // 唐傘お化け（一本足で跳ねる）
  e('enemy.onibi', 12, 12, 2), // 鬼火（青白い人魂）
  e('enemy.kappa', 16, 16, 2), // 河童
  e('enemy.tanuki', 20, 18, 2), // 化け狸
  e('enemy.nekomata', 16, 16, 2), // 猫又（二股の尾）
  e('enemy.rokuro', 16, 24, 2), // ろくろ首
  e('enemy.ittan', 24, 12, 2), // 一反木綿（飛ぶ白布）
  e('enemy.dorotabo', 24, 24, 2), // 泥田坊
  e('enemy.dorotabo_s', 12, 12, 2), // 泥田坊の分裂体
  e('enemy.tengu', 20, 20, 2), // 烏天狗
  e('enemy.wanyudo', 24, 24, 2), // 輪入道（炎の車輪に顔）
  e('enemy.yukionna', 16, 24, 2), // 雪女
  e('enemy.gaikotsu', 20, 22, 2), // 骸骨武者
  e('enemy.oni_red', 24, 26, 2), // 赤鬼
  e('enemy.oni_blue', 24, 26, 2), // 青鬼（赤鬼の色違いでよい）
  e('enemy.nurikabe', 24, 24, 2), // 塗り壁
  e('enemy.nue', 28, 20, 2), // 鵺
  e('enemy.gaki', 12, 14, 2), // 餓鬼
  e('enemy.kogumo', 12, 10, 2), // 小蜘蛛（土蜘蛛の手下）

  // ---- 大妖（右向き・足元が原点）
  e('boss.kanabo', 48, 48, 2), // 金棒鬼
  e('boss.tsuchigumo', 64, 44, 2), // 土蜘蛛
  e('boss.gasha', 64, 64, 2), // がしゃどくろ
  e('boss.shuten', 48, 56, 2), // 酒呑童子

  // ---- 敵の弾（中央が原点）
  e('shot.onibi', 6, 6, 2), // 鬼火弾
  e('shot.snow', 8, 8, 1), // 雪玉
  e('shot.web', 10, 10, 1), // 蜘蛛の糸玉
  e('shot.bone', 10, 10, 2), // 骨（回転）

  // ---- アイコン（16×16・中央が原点）
  ...WEAPON_ICON_IDS.map((n) => e(`icon.w.${n}`, 16, 16)),
  ...EVOLVED_ICON_IDS.map((n) => e(`icon.w.${n}`, 16, 16)),
  ...PASSIVE_ICON_IDS.map((n) => e(`icon.p.${n}`, 16, 16)),
  e('icon.x.gold', 16, 16), // 小判袋（選択肢が尽きたとき）
  e('icon.x.heal', 16, 16), // おにぎり（選択肢が尽きたとき）

  // ---- 落とし物（中央が原点）
  e('item.gem0', 8, 8, 2), // 霊玉（小・青）
  e('item.gem1', 8, 8, 2), // 霊玉（中・翠）
  e('item.gem2', 10, 10, 2), // 霊玉（大・金）
  e('item.coin', 8, 8, 2), // 小判
  e('item.bag', 12, 12), // 小判袋
  e('item.onigiri', 12, 12), // おにぎり（回復）
  e('item.bell', 12, 12), // 招霊の鈴（霊玉を全回収）
  e('item.nuke', 10, 14), // 大祓の札（画面一掃）
  e('item.freeze', 10, 14), // 金縛りの札（敵停止）
  e('item.chest', 20, 16, 2), // つづら（閉・開。足元が原点）
  e('prop.lantern', 16, 24, 2), // 石灯籠（灯りのゆらぎ 2 コマ。足元が原点）

  // ---- 弾（中央が原点。向きのあるものは右向き）
  e('proj.ofuda', 10, 6), // 霊符
  e('proj.ofuda_gold', 10, 6), // 神符（覚醒）
  e('proj.arrow', 16, 5), // 破魔矢
  e('proj.arrow_light', 20, 7), // 天羽々矢（覚醒）
  e('proj.bead', 8, 8), // 数珠の珠
  e('proj.bead_gold', 8, 8), // 百八煩悩珠（覚醒）
  e('proj.fire', 10, 10, 2), // 狐火
  e('proj.fire_blue', 10, 10, 2), // 九尾の業火（覚醒）
  e('proj.wind', 16, 16, 2), // 鎌鼬の風刃
  e('proj.wind_big', 24, 24, 2), // 颪（覚醒）
  e('proj.crane', 12, 10, 2), // 折り鶴（羽ばたき）
  e('proj.crane_gold', 12, 10, 2), // 千羽鶴（覚醒）
];
