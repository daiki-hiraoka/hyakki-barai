import { PLAYER_SPEED, TICK_RATE } from '../constants';
import type { SimInput, World } from '../types';

/** 鈍足（雪玉や蜘蛛の糸）にかかっている間の速度倍率 */
const SLOWED = 0.55;

export function updatePlayer(world: World, input: SimInput): void {
  const p = world.player;
  let mx = input.mx;
  let my = input.my;
  const len = Math.hypot(mx, my);
  // 斜め入力で速くならないよう、長さ 1 を超える入力は丸める
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  p.moving = len > 0.05;
  if (p.moving) {
    const speed = (PLAYER_SPEED * p.stats.moveSpeed * (p.slow > 0 ? SLOWED : 1)) / TICK_RATE;
    p.x += mx * speed;
    p.y += my * speed;
    const n = Math.min(len, 1);
    p.faceX = mx / n;
    p.faceY = my / n;
    if (Math.abs(mx) > 0.05) p.dir = mx > 0 ? 1 : -1;
  }
  if (p.iframes > 0) p.iframes--;
  if (p.slow > 0) p.slow--;

  // 自然回復。端数は「60 分の 1 HP」単位でためて、1 HP たまるごとに回復する
  if (p.stats.regen > 0 && p.hp < p.maxHp) {
    p.regenAcc += p.stats.regen;
    if (p.regenAcc >= TICK_RATE) {
      p.regenAcc -= TICK_RATE;
      p.hp = Math.min(p.maxHp, p.hp + 1);
    }
  }
}
