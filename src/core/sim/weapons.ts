import { ticks } from '../constants';
import {
  PF,
  type Enemy,
  type Projectile,
  type ProjKind,
  type WeaponKind,
  type WeaponState,
  type World,
} from '../types';
import { damageArea, hitEnemy } from './combat';
import { emit, randomEnemyInView, spawnProjectile } from './world';

const TWO_PI = Math.PI * 2;

/** 結界の基本半径（描画側も使う） */
export const AURA_RADIUS = 40;

/** fire の結果 */
const RETRY = 0; // 撃てなかった（狙う相手がいない）。少し待って再試行
const FIRED = 1; // 撃った
const SILENT = 2; // 撃ったが、発射音は鳴らさない

interface Behavior {
  /** クールダウンが明けたときに呼ばれる */
  fire(world: World, w: WeaponState): number;
  /** 連射の 1 発ぶん */
  shot?(world: World, w: WeaponState, index: number): void;
  /** 毎 tick 呼ばれる（常時発動する武器用） */
  tick?(world: World, w: WeaponState): void;
}

export function updateWeapons(world: World): void {
  for (const w of world.player.weapons) {
    const b = BEHAVIORS[w.def.kind];
    b.tick?.(world, w);
    if (w.burst > 0 && --w.burstTimer <= 0) {
      b.shot!(world, w, w.burstIndex++);
      w.burst--;
      w.burstTimer = w.burstGap;
    }
    if (--w.timer > 0) continue;
    const result = b.fire(world, w);
    if (result === RETRY) {
      w.timer = 8;
      continue;
    }
    w.timer = ticks(w.stats.cooldown);
    if (result === FIRED) emit(world, { t: 'fire', weapon: w.def.id });
  }
}

/** amount 発を gap tick おきに撃つ連射を始める */
function burst(w: WeaponState, gap: number): number {
  if (w.burst <= 0) {
    w.burstIndex = 0;
    w.burstTimer = 0;
  }
  w.burst += Math.max(1, Math.round(w.stats.amount));
  w.burstGap = gap;
  return FIRED;
}

/** 武器の最終値を写した弾を作る（位置はプレイヤーの位置） */
function make(world: World, kind: ProjKind, w: WeaponState, visual: string): Projectile {
  const s = w.stats;
  const p = spawnProjectile(world, kind, w.def.id, visual);
  p.damage = s.damage;
  p.knockback = s.knockback;
  p.crit = s.crit;
  p.pierce = s.pierce;
  p.scale = s.area;
  return p;
}

function facingAngle(world: World): number {
  return Math.atan2(world.player.faceY, world.player.faceX);
}

function aim(p: Projectile, angle: number, speed: number): void {
  p.angle = angle;
  p.speed = speed;
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
}

// ---------------------------------------------------------------------------
// 霊符：最も近い敵へ飛ぶ追尾の札
// ---------------------------------------------------------------------------

const HOMING_RANGE = 320;

const homing: Behavior = {
  fire(world, w) {
    const pl = world.player;
    if (!world.grid.nearest(pl.x, pl.y, HOMING_RANGE)) return RETRY;
    return burst(w, 5);
  },
  shot(world, w, index) {
    const pl = world.player;
    const t = world.grid.nearest(pl.x, pl.y, HOMING_RANGE);
    let angle = t ? Math.atan2(t.y - pl.y, t.x - pl.x) : facingAngle(world);
    // 連射の 2 発目以降は少し扇状に散らす（追尾するので最終的には当たる）
    angle += (index % 2 === 0 ? -1 : 1) * 0.12 * Math.ceil(index / 2);
    const p = make(world, 'bullet', w, w.def.evolved ? 'ofuda_gold' : 'ofuda');
    aim(p, angle, 4.3 * w.stats.speed);
    p.turn = 0.07;
    p.target = t;
    p.targetId = t ? t.id : -1;
    p.radius = 5 * w.stats.area;
    p.life = 100;
  },
};

// ---------------------------------------------------------------------------
// 破魔矢：最も近い敵へまっすぐ飛び、貫通する矢
// ---------------------------------------------------------------------------

const ARROW_RANGE = 360;

