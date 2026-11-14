import {
  PLAYER_RADIUS,
  RUN_DURATION,
  SPAWN_MARGIN,
  TICK_RATE,
  VIEW_HH,
  VIEW_HW,
} from '../constants';
import { CHARACTERS } from '../data/characters';
import { ENEMIES } from '../data/enemies';
import { PASSIVES } from '../data/passives';
import { WEAPONS } from '../data/weapons';
import type { SimEvent } from '../events';
import { SpatialGrid } from '../math/grid';
import { Pool } from '../math/pool';
import { Rng } from '../math/rng';
import type {
  Enemy,
  EnemyId,
  EnemyShot,
  Hazard,
  HazardKind,
  PassiveId,
  PassiveState,
  Pickup,
  PickupKind,
  Player,
  Projectile,
  ProjKind,
  Prop,
  RunConfig,
  WeaponId,
  WeaponState,
  World,
} from '../types';
import { xpToNext } from './leveling';
import { baseStats, refreshPlayer, resolveWeaponStats } from './stats';

// ---------------------------------------------------------------------------
// プール用の生成関数（全フィールドを最初から持たせ、形を揃えておく）
// ---------------------------------------------------------------------------

function makeEnemy(): Enemy {
  return {
    id: 0, alive: false, def: ENEMIES.chochin,
    x: 0, y: 0, radius: 0, hp: 0, maxHp: 0, speed: 0, damage: 0,
    kx: 0, ky: 0, facing: 1, flash: 0, frozen: 0, slow: 0,
    ai: 'chase', aiState: 0, aiTimer: 0, dirX: 0, dirY: 0, cx: 0, cy: 0, t2: 0, t3: 0,
    elite: false, boss: false, life: -1, xp: 0, seed: 0, age: 0,
  };
}

function makeProjectile(): Projectile {
  return {
    id: 0, alive: false, kind: 'bullet', weapon: 'reifu', visual: '',
    x: 0, y: 0, vx: 0, vy: 0, radius: 0, damage: 0, knockback: 0, crit: 0,
    pierce: 1, hitInterval: 0, hits: new Map(), life: 0, age: 0,
    angle: 0, spin: 0, dist: 0, speed: 0, turn: 0, target: null, targetId: -1,
    tx: 0, ty: 0, phase: 0, timer: 0, flags: 0, scale: 1,
  };
}

function makePickup(): Pickup {
  return { id: 0, alive: false, kind: 'gem', x: 0, y: 0, value: 0, tier: 0, pulled: false, vx: 0, vy: 0, age: 0 };
}

function makeShot(): EnemyShot {
  return { id: 0, alive: false, visual: '', x: 0, y: 0, vx: 0, vy: 0, radius: 0, damage: 0, life: 0, slow: 0, age: 0 };
}

function makeHazard(): Hazard {
  return {
    id: 0, alive: false, kind: 'slam', x: 0, y: 0, radius: 0,
    delay: 0, delayMax: 0, life: 0, damage: 0, slow: 0, angle: 0, length: 0,
  };
}

function makeProp(): Prop {
  return { id: 0, alive: false, x: 0, y: 0, radius: 0, hp: 0, flash: 0 };
}

// ---------------------------------------------------------------------------
// 世界の生成
// ---------------------------------------------------------------------------

export function createWorld(partial: Partial<RunConfig> = {}): World {
  const config: RunConfig = {
    seed: 1,
    character: 'haruma',
    shop: {},
    duration: RUN_DURATION,
    spawns: true,
    ...partial,
  };
  const char = CHARACTERS[config.character];
  const player: Player = {
    char,
    x: 0, y: 0, radius: PLAYER_RADIUS,
    faceX: 1, faceY: 0, dir: 1, moving: false,
    hp: 0, maxHp: 0,
    level: 1, xp: 0, xpNext: xpToNext(1),
    iframes: 0, slow: 0, regenAcc: 0,
    weapons: [], passives: [],
    stats: baseStats(),
    shop: { ...config.shop },
    revivesLeft: 0, rerollsLeft: 0, skipsLeft: 0,
  };
  const world: World = {
    config,
    rng: new Rng(config.seed),
    tick: 0,
    time: 0,
    phase: 'playing',
    player,
    enemies: new Pool(makeEnemy),
    projectiles: new Pool(makeProjectile),
    pickups: new Pool(makePickup),
    shots: new Pool(makeShot),
    hazards: new Pool(makeHazard),
    props: new Pool(makeProp),
    grid: new SpatialGrid<Enemy>(),
    events: [],
    nextId: 1,
    pendingLevels: 0,
    offer: null,
    chest: null,
    director: { spawnTimer: 30, nextEvent: 0, propTimer: 120, darkTicks: 0 },
    run: { kills: 0, gold: 0, damage: {}, acquiredAt: {}, bossKills: [], chests: 0, damageTaken: 0, peakEnemies: 0 },
    view: { hw: VIEW_HW, hh: VIEW_HH },
    freezeTicks: 0,
    dawnTicks: 0,
    scratch: [],
    gemCount: 0,
    gemBank: null,
    gemBankId: -1,
  };
  grantWeapon(world, char.weapon);
  player.hp = player.maxHp;
  player.revivesLeft = player.stats.revives;
  player.rerollsLeft = player.stats.rerolls;
  player.skipsLeft = player.stats.skips;
  return world;
}

