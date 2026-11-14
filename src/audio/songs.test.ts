import { describe, expect, it } from 'vitest';
import { MUSIC_IDS } from './port';
import { songDuration, songTotalSteps } from './song';
import { SONGS } from './songs';
import { degreeToMidi } from './theory';

describe('曲データ', () => {
  it.each(MUSIC_IDS)('%s が定義されている', (id) => {
    expect(SONGS[id]).toBeDefined();
    expect(SONGS[id].tracks.length).toBeGreaterThan(0);
  });

  it.each(MUSIC_IDS)('%s の各トラックはループの継ぎ目でずれない長さ', (id) => {
    const song = SONGS[id];
    const total = songTotalSteps(song);
    const loopStart = (song.loopStartBar ?? 0) * song.stepsPerBar;
    for (const t of song.tracks) {
      expect(t.pattern.length, `${id}/${t.name}`).toBeGreaterThan(0);
      // 曲と同じ長さのトラックは曲と一緒に戻るので常に揃う。
      // 短くてくり返すトラックは、曲の長さとループ開始位置の両方を割り切れないと継ぎ目で拍がずれる
      if (t.pattern.length === total) continue;
      expect(total % t.pattern.length, `${id}/${t.name} の長さ ${t.pattern.length}`).toBe(0);
      expect(loopStart % t.pattern.length, `${id}/${t.name} とループ開始位置`).toBe(0);
    }
  });

  it.each(MUSIC_IDS)('%s の音は無理のない音域に収まる', (id) => {
    const song = SONGS[id];
    for (const t of song.tracks) {
      for (const e of t.pattern.events) {
        for (const d of e.degrees) {
          const midi = degreeToMidi(t.scale ?? song.scale, t.root ?? song.root, d);
          expect(midi, `${id}/${t.name} の ${e.at} ステップ目`).toBeGreaterThanOrEqual(26);
          expect(midi, `${id}/${t.name} の ${e.at} ステップ目`).toBeLessThanOrEqual(96);
        }
      }
    }
  });

  it('title：ゆっくり（60〜72 BPM）、16〜32 小節のループ', () => {
    const s = SONGS.title;
    expect(s.bpm).toBeGreaterThanOrEqual(60);
    expect(s.bpm).toBeLessThanOrEqual(72);
    expect(s.bars).toBeGreaterThanOrEqual(16);
    expect(s.bars).toBeLessThanOrEqual(32);
    expect(s.loopStartBar).toBe(0);
  });

  it('stage：126〜138 BPM、16 小節以上のループ、intensity 0〜3 の各段階でトラックが増える', () => {
    const s = SONGS.stage;
    expect(s.bpm).toBeGreaterThanOrEqual(126);
    expect(s.bpm).toBeLessThanOrEqual(138);
    expect(s.bars).toBeGreaterThanOrEqual(16);
    expect(s.loopStartBar).toBe(0);
    for (const level of [0, 1, 2, 3]) {
      expect(s.tracks.some((t) => (t.layer ?? 0) === level), `layer ${level}`).toBe(true);
    }
  });

  it('boss：150〜160 BPM のループ', () => {
    const s = SONGS.boss;
    expect(s.bpm).toBeGreaterThanOrEqual(150);
    expect(s.bpm).toBeLessThanOrEqual(160);
    expect(s.loopStartBar).toBe(0);
  });

  it('victory：ファンファーレの後、前奏を除いた部分をループする', () => {
    expect(SONGS.victory.loopStartBar).toBeGreaterThan(0);
  });

  it('defeat：ループしない 6〜8 秒の短い曲', () => {
    const s = SONGS.defeat;
    expect(s.loopStartBar).toBeNull();
    expect(songDuration(s)).toBeGreaterThanOrEqual(6);
    expect(songDuration(s)).toBeLessThanOrEqual(8);
  });

  it('stage 以外は intensity に関係なく全トラックが鳴る', () => {
    for (const id of MUSIC_IDS.filter((m) => m !== 'stage')) {
      for (const t of SONGS[id].tracks) expect(t.layer ?? 0, `${id}/${t.name}`).toBe(0);
    }
  });
});