const arrow: Behavior = {
  fire(_world, w) {
    w.phase = Math.max(1, Math.round(w.stats.amount));
    return burst(w, w.def.evolved ? 3 : 5);
  },
  shot(world, w, index) {
    // 逃げながらでも当てられるよう、向きではなく最も近い敵を狙う。
    // 霊符と違って追尾はしないが、貫通するので群れを一列に射抜ける
    const pl = world.player;
    const t = world.grid.nearest(pl.x, pl.y, ARROW_RANGE);
    const base = t ? Math.atan2(t.y - pl.y, t.x - pl.x) : facingAngle(world);
    const p = make(world, 'bullet', w, w.def.evolved ? 'arrow_light' : 'arrow');
    if (w.def.evolved) {
      // 天羽々矢は扇状に広げる
      aim(p, base + (index - (w.phase - 1) / 2) * 0.16, 7 * w.stats.speed);
      p.radius = 5 * w.stats.area;
    } else {
      // 同じ軌道に重ならないよう、進行方向と直角に少しずらす
      aim(p, base, 7 * w.stats.speed);
      const offset = (index % 2 === 0 ? -1 : 1) * 3 * Math.ceil(index / 2);
      p.x += -Math.sin(base) * offset;
      p.y += Math.cos(base) * offset;
      p.radius = 4 * w.stats.area;
    }
    p.life = 70;
  },
};

// ---------------------------------------------------------------------------
// 錫杖：左右のなぎ払い ／ 退魔刀：向いている方向への斬撃
// ---------------------------------------------------------------------------

const sweep: Behavior = {
  fire(_world, w) {
    return burst(w, 9);
  },
  shot(world, w, index) {
    const pl = world.player;
    const evolved = w.def.evolved;
    const p = make(world, 'sweep', w, evolved ? 'spin' : 'staff');
    // 1 振り目は最も近い敵のいる側（いなければ向いている側）、2 振り目はその反対、と交互に払う
    if (index === 0) {
      const t = world.grid.nearest(pl.x, pl.y, 90);
      w.phase = t && Math.abs(t.x - pl.x) > 1 ? Math.sign(t.x - pl.x) : pl.dir;
    }
    const dir = index % 2 === 0 ? w.phase : -w.phase;
    p.angle = dir > 0 ? 0 : Math.PI;
    p.spin = 1.2;
    p.dist = (evolved ? 70 : 64) * w.stats.area;
    p.life = 8;
    p.pierce = -1;
    p.phase = index % 2;
    if (evolved) p.flags = PF.FULL | PF.LEECH;
  },
};

const slash: Behavior = {
  fire(_world, w) {
    return burst(w, 7);
  },
  shot(world, w, index) {
    // 間合いの少し外まで見て、最も近い敵へ向けて斬る（いなければ向いている方向）
    const pl = world.player;
    const t = world.grid.nearest(pl.x, pl.y, 46 * w.stats.area * 1.7);
    const base = t ? Math.atan2(t.y - pl.y, t.x - pl.x) : facingAngle(world);
    const evolved = w.def.evolved;
    const p = make(world, 'sweep', w, evolved ? 'oboro' : 'slash');
    p.angle = base;
    p.spin = 0.85;
    p.dist = 46 * w.stats.area;
    p.life = 6;
    p.pierce = -1;
    // 振り下ろしと振り上げを交互に（見た目用）
    p.phase = index % 2;
    if (evolved) {
      // 妖刀・朧：斬撃が三日月の刃になって飛ぶ
      const wave = make(world, 'bullet', w, 'wave');
      aim(wave, base, 6);
      wave.damage = w.stats.damage * 0.6;
      wave.knockback = 1;
      wave.radius = 12 * w.stats.area;
      wave.pierce = -1;
      wave.life = 34;
    }
  },
};

// ---------------------------------------------------------------------------
// 数珠：周回する珠
// ---------------------------------------------------------------------------

const orbit: Behavior = {
  fire(world, w) {
    const s = w.stats;
    const evolved = w.def.evolved;
    const count = Math.max(1, Math.round(s.amount));
    const period = ticks(s.cooldown);
    // 百八煩悩珠は次の発動まで残り続ける（＝途切れない）。数珠は効果時間で消える
    const life = evolved ? period + 2 : Math.min(ticks(s.duration), period);
    const rings: Array<[number, number]> = evolved ? [[40, 1], [72, -1]] : [[44, 1]];
    for (const [radius, sign] of rings) {
      for (let i = 0; i < count; i++) {
        const p = make(world, 'orbit', w, evolved ? 'bead_gold' : 'bead');
        p.angle = w.phase * sign + (i * TWO_PI) / count;
        p.dist = radius * s.area;
        p.spin = 0.075 * s.speed * sign;
        p.radius = 6;
        p.hitInterval = ticks(s.interval);
        p.pierce = -1;
        p.life = life;
      }
    }
    // 珠の回る速さに合わせて位相を進め、次の輪が同じ角度から始まるようにする
    w.phase += 0.075 * s.speed * period;
    return FIRED;
  },
};

