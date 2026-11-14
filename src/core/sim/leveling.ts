import type { World } from '../types';
import { emit } from './world';

/**
 * 次のレベルまでに必要な経験値。
 * 序盤は数体倒すだけで上がり、後半ほど緩やかに重くなる曲線にする
 * （20 分でレベル 50〜60 に届くくらいが目安）。
 */
export function xpToNext(level: number): number {
  const n = level - 1;
  return Math.floor(5 + n * 6 + Math.pow(n, 1.9) * 0.6);
}

/** 経験値を得る。レベルが上がった回数は pendingLevels にためておき、選択画面は step の最後に開く */
export function gainXp(world: World, amount: number): void {
  const p = world.player;
  p.xp += amount * p.stats.growth;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = xpToNext(p.level);
    world.pendingLevels++;
    emit(world, { t: 'levelUp', level: p.level });
  }
}
