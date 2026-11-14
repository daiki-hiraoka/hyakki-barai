import type { AudioPort } from '../audio/port';
import { PASSIVES } from '../core/data/passives';
import { WEAPONS } from '../core/data/weapons';
import { botChoose } from '../core/bot/bot';
import { chooseUpgrade, closeChest, rerollOffer, skipOffer } from '../core/sim/upgrades';
import type { Upgrade, World } from '../core/types';
import type { Input } from '../input/input';
import type { Gfx } from '../render/gfx';
import { upgradeInfo, type UpgradeInfo } from './describe';
import { C, hint, panel, shade, slot } from './widgets';

const CARD_W = 104;
const CARD_H = 192;
const CARD_GAP = 10;
const CARD_Y = 62;
/** カードの中で、縦書きの名前に使う範囲（カード上端からの位置） */
const NAME_TOP = 70;
const NAME_BOTTOM = 170;

function kindLabel(u: Upgrade): string {
  switch (u.kind) {
    case 'weapon':
      return '武器';
    case 'passive':
      return '装身具';
    case 'evolve':
      return '覚醒';
    default:
      return '恵み';
  }
}

/** 御札の形をした選択肢カード */
function drawCard(
  g: Gfx,
  x: number,
  y: number,
  info: UpgradeInfo,
  label: string,
  selected: boolean,
  tick: number,
): void {
  if (selected) {
    // 選ばれている札は金の縁取りで浮かせる
    g.rect(x - 3, y - 3, CARD_W + 6, CARD_H + 6, C.gold);
    g.rect(x - 2, y - 2, CARD_W + 4, CARD_H + 4, C.goldDark);
  }
  panel(g, x, y, CARD_W, CARD_H, 'paper');
  // 上部の朱の帯と札
  g.rect(x + 4, y + 4, CARD_W - 8, 20, info.tag === '覚醒' ? C.goldDark : C.vermilion);
  g.rect(x + 4, y + 23, CARD_W - 8, 1, C.crimson);
  if (info.tag) g.print(info.tag, x + CARD_W / 2, y + 6, { align: 'center', color: C.paper, outline: C.crimson });

  // 朱印の円にアイコン
  const cx = x + CARD_W / 2;
  g.disc(cx, y + 47, 20, C.vermilion);
  g.disc(cx, y + 47, 18, '#fbf6ea');
  g.spriteScaled(info.icon, 0, cx, y + 47, 2);

  // 縦書きの名前。3 文字までは大きく書く。名前の欄（NAME_TOP〜NAME_BOTTOM）の中央に置く
  const chars = Array.from(info.name);
  const scale = chars.length <= 3 ? 2 : 1;
  const advance = 16;
  const total = chars.length * advance * scale;
  const top = y + NAME_TOP + Math.max(0, (NAME_BOTTOM - NAME_TOP - total) / 2);
  g.printVertical(info.name, cx, top, { color: C.ink, outline: null, scale }, advance);

  g.print(label, cx, y + CARD_H - 21, { align: 'center', color: C.paperDark, outline: null });
  if (selected && (tick >> 4) % 2 === 0) g.sprite('ui.cursor', 0, x - 9, y + CARD_H / 2);
}

/** 選択肢の詳しい説明（カードの下に出す） */
function drawDetail(g: Gfx, world: World, u: Upgrade, y: number): void {
  const w = Math.min(g.w - 40, 460);
  const x = Math.round((g.w - w) / 2);
  panel(g, x, y, w, 58, 'dark');
  const info = upgradeInfo(u);
  g.sprite(info.icon, 0, x + 18, y + 18);
  g.print(info.name, x + 32, y + 9, { color: C.gold });
  let sub = '';
  if (u.kind === 'weapon') {
    const def = WEAPONS[u.id];
    sub = u.isNew ? '新しい武器' : `Lv${u.level - 1} → Lv${u.level}（最大 ${def.maxLevel}）`;
  } else if (u.kind === 'passive') {
    const def = PASSIVES[u.id];
    sub = u.isNew ? '新しい装身具' : `Lv${u.level - 1} → Lv${u.level}（最大 ${def.maxLevel}）`;
    // この装身具で覚醒する武器を持っていれば知らせる
    const partner = world.player.weapons.find((wpn) => wpn.def.requires === u.id);
    if (partner) sub += `　${partner.def.name}の覚醒に必要`;
  } else if (u.kind === 'evolve') {
    sub = `${WEAPONS[u.from].name} が覚醒`;
  }
  if (sub) g.print(sub, x + w - 10, y + 9, { color: C.dim, align: 'right' });
  const lines = g.wrap(info.desc, w - 24);
  lines.slice(0, 2).forEach((line, i) => g.print(line, x + 12, y + 30 + i * 16 - (lines.length > 1 ? 4 : 0), { color: C.paper }));
}

