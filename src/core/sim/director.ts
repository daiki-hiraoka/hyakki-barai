import { TICK_RATE, ticks } from '../constants';
import { ENEMIES } from '../data/enemies';
import { EVENTS, waveAt, type EventDef, type WaveDef } from '../data/waves';
import type { EnemyId, World } from '../types';
import { edgePoint, emit, spawnEnemy, spawnHazard, spawnProp } from './world';

const TWO_PI = Math.PI * 2;

/** 石灯籠の最大数と、これ以上離れたら片づける距離 */
const MAX_PROPS = 5;
const PROP_FAR = 900;

/**
 * 妖怪の湧きと、時刻で起きる出来事を進める。
 * 「いつ・何が・どれだけ出るか」は data/waves.ts の表が決め、ここはそれを実行するだけ。
 */
export function updateDirector(world: World): void {
  if (!world.config.spawns) return;
  const d = world.director;

  while (d.nextEvent < EVENTS.length && EVENTS[d.nextEvent]!.at <= world.time) {
    runEvent(world, EVENTS[d.nextEvent++]!);
  }
  if (d.darkTicks > 0) d.darkTicks--;

  const wave = waveAt(world.time);
  const alive = world.enemies.items.length;
  if (--d.spawnTimer <= 0) {
    d.spawnTimer = ticks(wave.interval);
    if (alive < wave.max) spawnGroup(world, wave, wave.batch);
  } else if (alive < wave.min) {
    // 倒しすぎて閑散としたら、間隔を待たずに少しずつ補充する
    spawnGroup(world, wave, Math.min(3, wave.min - alive));
  }

  if (--d.propTimer <= 0) {
    d.propTimer = ticks(16) + world.rng.int(ticks(10));
    if (world.props.items.length < MAX_PROPS) {
      const pt = edgePoint(world, 30);
      spawnProp(world, pt.x, pt.y);
    }
  }
  const p = world.player;
  for (const prop of world.props.items) {
    if (Math.abs(prop.x - p.x) > PROP_FAR || Math.abs(prop.y - p.y) > PROP_FAR) prop.alive = false;
  }
}

function pickFromPool(world: World, wave: WaveDef): EnemyId {
  return world.rng.weighted(wave.pool, (entry) => entry[1])[0];
}

/** 画面の縁の 1 点に、ひとかたまりで湧かせる（ばらばらに湧くより群れらしく見える） */
function spawnGroup(world: World, wave: WaveDef, count: number): void {
  const pt = edgePoint(world);
  const bx = pt.x;
  const by = pt.y;
  const rng = world.rng;
  for (let i = 0; i < count; i++) {
    spawnEnemy(world, pickFromPool(world, wave), bx + rng.range(-18, 18), by + rng.range(-18, 18), {
      hp: wave.hp,
    });
  }
}

function runEvent(world: World, ev: EventDef): void {
  const wave = waveAt(world.time);
  switch (ev.kind) {
    case 'boss': {
      const pt = edgePoint(world, 20);
      spawnEnemy(world, ev.enemy, pt.x, pt.y);
      emit(world, { t: 'bossSpawn', enemy: ev.enemy });
      break;
    }
    case 'elite': {
      // その時刻でいちばん打たれ強い妖怪を精鋭にする
      let id = wave.pool[0]![0];
      for (const [candidate] of wave.pool) {
        if (ENEMIES[candidate].hp > ENEMIES[id].hp) id = candidate;
      }
      for (let i = 0; i < ev.count; i++) {
        const pt = edgePoint(world, 10);
        spawnEnemy(world, id, pt.x, pt.y, { hp: wave.hp, elite: true });
      }
      emit(world, { t: 'warn', kind: 'elite' });
      break;
    }
    case 'stream':
      stream(world, ev.enemy, ev.count, wave.hp);
      emit(world, { t: 'warn', kind: 'stream' });
      break;
    case 'ring':
      ring(world, ev.enemy, ev.count, wave.hp);
      emit(world, { t: 'warn', kind: 'ring' });
      break;
    case 'rush':
      rush(world, ev.enemy, ev.count, wave.hp);
      emit(world, { t: 'warn', kind: 'rush' });
      break;
    case 'parade':
      parade(world, ev.count, wave);
      emit(world, { t: 'warn', kind: 'parade' });
      break;
    case 'swarm':
      for (let i = 0; i < ev.count; i++) {
        const pt = edgePoint(world, world.rng.range(0, 60));
        spawnEnemy(world, ev.enemy, pt.x, pt.y, { hp: wave.hp });
      }
      emit(world, { t: 'warn', kind: 'swarm' });
      break;
    case 'dark':
      world.director.darkTicks = ticks(ev.duration);
      emit(world, { t: 'warn', kind: 'dark' });
      break;
  }
}

