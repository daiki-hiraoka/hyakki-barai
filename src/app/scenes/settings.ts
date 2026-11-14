import type { Settings } from '../../core/meta/save';
import { Backdrop } from '../../ui/backdrop';
import { C, hint, panel } from '../../ui/widgets';
import type { Game, Scene } from '../game';
import { TitleScene } from './title';

type Row =
  | { kind: 'volume'; key: 'bgm' | 'sfx'; label: string }
  | { kind: 'toggle'; key: 'shake' | 'damageNumbers'; label: string }
  | { kind: 'back'; label: string };

const ROWS: Row[] = [
  { kind: 'volume', key: 'bgm', label: '音楽の音量' },
  { kind: 'volume', key: 'sfx', label: '効果音の音量' },
  { kind: 'toggle', key: 'shake', label: '画面の揺れ' },
  { kind: 'toggle', key: 'damageNumbers', label: 'ダメージ数字' },
  { kind: 'back', label: 'もどる' },
];

const ROW_H = 30;
const TOP = 88;

export class SettingsScene implements Scene {
  private readonly backdrop = new Backdrop();
  private selected = 0;
  private age = 0;

  constructor(private readonly game: Game) {}

  private rowRect(i: number): { x: number; y: number; w: number; h: number } {
    const w = Math.min(this.game.gfx.w - 40, 380);
    return { x: Math.round((this.game.gfx.w - w) / 2), y: TOP + i * ROW_H, w, h: ROW_H - 4 };
  }

  private back(): void {
    this.game.persist();
    this.game.goto(new TitleScene(this.game));
  }

  update(): void {
    const { input, audio } = this.game;
    const settings: Settings = this.game.save.settings;
    this.age++;
    if (input.pressed('cancel')) {
      audio.sfx('ui_cancel');
      this.back();
      return;
    }
    if (input.pressed('up')) {
      this.selected = (this.selected + ROWS.length - 1) % ROWS.length;
      audio.sfx('ui_move');
    }
    if (input.pressed('down')) {
      this.selected = (this.selected + 1) % ROWS.length;
      audio.sfx('ui_move');
    }
    let click = false;
    ROWS.forEach((_, i) => {
      const r = this.rowRect(i);
      if (!input.pointed(r.x, r.y, r.w, r.h)) return;
      this.selected = i;
      if (input.pointer.pressed) click = true;
    });

    const row = ROWS[this.selected]!;
    const left = input.pressed('left');
    const right = input.pressed('right');
    const confirm = (input.pressed('confirm') || click) && this.age > 10;

    if (row.kind === 'volume') {
      let v = Math.round(settings[row.key] * 10);
      if (left) v--;
      if (right || confirm) v = confirm && v >= 10 ? 0 : v + 1;
      v = Math.max(0, Math.min(10, v));
      if (v !== Math.round(settings[row.key] * 10)) {
        settings[row.key] = v / 10;
        this.game.applyAudioSettings();
        audio.sfx(row.key === 'sfx' ? 'gem' : 'ui_move');
      }
    } else if (row.kind === 'toggle') {
      if (left || right || confirm) {
        settings[row.key] = !settings[row.key];
        audio.sfx('ui_confirm');
      }
    } else if (confirm) {
      audio.sfx('ui_confirm');
      this.back();
    }
  }

  draw(): void {
    const { gfx: g, tick, save } = this.game;
    const cx = Math.round(g.w / 2);
    this.backdrop.draw(g, tick, 0.62);
    g.print('設定', cx, 30, { align: 'center', color: C.gold, scale: 1.5 });

    ROWS.forEach((row, i) => {
      const r = this.rowRect(i);
      const selected = i === this.selected;
      panel(g, r.x, r.y, r.w, r.h, 'dark');
      if (selected) {
        g.box(r.x, r.y, r.w, r.h, C.gold);
        if ((tick >> 4) % 2 === 0) g.sprite('ui.cursor', 0, r.x - 8, r.y + r.h / 2);
      }
      const color = selected ? C.gold : C.pale;
      if (row.kind === 'back') {
        g.print(row.label, cx, r.y + 5, { align: 'center', color });
        return;
      }
      g.print(row.label, r.x + 12, r.y + 5, { color });
      if (row.kind === 'volume') {
        const level = Math.round(save.settings[row.key] * 10);
        for (let k = 0; k < 10; k++) {
          const bx = r.x + r.w - 12 - (10 - k) * 11;
          g.rect(bx, r.y + 8, 9, 10, C.ink);
          g.rect(bx + 1, r.y + 9, 7, 8, k < level ? C.gold : C.night2);
        }
      } else {
        const on = save.settings[row.key];
        g.print(on ? '入' : '切', r.x + r.w - 14, r.y + 5, { align: 'right', color: on ? C.green : C.slate });
      }
    });
    hint(g, '↑↓ 選ぶ　←→ 変える　Esc もどる', cx, g.h - 20);
  }
}
