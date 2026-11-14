import { CHARACTERS } from '../../core/data/characters';
import { ENEMIES } from '../../core/data/enemies';
import { WEAPONS } from '../../core/data/weapons';
import { applyRun, type RunSummary } from '../../core/meta/save';
import type { CharacterId, WeaponId, World } from '../../core/types';
import { Backdrop } from '../../ui/backdrop';
import { formatTime } from '../../ui/describe';
import { C, hint, panel, slot } from '../../ui/widgets';
import type { Game, Scene } from '../game';
import { TitleScene } from './title';

interface Row {
  id: WeaponId;
  damage: number;
  dps: number;
}

/** 一夜の結果 */
export class ResultScene implements Scene {
  private readonly backdrop = new Backdrop();
  private readonly unlocked: CharacterId[];
  private readonly rows: Row[];
  private age = 0;

  constructor(
    private readonly game: Game,
    private readonly summary: RunSummary,
    world: World,
  ) {
    // 結果はここで一度だけセーブへ反映する
    this.unlocked = applyRun(game.save, summary).unlocked;
    game.persist();

    this.rows = (Object.keys(world.run.damage) as WeaponId[])
      .map((id) => {
        const damage = world.run.damage[id] ?? 0;
        const held = Math.max(1, summary.time - (world.run.acquiredAt[id] ?? 0));
        return { id, damage, dps: damage / held };
      })
      .sort((a, b) => b.damage - a.damage)
      .slice(0, 7);
  }

  update(): void {
    const { input, audio } = this.game;
    this.age++;
    if (this.age > 40 && (input.anyConfirm() || input.pressed('cancel'))) {
      audio.sfx('ui_confirm');
      this.game.goto(new TitleScene(this.game));
    }
  }

  draw(): void {
    const { gfx: g, tick } = this.game;
    const s = this.summary;
    const cx = Math.round(g.w / 2);
    this.backdrop.draw(g, tick, 0.6);

    g.print(s.victory ? '夜明け' : '力尽きた', cx, 12, {
      align: 'center',
      color: s.victory ? C.gold : C.danger,
      scale: 2,
    });

    const w = Math.min(g.w - 24, 592);
    const x = cx - w / 2;
    const leftW = 214;

    // ---- 左：祓い手と成績
    panel(g, x, 54, leftW, 232, 'dark');
    const char = CHARACTERS[s.character];
    g.spriteScaled(`char.${s.character}`, 0, x + 42, 140, 3);
    g.print(char.title, x + 84, 74, { color: C.dim });
    g.print(char.name, x + 84, 92, { color: C.gold, scale: 1.5 });

    const lines: Array<[string, string, string]> = [
      ['生き延びた時間', formatTime(s.time), C.paper],
      ['祓った妖怪', String(s.kills), C.paper],
      ['到達レベル', String(s.level), C.paper],
      ['持ち帰った小判', `+${s.gold}`, C.gold],
    ];
    lines.forEach(([label, value, color], i) => {
      const y = 158 + i * 22;
      g.print(label, x + 14, y, { color: C.pale });
      g.num(value, x + leftW - 14, y + 4, color, 1, 'right');
    });
    if (s.bossKills.length > 0) {
      g.print('討った大妖', x + 14, 248, { color: C.pale });
      const names = s.bossKills.map((id) => ENEMIES[id].name).join('・');
      g.wrap(names, leftW - 28).slice(0, 1).forEach((line) => g.print(line, x + 14, 265, { color: C.danger }));
    }

    // ---- 右：武器ごとの与ダメージ
    const rx = x + leftW + 8;
    const rw = w - leftW - 8;
    panel(g, rx, 54, rw, 232, 'dark');
    g.print('武器', rx + 14, 62, { color: C.dim });
    g.print('与えた痛手', rx + rw - 84, 62, { color: C.dim, align: 'right' });
    g.print('毎秒', rx + rw - 14, 62, { color: C.dim, align: 'right' });
    g.rect(rx + 12, 81, rw - 24, 1, C.slate);
    const top = this.rows[0]?.damage ?? 1;
    this.rows.forEach((row, i) => {
      const y = 88 + i * 27;
      const def = WEAPONS[row.id];
      slot(g, rx + 12, y, `icon.w.${row.id}`);
      g.print(def.name, rx + 36, y + 1, { color: def.evolved ? C.gold : C.paper });
      g.num(String(Math.round(row.damage)), rx + rw - 84, y + 5, C.paper, 1, 'right');
      g.num(row.dps.toFixed(1), rx + rw - 14, y + 5, C.cyan, 1, 'right');
      // いちばん働いた武器を基準にした横棒
      const bw = Math.round((rw - 60) * (row.damage / Math.max(1, top)));
      g.rect(rx + 36, y + 19, bw, 2, def.evolved ? C.goldDark : C.slate);
    });
    if (this.rows.length === 0) g.print('一太刀も浴びせられなかった', rx + 14, 96, { color: C.slate });

    // ---- 新しく加わった祓い手
    if (this.unlocked.length > 0 && (tick >> 4) % 4 !== 0) {
      const names = this.unlocked.map((id) => `${CHARACTERS[id].title} ${CHARACTERS[id].name}`).join('、');
      g.print(`新たな祓い手　${names}　が加わった`, cx, 294, { align: 'center', color: C.gold });
    }
    if (this.age > 40 && (tick >> 4) % 2 === 0) hint(g, 'Enter でタイトルへ', cx, g.h - 20);
  }
}
