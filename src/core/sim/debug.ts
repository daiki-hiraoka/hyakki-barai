import { DT, TICK_RATE } from '../constants';
import { EVENTS } from '../data/waves';
import type { World } from '../types';

/**
 * 経過時間を seconds 秒まで飛ばす（テストとデバッグ用）。
 * 飛ばした区間の出来事は起こさず、seconds ちょうど以降のものから再開する。
 */
export function skipTo(world: World, seconds: number): void {
  world.tick = Math.round(seconds * TICK_RATE);
  world.time = world.tick * DT;
  const next = EVENTS.findIndex((e) => e.at >= world.time);
  world.director.nextEvent = next < 0 ? EVENTS.length : next;
  world.director.spawnTimer = 1;
}
