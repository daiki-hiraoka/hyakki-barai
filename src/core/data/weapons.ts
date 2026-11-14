import type {
  BaseWeaponId,
  EvolvedWeaponId,
  PassiveId,
  WeaponDef,
  WeaponId,
  WeaponKind,
  WeaponStats,
} from '../types';

const DEFAULTS: WeaponStats = {
  damage: 10,
  cooldown: 1,
  amount: 1,
  area: 1,
  speed: 1,
  duration: 1,
  pierce: 1,
  knockback: 1,
  interval: 0.5,
  crit: 0,
};

function base(
  id: BaseWeaponId,
  name: string,
  desc: string,
  kind: WeaponKind,
  stats: Partial<WeaponStats>,
  levels: Partial<WeaponStats>[],
  evolvesTo: EvolvedWeaponId,
  requires: PassiveId,
  scalesAmount = true,
): WeaponDef {
  return {
    id,
    name,
    desc,
    kind,
    evolved: false,
    maxLevel: 8,
    base: { ...DEFAULTS, ...stats },
    levels,
    evolvesTo,
    requires,
    scalesAmount,
  };
}

function evolved(
  id: EvolvedWeaponId,
  name: string,
  desc: string,
  kind: WeaponKind,
  stats: Partial<WeaponStats>,
  scalesAmount = false,
): WeaponDef {
  return {
    id,
    name,
    desc,
    kind,
    evolved: true,
    maxLevel: 1,
    base: { ...DEFAULTS, ...stats },
    levels: [],
    scalesAmount,
  };
}

/**
 * 武器の定義。挙動は kind ごとに sim/weapons.ts が実装し、ここは数値だけを持つ。
 * 数値を 1 か所に集めておくと、バランス調整がコードの挙動と独立して行える。
 */
