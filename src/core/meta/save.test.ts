import { describe, expect, it } from 'vitest';
import type { SaveStorage } from '../ports';
import {
  SAVE_KEY,
  applyRun,
  buy,
  defaultSave,
  loadSave,
  refundAll,
  shopCost,
  storeSave,
  type RunSummary,
} from './save';

class MemoryStorage implements SaveStorage {
  readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

const summary = (over: Partial<RunSummary> = {}): RunSummary => ({
  character: 'haruma',
  time: 120,
  kills: 100,
  level: 8,
  gold: 50,
  bossKills: [],
  victory: false,
  ...over,
});

describe('セーブの読み書き', () => {
  it('何も無ければ初期値を返す（晴真と千早が使える）', () => {
    const save = loadSave(new MemoryStorage());
    expect(save).toEqual(defaultSave());
    expect(save.unlocked).toEqual(['haruma', 'chihaya']);
    expect(save.gold).toBe(0);
  });

  it('保存したものを読み戻せる', () => {
    const storage = new MemoryStorage();
    const save = defaultSave();
    save.gold = 321;
    save.shop.might = 2;
    save.settings.bgm = 0.3;
    storeSave(storage, save);
    expect(loadSave(storage)).toEqual(save);
  });

  it('壊れたデータは初期値に戻す', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{ not json');
    expect(loadSave(storage)).toEqual(defaultSave());
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 999, gold: 'たくさん' }));
    expect(loadSave(storage)).toEqual(defaultSave());
  });

  it('おかしな値は捨て、使える部分だけ引き継ぐ', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      SAVE_KEY,
      JSON.stringify({
        version: 1,
        gold: 500.7,
        shop: { might: 99, nope: 3, hp: -2 },
        unlocked: ['kon', 'だれか'],
        settings: { bgm: 5, sfx: 'x', shake: false },
      }),
    );
    const save = loadSave(storage);
    expect(save.gold).toBe(500);
    // ランクは上限まで。知らない項目や負の値は捨てる
    expect(save.shop).toEqual({ might: 5 });
    // 初期の 2 人は必ず含む
    expect(save.unlocked).toEqual(['haruma', 'chihaya', 'kon']);
    expect(save.settings.bgm).toBe(1);
    expect(save.settings.sfx).toBe(defaultSave().settings.sfx);
    expect(save.settings.shake).toBe(false);
  });

  it('保存先が例外を投げても落ちない', () => {
    const broken: SaveStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
    };
    expect(loadSave(broken)).toEqual(defaultSave());
    expect(() => storeSave(broken, defaultSave())).not.toThrow();
  });
});

describe('社の加護', () => {
  it('値段はランクが上がるほど高くなる', () => {
    expect(shopCost('might', 0)).toBe(200);
    expect(shopCost('might', 1)).toBeGreaterThan(shopCost('might', 0));
    expect(shopCost('might', 4)).toBeGreaterThan(shopCost('might', 3));
  });

  it('小判が足りれば買え、足りなければ買えない', () => {
    const save = defaultSave();
    save.gold = 250;
    expect(buy(save, 'might')).toBe(true);
    expect(save.gold).toBe(50);
    expect(save.shop.might).toBe(1);
    expect(buy(save, 'might')).toBe(false);
    expect(save.shop.might).toBe(1);
  });

  it('最大ランクを超えては買えない', () => {
    const save = defaultSave();
    save.gold = 1e9;
    expect(buy(save, 'amount')).toBe(true);
    expect(buy(save, 'amount')).toBe(false);
    expect(save.shop.amount).toBe(1);
  });

  it('払い戻すと、使った小判が全額戻る', () => {
    const save = defaultSave();
    save.gold = 5000;
    buy(save, 'might');
    buy(save, 'might');
    buy(save, 'hp');
    const spent = 5000 - save.gold;
    expect(refundAll(save)).toBe(spent);
    expect(save.gold).toBe(5000);
    expect(save.shop).toEqual({});
  });
});

describe('一夜の結果の反映', () => {
  it('小判と通算の記録が加算される', () => {
    const save = defaultSave();
    applyRun(save, summary({ gold: 80, kills: 300, time: 200 }));
    applyRun(save, summary({ gold: 20, kills: 100, time: 90 }));
    expect(save.gold).toBe(100);
    expect(save.stats.runs).toBe(2);
    expect(save.stats.kills).toBe(400);
    expect(save.stats.bestTime).toBe(200);
  });

  it('条件を満たすと祓い手が解放され、新しく解放された分が返る', () => {
    const save = defaultSave();
    expect(applyRun(save, summary({ time: 299 })).unlocked).toEqual([]);
    expect(applyRun(save, summary({ time: 300 })).unlocked).toEqual(['goukai']);
    // 同じ条件をもう一度満たしても、二重には返らない
    expect(applyRun(save, summary({ time: 400 })).unlocked).toEqual([]);
    expect(applyRun(save, summary({ kills: 1500 })).unlocked).toEqual(['kon']);
    expect(applyRun(save, summary({ bossKills: ['kanabo'] })).unlocked).toEqual(['jubei']);
    const last = applyRun(save, summary({ victory: true, time: 1200 }));
    expect(last.unlocked).toEqual(['enku']);
    expect(save.stats.dawns).toBe(1);
    expect(save.unlocked).toEqual(['haruma', 'chihaya', 'goukai', 'kon', 'jubei', 'enku']);
  });
});
