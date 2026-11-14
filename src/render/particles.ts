import type { Gfx } from './gfx';

type Kind = 'spark' | 'puff' | 'wisp' | 'ring' | 'bolt' | 'chain' | 'num' | 'debris' | 'mote' | 'burst';

interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  color2: string;
  size: number;
  /** 種類ごとの追加値（輪の始めの半径、雷の行き先など） */
  a: number;
  b: number;
  text: string;
}

const MAX_PARTICLES = 700;
const MAX_NUMBERS = 70;
/** 大きな会心の数字を出すのは、画面の数字がこの数より少ないときだけ */
const BIG_NUMBER_LIMIT = 8;
const TWO_PI = Math.PI * 2;

/**
 * 演出用の粒（煙・火花・ダメージ数字・雷など）。ゲームの勝敗には関わらないので、
 * シミュレーションとは切り離し、乱数も Math.random を使う。
 */
export class Particles {
  private readonly items: Particle[] = [];
  private readonly free: Particle[] = [];
  private numbers = 0;

  private add(kind: Kind, x: number, y: number, life: number): Particle | null {
    if (this.items.length >= MAX_PARTICLES) return null;
    const p: Particle = this.free.pop() ?? {
      kind, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 0,
      color: '#fff', color2: '#fff', size: 1, a: 0, b: 0, text: '',
    };
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = life;
    p.max = life;
    p.size = 1;
    p.a = 0;
    p.b = 0;
    this.items.push(p);
    return p;
  }

  clear(): void {
    this.free.push(...this.items);
    this.items.length = 0;
    this.numbers = 0;
  }

  update(): void {
    const items = this.items;
    let write = 0;
    for (let i = 0; i < items.length; i++) {
      const p = items[i]!;
      p.x += p.vx;
      p.y += p.vy;
      switch (p.kind) {
        case 'spark':
          p.vx *= 0.9;
          p.vy *= 0.9;
          break;
        case 'debris':
          p.vy += 0.12;
          break;
        case 'num':
          p.vy *= 0.9;
          break;
        case 'wisp':
          p.vx = Math.sin(p.life * 0.3 + p.a) * 0.3;
          break;
        case 'puff':
          p.vx *= 0.93;
          p.vy *= 0.93;
          break;
      }
      if (--p.life > 0) {
        items[write++] = p;
      } else {
        if (p.kind === 'num') this.numbers--;
        this.free.push(p);
      }
    }
    items.length = write;
  }

  draw(g: Gfx, camX: number, camY: number): void {
    const ctx = g.ctx;
    for (const p of this.items) {
      const x = p.x - camX;
      const y = p.y - camY;
      const k = p.life / p.max;
      switch (p.kind) {
        case 'spark':
        case 'debris':
        case 'mote':
          g.rect(x, y, p.size, p.size, k > 0.5 ? p.color : p.color2);
          break;
        case 'wisp':
          g.rect(x, y, 2, 2, p.color);
          g.rect(x, y + 2, 1, 2, p.color2);
          break;
        case 'puff':
          ctx.globalAlpha = Math.min(1, k * 1.2) * 0.55;
          g.disc(x, y, p.size * (0.45 + 0.55 * (1 - k)), k > 0.5 ? p.color : p.color2);
          ctx.globalAlpha = 1;
          break;
        case 'burst': {
          const r = p.size * (0.55 + 0.45 * (1 - k));
          ctx.globalAlpha = Math.min(1, k * 1.6);
          g.disc(x, y, r, p.color2);
          g.disc(x, y, r * 0.72 * k, p.color);
          g.disc(x, y, r * 0.4 * k, '#ffffff');
          ctx.globalAlpha = 1;
          break;
        }
        case 'ring':
          ctx.globalAlpha = Math.min(1, k * 1.5);
          g.arc(x, y, p.a + (p.b - p.a) * (1 - k), p.color, 0, TWO_PI, p.size);
          ctx.globalAlpha = 1;
          break;
        case 'bolt':
          this.drawBolt(g, x, y, p);
          break;
        case 'chain':
          jagged(g, x, y, p.a - camX, p.b - camY, p.life, '#52d2da', 3);
          jagged(g, x, y, p.a - camX, p.b - camY, p.life, '#ffffff', 1);
          break;
        case 'num':
          ctx.globalAlpha = Math.min(1, k * 3);
          g.num(p.text, x, y, p.color, p.size, 'center');
          ctx.globalAlpha = 1;
          break;
      }
    }
  }

  private drawBolt(g: Gfx, x: number, y: number, p: Particle): void {
    const k = p.life / p.max;
    // 地面の閃光
    g.ctx.globalAlpha = k * 0.8;
    g.disc(x, y, p.size * (0.6 + 0.4 * k), '#b8f5ef');
    g.ctx.globalAlpha = 1;
    if (k < 0.35) return;
    // 空から落ちる稲妻（毎フレーム形を変えてちらつかせる）
    const top = y - 230;
    jagged(g, x + p.a, top, x, y, p.life, '#52d2da', 3);
    jagged(g, x + p.a, top, x, y, p.life, '#ffffff', 1);
  }

  // ---- 発生 -----------------------------------------------------------------

  /** 命中の火花 */
  hit(x: number, y: number, color: string): void {
    for (let i = 0; i < 2; i++) {
      const p = this.add('spark', x, y, 8 + Math.random() * 6);
      if (!p) return;
      const a = Math.random() * TWO_PI;
      const s = 0.8 + Math.random() * 1.4;
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s;
      p.color = '#ffffff';
      p.color2 = color;
      p.size = 1;
    }
  }

