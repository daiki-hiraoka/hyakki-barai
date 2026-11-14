import type { Screen } from '../render/screen';

export type Action =
  | 'up' | 'down' | 'left' | 'right'
  | 'confirm' | 'cancel' | 'pause'
  | 'reroll' | 'skip'
  | 'n1' | 'n2' | 'n3' | 'n4';

const KEY_ACTIONS: Record<string, Action[]> = {
  ArrowUp: ['up'],
  KeyW: ['up'],
  ArrowDown: ['down'],
  KeyS: ['down'],
  ArrowLeft: ['left'],
  KeyA: ['left'],
  ArrowRight: ['right'],
  KeyD: ['right'],
  Enter: ['confirm'],
  Space: ['confirm'],
  KeyZ: ['confirm'],
  Escape: ['cancel', 'pause'],
  KeyP: ['pause'],
  KeyR: ['reroll'],
  KeyX: ['skip'],
  Digit1: ['n1'],
  Digit2: ['n2'],
  Digit3: ['n3'],
  Digit4: ['n4'],
};

/** スティックの遊びと、仮想スティックを倒しきる距離（論理 px） */
const DEADZONE = 0.25;
const STICK_RANGE = 36;

export interface Pointer {
  x: number;
  y: number;
  down: boolean;
  /** この tick に押されたか */
  pressed: boolean;
  /** ポインタが一度でも動いたか（マウスのない環境でホバー表示を出さないため） */
  active: boolean;
  /** この tick に動いたか */
  moved: boolean;
}

/**
 * キーボード・ゲームパッド・ポインタをまとめた入力。
 * ゲームは固定 60Hz で進むので、押した瞬間の判定は tick 単位で取り出す（poll を tick ごとに呼ぶ）。
 */
export class Input {
  /** 移動ベクトル（長さ 1 以下） */
  moveX = 0;
  moveY = 0;
  readonly pointer: Pointer = { x: 0, y: 0, down: false, pressed: false, active: false, moved: false };
  /** タッチでの仮想スティックの中心（表示用）。出していないときは null */
  stick: { x: number; y: number; dx: number; dy: number } | null = null;
  /** プレイ中だけ true にする。タッチを移動操作として扱うか */
  stickEnabled = false;

  private readonly held = new Set<string>();
  /** キーが押された順のキュー。同じ操作が 1 tick の間に 2 回来たら、2 回目は次の tick へ回す */
  private queued: Action[] = [];
  private readonly now = new Set<Action>();
  private pointerQueued = false;
  private movedQueued = false;
  private blurred = false;
  private padPrev: boolean[] = [];
  private touchId: number | null = null;

