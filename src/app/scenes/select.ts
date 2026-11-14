import { CHARACTERS } from '../../core/data/characters';
import { WEAPONS } from '../../core/data/weapons';
import { UNLOCKS } from '../../core/meta/save';
import { CHARACTER_IDS, type CharacterId } from '../../core/types';
import { Backdrop } from '../../ui/backdrop';
import { C, hint, panel, slot } from '../../ui/widgets';
import type { Game, Scene } from '../game';
import { RunScene } from './run';
import { TitleScene } from './title';

const MAX_CELL_W = 76;
const CELL_H = 104;
const GAP = 6;
const TOP = 54;

/** 祓い手を選ぶ画面 */
export class SelectScene implements Scene {
  private readonly backdrop = new Backdrop();
  private selected = 0;
  private age = 0;

  constructor(private readonly game: Game) {}

  private unlocked(id: CharacterId): boolean {
    return this.game.save.unlocked.includes(id);
  }

  /** 枠の幅。いちばん狭い画面でも 6 人が収まるように縮める */
  private cellW(): number {
    const n = CHARACTER_IDS.length;
    return Math.min(MAX_CELL_W, Math.floor((this.game.gfx.w - 16 - (n - 1) * GAP) / n));
  }

  private cellX(i: number): number {
    const n = CHARACTER_IDS.length;
    const cw = this.cellW();
    const total = n * cw + (n - 1) * GAP;
    return Math.round((this.game.gfx.w - total) / 2) + i * (cw + GAP);
  }

  update(): void {
    const { input, audio } = this.game;
    const n = CHARACTER_IDS.length;
    this.age++;
    if (input.pressed('cancel')) {
      audio.sfx('ui_cancel');
      this.game.goto(new TitleScene(this.game));
      return;
    }
    if (input.pressed('left')) {
      this.selected = (this.selected + n - 1) % n;
      audio.sfx('ui_move');
    }
    if (input.pressed('right')) {
      this.selected = (this.selected + 1) % n;
      audio.sfx('ui_move');
    }
    let go = input.pressed('confirm');
    for (let i = 0; i < n; i++) {
      if (!input.pointed(this.cellX(i), TOP, this.cellW(), CELL_H)) continue;
      this.selected = i;
      if (input.pointer.pressed) go = true;
    }
    if (!go || this.age < 10) return;
    const id = CHARACTER_IDS[this.selected]!;
    if (!this.unlocked(id)) {
      audio.sfx('ui_deny');
      return;
    }
    audio.sfx('ui_confirm');
    this.game.goto(new RunScene(this.game, id));
  }

  draw(): void {
    const { gfx: g, tick } = this.game;
    const cx = Math.round(g.w / 2);
    this.backdrop.draw(g, tick, 0.55);
    g.print('祓い手を選べ', cx, 14, { align: 'center', color: C.gold, scale: 1.5 });

    const CELL_W = this.cellW();
    CHARACTER_IDS.forEach((id, i) => {
      const x = this.cellX(i);
      const selected = i === this.selected;
      const open = this.unlocked(id);
      const def = CHARACTERS[id];
      const y = TOP - (selected ? 4 : 0);
      panel(g, x, y, CELL_W, CELL_H, 'dark');
      if (selected) g.box(x, y, CELL_W, CELL_H, C.gold, 2);
      const sx = x + CELL_W / 2;
      const sy = y + 78;
      if (open) {
        // 選ばれている祓い手は足踏みする
        const frames = g.frameCount(`char.${id}`);
        const frame = selected && frames > 0 ? Math.floor(tick / 9) % frames : 0;
        g.spriteScaled(`char.${id}`, frame, sx, sy, 3);
        g.print(def.name, sx, y + 82, { align: 'center', color: selected ? C.gold : C.paper });
      } else {
        g.ctx.globalAlpha = 0.16;
        g.spriteScaled(`char.${id}`, 0, sx, sy, 3, false, 'flash');
        g.ctx.globalAlpha = 1;
        g.spriteScaled('ui.lock', 0, sx, y + 44, 2);
        g.print('？？？', sx, y + 82, { align: 'center', color: C.slate });
      }
    });

    // ---- 詳細
    const id = CHARACTER_IDS[this.selected]!;
    const def = CHARACTERS[id];
    const w = Math.min(g.w - 32, 500);
    const x = cx - w / 2;
    const y = 178;
    panel(g, x, y, w, 132, 'dark');
    if (this.unlocked(id)) {
      const weapon = WEAPONS[def.weapon];
      g.print(`${def.title}　${def.name}`, x + 14, y + 10, { color: C.gold });
      g.print(`体力 ${def.baseHp}`, x + w - 14, y + 10, { color: C.pale, align: 'right' });
      g.wrap(def.desc, w - 28).slice(0, 2).forEach((line, i) => g.print(line, x + 14, y + 32 + i * 17, { color: C.paper }));
      g.rect(x + 12, y + 72, w - 24, 1, C.slate);
      slot(g, x + 14, y + 82, `icon.w.${weapon.id}`);
      g.print(`初期武器　${weapon.name}`, x + 38, y + 78, { color: C.pale });
      g.wrap(weapon.desc, w - 52).slice(0, 2).forEach((line, i) => g.print(line, x + 38, y + 95 + i * 16, { color: C.dim }));
    } else {
      const rule = UNLOCKS.find((u) => u.id === id);
      g.print('まだ出会っていない祓い手', x + 14, y + 10, { color: C.slate });
      g.print('解放の条件', x + 14, y + 44, { color: C.dim });
      g.print(rule ? rule.hint : '？', x + 14, y + 64, { color: C.paper });
    }
    hint(g, '←→ 選ぶ　Enter 出陣　Esc もどる', cx, g.h - 20);
  }
}