  /** 妖怪が煙になって消え、魂が昇る */
  kill(x: number, y: number, r: number, big: boolean): void {
    // 大群を倒しても画面が煙で埋まらないよう、ふつうの妖怪の煙は小さく少なめにする
    const n = big ? 18 : Math.min(4, 2 + Math.floor(r / 5));
    for (let i = 0; i < n; i++) {
      const p = this.add('puff', x + (Math.random() - 0.5) * r, y - r * 0.6 + (Math.random() - 0.5) * r, 12 + Math.random() * 9);
      if (!p) return;
      const a = Math.random() * TWO_PI;
      const s = (big ? 1.6 : 0.6) * Math.random();
      p.vx = Math.cos(a) * s;
      p.vy = Math.sin(a) * s - 0.25;
      p.color = '#c9d7f0';
      p.color2 = '#5c6ca3';
      p.size = (big ? 8 : 2.5) + Math.random() * (big ? 6 : 2);
    }
    const w = this.add('wisp', x, y - r, 26);
    if (w) {
      w.vy = -0.9;
      w.a = Math.random() * 6;
      w.color = '#b8f5ef';
      w.color2 = '#52d2da';
    }
  }

  /** ダメージ数字 */
  number(x: number, y: number, value: number, crit: boolean, color?: string): void {
    if (this.numbers >= MAX_NUMBERS) return;
    // 会心は大きく見せたいが、連発すると画面を覆ってしまうので、数字が少ないときだけ大きくする
    const big = crit && this.numbers < BIG_NUMBER_LIMIT;
    const p = this.add('num', x + (Math.random() - 0.5) * 8, y - 8, big ? 44 : 34);
    if (!p) return;
    this.numbers++;
    p.vy = big ? -1.4 : -1.1;
    p.text = String(value) + (crit ? '!' : '');
    p.color = color ?? (crit ? '#f7c948' : '#f5edd9');
    p.size = big ? 2 : 1;
  }

  /** 爆発 */
  explosion(x: number, y: number, r: number, hot: string, edge: string): void {
    const p = this.add('burst', x, y, 14);
    if (p) {
      p.size = r;
      p.color = hot;
      p.color2 = edge;
    }
    for (let i = 0; i < 8; i++) {
      const s = this.add('spark', x, y, 12 + Math.random() * 10);
      if (!s) return;
      const a = Math.random() * TWO_PI;
      const v = 1.5 + Math.random() * 2.5;
      s.vx = Math.cos(a) * v;
      s.vy = Math.sin(a) * v;
      s.color = hot;
      s.color2 = edge;
      s.size = 2;
    }
  }

  /** 落雷 */
  bolt(x: number, y: number, r: number): void {
    const p = this.add('bolt', x, y, 12);
    if (p) {
      p.size = r;
      p.a = (Math.random() - 0.5) * 70;
    }
  }

  /** 連鎖する雷 */
  chain(x: number, y: number, x2: number, y2: number): void {
    const p = this.add('chain', x, y, 9);
    if (p) {
      p.a = x2;
      p.b = y2;
    }
  }

  /** 広がる輪 */
  ring(x: number, y: number, from: number, to: number, color: string, life = 18, thickness = 2): void {
    const p = this.add('ring', x, y, life);
    if (p) {
      p.a = from;
      p.b = to;
      p.color = color;
      p.size = thickness;
    }
  }

  /** 砕けた石の破片 */
  debris(x: number, y: number): void {
    for (let i = 0; i < 9; i++) {
      const p = this.add('debris', x, y - 8, 22 + Math.random() * 12);
      if (!p) return;
      p.vx = (Math.random() - 0.5) * 3.2;
      p.vy = -1 - Math.random() * 2.2;
      p.color = '#9c9cab';
      p.color2 = '#6c6c7f';
      p.size = Math.random() < 0.5 ? 2 : 1;
    }
  }

  /** 立ちのぼる光の粒 */
  motes(x: number, y: number, count: number, color: string, color2: string, spread = 10): void {
    for (let i = 0; i < count; i++) {
      const p = this.add('mote', x + (Math.random() - 0.5) * spread * 2, y + (Math.random() - 0.5) * spread, 22 + Math.random() * 26);
      if (!p) return;
      p.vy = -0.4 - Math.random() * 0.9;
      p.vx = (Math.random() - 0.5) * 0.4;
      p.color = color;
      p.color2 = color2;
      p.size = Math.random() < 0.3 ? 2 : 1;
    }
  }

  /** 塩が撒かれる */
  scatter(x: number, y: number, r: number, color: string): void {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TWO_PI;
      const d = Math.random() * r;
      const p = this.add('spark', x + Math.cos(a) * d * 0.3, y + Math.sin(a) * d * 0.3, 14 + Math.random() * 8);
      if (!p) return;
      p.vx = Math.cos(a) * (d / 14);
      p.vy = Math.sin(a) * (d / 14);
      p.color = color;
      p.color2 = color;
      p.size = 1;
    }
  }
}

/** ぎざぎざの線（稲妻）。seed が変わるたびに形が変わる */
function jagged(g: Gfx, x0: number, y0: number, x1: number, y1: number, seed: number, color: string, size: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const steps = Math.max(2, Math.round(len / 14));
  const nx = -dy / len;
  const ny = dx / len;
  let px = x0;
  let py = y0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // 両端は目標に合わせ、途中だけ左右にずらす
    const wobble = i === steps ? 0 : Math.sin(i * 12.9898 + seed * 78.233) * 7;
    const qx = x0 + dx * t + nx * wobble;
    const qy = y0 + dy * t + ny * wobble;
    g.line(px, py, qx, qy, color, size);
    px = qx;
    py = qy;
  }
}
