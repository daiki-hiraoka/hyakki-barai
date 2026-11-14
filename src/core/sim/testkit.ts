import type { SimEvent } from '../events';
import type { RunConfig, SimInput, World } from '../types';
import { step } from './step';
import { createWorld } from './world';

/** テスト用の補助。本番コードからは使わない */

export const IDLE: SimInput = { mx: 0, my: 0 };

/** 自動の湧きを止めた世界を作る（個々の仕組みを単独で確かめるため） */
export function makeWorld(config: Partial<RunConfig> = {}): World {
  return createWorld({ seed: 7, spawns: false, ...config });
}

/** 武器を外す（敵の挙動だけを見たいテスト用） */
export function disarm(world: World): World {
  world.player.weapons.length = 0;
  return world;
}

/** n tick 進め、その間に起きた出来事をすべて返す */
export function run(world: World, n: number, input: SimInput = IDLE): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < n; i++) {
    step(world, input);
    events.push(...world.events);
  }
  return events;
}

export function eventsOf<T extends SimEvent['t']>(
  events: SimEvent[],
  type: T,
): Extract<SimEvent, { t: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { t: T }> => e.t === type);
}
