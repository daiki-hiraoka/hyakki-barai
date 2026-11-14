import type { SpatialGrid } from './math/grid';
import type { Pool } from './math/pool';
import type { Rng } from './math/rng';
import type { SimEvent } from './events';

// ---------------------------------------------------------------------------
// ID
// ---------------------------------------------------------------------------

export const CHARACTER_IDS = ['haruma', 'chihaya', 'goukai', 'kon', 'jubei', 'enku'] as const;
export type CharacterId = (typeof CHARACTER_IDS)[number];

export const BASE_WEAPON_IDS = [
  'reifu', 'hamaya', 'shakujo', 'juzu', 'kitsunebi', 'kekkai',
  'shio', 'kamaitachi', 'taiko', 'orizuru', 'suzu', 'katana',
] as const;
export const EVOLVED_WEAPON_IDS = [
  'yaoyorozu', 'habaya', 'kongo', 'bonno', 'kyubi', 'shijin',
  'misogi', 'oroshi', 'kannari', 'senbazuru', 'iwato', 'oboro',
] as const;
export type BaseWeaponId = (typeof BASE_WEAPON_IDS)[number];
export type EvolvedWeaponId = (typeof EVOLVED_WEAPON_IDS)[number];
export type WeaponId = BaseWeaponId | EvolvedWeaponId;

export const PASSIVE_IDS = [
  'fude', 'kazakiri', 'daruma', 'senko', 'ogi', 'inro',
  'magatama', 'waraji', 'kyokan', 'hotaru', 'domaru', 'maneki',
] as const;
export type PassiveId = (typeof PASSIVE_IDS)[number];

export const ENEMY_IDS = [
  'chochin', 'hitotsume', 'karakasa', 'onibi', 'kappa', 'tanuki', 'nekomata', 'rokuro',
  'ittan', 'dorotabo', 'dorotabo_s', 'tengu', 'wanyudo', 'yukionna', 'gaikotsu',
  'oni_red', 'oni_blue', 'nurikabe', 'nue', 'gaki', 'kogumo',
  'kanabo', 'tsuchigumo', 'gasha', 'shuten',
] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

export const SHOP_IDS = [
  'might', 'hp', 'regen', 'armor', 'moveSpeed', 'cooldown', 'area', 'amount',
  'magnet', 'luck', 'growth', 'greed', 'revives', 'rerolls', 'skips',
] as const;
export type ShopId = (typeof SHOP_IDS)[number];
export type ShopLevels = Partial<Record<ShopId, number>>;

export type PickupKind = 'gem' | 'coin' | 'bag' | 'onigiri' | 'bell' | 'nuke' | 'freeze' | 'chest';

// ---------------------------------------------------------------------------
// 能力値
// ---------------------------------------------------------------------------

/** プレイヤーの能力値。倍率系は 1 が基準 */
export interface Stats {
  /** 最大 HP の倍率 */
  hp: number;
  /** 自然回復（HP/秒） */
  regen: number;
  /** 被ダメージ軽減（1 発ごとに引く値） */
  armor: number;
  moveSpeed: number;
  /** 攻撃力 */
  might: number;
  /** 攻撃範囲 */
  area: number;
  /** 弾速 */
  projSpeed: number;
  /** 効果時間 */
  duration: number;
  /** 追加の弾数（加算） */
  amount: number;
  /** クールダウン倍率（小さいほど速い） */
  cooldown: number;
  luck: number;
  /** 経験値の倍率 */
  growth: number;
  /** 小判の倍率 */
  greed: number;
  /** 取得範囲の倍率 */
  magnet: number;
  revives: number;
  rerolls: number;
  skips: number;
}

/** 能力値への加算。祓い手の固有・社の加護・装身具はすべてこの形で表す */
export type StatMods = Partial<Stats>;

// ---------------------------------------------------------------------------
// 定義データ
// ---------------------------------------------------------------------------

export interface CharacterDef {
  id: CharacterId;
  name: string;
  title: string;
  desc: string;
  baseHp: number;
  weapon: BaseWeaponId;
  mods: StatMods;
}

export type WeaponKind =
  | 'homing' | 'arrow' | 'sweep' | 'orbit' | 'lob' | 'aura'
  | 'zone' | 'boomerang' | 'strike' | 'seeker' | 'ring' | 'slash';

export interface WeaponStats {
  damage: number;
  /** 発動間隔（秒） */
  cooldown: number;
  /** 弾数・個数 */
  amount: number;
  /** 大きさの倍率 */
  area: number;
  /** 弾速の倍率 */
  speed: number;
  /** 効果時間（秒） */
  duration: number;
  /** 貫通数（-1 は無限） */
  pierce: number;
  knockback: number;
  /** 同じ敵に再び当たるまでの間隔（秒） */
  interval: number;
  /** 会心率（0〜1） */
  crit: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  desc: string;
  kind: WeaponKind;
  evolved: boolean;
  maxLevel: number;
  base: WeaponStats;
  /** Lv2 以降の上昇分（長さは maxLevel - 1）。値は加算 */
  levels: Partial<WeaponStats>[];
  /** 覚醒先（基本武器のみ） */
  evolvesTo?: EvolvedWeaponId;
  /** 覚醒に必要な装身具（基本武器のみ） */
  requires?: PassiveId;
  /** player の amount ボーナスを受けるか */
  scalesAmount: boolean;
}

