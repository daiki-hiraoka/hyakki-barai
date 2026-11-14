import { Backdrop } from '../../ui/backdrop';
import { formatTime } from '../../ui/describe';
import { C, hint } from '../../ui/widgets';
import type { Game, Scene } from '../game';
import { SelectScene } from './select';
import { SettingsScene } from './settings';
import { ShopScene } from './shop';

const MENU = ['はじめる', '社の加護', '設定'] as const;

export class TitleScene implements Scene {
  private readonly backdrop = new Backdrop();
  private selected = 0;
  private age = 0;

  constructor(private readonly game: Game) {
    game.audio.setPaused(false);
    game.audio.music('title', 1.5);
    game.input.stickEnabled = false;
  }

  private itemRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = 132;
    return { x: Math.round(this.game.gfx.w / 2 - w / 2), y: 238 + i * 24, w, h: 22 };
  }

  update(): void {
    const { input, audio } = this.game;
    this.age++;
    if (input.pressed('up')) {
      this.selected = (this.selected + MENU.length - 1) % MENU.length;
      audio.sfx('ui_move');
    }
    if (input.pressed('down')) {
      this.selected = (this.selected + 1) % MENU.length;
      audio.sfx('ui_move');
    }
    let go = input.pressed('confirm');
    MENU.forEach((_, i) => {
      const r = this.itemRect(i);
      if (!input.pointed(r.x, r.y, r.w, r.h)) return;
      this.selected = i;
      if (input.pointer.pressed) go = true;
    });
    if (!go || this.age < 10) return;
    audio.sfx('ui_confirm');
    if (this.selected === 0) this.game.goto(new SelectScene(this.game));
    else if (this.selected === 1) this.game.goto(new ShopScene(this.game));
    else this.game.goto(new SettingsScene(this.game));
  }

  draw(): void {
    const { gfx: g, tick, save } = this.game;
    const cx = Math.round(g.w / 2);
    this.backdrop.draw(g, tick);

    // ---- 題字（朱の影を敷いて、判子のような重みを出す）
    const bob = Math.round(Math.sin(tick * 0.03) * 2);
    g.print('百鬼祓い', cx + 3, 44 + bob + 3, { align: 'center', color: C.crimson, outline: null, scale: 4 });
    g.print('百鬼祓い', cx, 44 + bob, { align: 'center', color: C.paper, outline: C.ink, scale: 4 });
    g.print('夜明けまで、祓い続けよ', cx, 118 + bob, { align: 'center', color: C.gold });

    // ---- メニュー
    MENU.forEach((label, i) => {
      const r = this.itemRect(i);
      const selected = i === this.selected;
      g.ctx.globalAlpha = selected ? 0.85 : 0.55;
      g.rect(r.x, r.y, r.w, r.h, C.ink);
      g.ctx.globalAlpha = 1;
      if (selected) {
        g.box(r.x, r.y, r.w, r.h, C.goldDark);
        if ((tick >> 4) % 2 === 0) g.sprite('ui.cursor', 0, r.x - 8, r.y + 11);
      }
      g.print(label, cx, r.y + 3, { align: 'center', color: selected ? C.gold : C.pale });
    });

    // ---- 持ち金と記録
    g.sprite('item.coin', 0, g.w - 16 - g.digits.width(String(save.gold)), 17);
    g.num(String(save.gold), g.w - 8, 13, C.gold, 1, 'right');
    if (save.stats.runs > 0) {
      g.print(`最長 ${formatTime(save.stats.bestTime)}　夜明け ${save.stats.dawns} 回`, 8, 8, { color: C.dim });
    }
    hint(g, 'WASD・矢印キー：移動／選択　Enter：決定', cx, g.h - 20);
  }
}