/** 出来事を記録する。1 tick に大量の命中が起きても上限で打ち切る（演出用なので欠けても支障はない） */
const MAX_EVENTS = 512;

export function emit(world: World, event: SimEvent): void {
  if (world.events.length < MAX_EVENTS || event.t !== 'hit') world.events.push(event);
}

// ---------------------------------------------------------------------------
// 装備
// ---------------------------------------------------------------------------

export function findWeapon(player: Player, id: WeaponId): WeaponState | undefined {
  return player.weapons.find((w) => w.def.id === id);
}

export function findPassive(player: Player, id: PassiveId): PassiveState | undefined {
  return player.passives.find((p) => p.def.id === id);
}

export function makeWeaponState(world: World, id: WeaponId): WeaponState {
  const def = WEAPONS[id];
  world.run.acquiredAt[id] = world.time;
  return {
    def,
    level: 1,
    stats: resolveWeaponStats(def, 1, world.player.stats),
    // 手に入れてすぐ（0.3 秒後）に最初の一撃が出るようにする
    timer: 18,
    burst: 0,
    burstTimer: 0,
    burstIndex: 0,
    burstGap: 1,
    phase: 0,
  };
}

export function grantWeapon(world: World, id: WeaponId): WeaponState {
  const state = makeWeaponState(world, id);
  world.player.weapons.push(state);
  refreshPlayer(world.player);
  return state;
}

export function grantPassive(world: World, id: PassiveId): PassiveState {
  const state: PassiveState = { def: PASSIVES[id], level: 1 };
  world.player.passives.push(state);
  refreshPlayer(world.player);
  return state;
}

// ---------------------------------------------------------------------------
// 生成
// ---------------------------------------------------------------------------

export interface SpawnOptions {
  /** 体力の倍率 */
  hp?: number;
  elite?: boolean;
}

export function spawnEnemy(
  world: World,
  type: EnemyId,
  x: number,
  y: number,
  opts: SpawnOptions = {},
): Enemy {
  const def = ENEMIES[type];
  const elite = opts.elite ?? false;
  const e = world.enemies.alloc();
  e.id = world.nextId++;
  e.def = def;
  e.x = x;
  e.y = y;
  e.radius = def.radius * (elite ? 1.5 : 1);
  e.maxHp = Math.max(1, Math.round(def.hp * (opts.hp ?? 1) * (elite ? 10 : 1)));
  e.hp = e.maxHp;
  e.speed = def.speed / TICK_RATE;
  e.damage = def.damage * (elite ? 1.5 : 1);
  e.kx = 0;
  e.ky = 0;
  e.facing = x > world.player.x ? -1 : 1;
  e.flash = 0;
  e.frozen = 0;
  e.slow = 0;
  e.ai = def.ai;
  e.aiState = 0;
  e.aiTimer = 0;
  e.dirX = 0;
  e.dirY = 0;
  e.cx = 0;
  e.cy = 0;
  e.t2 = 0;
  e.t3 = 0;
  e.elite = elite;
  e.boss = def.boss ?? false;
  e.life = -1;
  e.xp = def.xp * (elite ? 12 : 1);
  e.seed = world.rng.next();
  e.age = 0;
  if (def.ai === 'line') {
    // 向きを指定されずに湧いた直進型は、湧いた時点のプレイヤーへ向かわせる
    const dx = world.player.x - x;
    const dy = world.player.y - y;
    const d = Math.hypot(dx, dy) || 1;
    e.dirX = dx / d;
    e.dirY = dy / d;
    e.life = 12 * TICK_RATE;
  }
  return e;
}

/** 霊玉の大きさ（見た目の段階） */
export function gemTier(value: number): number {
  return value >= 25 ? 2 : value >= 5 ? 1 : 0;
}