export interface PassiveDef {
  id: PassiveId;
  name: string;
  desc: string;
  maxLevel: number;
  /** 1 レベルあたりの加算 */
  perLevel: StatMods;
}

export type AiKind =
  | 'chase' | 'hop' | 'line' | 'sine' | 'zigzag' | 'charge' | 'ranged' | 'ring'
  | 'boss_kanabo' | 'boss_tsuchigumo' | 'boss_gasha' | 'boss_shuten';

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  /** px/秒 */
  speed: number;
  damage: number;
  radius: number;
  xp: number;
  ai: AiKind;
  /** ノックバックの受けやすさ（1 が標準、0 で無効） */
  kb: number;
  boss?: boolean;
  /** 倒されたときに分裂して出す敵と数 */
  split?: { into: EnemyId; count: number };
  /** 図鑑の説明 */
  desc: string;
}

export interface ShopDef {
  id: ShopId;
  name: string;
  desc: string;
  maxRank: number;
  baseCost: number;
  /** 1 ランクあたりの加算 */
  perRank: StatMods;
}

// ---------------------------------------------------------------------------
// 実行時の状態
// ---------------------------------------------------------------------------

export interface WeaponState {
  def: WeaponDef;
  level: number;
  /** 能力値を反映した最終値（装備が変わるたびに再計算） */
  stats: WeaponStats;
  /** 次の発動までの tick */
  timer: number;
  /** 連射の残り発数と、次の 1 発までの tick・通し番号 */
  burst: number;
  burstTimer: number;
  burstIndex: number;
  /** 連射の間隔（tick） */
  burstGap: number;
  /** 型ごとの汎用状態（周回の角度、交互の向きなど） */
  phase: number;
}

export interface PassiveState {
  def: PassiveDef;
  level: number;
}

export interface Player {
  char: CharacterDef;
  x: number;
  y: number;
  radius: number;
  /** 最後に動いた向き（単位ベクトル） */
  faceX: number;
  faceY: number;
  /** 左右の向き（1: 右、-1: 左） */
  dir: number;
  moving: boolean;
  hp: number;
  maxHp: number;
  level: number;
  xp: number;
  xpNext: number;
  /** 無敵の残り tick */
  iframes: number;
  /** 鈍足の残り tick */
  slow: number;
  regenAcc: number;
  weapons: WeaponState[];
  passives: PassiveState[];
  stats: Stats;
  shop: ShopLevels;
  revivesLeft: number;
  rerollsLeft: number;
  skipsLeft: number;
}

export interface Enemy {
  id: number;
  alive: boolean;
  def: EnemyDef;
  x: number;
  y: number;
  radius: number;
  hp: number;
  maxHp: number;
  /** px/tick */
  speed: number;
  damage: number;
  /** ノックバックの速度（px/tick） */
  kx: number;
  ky: number;
  /** 左右の向き */
  facing: number;
  /** 被弾フラッシュの残り tick */
  flash: number;
  frozen: number;
  slow: number;
  ai: AiKind;
  aiState: number;
  aiTimer: number;
  dirX: number;
  dirY: number;
  /** 包囲の中心など、型ごとの基準点 */
  cx: number;
  cy: number;
  /** 大妖の技ごとの予備タイマー */
  t2: number;
  t3: number;
  elite: boolean;
  boss: boolean;
  /** 残り寿命（tick）。-1 は無期限 */
  life: number;
  xp: number;
  /** 個体差（動きの位相など） */
  seed: number;
  /** 生まれてからの tick（アニメーション用） */
  age: number;
}

export type ProjKind =
  | 'bullet' | 'orbit' | 'lob' | 'zone' | 'sweep' | 'ring' | 'seeker' | 'boomerang';

/** 弾の追加効果（ビットフラグ） */
export const PF = {
  FREEZE: 1, // 当たった敵を凍らせる
  PULL: 2, // 中心へ引き寄せる
  COLLECT: 4, // 触れた霊玉を回収する
  BURN: 8, // 着弾点に炎の陣を残す
  SLOW: 16, // 中の敵を鈍足にする
  LEECH: 32, // 倒すと回復する
  FULL: 64, // sweep が全周に当たる
} as const;

