import type { AiKind, EnemyDef, EnemyId } from '../types';

function e(
  id: EnemyId,
  name: string,
  hp: number,
  speed: number,
  damage: number,
  radius: number,
  xp: number,
  ai: AiKind,
  desc: string,
  extra: Partial<EnemyDef> = {},
): EnemyDef {
  return { id, name, hp, speed, damage, radius, xp, ai, kb: 1, desc, ...extra };
}

/** 妖怪の定義。速度は px/秒。行動は ai ごとに sim/enemies.ts が実装する */
export const ENEMIES: Record<EnemyId, EnemyDef> = {
  chochin: e('chochin', '提灯お化け', 6, 34, 4, 6, 1, 'chase', '古い提灯が化けたもの。ふわふわと漂ってくる。'),
  hitotsume: e('hitotsume', '一つ目小僧', 10, 42, 5, 6, 1, 'chase', '人を驚かすのが好きな小坊主の妖怪。'),
  karakasa: e('karakasa', '唐傘お化け', 14, 62, 6, 6, 1, 'hop', '一本足で跳ね回る古傘。'),
  onibi: e('onibi', '鬼火', 5, 118, 5, 4, 1, 'line', '群れをなして夜道を横切る青い火。', { kb: 0.4 }),
  kappa: e('kappa', '河童', 30, 52, 8, 6, 2, 'chase', '川に棲む妖怪。相撲と胡瓜を好む。'),
  tanuki: e('tanuki', '化け狸', 55, 40, 9, 7, 3, 'chase', '腹鼓を打つ古狸。打たれ強い。', { kb: 0.7 }),
  nekomata: e('nekomata', '猫又', 22, 86, 8, 6, 2, 'zigzag', '尾が二股に分かれた化け猫。素早く気まぐれに動く。'),
  rokuro: e('rokuro', 'ろくろ首', 45, 38, 8, 6, 3, 'ranged', '首を伸ばして鬼火を吐く。離れていても油断できない。'),
  ittan: e('ittan', '一反木綿', 28, 96, 9, 6, 2, 'sine', '夜空を舞う白布。うねりながら巻きついてくる。'),
  dorotabo: e('dorotabo', '泥田坊', 160, 30, 12, 10, 6, 'chase', '荒れた田から現れる泥の怪。倒すと分かれる。', {
    kb: 0.4,
    split: { into: 'dorotabo_s', count: 3 },
  }),
  dorotabo_s: e('dorotabo_s', '泥の子', 30, 56, 8, 5, 1, 'chase', '泥田坊から分かれた小さな泥の塊。'),
  tengu: e('tengu', '烏天狗', 70, 60, 12, 7, 4, 'charge', '山の修験者の成れの果て。狙いを定めて突っ込んでくる。'),
  wanyudo: e('wanyudo', '輪入道', 120, 220, 15, 10, 5, 'line', '炎をまとった車輪の妖怪。一直線に駆け抜ける。', { kb: 0 }),
  yukionna: e('yukionna', '雪女', 90, 36, 10, 6, 5, 'ranged', '吹雪の夜に現れる。雪玉に当たると足が鈍る。'),
  gaikotsu: e('gaikotsu', '骸骨武者', 200, 46, 14, 7, 6, 'chase', '戦場に散った武者の骨。硬く、しぶとい。', { kb: 0.6 }),
  oni_red: e('oni_red', '赤鬼', 420, 50, 18, 10, 12, 'chase', '金棒を振るう力自慢の鬼。', { kb: 0.3 }),
  oni_blue: e('oni_blue', '青鬼', 520, 46, 20, 10, 14, 'chase', '赤鬼よりも冷酷で打たれ強い鬼。', { kb: 0.3 }),
  nurikabe: e('nurikabe', '塗り壁', 300, 14, 12, 10, 5, 'ring', '行く手を阻む壁の妖怪。輪になって迫ってくる。', { kb: 0 }),
  nue: e('nue', '鵺', 300, 78, 16, 9, 10, 'charge', '猿の顔、虎の胴、蛇の尾。不気味な声で鳴き、飛びかかる。', { kb: 0.4 }),
  gaki: e('gaki', '餓鬼', 40, 92, 9, 4, 2, 'chase', '飢えに苦しむ亡者。大群で押し寄せる。'),
  kogumo: e('kogumo', '小蜘蛛', 35, 80, 8, 4, 1, 'chase', '土蜘蛛が産み落とした子蜘蛛。'),

  // ---- 大妖 ---------------------------------------------------------------
  kanabo: e('kanabo', '金棒鬼', 2600, 44, 22, 18, 150, 'boss_kanabo', '巨大な金棒で地を叩き割る鬼。', {
    kb: 0.03,
    boss: true,
  }),
  tsuchigumo: e('tsuchigumo', '土蜘蛛', 7000, 40, 24, 22, 300, 'boss_tsuchigumo', '糸を吐き、子蜘蛛を従える大蜘蛛。', {
    kb: 0.03,
    boss: true,
  }),
  gasha: e('gasha', 'がしゃどくろ', 16000, 26, 30, 28, 500, 'boss_gasha', '野ざらしの骨が集まった巨大な骸骨。', {
    kb: 0,
    boss: true,
  }),
  shuten: e('shuten', '酒呑童子', 30000, 68, 34, 18, 1000, 'boss_shuten', '大江山に棲む鬼の頭領。百鬼夜行を率いる。', {
    kb: 0.02,
    boss: true,
  }),
};
