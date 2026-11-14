import type { ShopDef, ShopId } from '../types';

/** 社の加護（小判で買う永続強化） */
export const SHOP: Record<ShopId, ShopDef> = {
  might: { id: 'might', name: '攻めの加護', desc: '攻撃力 +5%', maxRank: 5, baseCost: 200, perRank: { might: 0.05 } },
  hp: { id: 'hp', name: '命の加護', desc: '最大体力 +10%', maxRank: 3, baseCost: 200, perRank: { hp: 0.1 } },
  regen: { id: 'regen', name: '癒しの加護', desc: '毎秒 体力を 0.1 回復', maxRank: 5, baseCost: 200, perRank: { regen: 0.1 } },
  armor: { id: 'armor', name: '守りの加護', desc: '被ダメージ -1', maxRank: 3, baseCost: 600, perRank: { armor: 1 } },
  moveSpeed: { id: 'moveSpeed', name: '韋駄天の加護', desc: '移動速度 +5%', maxRank: 2, baseCost: 300, perRank: { moveSpeed: 0.05 } },
  cooldown: { id: 'cooldown', name: '神速の加護', desc: '冷却時間 -2.5%', maxRank: 2, baseCost: 900, perRank: { cooldown: -0.025 } },
  area: { id: 'area', name: '広がりの加護', desc: '攻撃範囲 +5%', maxRank: 2, baseCost: 300, perRank: { area: 0.05 } },
  amount: { id: 'amount', name: '数の加護', desc: '弾数 +1', maxRank: 1, baseCost: 4000, perRank: { amount: 1 } },
  magnet: { id: 'magnet', name: '招きの加護', desc: '取得範囲 +25%', maxRank: 2, baseCost: 300, perRank: { magnet: 0.25 } },
  luck: { id: 'luck', name: '福の加護', desc: '運 +10%', maxRank: 3, baseCost: 600, perRank: { luck: 0.1 } },
  growth: { id: 'growth', name: '学びの加護', desc: '経験値 +3%', maxRank: 5, baseCost: 500, perRank: { growth: 0.03 } },
  greed: { id: 'greed', name: '商いの加護', desc: '小判 +10%', maxRank: 5, baseCost: 200, perRank: { greed: 0.1 } },
  revives: { id: 'revives', name: '身代わり人形', desc: '力尽きても一度だけ蘇る', maxRank: 1, baseCost: 5000, perRank: { revives: 1 } },
  rerolls: { id: 'rerolls', name: '振り直し', desc: '選択肢を引き直せる回数 +1', maxRank: 3, baseCost: 600, perRank: { rerolls: 1 } },
  skips: { id: 'skips', name: '見送り', desc: '選択肢を見送れる回数 +1', maxRank: 3, baseCost: 150, perRank: { skips: 1 } },
};