export interface Projectile {
  id: number;
  alive: boolean;
  kind: ProjKind;
  /** ダメージの集計先 */
  weapon: WeaponId;
  /** 描画側が見た目を選ぶためのキー */
  visual: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  knockback: number;
  crit: number;
  /** 残り貫通数（-1 は無限） */
  pierce: number;
  /** 同じ敵への再ヒット間隔（tick）。0 は 1 回きり */
  hitInterval: number;
  /** 敵 ID → 最後に当てた tick */
  hits: Map<number, number>;
  /** 残り tick */
  life: number;
  age: number;
  angle: number;
  /** 角速度（rad/tick） */
  spin: number;
  /** 周回半径・輪の現在半径など */
  dist: number;
  /** px/tick */
  speed: number;
  /** 追尾の旋回量（rad/tick） */
  turn: number;
  /** 追尾対象。プールで使い回されるので、targetId と照合してから使う */
  target: Enemy | null;
  targetId: number;
  tx: number;
  ty: number;
  phase: number;
  /** 汎用タイマー（陣の次回判定までなど） */
  timer: number;
  flags: number;
  /** 描画倍率 */
  scale: number;
}

export interface Pickup {
  id: number;
  alive: boolean;
  kind: PickupKind;
  x: number;
  y: number;
  value: number;
  /** 霊玉の大きさ（0〜2） */
  tier: number;
  /** プレイヤーへ引き寄せ中か */
  pulled: boolean;
  vx: number;
  vy: number;
  age: number;
}

export interface EnemyShot {
  id: number;
  alive: boolean;
  visual: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  /** 当たると鈍足にする tick 数 */
  slow: number;
  age: number;
}

export type HazardKind = 'slam' | 'web' | 'bone' | 'line' | 'fire';

/** 予告つきの危険地帯（大妖の攻撃など）。delay の間は予告、その後 life の間だけ有効 */
export interface Hazard {
  id: number;
  alive: boolean;
  kind: HazardKind;
  x: number;
  y: number;
  radius: number;
  delay: number;
  delayMax: number;
  life: number;
  damage: number;
  slow: number;
  /** 線状の予告（突進）の向きと長さ */
  angle: number;
  length: number;
}

export interface Prop {
  id: number;
  alive: boolean;
  x: number;
  y: number;
  radius: number;
  hp: number;
  flash: number;
}

export type Upgrade =
  | { kind: 'weapon'; id: WeaponId; level: number; isNew: boolean }
  | { kind: 'passive'; id: PassiveId; level: number; isNew: boolean }
  | { kind: 'evolve'; from: BaseWeaponId; id: EvolvedWeaponId }
  | { kind: 'gold'; amount: number }
  | { kind: 'heal'; amount: number };

export interface ChestResult {
  items: Upgrade[];
  gold: number;
}

export interface RunStats {
  kills: number;
  gold: number;
  damage: Partial<Record<WeaponId, number>>;
  /** 武器を手に入れた時刻（秒）。DPS の計算用 */
  acquiredAt: Partial<Record<WeaponId, number>>;
  bossKills: EnemyId[];
  chests: number;
  damageTaken: number;
  /** 同時にいた敵の最大数 */
  peakEnemies: number;
}

export interface DirectorState {
  spawnTimer: number;
  nextEvent: number;
  propTimer: number;
  /** 丑三つ時の残り tick */
  darkTicks: number;
}

export type Phase = 'playing' | 'levelup' | 'chest' | 'dead' | 'dawn' | 'victory';

export interface RunConfig {
  seed: number;
  character: CharacterId;
  shop: ShopLevels;
  /** 一夜の長さ（秒） */
  duration: number;
  /** 妖怪や灯籠を自動で湧かせるか（テストやデバッグでは止められる） */
  spawns: boolean;
}

export interface World {
  config: RunConfig;
  rng: Rng;
  tick: number;
  /** 経過秒 */
  time: number;
  phase: Phase;
  player: Player;
  enemies: Pool<Enemy>;
  projectiles: Pool<Projectile>;
  pickups: Pool<Pickup>;
  shots: Pool<EnemyShot>;
  hazards: Pool<Hazard>;
  props: Pool<Prop>;
  grid: SpatialGrid<Enemy>;
  /** この tick に起きた出来事。音と演出は外側がこれを読む */
  events: SimEvent[];
  nextId: number;
  /** レベルアップ待ちの回数と、提示中の選択肢 */
  pendingLevels: number;
  offer: Upgrade[] | null;
  chest: ChestResult | null;
  director: DirectorState;
  run: RunStats;
  /** カメラに映る範囲の半分（出現位置と再配置の基準） */
  view: { hw: number; hh: number };
  /** 金縛りの残り tick */
  freezeTicks: number;
  /** 夜明け演出の残り tick */
  dawnTicks: number;
  /** 近傍検索の使い回し用バッファ */
  scratch: Enemy[];
  /** 場にある霊玉の数と、上限を超えた分をためる玉 */
  gemCount: number;
  gemBank: Pickup | null;
  gemBankId: number;
}

/** 1 tick 分の入力。移動ベクトルの長さは 1 以下 */
export interface SimInput {
  mx: number;
  my: number;
}
