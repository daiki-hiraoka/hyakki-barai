import { DT } from '../constants';
import type { SimInput, World } from '../types';
import { killEnemy } from './combat';
import { updateDirector } from './director';
import { updateEnemies } from './enemies';
import { updateHazards, updateShots } from './hazards';
import { updatePickups } from './pickups';
import { updatePlayer } from './player';
import { updateProjectiles } from './projectiles';
import { rollOffer } from './upgrades';
import { updateWeapons } from './weapons';
import { emit } from './world';

/** 夜明けの演出の長さ（tick） */
const DAWN_TICKS = 210;

/**
 * シミュレーションを 1 tick（1/60 秒）進める。
 * 乱数は world.rng だけを使うので、同じシードと同じ入力からは同じ結果になる。
 */
export function step(world: World, input: SimInput): void {
  world.events.length = 0;
  if (world.phase === 'dawn') {
    stepDawn(world);
    return;
  }
  if (world.phase !== 'playing') return;

  world.tick++;
  world.time = world.tick * DT;

  updatePlayer(world, input);
  // 以降の当たり判定は、この時点の敵の位置で作った索引を使う
  world.grid.rebuild(world.enemies.items, world.player.x, world.player.y);

  updateWeapons(world);
  updateProjectiles(world);
  updateEnemies(world);
  updateShots(world);
  updateHazards(world);
  updatePickups(world);
  updateDirector(world);

  compact(world);
  if (world.enemies.items.length > world.run.peakEnemies) {
    world.run.peakEnemies = world.enemies.items.length;
  }

  if (world.phase !== 'playing') return;

  if (world.time >= world.config.duration) {
    // 夜明け。ここからは操作を受けつけず、妖怪が朝日に焼かれて消えていく
    world.phase = 'dawn';
    world.dawnTicks = DAWN_TICKS;
    world.shots.clear();
    world.hazards.clear();
    world.projectiles.clear();
    emit(world, { t: 'dawn' });
    return;
  }

  // レベルアップは tick の最後にまとめて開く（つづらや死亡が同時に起きたらそちらを優先）
  if (world.pendingLevels > 0) {
    world.offer = rollOffer(world);
    world.phase = 'levelup';
  }
}

/** 消えたものをまとめて取り除く（走査中に配列を動かさないため、tick の最後に行う） */
function compact(world: World): void {
  world.enemies.compact();
  world.projectiles.compact();
  world.pickups.compact();
  world.shots.compact();
  world.hazards.compact();
  world.props.compact();
}

function stepDawn(world: World): void {
  world.dawnTicks--;
  // はじめはぽつぽつと、最後は残りすべてが消える
  const sweepAll = world.dawnTicks < 40;
  for (const e of world.enemies.items) {
    if (e.alive && (sweepAll || world.rng.next() < 0.05)) killEnemy(world, e, false);
  }
  world.enemies.compact();
  if (world.dawnTicks <= 0) {
    world.phase = 'victory';
    emit(world, { t: 'victory' });
  }
}
