import { describe, expect, it } from 'vitest';
import { FakeAudioContext, type FakeParam } from './fakeAudioContext';
import type { InstrumentFn } from './instruments';
import { grid } from './pattern';
import { MUSIC_IDS } from './port';
import { INSTRUMENT_IDS, type InstrumentId, type SongDef, songDuration } from './song';
import { SongPlayer } from './songPlayer';
import { SONGS } from './songs';
import { IN_SCALE } from './theory';

/** 鳴らした音を記録するだけの楽器一式 */
function recorder() {
  const notes: { inst: InstrumentId; t: number; freq: number; vel: number }[] = [];
  const table = Object.fromEntries(
    INSTRUMENT_IDS.map((id) => [id, ((_v, _out, t, n) => notes.push({ inst: id, t, freq: n.freq, vel: n.vel })) as InstrumentFn]),
  ) as Record<InstrumentId, InstrumentFn>;
  return { notes, table };
}

// 120 BPM：1 ステップ 0.125 秒、1 小節 2 秒
const testSong: SongDef = {
  bpm: 120,
  stepsPerBar: 16,
  bars: 2,
  loopStartBar: 0,
  scale: IN_SCALE,
  root: 62,
  tracks: [
    { name: 'base', inst: 'odaiko', gain: 1, pattern: grid('x...x...x...x...') },
    { name: 'top', inst: 'kane', gain: 1, layer: 1, pattern: grid('xxxxxxxxxxxxxxxx') },
  ],
};

function setup(song: SongDef, intensity = 0) {
  const ctx = new FakeAudioContext();
  const dry = ctx.createGain();
  dry.connect(ctx.destination);
  const rec = recorder();
  const player = new SongPlayer(ctx.asBase(), song, { dry: dry as unknown as AudioNode, wet: null }, 0, {
    intensity,
    instruments: rec.table,
  });
  /** 実時間の再生と同じく 25ms ごとにタイマーが呼ばれたことにする */
  const run = (from: number, to: number) => {
    for (let t = from; t <= to + 1e-9; t += 0.025) {
      ctx.advance(t);
      player.pump(t, 0.15);
    }
  };
  return { ctx, player, notes: rec.notes, run };
}

describe('SongPlayer', () => {
  it('細かく何度呼んでも、同じステップを二重に鳴らさない', () => {
    const { notes, run } = setup(testSong);
    // 3.8 秒まで（先読み 0.15 秒を足しても 4 秒の拍には届かない）
    run(0, 3.8);
    const times = notes.filter((n) => n.inst === 'odaiko').map((n) => n.t);
    expect(times).toHaveLength(8);
    times.forEach((t, i) => expect(t).toBeCloseTo(i * 0.5, 9));
  });

  it('intensity の変更は、次の小節の頭から反映する', () => {
    const { player, notes, run } = setup(testSong);
    run(0, 0.6);
    player.setIntensity(1);
    run(0.625, 3.5);
    const top = notes.filter((n) => n.inst === 'kane').map((n) => n.t);
    expect(Math.min(...top)).toBeCloseTo(2.0, 9);
  });

  it('最初から指定した intensity は 1 小節目から鳴る', () => {
    const { notes, run } = setup(testSong, 1);
    run(0, 0.2);
    expect(notes.some((n) => n.inst === 'kane' && n.t === 0)).toBe(true);
  });

  it('ループしない曲は最後まで鳴らしたら finished になり、その先は鳴らさない', () => {
    const { player, notes, run } = setup({ ...testSong, loopStartBar: null });
    run(0, 5);
    expect(player.finished).toBe(true);
    expect(Math.max(...notes.map((n) => n.t))).toBeLessThan(4);
  });

  it('タブ復帰などで大きく遅れても、溜まった音を一度に鳴らさない', () => {
    const { ctx, player, notes } = setup(testSong);
    ctx.advance(0);
    player.pump(0, 0.15);
    const before = notes.length;
    ctx.advance(30);
    player.pump(30, 0.15);
    const late = notes.slice(before);
    expect(late.length).toBeLessThanOrEqual(2);
    for (const n of late) expect(n.t).toBeGreaterThanOrEqual(30 - 0.1);
  });

  it('fade は出力のゲインを目標値へランプする', () => {
    const { player } = setup(testSong);
    player.fade(0, 1, 0.5);
    const gain = player.output.gain as unknown as FakeParam;
    expect(gain.events.at(-1)).toMatchObject({ value: 0, time: 1.5 });
  });

  it('dispose すると、自分で作った接続を全て切る', () => {
    const { ctx, player } = setup(testSong);
    const base = 1; // テスト側で作った dry → destination の 1 本だけが残る
    player.dispose();
    expect(ctx.connectionCount()).toBe(base);
  });

  it.each(MUSIC_IDS)('%s：実際の楽器で intensity 0〜3 を 1 周以上鳴らしても制約違反が無く、鳴り終われば切り離される', (id) => {
    for (const intensity of [0, 1, 2, 3]) {
      const ctx = new FakeAudioContext();
      const dry = ctx.createGain();
      const wet = ctx.createGain();
      dry.connect(ctx.destination);
      wet.connect(ctx.destination);
      const song = SONGS[id];
      const player = new SongPlayer(ctx.asBase(), song, { dry: dry as unknown as AudioNode, wet: wet as unknown as AudioNode }, 0.05, {
        intensity,
      });
      const until = songDuration(song) + 1;
      for (let t = 0; t <= until; t += 0.1) {
        ctx.advance(t);
        player.pump(t, 0.2);
      }
      ctx.advance(until + 60);
      player.dispose();
      expect(ctx.connectionCount(), `${id} intensity ${intensity}`).toBe(2);
      expect(ctx.sources().length, `${id} は音を出している`).toBeGreaterThan(0);
    }
  });
});
