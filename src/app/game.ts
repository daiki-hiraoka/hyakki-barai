import type { AudioPort } from '../audio/port';
import { DT } from '../core/constants';
import { storeSave, type SaveData } from '../core/meta/save';
import type { SaveStorage } from '../core/ports';
import { Input } from '../input/input';
import type { Atlas } from '../render/atlas';
import { Gfx } from '../render/gfx';
import type { Screen } from '../render/screen';

/** 画面 1 つぶんの振る舞い。update は 60Hz 固定、draw は表示のたびに呼ばれる */
export interface Scene {
  update(): void;
  draw(): void;
}

/** 1 回の描画までに進める tick の上限（重い瞬間に処理が雪だるま式に溜まるのを防ぐ） */
const MAX_STEPS = 5;

/**
 * 合成ルート兼ゲームループ。
 * 画面・入力・音・保存先といった外界の実装をここで受け取り、各シーンへ渡す。
 */
export class Game {
  readonly gfx: Gfx;
  readonly input: Input;
  /** 起動してからの tick 数（点滅などの演出に使う） */
  tick = 0;
  /** 時間の進む速さ（デバッグ用。2 にすると倍速） */
  speed = 1;

  private scene: Scene | null = null;
  private last = 0;
  private acc = 0;

  constructor(
    readonly screen: Screen,
    atlas: Atlas,
    readonly audio: AudioPort,
    private readonly storage: SaveStorage,
    public save: SaveData,
    readonly debug: boolean,
  ) {
    this.gfx = new Gfx(screen, atlas);
    this.input = new Input(screen, () => audio.unlock());
    this.applyAudioSettings();
  }

  goto(scene: Scene): void {
    this.scene = scene;
  }

  /** セーブデータを書き込む */
  persist(): void {
    storeSave(this.storage, this.save);
  }

  applyAudioSettings(): void {
    this.audio.setVolume('bgm', this.save.settings.bgm);
    this.audio.setVolume('sfx', this.save.settings.sfx);
  }

  start(scene: Scene): void {
    this.scene = scene;
    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  /** n tick だけ手動で進めて 1 回描く（デバッグ・自動検証用） */
  advance(n: number): void {
    for (let i = 0; i < n; i++) this.stepOnce();
    this.render();
  }

  private stepOnce(): void {
    this.input.poll();
    this.scene?.update();
    this.tick++;
  }

  private render(): void {
    this.scene?.draw();
    this.screen.present();
  }

  private readonly frame = (now: number): void => {
    // タブが裏に回っていた間のぶんは進めない（戻った瞬間に早送りにならないように）
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.acc += dt * this.speed;
    const limit = MAX_STEPS * Math.max(1, Math.ceil(this.speed));
    let steps = 0;
    while (this.acc >= DT && steps < limit) {
      this.stepOnce();
      this.acc -= DT;
      steps++;
    }
    if (steps === limit) this.acc = 0;
    this.render();
    requestAnimationFrame(this.frame);
  };
}
