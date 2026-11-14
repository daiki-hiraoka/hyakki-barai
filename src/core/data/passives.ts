import type { PassiveDef, PassiveId } from '../types';

/** 装身具。持っているだけで能力値が上がり、対応する武器の覚醒条件にもなる */
export const PASSIVES: Record<PassiveId, PassiveDef> = {
  fude: { id: 'fude', name: '筆', desc: '弾数 +1', maxLevel: 2, perLevel: { amount: 1 } },
  kazakiri: { id: 'kazakiri', name: '風切羽', desc: '弾速 +10%', maxLevel: 5, perLevel: { projSpeed: 0.1 } },
  daruma: { id: 'daruma', name: 'だるま', desc: '最大体力 +20%', maxLevel: 5, perLevel: { hp: 0.2 } },
  senko: { id: 'senko', name: '線香', desc: '効果時間 +10%', maxLevel: 5, perLevel: { duration: 0.1 } },
  ogi: { id: 'ogi', name: '扇', desc: '攻撃範囲 +10%', maxLevel: 5, perLevel: { area: 0.1 } },
  inro: { id: 'inro', name: '印籠', desc: '毎秒 体力を 0.25 回復', maxLevel: 5, perLevel: { regen: 0.25 } },
  magatama: { id: 'magatama', name: '勾玉', desc: '攻撃力 +10%', maxLevel: 5, perLevel: { might: 0.1 } },
  waraji: { id: 'waraji', name: '草鞋', desc: '移動速度 +8%', maxLevel: 5, perLevel: { moveSpeed: 0.08 } },
  kyokan: { id: 'kyokan', name: '経巻', desc: '冷却時間 -7%', maxLevel: 5, perLevel: { cooldown: -0.07 } },
  hotaru: { id: 'hotaru', name: '蛍籠', desc: '取得範囲 +30%', maxLevel: 5, perLevel: { magnet: 0.3 } },
  domaru: { id: 'domaru', name: '胴丸', desc: '被ダメージ -1', maxLevel: 5, perLevel: { armor: 1 } },
  maneki: { id: 'maneki', name: '招き猫', desc: '運 +15%', maxLevel: 5, perLevel: { luck: 0.15 } },
};