// ---------------------------------------------------------------------------
// レベルアップ
// ---------------------------------------------------------------------------

export class LevelUpPanel {
  private selected = 0;
  private age = 0;
  private offer: Upgrade[] | null = null;

  private layout(g: Gfx, n: number): number {
    return Math.round((g.w - (n * CARD_W + (n - 1) * CARD_GAP)) / 2);
  }

  /** 選び終えたら true */
  update(world: World, input: Input, audio: AudioPort, g: Gfx, auto: boolean): boolean {
    const offer = world.offer;
    if (!offer) return false;
    if (offer !== this.offer) {
      this.offer = offer;
      this.selected = 0;
      this.age = 0;
    }
    this.age++;
    if (auto) {
      if (this.age < 20) return false;
      chooseUpgrade(world, botChoose(world));
      return true;
    }
    // 開いた直後の押しっぱなしで誤って選ばないよう、少しだけ待つ
    if (this.age < 14) return false;

    const n = offer.length;
    if (input.pressed('left') || input.pressed('up')) {
      this.selected = (this.selected + n - 1) % n;
      audio.sfx('ui_move');
    }
    if (input.pressed('right') || input.pressed('down')) {
      this.selected = (this.selected + 1) % n;
      audio.sfx('ui_move');
    }
    const x0 = this.layout(g, n);
    let choice = -1;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (CARD_W + CARD_GAP);
      if (input.pointed(x, CARD_Y - 8, CARD_W, CARD_H + 8)) {
        this.selected = i;
        if (input.pointer.pressed) choice = i;
      }
    }
    const keys = ['n1', 'n2', 'n3', 'n4'] as const;
    keys.forEach((key, i) => {
      if (i < n && input.pressed(key)) choice = i;
    });
    if (input.pressed('confirm')) choice = this.selected;

    if (choice >= 0) {
      audio.sfx('ui_confirm');
      chooseUpgrade(world, choice);
      return true;
    }
    if (input.pressed('reroll')) {
      if (rerollOffer(world)) audio.sfx('ui_confirm');
      else audio.sfx('ui_deny');
    } else if (input.pressed('skip')) {
      if (skipOffer(world)) {
        audio.sfx('ui_cancel');
        return true;
      }
      audio.sfx('ui_deny');
    }
    return false;
  }

  draw(g: Gfx, world: World, tick: number): void {
    const offer = world.offer;
    if (!offer) return;
    const n = offer.length;
    shade(g, 0.6);
    const cx = g.w / 2;
    g.print('霊力が満ちた', cx, 10, { align: 'center', color: C.gold, scale: 1.5 });
    g.print(`Lv ${world.player.level}　御札を一枚選べ`, cx, 36, { align: 'center', color: C.pale });

    const x0 = this.layout(g, n);
    // 札が上から滑り落ちてくる
    const drop = Math.max(0, 14 - this.age) * 3;
    offer.forEach((u, i) => {
      const x = x0 + i * (CARD_W + CARD_GAP);
      const selected = i === this.selected;
      const y = CARD_Y - drop - (selected ? 6 : 0);
      drawCard(g, x, y, upgradeInfo(u), kindLabel(u), selected, tick);
      // 数字キーで直接選べることを、帯の左端に小さく示す
      g.num(String(i + 1), x + 8, y + 10, C.paper, 1, 'left');
    });

    const pick = offer[this.selected];
    if (pick) drawDetail(g, world, pick, CARD_Y + CARD_H + 8);

    const p = world.player;
    const parts = ['←→ 選ぶ', 'Enter 決定'];
    if (p.rerollsLeft > 0) parts.push(`R 振り直し(${p.rerollsLeft})`);
    if (p.skipsLeft > 0) parts.push(`X 見送り(${p.skipsLeft})`);
    hint(g, parts.join('　'), cx, g.h - 20);
  }
}

