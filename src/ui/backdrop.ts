import type { Gfx } from '../render/gfx';
import { Lighting } from '../render/lighting';

/** 空の色（上から下へ）。境目は点描でなじませる */
const SKY = ['#0c0d22', '#121433', '#1a1b45', '#262354', '#39295f', '#55305f'];
const HORIZON = 250;

/** タイトルの行列に並ぶ妖怪（左へ歩く） */
const MARCHERS = [
  'enemy.chochin', 'enemy.hitotsume', 'enemy.karakasa', 'enemy.kappa', 'enemy.tanuki',
  'enemy.chochin', 'enemy.nekomata', 'enemy.rokuro', 'enemy.oni_red', 'enemy.gaki',
  'enemy.chochin', 'enemy.yukionna', 'enemy.tengu', 'enemy.gaikotsu', 'enemy.oni_blue',
  'enemy.dorotabo', 'enemy.chochin', 'enemy.nue', 'enemy.kappa', 'enemy.hitotsume',
];
const MARCH_GAP = 34;

function rand(i: number): number {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * タイトルやメニューの背景：月夜の山里を、百鬼夜行がぞろぞろと練り歩く。
 * dim を上げると全体を暗くできる（文字を載せるメニュー用）。
 */
export class Backdrop {
  private readonly lighting = new Lighting();

  draw(g: Gfx, tick: number, dim = 0): void {
    const ctx = g.ctx;
    const w = g.w;
    const h = g.h;

    // ---- 空
    const band = HORIZON / SKY.length;
    SKY.forEach((color, i) => {
      g.rect(0, Math.floor(i * band), w, Math.ceil(band) + 1, color);
      if (i === 0) return;
      // 帯の境目を市松で 2 段ぼかす
      const y = Math.floor(i * band);
      ctx.fillStyle = color;
      for (let x = 0; x < w; x += 2) {
        ctx.fillRect(x + ((y >> 1) % 2), y - 2, 1, 1);
        ctx.fillRect(x + 1, y - 4, 1, 1);
      }
    });

    // ---- 星（ゆっくり瞬く）
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(rand(i) * w);
      const y = Math.floor(rand(i + 100) * (HORIZON - 70));
      const twinkle = Math.sin(tick * 0.03 + i * 1.7);
      if (twinkle < -0.6) continue;
      g.rect(x, y, 1, 1, twinkle > 0.7 ? '#ffffff' : '#8fa5d2');
    }

    // ---- 月と月暈
    // 中央の題字に重ならないよう、狭い画面では右端へ寄せる
    const mx = Math.round(Math.min(w - 46, Math.max(w * 0.78, w / 2 + 176)));
    const my = 80;
    ctx.globalAlpha = 0.12;
    g.disc(mx, my, 58, '#c9d7f0');
    g.disc(mx, my, 48, '#c9d7f0');
    ctx.globalAlpha = 1;
    g.disc(mx, my, 38, '#fff3b0');
    g.disc(mx - 3, my - 3, 34, '#fffbe0');
    g.disc(mx + 12, my - 10, 6, '#f0e6b4');
    g.disc(mx - 14, my + 9, 8, '#f0e6b4');
    g.disc(mx + 6, my + 16, 4, '#f0e6b4');

    // ---- 遠い山並みと近い丘
    this.ridge(g, 196, 34, 0.011, 3, '#191a3c');
    this.ridge(g, 226, 22, 0.021, 9, '#101127');

    // ---- 地面と鳥居
    g.rect(0, HORIZON + 22, w, h - HORIZON - 22, '#0a0b18');
    g.rect(0, HORIZON + 22, w, 1, '#1c2440');
    g.spriteScaled('decor.torii', 0, Math.round(w * 0.2), HORIZON + 32, 2);
    g.sprite('decor.pine', 0, Math.round(w * 0.9), HORIZON + 30);
    g.sprite('decor.jizo', 0, Math.round(w * 0.34), HORIZON + 30);
    g.sprite('decor.jizo', 0, Math.round(w * 0.34) + 15, HORIZON + 31);

    // ---- 百鬼夜行（右から左へ練り歩く）
    const total = MARCHERS.length * MARCH_GAP;
    const scroll = (tick * 0.35) % total;
    const ground = HORIZON + 44;
    const L = this.lighting;
    L.begin(w, h, '#3a3f86');
    L.light(mx, my, 150, 0.5);
    const glows: Array<[string, number, number, number]> = [];
    MARCHERS.forEach((id, i) => {
      let x = i * MARCH_GAP - scroll;
      // 画面の幅より行列が長いので、左へ抜けたら右へ回す
      while (x < -40) x += Math.max(total, w + 80);
      if (x > w + 40) return;
      const frame = Math.floor((tick + i * 7) / 14) % 2;
      const hop = Math.abs(Math.sin((tick + i * 11) * 0.09)) * 2;
      const y = ground + (i % 3) * 5 - hop;
      g.sprite(id, frame, x, y, true);
      glows.push([id, frame, x, y]);
      if (id === 'enemy.chochin') L.light(x, y - 8, 30, 0.95);
    });
    // 漂う鬼火
    for (let i = 0; i < 5; i++) {
      const x = ((i * 157 + tick * (0.2 + i * 0.05)) % (w + 40)) - 20;
      const y = 150 + i * 16 + Math.sin(tick * 0.04 + i * 2) * 10;
      const frame = Math.floor((tick + i * 9) / 12) % 2;
      g.sprite('enemy.onibi', frame, x, y);
      glows.push(['enemy.onibi', frame, x, y]);
      L.light(x, y - 5, 22, 0.8);
    }
    L.light(Math.round(w * 0.2), HORIZON + 10, 60, 0.35);

    // 闇は地上にだけ掛ける（空と月は暗くしない）
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, HORIZON + 4, w, h - HORIZON - 4);
    ctx.clip();
    L.apply(ctx, 0.6);
    ctx.restore();
    for (const [id, frame, x, y] of glows) g.sprite(id, frame, x, y, id !== 'enemy.onibi', 'glow');

    if (dim > 0) {
      ctx.globalAlpha = dim;
      g.rect(0, 0, w, h, '#07070f');
      ctx.globalAlpha = 1;
    }
  }

  /** 山の稜線（サイン波を重ねた簡単な地形） */
  private ridge(g: Gfx, base: number, height: number, freq: number, seed: number, color: string): void {
    const ctx = g.ctx;
    ctx.fillStyle = color;
    for (let x = 0; x < g.w; x++) {
      const n =
        Math.sin(x * freq + seed) * 0.5 +
        Math.sin(x * freq * 2.3 + seed * 1.7) * 0.3 +
        Math.sin(x * freq * 5.1 + seed * 0.3) * 0.2;
      const top = Math.round(base - (n * 0.5 + 0.5) * height);
      ctx.fillRect(x, top, 1, HORIZON + 22 - top);
    }
  }
}
