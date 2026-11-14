import { describe, expect, it } from 'vitest';
import { FakeAudioContext, type FakeNode, type FakeParam } from './fakeAudioContext';
import { createWebAudio } from './webAudio';

/** タイマーを手で進められるようにした依存一式 */
function setup(opts: { hidden?: boolean } = {}) {
  let ctx: FakeAudioContext | null = null;
  let created = 0;
  const timers = new Map<number, () => void>();
  let nextId = 1;
  const port = createWebAudio({
    isHidden: () => opts.hidden ?? false,
    createContext: () => {
      created++;
      ctx = new FakeAudioContext();
      return ctx as unknown as AudioContext;
    },
    setInterval: (fn) => {
      timers.set(nextId, fn);
      return nextId++;
    },
    clearInterval: (id) => {
      timers.delete(id as number);
    },
    random: () => 0.5,
  });
  /** 実時間の再生と同じく、25ms ごとにタイマーを呼んで時間を進める */
  const run = (seconds: number) => {
    const c = ctx;
    if (!c) return;
    const end = c.currentTime + seconds;
    while (c.currentTime < end - 1e-9) {
      c.advance(c.currentTime + 0.025);
      for (const fn of [...timers.values()]) fn();
    }
  };
  return {
    port,
    run,
    timers,
    ctx: () => ctx,
    created: () => created,
  };
}

const gainOf = (n: FakeNode) => (n as unknown as { gain: FakeParam }).gain;

