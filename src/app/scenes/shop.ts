import { SHOP } from '../../core/data/shop';
import { buy, refundAll, shopCost } from '../../core/meta/save';
import { SHOP_IDS } from '../../core/types';
import { Backdrop } from '../../ui/backdrop';
import { C, hint, panel } from '../../ui/widgets';
import type { Game, Scene } from '../game';
import { TitleScene } from './title';

const COLS = 3;
const CELL_H = 36;
const GAP = 4;
const TOP = 48;

/** 社：小判で永続的な加護を授かる */
export class ShopScene implements Scene {
  private readonly backdrop = new Backdrop();
  private selected = 0;
  private age = 0;
  /** 直前の操作の結果（「足りない」など）を少しの間だけ表示する */
  private note = '';
  private noteLife = 0;

  constructor(private readonly game: Game) {}

  private cell(i: number): { x: number; y: number; w: number; h: number } {
    const g = this.game.gfx;
    const w = Math.floor((Math.min(g.w - 24, 600) - GAP * (COLS - 1)) / COLS);
    const total = w * COLS + GAP * (COLS - 1);
    const x0 = Math.round((g.w - total) / 2);
    return {
      x: x0 + (i % COLS) * (w + GAP),
      y: TOP + Math.floor(i / COLS) * (CELL_H + GAP),
      w,
      h: CELL_H,
    };
  }

  private say(text: string): void {
    this.note = text;
    this.noteLife = 120;
  }

  update(): void {
    const { input, audio, save } = this.game;
    const n = SHOP_IDS.length;
    this.age++;
    if (this.noteLife > 0) this.noteLife--;
    if (input.pressed('cancel')) {
      audio.sfx('ui_cancel');
      this.game.goto(new TitleScene(this.game));
      return;
    }
    const before = this.selected;
    if (input.pressed('left')) this.selected = (this.selected + n - 1) % n;
    if (input.pressed('right')) this.selected = (this.selected + 1) % n;
    if (input.pressed('up')) this.selected = (this.selected + n - COLS) % n;
    if (input.pressed('down')) this.selected = (this.selected + COLS) % n;
    if (before !== this.selected) audio.sfx('ui_move');

    let go = input.pressed('confirm');
    for (let i = 0; i < n; i++) {
      const c = this.cell(i);
      if (!input.pointed(c.x, c.y, c.w, c.h)) continue;
      this.selected = i;
      if (input.pointer.pressed) go = true;
    }

    if (input.pressed('reroll')) {
      const back = refundAll(save);
      if (back > 0) {
        audio.sfx('ui_buy');
        this.say(`加護をお返しし、小判 ${back} 枚が戻った`);
        this.game.persist();
      } else {
        audio.sfx('ui_deny');
      }
      return;
    }
    if (!go || this.age < 10) return;
    const id = SHOP_IDS[this.selected]!;
    const rank = save.shop[id] ?? 0;
    if (buy(save, id)) {
      audio.sfx('ui_buy');
      this.say(`${SHOP[id].name} を授かった`);
      this.game.persist();
    } else {
      audio.sfx('ui_deny');
      this.say(rank >= SHOP[id].maxRank ? 'これ以上は授かれない' : '小判が足りない');
    }
  }

  draw(): void {
    const { gfx: g, tick, save } = this.game;
    const cx = Math.round(g.w / 2);
    this.backdrop.draw(g, tick, 0.62);
    g.print('社の加護', cx, 12, { align: 'center', color: C.gold, scale: 1.5 });
    g.sprite('item.coin', 0, g.w - 18 - g.digits.width(String(save.gold)), 23);
    g.num(String(save.gold), g.w - 10, 19, C.gold, 1, 'right');

    SHOP_IDS.forEach((id, i) => {
      const c = this.cell(i);
      const def = SHOP[id];
      const rank = save.shop[id] ?? 0;
      const maxed = rank >= def.maxRank;
      const selected = i === this.selected;
      const cost = shopCost(id, rank);
      panel(g, c.x, c.y, c.w, c.h, 'dark');
      if (selected) g.box(c.x, c.y, c.w, c.h, C.gold, 2);
      g.print(def.name, c.x + 8, c.y + 4, { color: maxed ? C.gold : C.paper });
      // ランクを小さな枡で示す
      for (let r = 0; r < def.maxRank; r++) {
        const px = c.x + 9 + r * 8;
        g.rect(px, c.y + 24, 6, 6, C.ink);
        g.rect(px + 1, c.y + 25, 4, 4, r < rank ? C.gold : C.night2);
      }
      if (maxed) {
        g.print('満', c.x + c.w - 8, c.y + 16, { color: C.gold, align: 'right' });
      } else {
        g.num(String(cost), c.x + c.w - 8, c.y + 23, save.gold >= cost ? C.paper : C.danger, 1, 'right');
      }
    });

    // ---- 説明
    const id = SHOP_IDS[this.selected]!;
    const def = SHOP[id];
    const rank = save.shop[id] ?? 0;
    const w = Math.min(g.w - 24, 600);
    const y = TOP + Math.ceil(SHOP_IDS.length / COLS) * (CELL_H + GAP) + 4;
    panel(g, cx - w / 2, y, w, 44, 'dark');
    g.print(def.name, cx - w / 2 + 12, y + 6, { color: C.gold });
    g.print(`${rank} / ${def.maxRank}`, cx + w / 2 - 12, y + 6, { color: C.dim, align: 'right' });
    g.print(`${def.desc}（1 段ごと）`, cx - w / 2 + 12, y + 23, { color: C.paper });

    if (this.noteLife > 0) {
      g.ctx.globalAlpha = Math.min(1, this.noteLife / 20);
      g.print(this.note, cx, g.h - 40, { align: 'center', color: C.gold });
      g.ctx.globalAlpha = 1;
    }
    hint(g, '矢印 選ぶ　Enter 授かる　R すべてお返しする　Esc もどる', cx, g.h - 20);
  }
}
