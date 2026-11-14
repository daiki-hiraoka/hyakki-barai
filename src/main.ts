// フォントは 1 ファイルにまとまった版を使う（Canvas は字形の遅延読み込みと相性が悪いため）。
// 後に書いた日本語版が優先され、無い字形だけラテン版から補われる
import '@fontsource/dotgothic16/latin-400.css';
import '@fontsource/dotgothic16/japanese-400.css';

import { Game } from './app/game';
import { TitleScene } from './app/scenes/title';
import { ALL_SPRITES } from './art/sprites/index';
import { NullAudio, type AudioPort } from './audio/port';
import { createWebAudio, renderOffline } from './audio/webAudio';
import { loadSave } from './core/meta/save';
import { browserStorage } from './infra/storage';
import { Atlas } from './render/atlas';
import { Screen } from './render/screen';

/** フォントの読み込みを待つ上限。過ぎたら代用フォントで始める */
const FONT_TIMEOUT_MS = 4000;

/** `?mute` を付けると無音で起動する（音の出せない環境や、自動検証用） */
function createAudio(params: URLSearchParams): AudioPort {
  return params.has('mute') ? new NullAudio() : createWebAudio();
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  const screen = new Screen(canvas);
  const storage = browserStorage();
  const save = loadSave(storage);
  const atlas = new Atlas(ALL_SPRITES);
  const params = new URLSearchParams(window.location.search);
  const debug = params.has('debug');

  // ここが合成ルート。外界の実装（音・保存先・画面）を作って Game に渡す
  const game = new Game(screen, atlas, createAudio(params), storage, save, debug);

  await Promise.race([
    game.gfx.text.preload('百鬼祓い 夜明けまで、祓い続けよ'),
    new Promise<void>((resolve) => window.setTimeout(resolve, FONT_TIMEOUT_MS)),
  ]);

  game.start(new TitleScene(game));
  canvas.focus();
  if (debug) {
    // 耳で確かめられない環境でも、音量を数値で検証できるようにしておく
    Object.assign(window, { __game: game, __renderOffline: renderOffline });
  }
}

void boot();
