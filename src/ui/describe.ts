import { PASSIVES } from '../core/data/passives';
import { WEAPONS } from '../core/data/weapons';
import type { Upgrade, WeaponStats } from '../core/types';

/** 選択肢や一覧に出すための、強化 1 件の見せ方 */
export interface UpgradeInfo {
  icon: string;
  name: string;
  /** 「新」「Lv3」「覚醒」などの札 */
  tag: string;
  desc: string;
}

/** 小数の誤差を消して、余分な 0 を付けない */
function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

const signed = (value: number): string => (value > 0 ? `+${trim(value)}` : trim(value));
const percent = (value: number): string => `${value > 0 ? '+' : ''}${Math.round(value * 100)}%`;

/** 表示する順番と書き方 */
const DELTA_TEXT: Array<[keyof WeaponStats, (v: number) => string]> = [
  ['damage', (v) => `威力 ${signed(v)}`],
  ['amount', (v) => `数 ${signed(v)}`],
  ['pierce', (v) => `貫通 ${signed(v)}`],
  ['cooldown', (v) => `冷却 ${signed(v)}秒`],
  ['area', (v) => `範囲 ${percent(v)}`],
  ['speed', (v) => `速さ ${percent(v)}`],
  ['duration', (v) => `効果 ${signed(v)}秒`],
  ['interval', (v) => `間隔 ${signed(v)}秒`],
  ['crit', (v) => `会心 ${percent(v)}`],
  ['knockback', (v) => `吹き飛ばし ${signed(v)}`],
];

/** 武器のレベルアップで増える分を、短い日本語にする */
export function describeDelta(delta: Partial<WeaponStats>): string {
  const parts: string[] = [];
  for (const [key, format] of DELTA_TEXT) {
    const value = delta[key];
    if (value !== undefined && value !== 0) parts.push(format(value));
  }
  return parts.join('／');
}

export function upgradeInfo(u: Upgrade): UpgradeInfo {
  switch (u.kind) {
    case 'weapon': {
      const def = WEAPONS[u.id];
      return {
        icon: `icon.w.${u.id}`,
        name: def.name,
        tag: u.isNew ? '新' : `Lv${u.level}`,
        desc: u.isNew ? def.desc : describeDelta(def.levels[u.level - 2] ?? {}),
      };
    }
    case 'passive': {
      const def = PASSIVES[u.id];
      return { icon: `icon.p.${u.id}`, name: def.name, tag: u.isNew ? '新' : `Lv${u.level}`, desc: def.desc };
    }
    case 'evolve': {
      const def = WEAPONS[u.id];
      return { icon: `icon.w.${u.id}`, name: def.name, tag: '覚醒', desc: def.desc };
    }
    case 'gold':
      return { icon: 'icon.x.gold', name: '小判袋', tag: '', desc: `小判 ${u.amount} 枚` };
    case 'heal':
      return { icon: 'icon.x.heal', name: 'おにぎり', tag: '', desc: `体力を ${u.amount} 回復` };
  }
}

/** 秒を mm:ss にする */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}
