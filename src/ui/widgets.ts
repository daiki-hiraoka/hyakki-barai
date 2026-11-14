import type { Gfx } from '../render/gfx';

/** 画面全体で使う色 */
export const C = {
  ink: '#0b0b16',
  night: '#16162c',
  night2: '#2b2b4c',
  slate: '#3f4573',
  pale: '#c9d7f0',
  dim: '#8fa5d2',
  paper: '#f5edd9',
  paperShade: '#d9ccb1',
  paperDark: '#a99b85',
  gold: '#f7c948',
  goldDark: '#c2902c',
  vermilion: '#cf3a2f',
  crimson: '#8c2030',
  cyan: '#52d2da',
  green: '#7be2a2',
  danger: '#f2507a',
} as const;

/** 画面を暗くする幕（選択画面などの背景に敷く） */
export function shade(g: Gfx, alpha: number, color: string = C.ink): void {
  g.ctx.globalAlpha = alpha;
  g.rect(0, 0, g.w, g.h, color);
  g.ctx.globalAlpha = 1;
}

/**
 * パネル。'dark' は夜色に金の縁（HUD やメニュー）、'paper' は和紙に朱の縁（御札や説明）。
 */
export function panel(g: Gfx, x: number, y: number, w: number, h: number, kind: 'dark' | 'paper' = 'dark'): void {
  x = Math.round(x);
  y = Math.round(y);
  g.rect(x, y, w, h, C.ink);
  if (kind === 'dark') {
    g.ctx.globalAlpha = 0.94;
    g.rect(x + 1, y + 1, w - 2, h - 2, C.night);
    g.ctx.globalAlpha = 1;
    g.box(x + 2, y + 2, w - 4, h - 4, C.goldDark);
    // 四隅の飾り
    for (const [cx, cy] of [[x + 2, y + 2], [x + w - 4, y + 2], [x + 2, y + h - 4], [x + w - 4, y + h - 4]] as const) {
      g.rect(cx, cy, 2, 2, C.gold);
    }
  } else {
    g.rect(x + 1, y + 1, w - 2, h - 2, C.paper);
    g.rect(x + 1, y + h - 4, w - 2, 3, C.paperShade);
    g.rect(x + w - 4, y + 1, 3, h - 2, C.paperShade);
    g.box(x + 3, y + 3, w - 6, h - 6, C.vermilion);
  }
}

/** アイコンの枠（暗い地に細い縁） */
export function slot(g: Gfx, x: number, y: number, icon: string | null, level = 0, highlight = false): void {
  g.rect(x, y, 18, 18, C.ink);
  g.rect(x + 1, y + 1, 16, 16, icon ? '#22223e' : '#141426');
  if (highlight) g.box(x, y, 18, 18, C.gold);
  if (!icon) return;
  g.sprite(icon, 0, x + 9, y + 9);
  if (level > 0) g.num(String(level), x + 18, y + 11, C.paper, 1, 'right');
}

/** 横棒のゲージ */
export function bar(
  g: Gfx,
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number,
  fill: string,
  light: string,
  back: string = '#1a1930',
): void {
  g.rect(x - 1, y - 1, w + 2, h + 2, C.ink);
  g.rect(x, y, w, h, back);
  const fw = Math.round(w * Math.max(0, Math.min(1, ratio)));
  if (fw <= 0) return;
  g.rect(x, y, fw, h, fill);
  g.rect(x, y, fw, 1, light);
}

/** 操作の案内（画面下などに小さく出す） */
export function hint(g: Gfx, text: string, x: number, y: number, align: 'left' | 'center' | 'right' = 'center'): void {
  g.print(text, x, y, { color: C.dim, align });
}
