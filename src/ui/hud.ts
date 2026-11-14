import { ENEMIES } from '../core/data/enemies';
import { EVENTS, nightPhase } from '../core/data/waves';
import { MAX_PASSIVES, MAX_WEAPONS } from '../core/constants';
import type { World } from '../core/types';
import type { Input } from '../input/input';
import type { Gfx } from '../render/gfx';
import { formatTime } from './describe';
import { C, bar, slot } from './widgets';

/** 画面上部に出す告知（大妖の出現など） */
export interface Banner {
  title: string;
  sub: string;
  /** 残り tick */
  life: number;
  max: number;
  color: string;
}

const BOSS_TIMES = EVENTS.flatMap((e) => (e.kind === 'boss' ? [e.at] : []));

/** プレイ中の画面表示（経験値・時刻・装備・撃破数・大妖の体力） */
export function drawHud(g: Gfx, world: World, tick: number, hurt: number, banner: Banner | null): void {
  const w = g.w;
  const h = g.h;
  const p = world.player;
  const ctx = g.ctx;

  // ---- 打たれた直後と、瀕死のときは画面の縁を赤くする
  const low = p.hp / p.maxHp < 0.3 && world.phase === 'playing';
  const pulse = low ? 0.16 + Math.sin(tick * 0.14) * 0.08 : 0;
  const edge = Math.max(pulse, hurt > 0 ? (hurt / 14) * 0.35 : 0);
  if (edge > 0.01) {
    ctx.globalAlpha = edge;
    for (let i = 0; i < 4; i++) {
      // 外側ほど濃い縁取りを、幅を変えた帯で重ねる
      const t = 6 + i * 7;
      ctx.globalAlpha = edge * (1 - i * 0.22);
      g.rect(0, 0, w, t, C.danger);
      g.rect(0, h - t, w, t, C.danger);
      g.rect(0, t, t, h - t * 2, C.danger);
      g.rect(w - t, t, t, h - t * 2, C.danger);
    }
    ctx.globalAlpha = 1;
  }

  // ---- 経験値（注連縄風に、ねじり目を入れたゲージ）
  const ratio = p.xpNext > 0 ? p.xp / p.xpNext : 0;
  g.rect(0, 0, w, 9, C.ink);
  g.rect(1, 1, w - 2, 7, '#1a1930');
  const fill = Math.round((w - 2) * Math.max(0, Math.min(1, ratio)));
  g.rect(1, 1, fill, 7, '#2f60b2');
  g.rect(1, 1, fill, 2, '#52d2da');
  g.rect(1, 3, fill, 1, '#5ba2ea');
  for (let x = 6 - ((tick >> 3) % 10); x < fill; x += 10) {
    // ねじり目
    g.rect(x, 4, 1, 3, '#2b8fab');
    g.rect(x + 1, 5, 1, 2, '#2b8fab');
  }
  g.num(`Lv${p.level}`, w - 5, 12, C.paper, 1, 'right');

  // ---- 装備（上段が武器、下段が装身具）
  for (let i = 0; i < MAX_WEAPONS; i++) {
    const wpn = p.weapons[i];
    slot(g, 4 + i * 19, 12, wpn ? `icon.w.${wpn.def.id}` : null, wpn && !wpn.def.evolved ? wpn.level : 0);
    if (wpn?.def.evolved) g.box(4 + i * 19, 12, 18, 18, C.gold);
  }
  for (let i = 0; i < MAX_PASSIVES; i++) {
    const ps = p.passives[i];
    slot(g, 4 + i * 19, 32, ps ? `icon.p.${ps.def.id}` : null, ps ? ps.level : 0);
  }

  // ---- 時刻と夜の進み具合
  const cx = Math.round(w / 2);
  const duration = world.config.duration;
  g.num(formatTime(Math.min(world.time, duration)), cx, 13, C.paper, 2, 'center');
  g.print(nightPhase(world.time, duration), cx, 30, { align: 'center', color: C.pale });
  const trackW = 132;
  const tx = cx - trackW / 2;
  const ty = 51;
  g.rect(tx, ty, trackW, 1, C.slate);
  for (const at of BOSS_TIMES) {
    // 大妖の現れる刻
    const bx = tx + Math.round((at / duration) * trackW);
    g.rect(bx, ty - 2, 1, 5, world.time >= at ? C.slate : C.danger);
  }
  g.sprite('ui.sun', 0, tx + trackW + 7, ty);
  g.sprite('ui.moon', 0, tx + Math.round(Math.min(1, world.time / duration) * trackW), ty);

  // ---- 撃破数と小判
  g.num(String(world.run.kills), w - 5, 26, C.paper, 1, 'right');
  g.sprite('ui.skull', 0, w - 12 - g.digits.width(String(world.run.kills)), 30);
  g.num(String(world.run.gold), w - 5, 39, C.gold, 1, 'right');
  g.sprite('item.coin', 0, w - 12 - g.digits.width(String(world.run.gold)), 42);

  // ---- 大妖の体力
  let boss = null;
  for (const e of world.enemies.items) {
    if (e.alive && e.boss && (!boss || e.maxHp > boss.maxHp)) boss = e;
  }
  if (boss) {
    const bw = Math.min(260, w - 120);
    const bx = cx - bw / 2;
    g.print(`大妖 ${ENEMIES[boss.def.id].name}`, cx, h - 40, { align: 'center', color: '#ffa0c2' });
    bar(g, bx, h - 21, bw, 6, boss.hp / boss.maxHp, C.vermilion, '#ea6a50', '#551428');
  }

  // ---- 告知
  if (banner && banner.life > 0) drawBanner(g, banner);
}

function drawBanner(g: Gfx, b: Banner): void {
  const ctx = g.ctx;
  const w = g.w;
  const age = b.max - b.life;
  // 現れるときは帯が横に開き、消えるときは薄れる
  const open = Math.min(1, age / 12);
  const fade = Math.min(1, b.life / 20);
  const bandH = 44;
  const y = 74;
  const half = Math.round((w / 2) * open);
  ctx.globalAlpha = 0.72 * fade;
  g.rect(w / 2 - half, y, half * 2, bandH, C.ink);
  ctx.globalAlpha = fade;
  g.rect(w / 2 - half, y, half * 2, 1, b.color);
  g.rect(w / 2 - half, y + bandH - 1, half * 2, 1, b.color);
  if (open >= 1) {
    g.print(b.title, w / 2, y + 4, { align: 'center', color: b.color, scale: 1.5 });
    if (b.sub) g.print(b.sub, w / 2, y + 28, { align: 'center', color: C.pale });
  }
  ctx.globalAlpha = 1;
}

/** タッチ操作の仮想スティック */
export function drawStick(g: Gfx, input: Input): void {
  const s = input.stick;
  if (!s) return;
  const ctx = g.ctx;
  ctx.globalAlpha = 0.35;
  g.arc(s.x, s.y, 36, C.pale, 0, Math.PI * 2, 1, 2);
  const len = Math.hypot(s.dx, s.dy);
  const k = len > 36 ? 36 / len : 1;
  g.disc(s.x + s.dx * k, s.y + s.dy * k, 10, C.pale);
  ctx.globalAlpha = 1;
}