export const WEAPONS: Record<WeaponId, WeaponDef> = {
  // ---- 基本武器 -----------------------------------------------------------
  reifu: base(
    'reifu', '霊符', '最も近い妖怪へ飛ぶ追尾の札。', 'homing',
    { damage: 10, cooldown: 1.2, amount: 1, pierce: 1, knockback: 1.2 },
    [{ amount: 1 }, { damage: 5 }, { cooldown: -0.15 }, { amount: 1 }, { damage: 5, pierce: 1 }, { amount: 1 }, { damage: 8 }],
    'yaoyorozu', 'fude',
  ),
  hamaya: base(
    'hamaya', '破魔矢', '最も近い妖怪へ、群れを一列に射抜く矢を放つ。', 'arrow',
    { damage: 12, cooldown: 1.3, amount: 1, pierce: 3, knockback: 1.5 },
    [{ amount: 1 }, { damage: 6 }, { pierce: 2 }, { amount: 1 }, { damage: 6 }, { amount: 1 }, { damage: 8, pierce: 2 }],
    'habaya', 'kazakiri',
  ),
  shakujo: base(
    'shakujo', '錫杖', '妖怪のいる側を大きくなぎ払い、弾き飛ばす。', 'sweep',
    { damage: 14, cooldown: 1.35, amount: 1, pierce: -1, knockback: 6 },
    [{ amount: 1 }, { damage: 6 }, { area: 0.15 }, { damage: 6 }, { area: 0.15 }, { damage: 8 }, { amount: 1, damage: 6 }],
    'kongo', 'daruma',
  ),
  juzu: base(
    'juzu', '数珠', '身の回りを巡る珠が、触れた妖怪を打つ。', 'orbit',
    { damage: 8, cooldown: 4, amount: 2, duration: 3, interval: 0.5, pierce: -1, knockback: 2 },
    [{ amount: 1 }, { area: 0.2, speed: 0.2 }, { duration: 0.6, damage: 3 }, { amount: 1 }, { area: 0.2, speed: 0.2 }, { duration: 0.6, damage: 3 }, { amount: 1 }],
    'bonno', 'senko',
  ),
  kitsunebi: base(
    'kitsunebi', '狐火', '妖怪めがけて飛び、着弾すると爆ぜる火の玉。', 'lob',
    { damage: 16, cooldown: 2.2, amount: 1, pierce: -1, knockback: 2 },
    [{ damage: 6 }, { amount: 1 }, { area: 0.2 }, { damage: 8 }, { amount: 1 }, { area: 0.2, cooldown: -0.3 }, { damage: 10, amount: 1 }],
    'kyubi', 'ogi',
  ),
  kekkai: base(
    'kekkai', '結界', '身の回りに張った結界が、中の妖怪を祓い続ける。', 'aura',
    { damage: 5, cooldown: 1, amount: 1, interval: 0.5, pierce: -1, knockback: 0.6 },
    [{ area: 0.15, damage: 1 }, { damage: 2 }, { area: 0.15 }, { damage: 2, interval: -0.1 }, { area: 0.15 }, { damage: 3 }, { area: 0.2, damage: 3 }],
    'shijin', 'inro', false,
  ),
  shio: base(
    'shio', '清め塩', '塩を撒いて浄めの陣を敷く。陣の中の妖怪は祓われ続ける。', 'zone',
    { damage: 7, cooldown: 3.5, amount: 1, duration: 3, interval: 0.5, pierce: -1, knockback: 0 },
    [{ amount: 1 }, { damage: 3, duration: 0.5 }, { area: 0.2 }, { amount: 1 }, { damage: 4, duration: 0.5 }, { area: 0.2 }, { amount: 1, damage: 4 }],
    'misogi', 'magatama',
  ),
  kamaitachi: base(
    'kamaitachi', '鎌鼬', '飛んで戻る風の刃。行きも帰りも妖怪を斬り裂く。', 'boomerang',
    { damage: 11, cooldown: 2.0, amount: 1, interval: 0.4, pierce: -1, knockback: 1.5 },
    [{ damage: 5 }, { area: 0.15, speed: 0.15 }, { amount: 1 }, { damage: 6 }, { area: 0.15, speed: 0.15 }, { amount: 1 }, { damage: 8 }],
    'oroshi', 'waraji',
  ),
  taiko: base(
    'taiko', '雷太鼓', '太鼓を打ち鳴らし、妖怪の頭上に雷を落とす。', 'strike',
    { damage: 22, cooldown: 2.6, amount: 1, pierce: -1, knockback: 2 },
    [{ amount: 1 }, { damage: 8 }, { area: 0.25 }, { amount: 1 }, { damage: 10 }, { cooldown: -0.4 }, { amount: 2 }],
    'kannari', 'kyokan',
  ),
  orizuru: base(
    'orizuru', '折り鶴', '式神の折り鶴が、近くの妖怪を追って体当たりする。', 'seeker',
    { damage: 9, cooldown: 6, amount: 1, duration: 5, interval: 0.6, pierce: -1, knockback: 1 },
    [{ amount: 1 }, { damage: 4, speed: 0.15 }, { duration: 1 }, { amount: 1 }, { damage: 5, speed: 0.15 }, { duration: 1 }, { amount: 1, damage: 5 }],
    'senbazuru', 'hotaru',
  ),
  suzu: base(
    'suzu', '神楽鈴', '鈴の音が輪となって広がり、妖怪を押し返す。', 'ring',
    { damage: 9, cooldown: 3.0, amount: 1, pierce: -1, knockback: 7 },
    [{ damage: 4 }, { area: 0.15 }, { amount: 1 }, { damage: 5, cooldown: -0.3 }, { area: 0.15 }, { damage: 6 }, { amount: 1, area: 0.15 }],
    'iwato', 'domaru',
  ),
  katana: base(
    'katana', '退魔刀', '間合いに入った妖怪を素早く斬る。会心の一撃が出やすい。', 'slash',
    { damage: 18, cooldown: 0.8, amount: 1, crit: 0.2, pierce: -1, knockback: 2.5 },
    [{ damage: 5 }, { cooldown: -0.08 }, { amount: 1 }, { damage: 6, crit: 0.1 }, { area: 0.15 }, { damage: 7 }, { amount: 1, crit: 0.1 }],
    'oboro', 'maneki',
  ),

  // ---- 覚醒武器 -----------------------------------------------------------
  yaoyorozu: evolved(
    'yaoyorozu', '神符・八百万', '神々の符を、息つく間もなく放ち続ける。', 'homing',
    { damage: 18, cooldown: 0.14, amount: 1, pierce: 2, speed: 1.3, area: 1.2, knockback: 1.2 },
  ),
  habaya: evolved(
    'habaya', '天羽々矢', '神代の大矢。あらゆる妖怪を貫いて飛ぶ。', 'arrow',
    { damage: 45, cooldown: 1.0, amount: 3, pierce: -1, speed: 1.3, area: 1.6, knockback: 3 },
    true,
  ),
  kongo: evolved(
    'kongo', '金剛杖', '全周をなぎ払い、祓った妖怪の気で傷を癒やす。', 'sweep',
    { damage: 44, cooldown: 1.1, amount: 1, area: 1.5, pierce: -1, knockback: 8 },
  ),
  bonno: evolved(
    'bonno', '百八煩悩珠', '二重の珠の輪が、途切れることなく巡り続ける。', 'orbit',
    { damage: 18, cooldown: 4, amount: 6, area: 1.5, speed: 1.4, duration: 4, interval: 0.4, pierce: -1, knockback: 2 },
    true,
  ),
  kyubi: evolved(
    'kyubi', '九尾の業火', '九つの蒼い炎が降りそそぎ、地を焼き続ける。', 'lob',
    { damage: 34, cooldown: 2.4, amount: 9, area: 1.4, duration: 2, interval: 0.5, pierce: -1, knockback: 2 },
  ),
  shijin: evolved(
    'shijin', '四神結界', '四神の守る大結界。中の妖怪は足が鈍る。', 'aura',
    { damage: 15, cooldown: 1, amount: 1, area: 2.0, interval: 0.35, pierce: -1, knockback: 0.6 },
  ),
  misogi: evolved(
    'misogi', '禊の大陣', '渦巻く浄めの大陣が、妖怪を中心へ引きずり込む。', 'zone',
    { damage: 20, cooldown: 3.2, amount: 3, area: 1.8, duration: 4.5, interval: 0.4, pierce: -1, knockback: 0 },
    true,
  ),
  oroshi: evolved(
    'oroshi', '颪', '山から吹き下ろす暴風。無数の刃が渦を巻く。', 'boomerang',
    { damage: 30, cooldown: 1.6, amount: 6, area: 1.6, speed: 1.2, interval: 0.35, pierce: -1, knockback: 2 },
    true,
  ),
  kannari: evolved(
    'kannari', '神鳴り', '神の怒りの雷。妖怪から妖怪へと連なって走る。', 'strike',
    { damage: 48, cooldown: 1.8, amount: 4, area: 1.4, pierce: -1, knockback: 2 },
    true,
  ),
  senbazuru: evolved(
    'senbazuru', '千羽鶴', '金色の鶴の群れが舞い続け、霊玉も拾い集める。', 'seeker',
    { damage: 20, cooldown: 6, amount: 10, speed: 1.5, duration: 6, interval: 0.5, pierce: -1, knockback: 1 },
    true,
  ),
  iwato: evolved(
    'iwato', '岩戸神楽', '神を呼ぶ舞の音。輪に触れた妖怪は凍りつく。', 'ring',
    { damage: 26, cooldown: 2.8, amount: 3, area: 1.7, duration: 1.2, pierce: -1, knockback: 7 },
  ),
  oboro: evolved(
    'oboro', '妖刀・朧', '斬撃が三日月の刃となって飛ぶ。会心が冴えわたる。', 'slash',
    { damage: 40, cooldown: 0.6, amount: 2, area: 1.4, crit: 0.5, pierce: -1, knockback: 3 },
  ),
};

/** レベルごとの武器の基本値（能力値を掛ける前）。Lv2 以降は上昇分を累積する */
export function weaponStatsAt(def: WeaponDef, level: number): WeaponStats {
  const stats: WeaponStats = { ...def.base };
  const upTo = Math.min(level, def.maxLevel) - 1;
  for (let i = 0; i < upTo; i++) {
    const delta = def.levels[i]!;
    for (const key of Object.keys(delta) as (keyof WeaponStats)[]) {
      stats[key] += delta[key]!;
    }
  }
  return stats;
}