// ---------------------------------------------------------------------------
// 狐火：敵のいる場所へ飛んで爆発する
// ---------------------------------------------------------------------------

const lob: Behavior = {
  fire(world, w) {
    if (!randomEnemyInView(world)) return RETRY;
    return burst(w, 4);
  },
  shot(world, w) {
    const t = randomEnemyInView(world);
    if (!t) return;
    const pl = world.player;
    const s = w.stats;
    const evolved = w.def.evolved;
    const p = make(world, 'lob', w, evolved ? 'fire_blue' : 'fire');
    p.tx = t.x;
    p.ty = t.y;
    const dist = Math.hypot(t.x - pl.x, t.y - pl.y);
    const flight = Math.max(12, Math.min(55, Math.round(dist / (3.4 * s.speed))));
    p.vx = (t.x - pl.x) / flight;
    p.vy = (t.y - pl.y) / flight;
    p.life = flight;
    p.dist = flight;
    p.radius = 28 * s.area;
    p.pierce = -1;
    if (evolved) {
      p.flags = PF.BURN;
      p.phase = ticks(s.duration);
      p.hitInterval = ticks(s.interval);
    }
  },
};

// ---------------------------------------------------------------------------
// 結界：自分中心の常時ダメージ場
// ---------------------------------------------------------------------------

const scratch: Enemy[] = [];

const aura: Behavior = {
  fire() {
    return SILENT;
  },
  tick(world, w) {
    if (--w.phase > 0) return;
    const s = w.stats;
    const interval = ticks(s.interval);
    w.phase = interval;
    const pl = world.player;
    const radius = AURA_RADIUS * s.area;
    damageArea(world, pl.x, pl.y, radius, s.damage, w.def.id, s.knockback, s.crit);
    if (w.def.evolved) {
      // 四神結界：中の妖怪は足が鈍る
      const n = world.grid.query(pl.x, pl.y, radius, scratch);
      for (let i = 0; i < n; i++) scratch[i]!.slow = interval + 4;
    }
  },
};

// ---------------------------------------------------------------------------
// 清め塩：地面に陣を敷く
// ---------------------------------------------------------------------------

const zone: Behavior = {
  fire(world, w) {
    const pl = world.player;
    const s = w.stats;
    const rng = world.rng;
    const count = Math.max(1, Math.round(s.amount));
    for (let i = 0; i < count; i++) {
      // 近くに敵がいればその足元へ、いなければ自分の周りへ撒く
      const n = world.grid.query(pl.x, pl.y, 160, scratch);
      let x: number;
      let y: number;
      if (n > 0) {
        const t = scratch[rng.int(n)]!;
        x = t.x + rng.range(-8, 8);
        y = t.y + rng.range(-8, 8);
      } else {
        const a = rng.angle();
        const d = rng.range(20, 70);
        x = pl.x + Math.cos(a) * d;
        y = pl.y + Math.sin(a) * d;
      }
      const p = make(world, 'zone', w, w.def.evolved ? 'misogi' : 'salt');
      p.x = x;
      p.y = y;
      p.radius = 30 * s.area;
      p.life = ticks(s.duration);
      p.hitInterval = ticks(s.interval);
      p.timer = 1;
      p.pierce = -1;
      if (w.def.evolved) p.flags = PF.PULL;
      emit(world, { t: 'fx', kind: 'salt', x, y, r: p.radius, angle: 0, x2: 0, y2: 0, weapon: w.def.id });
    }
    return FIRED;
  },
};

// ---------------------------------------------------------------------------
// 鎌鼬：行って戻る風の刃
// ---------------------------------------------------------------------------

