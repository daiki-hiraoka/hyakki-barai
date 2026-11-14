/**
 * ファビコンを作る。提灯お化けのスプライトを 2 倍に拡大して public/favicon.png に書き出す。
 *
 *   npm run favicon
 *
 * ゲーム内のドット絵と同じ定義から作るので、絵を直したらこれを実行し直して出力をコミットする。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { frameToRgba } from '../src/art/sprite';
import { getSprite } from '../src/art/sprites/index';
import { encodePng, upscale } from './png';

const SPRITE_ID = 'enemy.chochin';
/** 16px の絵を 32px にする（高解像度のタブでもくっきり見える大きさ） */
const SCALE = 2;
const OUT = resolve('public/favicon.png');

const def = getSprite(SPRITE_ID);
if (!def) {
  console.error(`スプライトが見つかりません: ${SPRITE_ID}`);
  process.exit(1);
}

const size = { w: def.w * SCALE, h: def.h * SCALE };
const rgba = upscale(frameToRgba(def, 0), def.w, def.h, SCALE);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePng(size.w, size.h, rgba));
console.log(`${SPRITE_ID} から ${size.w}x${size.h} のファビコンを出力しました: ${OUT}`);