  constructor(screen: Screen, onFirstGesture: () => void) {
    let gestured = false;
    const gesture = (): void => {
      if (gestured) return;
      gestured = true;
      onFirstGesture();
    };

    window.addEventListener('keydown', (e) => {
      gesture();
      const actions = KEY_ACTIONS[e.code];
      if (!actions) return;
      // 矢印キーやスペースでページがスクロールしないようにする
      e.preventDefault();
      // 押しっぱなしによる自動連打は拾わない。移動キーを押したままレベルアップ画面が開くと、
      // 連打扱いで選択肢が勝手に流れてしまうため
      if (e.repeat) return;
      this.held.add(e.code);
      for (const a of actions) this.queued.push(a);
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.code));
    window.addEventListener('blur', () => {
      this.held.clear();
      this.endTouch();
      this.blurred = true;
    });

    const canvas = screen.canvas;
    canvas.addEventListener('pointerdown', (e) => {
      gesture();
      const p = screen.toLogical(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.down = true;
      this.pointer.active = true;
      this.pointerQueued = true;
      if (e.pointerType === 'touch' && this.stickEnabled && this.touchId === null) {
        this.touchId = e.pointerId;
        this.stick = { x: p.x, y: p.y, dx: 0, dy: 0 };
      }
      e.preventDefault();
    });
    window.addEventListener('pointermove', (e) => {
      const p = screen.toLogical(e.clientX, e.clientY);
      this.pointer.x = p.x;
      this.pointer.y = p.y;
      this.pointer.active = true;
      this.movedQueued = true;
      if (this.stick && e.pointerId === this.touchId) {
        this.stick.dx = p.x - this.stick.x;
        this.stick.dy = p.y - this.stick.y;
      }
    });
    const up = (e: PointerEvent): void => {
      this.pointer.down = false;
      if (e.pointerId === this.touchId) this.endTouch();
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private endTouch(): void {
    this.touchId = null;
    this.stick = null;
  }

  /** tick の始めに呼ぶ。たまっていた入力を「この tick の入力」として確定する */
  poll(): void {
    this.now.clear();
    // 素早い 2 度押しを 1 回に潰さないよう、重複ぶんは次の tick に持ち越す
    const later: Action[] = [];
    for (const a of this.queued) {
      if (this.now.has(a)) later.push(a);
      else this.now.add(a);
    }
    this.queued = later;
    this.pointer.pressed = this.pointerQueued;
    this.pointerQueued = false;
    this.pointer.moved = this.movedQueued;
    this.movedQueued = false;

    let x = 0;
    let y = 0;
    const h = this.held;
    if (h.has('ArrowLeft') || h.has('KeyA')) x -= 1;
    if (h.has('ArrowRight') || h.has('KeyD')) x += 1;
    if (h.has('ArrowUp') || h.has('KeyW')) y -= 1;
    if (h.has('ArrowDown') || h.has('KeyS')) y += 1;

    const pad = this.readPad();
    if (pad) {
      x += pad.x;
      y += pad.y;
    }
    if (this.stick && this.stickEnabled) {
      x += this.stick.dx / STICK_RANGE;
      y += this.stick.dy / STICK_RANGE;
    } else if (!this.stickEnabled) {
      this.endTouch();
    }

    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.moveX = x;
    this.moveY = y;
  }

  pressed(action: Action): boolean {
    return this.now.has(action);
  }

  /** ウィンドウが操作対象から外れたか（1 度読むと消える）。プレイ中なら一時停止させるのに使う */
  takeBlur(): boolean {
    const was = this.blurred;
    this.blurred = false;
    return was;
  }

  /** 何かしらの決定操作（キー・ボタン・クリック）があったか */
  anyConfirm(): boolean {
    return this.now.has('confirm') || this.pointer.pressed;
  }

  /** ポインタが矩形の中にあるか */
  hover(x: number, y: number, w: number, h: number): boolean {
    const p = this.pointer;
    return p.active && p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
  }

  /**
   * ポインタで矩形を「指した」か。動かしたか押したときだけ true になる。
   * 置きっぱなしのカーソルが、キーボードで動かした選択を毎 tick 引き戻さないようにするため。
   */
  pointed(x: number, y: number, w: number, h: number): boolean {
    return (this.pointer.moved || this.pointer.pressed) && this.hover(x, y, w, h);
  }

  /** この tick に矩形の中が押されたか */
  clicked(x: number, y: number, w: number, h: number): boolean {
    return this.pointer.pressed && this.hover(x, y, w, h);
  }

  private readPad(): { x: number; y: number } | null {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    let pad: Gamepad | null = null;
    for (const p of pads) {
      if (p && p.connected) {
        pad = p;
        break;
      }
    }
    if (!pad) return null;

    const button = (i: number): boolean => pad.buttons[i]?.pressed ?? false;
    const edges: Array<[number, Action[]]> = [
      [0, ['confirm']],
      [1, ['cancel']],
      [2, ['reroll']],
      [3, ['skip']],
      [9, ['pause']],
      [12, ['up']],
      [13, ['down']],
      [14, ['left']],
      [15, ['right']],
    ];
    for (const [i, actions] of edges) {
      const isDown = button(i);
      if (isDown && !this.padPrev[i]) for (const a of actions) this.now.add(a);
      this.padPrev[i] = isDown;
    }

    let x = pad.axes[0] ?? 0;
    let y = pad.axes[1] ?? 0;
    if (Math.hypot(x, y) < DEADZONE) {
      x = 0;
      y = 0;
    }
    if (button(14)) x -= 1;
    if (button(15)) x += 1;
    if (button(12)) y -= 1;
    if (button(13)) y += 1;

    // スティックを倒した瞬間も、メニューの上下左右として扱う
    const tilt: Array<[number, boolean, Action]> = [
      [100, y < -0.6, 'up'],
      [101, y > 0.6, 'down'],
      [102, x < -0.6, 'left'],
      [103, x > 0.6, 'right'],
    ];
    for (const [i, isDown, action] of tilt) {
      if (isDown && !this.padPrev[i]) this.now.add(action);
      this.padPrev[i] = isDown;
    }
    return { x, y };
  }
}