const boomerang: Behavior = {
  fire(world, w) {
    const pl = world.player;
    const s = w.stats;
    const evolved = w.def.evolved;
    const count = Math.max(1, Math.round(s.amount));
    const t = world.grid.nearest(pl.x, pl.y, 280);
    const base = t ? Math.atan2(t.y - pl.y, t.x - pl.x) : facingAngle(world);
    for (let i = 0; i < count; i++) {
      const p = make(world, 'boomerang', w, evolved ? 'wind_big' : 'wind');
      // 颪は全方位へ、鎌鼬は狙った方向を中心に扇状へ
      const angle = evolved ? w.phase + (i * TWO_PI) / count : base + (i - (count - 1) / 2) * 0.45;
      aim(p, angle, 5.2 * s.speed);
      p.turn = 0.15;
      p.spin = evolved ? 0.035 : 0;
      p.radius = 9 * s.area;
      p.hitInterval = ticks(s.interval);
      p.pierce = -1;
      p.life = 240;
    }
    if (evolved) w.phase += 0.5;
    return FIRED;
  },
};

// ---------------------------------------------------------------------------
// 雷太鼓：ランダムな敵に落雷
// ---------------------------------------------------------------------------

/** 神鳴りが連鎖する回数と、次の敵を探す距離 */
const CHAIN_HOPS = 4;
const CHAIN_RANGE = 85;
const chained: number[] = [];

const strike: Behavior = {
  fire(world, w) {
    if (!randomEnemyInView(world)) return RETRY;
    return burst(w, 5);
  },
  shot(world, w) {
    const t = randomEnemyInView(world);
    if (!t) return;
    const s = w.stats;
    const id = w.def.id;
    let x = t.x;
    let y = t.y;
    const radius = 26 * s.area;
    chained.length = 0;
    chained.push(t.id);
    damageArea(world, x, y, radius, s.damage, id, s.knockback, s.crit);
    emit(world, { t: 'fx', kind: 'lightning', x, y, r: radius, angle: 0, x2: 0, y2: 0, weapon: id });
    if (!w.def.evolved) return;
    // 神鳴り：まだ打っていない近くの敵へ、威力を落としながら連なっていく
    for (let hop = 0; hop < CHAIN_HOPS; hop++) {
      const next = world.grid.nearest(x, y, CHAIN_RANGE, (e) => !chained.includes(e.id));
      if (!next) break;
      chained.push(next.id);
      emit(world, {
        t: 'fx', kind: 'chain', x, y, r: 0, angle: 0, x2: next.x, y2: next.y, weapon: id,
      });
      x = next.x;
      y = next.y;
      hitEnemy(world, next, s.damage * 0.7, id, 0, 0, 0, s.crit);
    }
  },
};

// ---------------------------------------------------------------------------
// 折り鶴：敵を追う式神
// ---------------------------------------------------------------------------

const seeker: Behavior = {
  fire(world, w) {
    const s = w.stats;
    const evolved = w.def.evolved;
    const period = ticks(s.cooldown);
    // 千羽鶴は次の発動まで舞い続ける（＝途切れない）
    const life = evolved ? period + 2 : Math.min(ticks(s.duration), period);
    const count = Math.max(1, Math.round(s.amount));
    for (let i = 0; i < count; i++) {
      const p = make(world, 'seeker', w, evolved ? 'crane_gold' : 'crane');
      aim(p, world.rng.angle(), 2.5 * s.speed);
      p.turn = 0.13;
      p.radius = 6;
      p.hitInterval = ticks(s.interval);
      p.pierce = -1;
      p.life = life;
      p.phase = world.rng.angle();
      if (evolved) p.flags = PF.COLLECT;
    }
    return FIRED;
  },
};

// ---------------------------------------------------------------------------
// 神楽鈴：広がる輪
// ---------------------------------------------------------------------------

const RING_START = 6;
const RING_SPEED = 3.6;

const ring: Behavior = {
  fire(_world, w) {
    return burst(w, 15);
  },
  shot(world, w) {
    const s = w.stats;
    const evolved = w.def.evolved;
    const p = make(world, 'ring', w, evolved ? 'iwato' : 'bell');
    const max = 90 * s.area;
    p.dist = RING_START;
    p.speed = RING_SPEED;
    p.life = Math.ceil((max - RING_START) / RING_SPEED);
    // tx に最大半径を入れておく（描画側が消え際を薄くするのに使う）
    p.tx = max;
    p.pierce = -1;
    if (evolved) {
      p.flags = PF.FREEZE;
      p.phase = ticks(s.duration);
    }
  },
};

const BEHAVIORS: Record<WeaponKind, Behavior> = {
  homing,
  arrow,
  sweep,
  orbit,
  lob,
  aura,
  zone,
  boomerang,
  strike,
  seeker,
  ring,
  slash,
};