// ---------------------------------------------------------------------------
// つづら
// ---------------------------------------------------------------------------

/** つづらが開くまでの tick と、中身が 1 つずつ出る間隔 */
const CHEST_OPEN = 38;
const CHEST_STEP = 28;

export class ChestPanel {
  private age = 0;
  private revealed = 0;
  private active = false;

  /** 閉じたら true */
  update(world: World, input: Input, audio: AudioPort, auto: boolean): boolean {
    const chest = world.chest;
    if (!chest) return false;
    if (!this.active) {
      this.active = true;
      this.age = 0;
      this.revealed = 0;
    }
    this.age++;
    const total = chest.items.length;
    if (this.age === CHEST_OPEN) audio.sfx('chest_open');
    const due = Math.min(total, Math.floor((this.age - CHEST_OPEN - 14) / CHEST_STEP) + 1);
    if (this.age > CHEST_OPEN + 14 && due > this.revealed) {
      this.revealed = due;
      const item = chest.items[due - 1]!;
      audio.sfx(item.kind === 'evolve' ? 'evolve' : 'chest_item');
    }
    const done = this.revealed >= total && this.age > CHEST_OPEN + 14 + total * CHEST_STEP;
    const go = input.anyConfirm() || (auto && done && this.age > CHEST_OPEN + 60 + total * CHEST_STEP);
    if (!go) return false;
    if (!done) {
      // 途中で押したら、演出を飛ばして全部見せる
      this.revealed = total;
      this.age = CHEST_OPEN + 20 + total * CHEST_STEP;
      return false;
    }
    this.active = false;
    audio.sfx('ui_confirm');
    closeChest(world);
    return true;
  }

  draw(g: Gfx, world: World, tick: number): void {
    const chest = world.chest;
    if (!chest) return;
    const ctx = g.ctx;
    shade(g, 0.68);
    const cx = Math.round(g.w / 2);
    const cy = 126;
    const opened = this.age >= CHEST_OPEN;

    if (opened) {
      // あふれ出す光
      const rays = 12;
      const t = tick * 0.02;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < rays; i++) {
        const a = t + (i / rays) * Math.PI * 2;
        const len = 80 + Math.sin(tick * 0.1 + i * 2) * 14;
        g.line(cx, cy - 16, cx + Math.cos(a) * len, cy - 16 + Math.sin(a) * len, i % 2 ? C.gold : '#fff3b0', 2);
      }
      ctx.globalAlpha = 1;
    }
    // 開く前はがたがた揺れる
    const rattle = opened ? 0 : Math.round(Math.sin(this.age * 0.9) * Math.min(3, this.age / 10));
    const fall = Math.max(0, 12 - this.age) * 6;
    g.spriteScaled('item.chest', opened ? 1 : 0, cx + rattle, cy + 22 - fall, 3);

    g.print(opened ? 'つづらが開いた' : 'つづらを見つけた', cx, 34, { align: 'center', color: C.gold, scale: 1.5 });

    // 中身
    const n = chest.items.length;
    // 画面の幅に収まるよう、中身の数に応じて札の幅を決める
    const gap = Math.min(112, Math.floor((g.w - 16) / n));
    const cardW = gap - 6;
    const x0 = cx - ((n - 1) * gap) / 2;
    for (let i = 0; i < this.revealed; i++) {
      const info = upgradeInfo(chest.items[i]!);
      const x = Math.round(x0 + i * gap);
      const y = 196;
      const evolve = chest.items[i]!.kind === 'evolve';
      panel(g, x - cardW / 2, y, cardW, 84, 'paper');
      if (evolve) g.box(x - cardW / 2 - 1, y - 1, cardW + 2, 86, C.gold, 2);
      g.spriteScaled(info.icon, 0, x, y + 26, 2);
      g.print(info.tag, x, y + 46, { align: 'center', color: evolve ? C.goldDark : C.vermilion, outline: null });
      // 札に収まらない長い名前だけ、末尾を省く
      let name = info.name;
      while (name.length > 1 && g.text.width(name) > cardW - 8) name = `${Array.from(name).slice(0, -2).join('')}…`;
      g.print(name, x, y + 62, { align: 'center', color: C.ink, outline: null });
    }

