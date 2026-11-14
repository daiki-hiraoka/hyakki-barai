import { BOSS } from './music/boss';
import { DEFEAT } from './music/defeat';
import { STAGE } from './music/stage';
import { TITLE } from './music/title';
import { VICTORY } from './music/victory';
import type { MusicId } from './port';
import type { SongDef } from './song';

/** MusicId → 曲データ。Record にして、曲の追加漏れを型で検出する */
export const SONGS: Readonly<Record<MusicId, SongDef>> = {
  title: TITLE,
  stage: STAGE,
  boss: BOSS,
  victory: VICTORY,
  defeat: DEFEAT,
};