export function spawnPickup(
  world: World,
  kind: PickupKind,
  x: number,
  y: number,
  value = 1,
): Pickup {
  const k = world.pickups.alloc();
  k.id = world.nextId++;
  k.kind = kind;
  k.x = x;
  k.y = y;
  k.value = value;
  k.tier = kind === 'gem' ? gemTier(value) : 0;
  k.pulled = false;
  k.vx = 0;
  k.vy = 0;
  k.age = 0;
  if (kind === 'gem') world.gemCount++;
  return k;
}

export function spawnProjectile(
  world: World,
  kind: ProjKind,
  weapon: WeaponId,
  visual: string,
): Projectile {
  const p = world.projectiles.alloc();
  p.id = world.nextId++;
  p.kind = kind;
  p.weapon = weapon;
  p.visual = visual;
  p.x = world.player.x;
  p.y = world.player.y;
  p.vx = 0;
  p.vy = 0;
  p.radius = 4;
  p.damage = 0;
  p.knockback = 0;
  p.crit = 0;
  p.pierce = 1;
  p.hitInterval = 0;
  p.hits.clear();
  p.life = 60;
  p.age = 0;
  p.angle = 0;
  p.spin = 0;
  p.dist = 0;
  p.speed = 0;
  p.turn = 0;
  p.target = null;
  p.targetId = -1;
  p.tx = 0;
  p.ty = 0;
  p.phase = 0;
  p.timer = 0;
  p.flags = 0;
  p.scale = 1;
  return p;
}

export function spawnShot(
  world: World,
  visual: string,
  x: number,
  y: number,
  vx: number,
  vy: number,
  damage: number,
  radius = 3,
  life = 300,
): EnemyShot {
  const s = world.shots.alloc();
  s.id = world.nextId++;
  s.visual = visual;
  s.x = x;
  s.y = y;
  s.vx = vx;
  s.vy = vy;
  s.radius = radius;
  s.damage = damage;
  s.life = life;
  s.slow = 0;
  s.age = 0;
  return s;
}

export function spawnHazard(
  world: World,
  kind: HazardKind,
  x: number,
  y: number,
  radius: number,
  delay: number,
  life: number,
  damage: number,
): Hazard {
  const h = world.hazards.alloc();
  h.id = world.nextId++;
  h.kind = kind;
  h.x = x;
  h.y = y;
  h.radius = radius;
  h.delay = delay;
  h.delayMax = delay;
  h.life = life;
  h.damage = damage;
  h.slow = 0;
  h.angle = 0;
  h.length = 0;
  return h;
}

export function spawnProp(world: World, x: number, y: number): Prop {
  const p = world.props.alloc();
  p.id = world.nextId++;
  p.x = x;
  p.y = y;
  p.radius = 7;
  p.hp = 1;
  p.flash = 0;
  return p;
}

// ---------------------------------------------------------------------------
// 位置の補助
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

const edge: Point = { x: 0, y: 0 };

/**
 * 画面のすぐ外側のランダムな点（妖怪の湧き位置）。
 * 戻り値のオブジェクトは使い回すので、呼び出し側で保持しないこと。
 */
export function edgePoint(world: World, extra = 0): Point {
  const hw = world.view.hw + SPAWN_MARGIN + extra;
  const hh = world.view.hh + SPAWN_MARGIN + extra;
  const rng = world.rng;
  const p = world.player;
  // 辺の長さに比例して上下・左右を選ぶ（偏りなく取り囲むように）
  if (rng.next() < hw / (hw + hh)) {
    edge.x = p.x + rng.range(-hw, hw);
    edge.y = p.y + (rng.chance(0.5) ? -hh : hh);
  } else {
    edge.x = p.x + (rng.chance(0.5) ? -hw : hw);
    edge.y = p.y + rng.range(-hh, hh);
  }
  return edge;
}

/** カメラに映っているか（margin で外側に広げられる） */
export function inView(world: World, x: number, y: number, margin = 0): boolean {
  const p = world.player;
  return (
    Math.abs(x - p.x) <= world.view.hw + margin && Math.abs(y - p.y) <= world.view.hh + margin
  );
}

/** 画面内の敵からランダムに 1 体（いなければ null）。全件を 1 回なめる抽選 */
export function randomEnemyInView(world: World, margin = -12): Enemy | null {
  let chosen: Enemy | null = null;
  let seen = 0;
  for (const e of world.enemies.items) {
    if (!e.alive || !inView(world, e.x, e.y, margin)) continue;
    seen++;
    if (world.rng.next() * seen < 1) chosen = e;
  }
  return chosen;
}