    if (this.revealed >= n) {
      g.sprite('item.coin', 0, cx - 30, 300);
      g.num(`+${chest.gold}`, cx - 20, 296, C.gold, 2);
      if ((tick >> 4) % 2 === 0) hint(g, 'Enter でつづける', cx, g.h - 22);
    }
  }
}

// ---------------------------------------------------------------------------
// 一時停止
// ---------------------------------------------------------------------------

export type PauseResult = 'none' | 'resume' | 'quit';

export class PausePanel {
  private selected = 0;

  update(input: Input, audio: AudioPort, g: Gfx): PauseResult {
    const items = this.items(g);
    if (input.pressed('up') || input.pressed('down')) {
      this.selected = 1 - this.selected;
      audio.sfx('ui_move');
    }
    let choice = -1;
    items.forEach((it, i) => {
      if (input.pointed(it.x, it.y, it.w, it.h)) {
        this.selected = i;
        if (input.pointer.pressed) choice = i;
      }
    });
    if (input.pressed('confirm')) choice = this.selected;
    if (input.pressed('pause') || input.pressed('cancel')) choice = 0;
    if (choice === 0) {
      this.selected = 0;
      return 'resume';
    }
    if (choice === 1) {
      this.selected = 0;
      return 'quit';
    }
    return 'none';
  }

  private items(g: Gfx): Array<{ x: number; y: number; w: number; h: number; label: string }> {
    const x = Math.round(g.w / 2 - 70);
    return [
      { x, y: 268, w: 140, h: 22, label: 'つづける' },
      { x, y: 294, w: 140, h: 22, label: 'あきらめる' },
    ];
  }

  draw(g: Gfx, world: World, tick: number): void {
    shade(g, 0.62);
    const cx = Math.round(g.w / 2);
    const w = Math.min(g.w - 32, 440);
    const x = cx - w / 2;
    panel(g, x, 30, w, 226, 'dark');
    g.print('一時停止', cx, 38, { align: 'center', color: C.gold, scale: 1.5 });

    const p = world.player;
    g.print(`${p.char.title} ${p.char.name}　Lv ${p.level}`, x + 14, 68, { color: C.pale });

    // 装備の一覧
    let y = 90;
    g.print('武器', x + 14, y, { color: C.dim });
    p.weapons.forEach((wpn, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ix = x + 72 + col * ((w - 86) / 2);
      const iy = y + row * 22 - 2;
      slot(g, ix, iy, `icon.w.${wpn.def.id}`);
      const lv = wpn.def.evolved ? '覚醒' : `Lv${wpn.level}`;
      g.print(`${wpn.def.name} ${lv}`, ix + 22, iy + 1, { color: wpn.def.evolved ? C.gold : C.paper });
    });
    y += Math.max(1, Math.ceil(p.weapons.length / 2)) * 22 + 6;
    g.print('装身具', x + 14, y, { color: C.dim });
    p.passives.forEach((ps, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const ix = x + 72 + col * ((w - 86) / 2);
      const iy = y + row * 22 - 2;
      slot(g, ix, iy, `icon.p.${ps.def.id}`);
      g.print(`${ps.def.name} Lv${ps.level}`, ix + 22, iy + 1, { color: C.paper });
    });
    if (p.passives.length === 0) g.print('まだ無い', x + 72, y, { color: C.slate });

    this.items(g).forEach((it, i) => {
      const selected = i === this.selected;
      panel(g, it.x, it.y, it.w, it.h, 'dark');
      if (selected) g.box(it.x, it.y, it.w, it.h, C.gold);
      g.print(it.label, it.x + it.w / 2, it.y + 3, { align: 'center', color: selected ? C.gold : C.pale });
      if (selected && (tick >> 4) % 2 === 0) g.sprite('ui.cursor', 0, it.x - 8, it.y + 11);
    });
    hint(g, 'Esc でつづける', cx, g.h - 20);
  }
}
