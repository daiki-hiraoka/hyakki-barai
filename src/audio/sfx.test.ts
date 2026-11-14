import { describe, expect, it } from 'vitest';
import { FakeAudioContext, FakeOscillator } from './fakeAudioContext';
import { SFX_IDS } from './port';
import { SFX_DEFS, playSfx } from './sfx';

function setup() {
  const ctx = new FakeAudioContext();
  const out = ctx.createGain();
  out.connect(ctx.destination);
  return { ctx, out: out as unknown as AudioNode };
}

describe('効果音', () => {
  it.each(SFX_IDS)('%s：Web Audio の制約を守って鳴り、鳴り終わると作ったノードを全て切り離す', (id) => {
    const { ctx, out } = setup();
    const base = ctx.connectionCount();
    const end = playSfx(ctx.asBase(), out, id, 0.1, { pan: 0.5, volume: 1, pitch: 1 });
    expect(ctx.connectionCount()).toBeGreaterThan(base);
    expect(end).toBeGreaterThan(0.1);
    ctx.advance(end + 0.001);
    expect(ctx.connectionCount()).toBe(base);
  });

  it.each(SFX_IDS)('%s：短く（4 秒以内）、間引きに使う公称の長さが実際とかけ離れていない', (id) => {
    const { ctx, out } = setup();
    const len = playSfx(ctx.asBase(), out, id, 0, { rand: () => 0.5 });
    expect(len).toBeLessThanOrEqual(4);
    expect(SFX_DEFS[id].len).toBeGreaterThanOrEqual(len * 0.5);
    expect(SFX_DEFS[id].len).toBeLessThanOrEqual(len * 1.5 + 0.05);
  });

  it('pitch を 2 にすると、鳴らす周波数が 2 倍になる', () => {
    const maxFreq = (pitch: number) => {
      const { ctx, out } = setup();
      playSfx(ctx.asBase(), out, 'gem', 0, { pitch, rand: () => 0.5 });
      const oscs = ctx.sources().filter((s): s is FakeOscillator => s instanceof FakeOscillator);
      return Math.max(...oscs.map((o) => o.frequency.maxValue()));
    };
    expect(maxFreq(2) / maxFreq(1)).toBeCloseTo(2, 5);
  });

  it('volume 0 なら何も作らない', () => {
    const { ctx, out } = setup();
    const n = ctx.created.length;
    playSfx(ctx.asBase(), out, 'hit', 0, { volume: 0 });
    expect(ctx.created.length).toBe(n);
  });

  it('pan を指定したときだけ定位のノードを通す', () => {
    const a = setup();
    playSfx(a.ctx.asBase(), a.out, 'hit', 0, {});
    expect(a.ctx.created.some((n) => n.kind === 'panner')).toBe(false);
    const b = setup();
    playSfx(b.ctx.asBase(), b.out, 'hit', 0, { pan: -1 });
    expect(b.ctx.created.some((n) => n.kind === 'panner')).toBe(true);
  });

  it('頻出する音の最小間隔：hit 35ms・kill 45ms・gem 30ms・武器 50ms 以上', () => {
    expect(SFX_DEFS.hit.minInterval).toBeCloseTo(0.035, 3);
    expect(SFX_DEFS.kill.minInterval).toBeCloseTo(0.045, 3);
    expect(SFX_DEFS.gem.minInterval).toBeCloseTo(0.03, 3);
    for (const id of SFX_IDS.filter((s) => s.startsWith('w_'))) {
      expect(SFX_DEFS[id].minInterval, id).toBeGreaterThanOrEqual(0.05);
    }
  });

  it('UI と進行の合図は乱戦中でも欠けないよう優先し、命中音は優先しない', () => {
    const important = ['ui_move', 'ui_confirm', 'ui_cancel', 'ui_deny', 'ui_buy', 'level_up', 'boss_warn', 'death', 'dawn'] as const;
    for (const id of important) expect(SFX_DEFS[id].priority, id).toBe(true);
    expect(SFX_DEFS.hit.priority ?? false).toBe(false);
  });
});