/** 鬼火の流れ：プレイヤーのいる帯を、同じ向きに横切っていく群れ */
function stream(world: World, enemy: EnemyId, count: number, hp: number): void {
  const p = world.player;
  const rng = world.rng;
  const dir = rng.chance(0.5) ? 1 : -1;
  const horizontal = rng.chance(0.7);
  const span = (horizontal ? world.view.hw : world.view.hh) + 60;
  const speed = ENEMIES[enemy].speed / TICK_RATE;
  for (let i = 0; i < count; i++) {
    const along = -dir * (span + rng.range(0, 170));
    const across = rng.range(-72, 72);
    const e = spawnEnemy(
      world,
      enemy,
      horizontal ? p.x + along : p.x + across,
      horizontal ? p.y + across : p.y + along,
      { hp },
    );
    e.ai = 'line';
    e.dirX = horizontal ? dir : 0;
    e.dirY = horizontal ? 0 : dir;
    e.life = Math.ceil((span * 2 + 240) / speed);
  }
}

/** 塗り壁の包囲：プレイヤーを中心にした輪が、じりじり狭まる */
function ring(world: World, enemy: EnemyId, count: number, hp: number): void {
  const p = world.player;
  const RADIUS = 190;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TWO_PI;
    const e = spawnEnemy(world, enemy, p.x + Math.cos(a) * RADIUS, p.y + Math.sin(a) * RADIUS, { hp });
    e.ai = 'ring';
    e.cx = p.x;
    e.cy = p.y;
    e.life = ticks(28);
  }
}

/** 輪入道の暴走：予告の線を見せたあと、1 体ずつ時間差で駆け抜ける */
function rush(world: World, enemy: EnemyId, count: number, hp: number): void {
  const p = world.player;
  const rng = world.rng;
  const radius = Math.hypot(world.view.hw, world.view.hh) + 40;
  const speed = ENEMIES[enemy].speed / TICK_RATE;
  for (let i = 0; i < count; i++) {
    const a = rng.angle();
    const sx = p.x + Math.cos(a) * radius;
    const sy = p.y + Math.sin(a) * radius;
    // 湧いた時点のプレイヤー付近を狙う（予告を見て避けられるように、追尾はしない）
    const dx = p.x + rng.range(-40, 40) - sx;
    const dy = p.y + rng.range(-40, 40) - sy;
    const d = Math.hypot(dx, dy) || 1;
    const wait = 60 + i * 40;
    const e = spawnEnemy(world, enemy, sx, sy, { hp });
    e.ai = 'line';
    e.dirX = dx / d;
    e.dirY = dy / d;
    e.aiTimer = wait;
    e.life = wait + Math.ceil((radius * 2 + 200) / speed);
    const h = spawnHazard(world, 'line', sx, sy, 10, wait, 20, 0);
    h.angle = Math.atan2(dy, dx);
    h.length = radius * 2 + 100;
  }
}

/** 百鬼夜行：7 列の大行列が、ゆっくりと画面を横切る */
function parade(world: World, count: number, wave: WaveDef): void {
  const p = world.player;
  const rng = world.rng;
  const ROWS = 7;
  const GAP = 18;
  const dir = rng.chance(0.5) ? 1 : -1;
  const cols = Math.ceil(count / ROWS);
  const speed = 26 / TICK_RATE;
  const life = Math.ceil((world.view.hw * 2 + cols * GAP + 280) / speed);
  for (let i = 0; i < count; i++) {
    const col = Math.floor(i / ROWS);
    const row = i % ROWS;
    // 行列の両端は提灯持ち
    const id: EnemyId = row === 0 || row === ROWS - 1 ? 'chochin' : pickFromPool(world, wave);
    const e = spawnEnemy(
      world,
      id,
      p.x - dir * (world.view.hw + 40 + col * GAP),
      p.y + (row - (ROWS - 1) / 2) * GAP + rng.range(-3, 3),
      { hp: wave.hp * 1.5 },
    );
    e.ai = 'line';
    e.dirX = dir;
    e.dirY = 0;
    e.aiTimer = 0;
    e.speed = speed;
    e.life = life;
    e.xp *= 2;
  }
}