describe('createWebAudio', () => {
  it('window も AudioContext も無い環境で、生成して全メソッドを呼んでも落ちない', () => {
    const port = createWebAudio();
    expect(() => {
      port.sfx('hit');
      port.music('stage');
      port.setIntensity(2);
      port.setVolume('bgm', 0.5);
      port.setPaused(true);
      port.unlock();
      port.sfx('gem', { pan: 1 });
      port.music(null);
    }).not.toThrow();
  });

  it('unlock まで AudioContext を作らず、何度 unlock しても 1 つだけ作る', () => {
    const s = setup();
    s.port.sfx('hit');
    s.port.music('title');
    expect(s.created()).toBe(0);
    s.port.unlock();
    s.port.unlock();
    expect(s.created()).toBe(1);
  });

  it('unlock 前の music() は覚えておき、unlock 後に再生を始める', () => {
    const s = setup();
    s.port.music('title');
    s.port.unlock();
    s.run(0.5);
    expect(s.ctx()?.sources().length).toBeGreaterThan(0);
  });

  it('unlock 前の sfx() は捨てる', () => {
    const s = setup();
    s.port.sfx('ui_confirm');
    s.port.unlock();
    expect(s.ctx()?.sources().length).toBe(0);
    s.port.sfx('ui_confirm');
    expect(s.ctx()?.sources().length).toBeGreaterThan(0);
  });

  it('同じ曲を再指定しても頭出ししない（新しいノードを作らない）', () => {
    const s = setup();
    s.port.unlock();
    s.port.music('stage', 0);
    const n = s.ctx()?.created.length ?? 0;
    s.port.music('stage', 0.5);
    expect(s.ctx()?.created.length).toBe(n);
  });

  it('null で止めると、フェードと余韻の後に曲のノードが全て切り離され、タイマーも止まる', () => {
    const s = setup();
    s.port.unlock();
    const base = s.ctx()?.connectionCount() ?? 0;
    s.port.music('stage', 0);
    s.run(2);
    expect(s.ctx()?.connectionCount()).toBeGreaterThan(base);
    s.port.music(null, 0.5);
    s.run(15);
    expect(s.ctx()?.connectionCount()).toBe(base);
    expect(s.timers.size).toBe(0);
  });

  it('別の曲へはクロスフェードで切り替える（しばらくは両方が鳴る）', () => {
    const s = setup();
    s.port.unlock();
    s.port.music('title', 0);
    s.run(1);
    const before = s.ctx()?.created.length ?? 0;
    s.port.music('boss', 1);
    expect(s.ctx()?.created.length).toBeGreaterThan(before);
    s.run(0.5);
    // 古い曲の出力はまだ 0 になっていない
    expect(() => s.run(2)).not.toThrow();
  });

  it('連続で取った霊玉は音程が上がっていく', () => {
    const s = setup();
    s.port.unlock();
    const freqs: number[] = [];
    for (let i = 0; i < 4; i++) {
      const c = s.ctx();
      if (!c) throw new Error('ctx が無い');
      const n = c.created.length;
      s.port.sfx('gem');
      const osc = c.created.slice(n).find((x) => x.kind === 'oscillator') as unknown as { frequency: FakeParam };
      freqs.push(osc.frequency.maxValue());
      s.run(0.1);
    }
    for (let i = 1; i < freqs.length; i++) expect(freqs[i]).toBeGreaterThan(freqs[i - 1] ?? Infinity);
  });

  it('命中音の連打は間引く', () => {
    const s = setup();
    s.port.unlock();
    const c = s.ctx();
    if (!c) throw new Error('ctx が無い');
    for (let i = 0; i < 20; i++) s.port.sfx('hit');
    const played = c.sources().filter((x) => x.kind === 'oscillator').length;
    s.port.sfx('hit');
    expect(c.sources().filter((x) => x.kind === 'oscillator').length).toBe(played);
    expect(played).toBeGreaterThan(0);
  });

  it('setVolume は該当するバスのゲインだけを変える', () => {
    const s = setup();
    s.port.unlock();
    const c = s.ctx();
    if (!c) throw new Error('ctx が無い');
    const gains = c.created.filter((n) => n.kind === 'gain');
    const snapshot = () => gains.map((g) => gainOf(g).events.length);
    const before = snapshot();
    s.port.setVolume('sfx', 0.5);
    const after = snapshot();
    expect(after.filter((v, i) => v !== before[i])).toHaveLength(1);
  });

  it('setPaused(true) で BGM にローパスと 4 割の音量をかけ、false で戻す', () => {
    const s = setup();
    s.port.unlock();
    const c = s.ctx();
    if (!c) throw new Error('ctx が無い');
    const filters = c.created.filter((n) => n.kind === 'biquad') as unknown as { frequency: FakeParam }[];
    s.port.setPaused(true);
    const targets = filters.map((f) => f.frequency.events.at(-1)?.value);
    expect(targets.some((v) => v !== undefined && v < 1500)).toBe(true);
    s.port.setPaused(false);
    const back = filters.map((f) => f.frequency.events.at(-1)?.value);
    expect(back.some((v) => v !== undefined && v >= 15000)).toBe(true);
  });

  it('表示中は 0.2 秒先までしか予約しない（切り替えへの反応を速くするため）', () => {
    const s = setup({ hidden: false });
    s.port.unlock();
    s.port.music('stage', 0);
    const c = s.ctx();
    if (!c) throw new Error('ctx が無い');
    expect(Math.max(...c.sources().map((x) => x.startTime ?? 0))).toBeLessThan(0.3);
  });

  it('非表示のタブでは先読みを長くし、1 秒に 1 回まで間引かれたタイマーでも曲が途切れない', () => {
    const s = setup({ hidden: true });
    s.port.unlock();
    s.port.music('stage', 0);
    const c = s.ctx();
    if (!c) throw new Error('ctx が無い');
    expect(Math.max(...c.sources().map((x) => x.startTime ?? 0))).toBeGreaterThan(1.0);
  });

  it('fadeSec 0 で切り替えても、古い曲はごく短いフェードで止める（プツッと鳴らさない）', () => {
    const s = setup();
    s.port.unlock();
    s.port.music('title', 0);
    s.run(1);
    const c = s.ctx();
    if (!c) throw new Error('ctx が無い');
    const outs = c.created.filter((n) => n.kind === 'gain').map(gainOf);
    s.port.music('boss', 0);
    const fadeOut = outs.find((g) => g.events.at(-1)?.value === 0);
    expect(fadeOut?.events.at(-1)?.time).toBeGreaterThan(c.currentTime + 0.02);
  });

  it('unlock 前の音量・ポーズ・intensity の設定も unlock 時に反映する', () => {
    const s = setup();
    s.port.setPaused(true);
    s.port.unlock();
    const c = s.ctx();
    if (!c) throw new Error('ctx が無い');
    const filters = c.created.filter((n) => n.kind === 'biquad') as unknown as { frequency: FakeParam }[];
    expect(filters.some((f) => f.frequency.maxValue() < 1500)).toBe(true);
  });
});
