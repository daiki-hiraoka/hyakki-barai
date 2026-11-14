import type { SimEvent } from '../core/events';
import type { Settings } from '../core/meta/save';
import { AURA_RADIUS } from '../core/sim/weapons';
import { PF, type Enemy, type Pickup, type Prop, type WeaponId, type World } from '../core/types';
import type { Gfx } from './gfx';
import { Ground, type Decor } from './ground';
import { Lighting, nightLook } from './lighting';
import { Particles } from './particles';

const TWO_PI = Math.PI * 2;

const PROJ_SPRITE: Record<string, string> = {
  ofuda: 'proj.ofuda',
  ofuda_gold: 'proj.ofuda_gold',
  arrow: 'proj.arrow',
  arrow_light: 'proj.arrow_light',
  bead: 'proj.bead',
  bead_gold: 'proj.bead_gold',
  fire: 'proj.fire',
  fire_blue: 'proj.fire_blue',
  wind: 'proj.wind',
  wind_big: 'proj.wind_big',
  crane: 'proj.crane',
  crane_gold: 'proj.crane_gold',
  wave: 'proj.wind_big',
};

/** なぎ払い・斬撃の色（外側 → 内側） */
const SWEEP_COLORS: Record<string, [string, string, string]> = {
  staff: ['#fff3b0', '#f7c948', '#c2902c'],
  spin: ['#ffffff', '#f7c948', '#f08c30'],
  slash: ['#ffffff', '#b8f5ef', '#52d2da'],
  oboro: ['#ffffff', '#c394e2', '#8b58ba'],
};

/** 命中の火花の色 */
function sparkColor(weapon: WeaponId | null): string {
  switch (weapon) {
    case 'kitsunebi':
      return '#f08c30';
    case 'kyubi':
    case 'taiko':
    case 'kannari':
    case 'kekkai':
      return '#52d2da';
    case 'oboro':
      return '#c394e2';
    default:
      return '#f7c948';
  }
}

/** y 順に描くもの 1 件（毎フレーム作り直さず使い回す） */
interface Item {
  y: number;
  /** 0: 妖怪 / 1: プレイヤー / 2: 石灯籠 / 3: 飾り / 4: つづら */
  kind: number;
  enemy: Enemy | null;
  prop: Prop | null;
  decor: Decor | null;
  pickup: Pickup | null;
}

/** 闇の上に重ねて描く発光部分 */
interface Glow {
  id: string;
  frame: number;
  x: number;
  y: number;
  flip: boolean;
  scale: number;
  /** 回転（弾用）。NaN なら回転なし */
  rot: number;
}

interface FlashLight {
  x: number;
  y: number;
  r: number;
  life: number;
  max: number;
}

/**
 * シミュレーションの世界を画面に描く。
 * 描く順：地面 → 地面の上の陣や予告 → 影 → 妖怪や人（y 順）→ 弾 → 夜の闇 → 光るもの → 演出。
 */
export class WorldView {
  camX = 0;
  camY = 0;
  readonly fx = new Particles();
  /** プレイヤーが打たれた直後の赤い縁取り用（HUD が読む） */
  hurt = 0;

  private readonly ground = new Ground();
  private readonly lighting = new Lighting();
  private readonly items: Item[] = [];
  private itemCount = 0;
  private readonly glows: Glow[] = [];
  private glowCount = 0;
  private readonly decor: Decor[] = [];
  private readonly lights: FlashLight[] = [];
  private readonly shadows = new Map<number, HTMLCanvasElement>();
  private shake = 0;
  private flash = 0;
  private flashColor = '#ffffff';

  constructor(
    private readonly g: Gfx,
    private readonly settings: () => Settings,
  ) {}

  // ---------------------------------------------------------------------------
  // 出来事 → 演出
  // ---------------------------------------------------------------------------

  onEvents(world: World, events: readonly SimEvent[]): void {
    const fx = this.fx;
    const p = world.player;
    const numbers = this.settings().damageNumbers;
    for (const ev of events) {
      switch (ev.t) {
        case 'hit':
          fx.hit(ev.x, ev.y - 4, sparkColor(ev.weapon));
          if (numbers) fx.number(ev.x, ev.y - 6, ev.dmg, ev.crit);
          break;
        case 'kill':
          fx.kill(ev.x, ev.y, ev.r, ev.boss);
          if (ev.boss) {
            this.kick(9);
            this.setFlash(12, '#ffffff');
            fx.ring(ev.x, ev.y, 8, 150, '#fff3b0', 30, 3);
            fx.motes(ev.x, ev.y, 40, '#f7c948', '#f08c30', 40);
          } else if (ev.elite) {
            this.kick(3);
            fx.ring(ev.x, ev.y, 4, 46, '#f7c948', 18, 2);
          }
          break;
        case 'fx':
          this.onFx(ev);
          break;
        case 'playerHit':
          this.kick(4);
          this.hurt = 14;
          fx.number(p.x, p.y - 22, ev.dmg, false, '#f2507a');
          break;
        case 'heal':
          fx.motes(p.x, p.y - 8, 6, '#7be2a2', '#39a96a');
          fx.number(p.x, p.y - 24, ev.amount, false, '#7be2a2');
          break;
        case 'pickup':
          if (ev.kind !== 'gem') fx.motes(ev.x, ev.y, 5, '#fff3b0', '#f7c948', 4);
          break;
        case 'levelUp':
          fx.ring(p.x, p.y - 8, 6, 70, '#f7c948', 26, 2);
          fx.motes(p.x, p.y, 22, '#fff3b0', '#f7c948', 14);
          break;
        case 'propBreak':
          fx.debris(ev.x, ev.y);
          break;
        case 'nuke':
          this.setFlash(18, '#ffffff');
          this.kick(6);
          fx.ring(p.x, p.y, 10, 420, '#fff3b0', 34, 4);
          break;
        case 'freeze':
          this.setFlash(10, '#b8f5ef');
          fx.ring(p.x, p.y, 10, 380, '#b8f5ef', 30, 2);
          break;
        case 'revive':
          this.setFlash(16, '#fff3b0');
          fx.ring(p.x, p.y, 8, 160, '#f7c948', 26, 3);
          fx.motes(p.x, p.y, 30, '#fff3b0', '#f7c948', 20);
          break;
        case 'death':
          this.kick(8);
          fx.kill(p.x, p.y, 10, true);
          break;
        case 'bossSpawn':
          this.kick(5);
          break;
      }
    }
  }

  private onFx(ev: Extract<SimEvent, { t: 'fx' }>): void {
    const fx = this.fx;
    switch (ev.kind) {
      case 'explosion': {
        const blue = ev.weapon === 'kyubi';
        fx.explosion(ev.x, ev.y, ev.r, blue ? '#b8f5ef' : '#f7c948', blue ? '#2b8fab' : '#cf3a2f');
        this.addLight(ev.x, ev.y, ev.r * 2, 14);
        this.kick(1.2);
        break;
      }
      case 'lightning':
        fx.bolt(ev.x, ev.y, ev.r);
        this.addLight(ev.x, ev.y, ev.r * 2.6, 10);
        this.kick(1.8);
        break;
      case 'chain':
        fx.chain(ev.x, ev.y, ev.x2, ev.y2);
        this.addLight(ev.x2, ev.y2, 26, 8);
        break;
      case 'shockwave':
        fx.ring(ev.x, ev.y, ev.r * 0.3, ev.r * 1.3, '#f2507a', 16, 3);
        fx.explosion(ev.x, ev.y, ev.r * 0.8, '#fff3b0', '#8c2030');
        this.kick(5);
        break;
      case 'salt':
        fx.scatter(ev.x, ev.y, ev.r, '#ffffff');
        break;
      case 'charge':
        fx.ring(ev.x, ev.y - ev.r, ev.r + 10, ev.r, '#f2507a', 24, 1);
        break;
    }
  }

  private kick(amount: number): void {
    if (this.settings().shake) this.shake = Math.max(this.shake, amount);
  }

  private setFlash(ticks: number, color: string): void {
    this.flash = ticks;
    this.flashColor = color;
  }

  private addLight(x: number, y: number, r: number, life: number): void {
    if (this.lights.length < 24) this.lights.push({ x, y, r, life, max: life });
  }

  /** 1 tick ぶん演出を進める */
  update(): void {
    this.fx.update();
    if (this.shake > 0) this.shake *= 0.85;
    if (this.shake < 0.2) this.shake = 0;
    if (this.flash > 0) this.flash--;
    if (this.hurt > 0) this.hurt--;
    for (let i = this.lights.length - 1; i >= 0; i--) {
      if (--this.lights[i]!.life <= 0) this.lights.splice(i, 1);
    }
  }

  reset(): void {
    this.fx.clear();
    this.lights.length = 0;
    this.shake = 0;
    this.flash = 0;
    this.hurt = 0;
  }

  // ---------------------------------------------------------------------------
  // 描画
  // ---------------------------------------------------------------------------

  draw(world: World, tick: number): void {
    const g = this.g;
    const ctx = g.ctx;
    const w = g.w;
    const h = g.h;
    const p = world.player;

    const sx = this.shake > 0 ? (Math.random() - 0.5) * 2 * this.shake : 0;
    const sy = this.shake > 0 ? (Math.random() - 0.5) * 2 * this.shake : 0;
    const camX = Math.round(p.x - w / 2 + sx);
    const camY = Math.round(p.y - h / 2 + sy);
    this.camX = camX;
    this.camY = camY;
    this.glowCount = 0;

    this.ground.draw(ctx, camX, camY, w, h);
    this.drawZones(world, tick);
    this.drawAura(world, tick);
    this.drawHazards(world, tick);
    this.drawPickups(world, tick);
    this.drawSorted(world, tick);
    this.drawProjectiles(world, tick);
    this.drawShots(world);

    // ---- 夜の闇と灯り
    const dawning = world.phase === 'dawn' || world.phase === 'victory';
    const dawnK = dawning ? 1 - Math.max(0, world.dawnTicks) / 210 : 0;
    const look = nightLook(world.time / world.config.duration, world.director.darkTicks > 0);
    const strength = look.strength * (1 - dawnK);
    if (strength > 0.01) {
      this.lighting.begin(w, h, look.color);
      this.addLights(world, tick, look.lantern);
      this.lighting.apply(ctx, strength);
    }

    // ---- 闇に負けずに光るもの
    for (let i = 0; i < this.glowCount; i++) {
      const gl = this.glows[i]!;
      if (!Number.isNaN(gl.rot)) g.spriteRot(gl.id, gl.frame, gl.x, gl.y, gl.rot, gl.scale, 'glow');
      else if (gl.scale !== 1) g.spriteScaled(gl.id, gl.frame, gl.x, gl.y, gl.scale, gl.flip, 'glow');
      else g.sprite(gl.id, gl.frame, gl.x, gl.y, gl.flip, 'glow');
    }
    this.drawSweeps(world);
    this.fx.draw(g, camX, camY);
    this.drawBars(world);
    this.drawIndicators(world, tick);

    // ---- 夜明けの光
    if (dawnK > 0) {
      ctx.globalAlpha = Math.min(0.42, dawnK * 0.5);
      ctx.fillStyle = '#ffc890';
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.7, this.flash / 14);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }

  private visible(x: number, y: number, margin: number): boolean {
    return x > -margin && y > -margin && x < this.g.w + margin && y < this.g.h + margin;
  }

  private glow(id: string, frame: number, x: number, y: number, flip = false, scale = 1, rot = NaN): void {
    let gl = this.glows[this.glowCount];
    if (!gl) {
      gl = { id, frame, x, y, flip, scale, rot };
      this.glows[this.glowCount] = gl;
    }
    gl.id = id;
    gl.frame = frame;
    gl.x = x;
    gl.y = y;
    gl.flip = flip;
    gl.scale = scale;
    gl.rot = rot;
    this.glowCount++;
  }

  // ---- 地面の上の陣 ---------------------------------------------------------

  private drawZones(world: World, tick: number): void {
    const g = this.g;
    const ctx = g.ctx;
    for (const p of world.projectiles.items) {
      if (p.kind !== 'zone') continue;
      const x = p.x - this.camX;
      const y = p.y - this.camY;
      if (!this.visible(x, y, p.radius + 8)) continue;
      const fade = Math.min(1, p.life / 24);
      const r = p.radius * Math.min(1, p.age / 8);
      if (p.visual === 'burn') {
        ctx.globalAlpha = 0.2 * fade;
        g.disc(x, y, r, '#2b8fab');
        ctx.globalAlpha = 1;
        // 陣の中に散らばる蒼い炎（位置は陣ごとに固定し、コマだけ揺らす）
        for (let i = 0; i < 5; i++) {
          const a = (p.id * 1.7 + i * 1.256) % TWO_PI;
          const d = r * (0.25 + ((p.id * 7 + i * 13) % 10) / 16);
          const fx = x + Math.cos(a) * d;
          const fy = y + Math.sin(a) * d * 0.8;
          const frame = Math.floor(tick / 6 + i) % 2;
          g.sprite('proj.fire_blue', frame, fx, fy);
          this.glow('proj.fire_blue', frame, fx, fy);
        }
        continue;
      }
      const misogi = p.visual === 'misogi';
      ctx.globalAlpha = 0.16 * fade;
      g.disc(x, y, r, misogi ? '#52d2da' : '#f5edd9');
      ctx.globalAlpha = 0.85 * fade;
      if (misogi) {
        // 中心へ巻き込む渦
        for (let i = 0; i < 3; i++) {
          const rr = r * (1 - i * 0.3);
          const a = -tick * 0.06 * (i + 1) + i * 2.1;
          g.arc(x, y, rr, i === 0 ? '#b8f5ef' : '#52d2da', a, a + 4.4, 1, 1.5);
        }
      } else {
        g.arc(x, y, r, '#f5edd9', tick * 0.01, tick * 0.01 + TWO_PI, 1, 3);
        // 塩のきらめき
        for (let i = 0; i < 6; i++) {
          if ((tick + i * 7 + p.id) % 24 > 9) continue;
          const a = (p.id * 2.3 + i * 1.05) % TWO_PI;
          const d = r * (((p.id * 5 + i * 11) % 10) / 11);
          g.rect(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 1, 1, '#ffffff');
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawAura(world: World, tick: number): void {
    const g = this.g;
    const ctx = g.ctx;
    const pl = world.player;
    const x = pl.x - this.camX;
    const y = pl.y - this.camY - 6;
    for (const wpn of pl.weapons) {
      if (wpn.def.kind !== 'aura') continue;
      const r = AURA_RADIUS * wpn.stats.area;
      const evolved = wpn.def.evolved;
      // 祓った瞬間（phase が満ちた直後）に少し明るくする
      const pulse = wpn.phase > 0 ? Math.max(0, 1 - wpn.phase / 30) : 0;
      ctx.globalAlpha = 0.08 + (1 - pulse) * 0.06;
      g.disc(x, y, r, evolved ? '#f7c948' : '#52d2da');
      ctx.globalAlpha = 0.8;
      const rot = tick * 0.012;
      g.arc(x, y, r, evolved ? '#fff3b0' : '#b8f5ef', rot, rot + TWO_PI, 1, 4);
      if (evolved) {
        g.arc(x, y, r * 0.82, '#f7c948', -rot * 1.5, -rot * 1.5 + TWO_PI, 1, 7);
        // 四神（青龍・朱雀・白虎・玄武）の宝珠
        const orbs = ['#5ba2ea', '#cf3a2f', '#f5edd9', '#8b58ba'];
        orbs.forEach((color, i) => {
          const a = rot * 2 + (i * Math.PI) / 2;
          g.disc(x + Math.cos(a) * r, y + Math.sin(a) * r, 2, color);
        });
      }
      ctx.globalAlpha = 1;
    }
  }

  private drawHazards(world: World, tick: number): void {
    const g = this.g;
    const ctx = g.ctx;
    const blink = (tick >> 2) & 1;
    for (const hz of world.hazards.items) {
      const x = hz.x - this.camX;
      const y = hz.y - this.camY;
      if (hz.kind === 'line') {
        // 突進の予告線。直前の 1 秒だけ見せる
        if (hz.delay <= 0 || hz.delay > 60) continue;
        ctx.globalAlpha = 0.55 + blink * 0.3;
        const dx = Math.cos(hz.angle);
        const dy = Math.sin(hz.angle);
        for (let d = (tick * 2) % 12; d < hz.length; d += 12) {
          g.line(x + dx * d, y + dy * d, x + dx * (d + 6), y + dy * (d + 6), '#f2507a', 1);
        }
        ctx.globalAlpha = 1;
        continue;
      }
      if (!this.visible(x, y, hz.radius + 4)) continue;
      if (hz.delay > 0) {
        const k = 1 - hz.delay / hz.delayMax;
        ctx.globalAlpha = 0.25;
        g.disc(x, y, hz.radius * k, '#f2507a');
        ctx.globalAlpha = 0.9;
        g.arc(x, y, hz.radius, blink ? '#ffa0c2' : '#f2507a', 0, TWO_PI, 1, hz.kind === 'web' ? 3 : 1.4);
        ctx.globalAlpha = 1;
      } else if (hz.kind === 'web') {
        ctx.globalAlpha = Math.min(1, hz.life / 40) * 0.6;
        for (let i = 0; i < 6; i++) {
          const a = (i * Math.PI) / 3;
          g.line(x, y, x + Math.cos(a) * hz.radius, y + Math.sin(a) * hz.radius, '#c9d7f0', 1);
        }
        g.arc(x, y, hz.radius, '#c9d7f0');
        g.arc(x, y, hz.radius * 0.62, '#c9d7f0');
        g.arc(x, y, hz.radius * 0.28, '#c9d7f0');
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = Math.min(1, hz.life / 14) * 0.55;
        g.disc(x, y, hz.radius, '#fff3b0');
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---- 落とし物 -------------------------------------------------------------

  private drawPickups(world: World, tick: number): void {
    const g = this.g;
    for (const k of world.pickups.items) {
      if (k.kind === 'chest') continue;
      const x = k.x - this.camX;
      const y = k.y - this.camY;
      if (!this.visible(x, y, 12)) continue;
      if (k.kind === 'gem') {
        const id = k.tier === 2 ? 'item.gem2' : k.tier === 1 ? 'item.gem1' : 'item.gem0';
        const frame = Math.floor((tick + k.id * 5) / 20) % 2;
        g.sprite(id, frame, x, y);
        this.glow(id, frame, x, y);
        continue;
      }
      const bob = Math.sin((tick + k.id * 9) * 0.1) * 1.5;
      const id = `item.${k.kind}`;
      const frame = k.kind === 'coin' ? Math.floor((tick + k.id * 3) / 9) % 4 === 3 ? 1 : 0 : 0;
      this.shadow(x, y + 6, 4);
      g.sprite(id, frame, x, y + bob);
      this.glow(id, frame, x, y + bob);
    }
  }

  // ---- 妖怪・人・置物（y 順） -----------------------------------------------

  private push(y: number, kind: number): Item {
    let it = this.items[this.itemCount];
    if (!it) {
      it = { y, kind, enemy: null, prop: null, decor: null, pickup: null };
      this.items[this.itemCount] = it;
    }
    it.y = y;
    it.kind = kind;
    it.enemy = null;
    it.prop = null;
    it.decor = null;
    it.pickup = null;
    this.itemCount++;
    return it;
  }

  private drawSorted(world: World, tick: number): void {
    const g = this.g;
    const camX = this.camX;
    const camY = this.camY;
    this.itemCount = 0;

    for (const e of world.enemies.items) {
      if (!e.alive) continue;
      // 出番待ちの輪入道は画面の外にいて、まだ描かない
      if (e.ai === 'line' && e.aiTimer > 0) continue;
      if (!this.visible(e.x - camX, e.y - camY, e.radius * 2 + 40)) continue;
      this.push(e.y, 0).enemy = e;
    }
    for (const prop of world.props.items) {
      if (!prop.alive || !this.visible(prop.x - camX, prop.y - camY, 30)) continue;
      this.push(prop.y, 2).prop = prop;
    }
    for (const k of world.pickups.items) {
      if (k.kind !== 'chest' || !this.visible(k.x - camX, k.y - camY, 30)) continue;
      this.push(k.y, 4).pickup = k;
    }
    this.decor.length = 0;
    this.ground.collectDecor(camX, camY, g.w, g.h, this.decor);
    for (const d of this.decor) this.push(d.y, 3).decor = d;
    this.push(world.player.y, 1);

    const list = this.items;
    // 末尾の使っていない要素は並べ替えに混ぜない
    const active = list.slice(0, this.itemCount).sort((a, b) => a.y - b.y);

    // 影は先にまとめて敷く（手前のものの影が、奥のものの上に乗らないように）
    for (const it of active) {
      if (it.kind === 0) {
        const e = it.enemy!;
        this.shadow(e.x - camX, e.y - camY, e.radius * (e.elite ? 1.5 : 1));
      } else if (it.kind === 1) {
        this.shadow(world.player.x - camX, world.player.y - camY, 6);
      } else if (it.kind === 2) {
        this.shadow(it.prop!.x - camX, it.prop!.y - camY, 7);
      } else if (it.kind === 4) {
        this.shadow(it.pickup!.x - camX, it.pickup!.y - camY, 9);
      }
    }

    for (const it of active) {
      switch (it.kind) {
        case 0:
          this.drawEnemy(world, it.enemy!, tick);
          break;
        case 1:
          this.drawPlayer(world, tick);
          break;
        case 2: {
          const prop = it.prop!;
          const frame = Math.floor((tick + prop.id * 3) / 14) % 2;
          g.sprite('prop.lantern', frame, prop.x - camX, prop.y - camY);
          this.glow('prop.lantern', frame, prop.x - camX, prop.y - camY);
          break;
        }
        case 3: {
          const d = it.decor!;
          g.sprite(d.sprite, d.frame, d.x - camX, d.y - camY, d.flip);
          break;
        }
        case 4: {
          const k = it.pickup!;
          const hop = Math.abs(Math.sin((tick + k.id) * 0.08)) * 2;
          g.sprite('item.chest', 0, k.x - camX, k.y - camY - hop);
          break;
        }
      }
    }
  }

  private drawEnemy(world: World, e: Enemy, tick: number): void {
    const g = this.g;
    const ctx = g.ctx;
    const id = e.boss ? `boss.${e.def.id}` : `enemy.${e.def.id}`;
    const frames = g.frameCount(id);
    if (frames === 0) return;
    let x = e.x - this.camX;
    let y = e.y - this.camY;
    let frame = Math.floor((e.age + e.seed * 24) / 12) % frames;
    const frozen = e.frozen > 0 || world.freezeTicks > 0;
    if (frozen) frame = 0;

    if (e.ai === 'hop' && !frozen) {
      // 跳躍：空中にいる間は 2 コマ目にして、弧を描いて浮かせる
      const t = (e.age + Math.floor(e.seed * 50)) % 50;
      if (t < 24) {
        y -= Math.sin((t / 24) * Math.PI) * 7;
        frame = 1 % frames;
      } else {
        frame = 0;
      }
    } else if (e.ai === 'charge' && e.aiState === 1) {
      // 突進の溜め：小刻みに震える
      x += (tick & 1) * 2 - 1;
    } else if (e.boss && e.aiState === 1) {
      x += (tick & 1) * 2 - 1;
    }

    const flip = e.facing < 0;
    const variant = e.flash > 0 ? 'flash' : 'normal';
    if (e.elite) {
      // 精鋭：大きく描き、足元に金の輪を出す
      ctx.globalAlpha = 0.7;
      g.arc(x, y, e.radius + 3 + Math.sin(tick * 0.15), '#f7c948', 0, TWO_PI, 1, 2);
      ctx.globalAlpha = 1;
      g.spriteScaled(id, frame, x, y, 1.5, flip, variant);
      if (e.flash === 0) this.glow(id, frame, x, y, flip, 1.5);
    } else {
      g.sprite(id, frame, x, y, flip, variant);
      if (e.flash === 0) this.glow(id, frame, x, y, flip);
    }
    if (frozen && e.flash === 0) {
      // 凍りついた妖怪は白っぽく
      ctx.globalAlpha = 0.45;
      if (e.elite) g.spriteScaled(id, frame, x, y, 1.5, flip, 'flash');
      else g.sprite(id, frame, x, y, flip, 'flash');
      ctx.globalAlpha = 1;
    }
  }

  private drawPlayer(world: World, tick: number): void {
    const g = this.g;
    const p = world.player;
    if (world.phase === 'dead') return;
    // 無敵中は点滅させる
    if (p.iframes > 0 && (tick >> 1) % 2 === 0) return;
    const id = `char.${p.char.id}`;
    const frames = g.frameCount(id);
    const frame = p.moving && frames > 0 ? Math.floor(tick / 8) % frames : 0;
    g.sprite(id, frame, p.x - this.camX, p.y - this.camY, p.dir < 0, this.hurt > 10 ? 'flash' : 'normal');
  }

  private shadow(x: number, y: number, r: number): void {
    const size = Math.max(3, Math.min(40, Math.round(r)));
    let canvas = this.shadows.get(size);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = size * 2 + 1;
      canvas.height = size + 1;
      const c = canvas.getContext('2d')!;
      c.fillStyle = 'rgba(5, 8, 16, 0.4)';
      const ry = size / 2;
      for (let dy = -Math.floor(ry); dy <= Math.floor(ry); dy++) {
        const half = Math.floor(size * Math.sqrt(Math.max(0, 1 - (dy * dy) / (ry * ry))));
        c.fillRect(size - half, Math.floor(ry) + dy, half * 2 + 1, 1);
      }
      this.shadows.set(size, canvas);
    }
    this.g.ctx.drawImage(canvas, Math.round(x) - size, Math.round(y) - Math.floor(size / 2));
  }

  // ---- 弾 -------------------------------------------------------------------

  private drawProjectiles(world: World, tick: number): void {
    const g = this.g;
    for (const p of world.projectiles.items) {
      if (!p.alive) continue;
      const x = p.x - this.camX;
      const y = p.y - this.camY;
      const id = PROJ_SPRITE[p.visual];
      switch (p.kind) {
        case 'bullet': {
          if (!id || !this.visible(x, y, 24)) break;
          const angle = Math.atan2(p.vy, p.vx);
          const scale = p.visual === 'wave' ? 0.8 * p.scale : 1;
          g.spriteRot(id, 0, x, y, angle, scale);
          this.glow(id, 0, x, y, false, scale, angle);
          break;
        }
        case 'orbit':
          if (!id) break;
          g.sprite(id, 0, x, y);
          this.glow(id, 0, x, y);
          break;
        case 'lob': {
          if (!id) break;
          // 山なりに飛ぶ（地面の位置は影で示す）
          const k = p.dist > 0 ? 1 - p.life / p.dist : 1;
          const height = Math.sin(Math.PI * k) * 26;
          const frame = Math.floor(tick / 5) % 2;
          this.shadow(x, y, 4);
          g.sprite(id, frame, x, y - height - 4);
          this.glow(id, frame, x, y - height - 4);
          break;
        }
        case 'seeker': {
          if (!id) break;
          const frame = Math.floor((p.age + p.id) / 5) % 2;
          g.sprite(id, frame, x, y - 6, p.vx < 0);
          this.glow(id, frame, x, y - 6, p.vx < 0);
          break;
        }
        case 'boomerang': {
          if (!id) break;
          const frame = Math.floor(p.age / 4) % 2;
          const angle = p.age * 0.42;
          g.spriteRot(id, frame, x, y, angle);
          this.glow(id, frame, x, y, false, 1, angle);
          break;
        }
        default:
          break;
      }
    }
  }

  private drawShots(world: World): void {
    const g = this.g;
    for (const s of world.shots.items) {
      const x = s.x - this.camX;
      const y = s.y - this.camY;
      if (!this.visible(x, y, 12)) continue;
      const frame = Math.floor(s.age / 6);
      g.sprite(s.visual, frame, x, y);
      this.glow(s.visual, frame, x, y);
    }
  }

  /** なぎ払い・斬撃・広がる輪。光る演出なので、闇の上に描く */
  private drawSweeps(world: World): void {
    const g = this.g;
    const ctx = g.ctx;
    for (const p of world.projectiles.items) {
      if (!p.alive) continue;
      if (p.kind === 'ring') {
        const x = p.x - this.camX;
        const y = p.y - this.camY;
        const freeze = (p.flags & PF.FREEZE) !== 0;
        // 広がるほど薄くして、画面を覆い隠さないようにする
        ctx.globalAlpha = Math.min(0.85, p.life / 12);
        g.arc(x, y, p.dist, freeze ? '#b8f5ef' : '#fff3b0', 0, TWO_PI, 1);
        g.arc(x, y, Math.max(1, p.dist - 3), freeze ? '#52d2da' : '#f7c948', 0, TWO_PI, 1, 3);
        ctx.globalAlpha = 1;
        continue;
      }
      if (p.kind !== 'sweep') continue;
      const colors = SWEEP_COLORS[p.visual] ?? SWEEP_COLORS.slash!;
      const x = world.player.x - this.camX;
      const y = world.player.y - this.camY - 8;
      const total = p.age + p.life;
      const k = Math.min(1, p.age / total);
      let a0: number;
      let a1: number;
      if (p.flags & PF.FULL) {
        // 全周：ぐるりと一回転
        a1 = p.angle + k * TWO_PI * 1.15;
        a0 = a1 - 2.6;
      } else {
        // 扇形：端から端へ振り抜く。偶数回目と奇数回目で振る向きを逆にする
        const dir = p.phase ? -1 : 1;
        const lead = p.angle - dir * p.spin + dir * p.spin * 2 * Math.min(1, k * 1.5);
        const tail = lead - dir * Math.min(p.spin * 1.5, 1.4);
        a0 = Math.min(lead, tail);
        a1 = Math.max(lead, tail);
        // 振り始めの側を細らせるため、どちらが先頭かを覚えておく
        if (dir < 0) {
          // 先頭は a0 側
          this.sweepBands(x, y, p.dist, a1, a0, colors, 1 - k * 0.6);
          continue;
        }
      }
      this.sweepBands(x, y, p.dist, a0, a1, colors, 1 - k * 0.6);
    }
  }

  /**
   * 三日月形の太刀筋。tail から lead へ向けて描き、内側の帯ほど短くして尾を細らせる。
   * lead < tail でも描けるよう、角度の大小は中で入れ替える。
   */
  private sweepBands(
    x: number,
    y: number,
    reach: number,
    tail: number,
    lead: number,
    colors: [string, string, string],
    alpha: number,
  ): void {
    const g = this.g;
    const ctx = g.ctx;
    const BANDS = 7;
    ctx.globalAlpha = Math.max(0.15, alpha);
    for (let i = 0; i < BANDS; i++) {
      const start = tail + (lead - tail) * (i / BANDS) * 0.75;
      const color = i < 2 ? colors[0] : i < 4 ? colors[1] : colors[2];
      g.arc(x, y, reach - i, color, Math.min(start, lead), Math.max(start, lead));
    }
    ctx.globalAlpha = 1;
  }

  // ---- 灯り -----------------------------------------------------------------

  private addLights(world: World, tick: number, lantern: number): void {
    const L = this.lighting;
    const camX = this.camX;
    const camY = this.camY;
    const p = world.player;
    // 手にした灯りは、ゆらゆらと揺れる
    const flicker = 1 + Math.sin(tick * 0.21) * 0.012 + Math.sin(tick * 0.057) * 0.01;
    L.light(p.x - camX, p.y - camY - 8, lantern * flicker);

    for (const prop of world.props.items) {
      L.light(prop.x - camX, prop.y - camY - 12, 46 + Math.sin((tick + prop.id * 13) * 0.2) * 2);
    }
    for (const e of world.enemies.items) {
      if (!e.alive) continue;
      const x = e.x - camX;
      const y = e.y - camY;
      if (!this.visible(x, y, 60)) continue;
      if (e.boss) L.light(x, y - e.radius, e.radius * 3.2, 0.55);
      else if (e.elite) L.light(x, y - e.radius, 34, 0.45);
      else if (e.def.id === 'onibi') L.light(x, y - 5, 18, 0.75);
      else if (e.def.id === 'wanyudo') L.light(x, y - 10, 36, 0.9);
      else if (e.def.id === 'chochin') L.light(x, y - 8, 16, 0.5);
    }
    for (const pr of world.projectiles.items) {
      if (!pr.alive) continue;
      const x = pr.x - camX;
      const y = pr.y - camY;
      switch (pr.kind) {
        case 'lob':
          L.light(x, y - 10, 28, 0.9);
          break;
        case 'zone':
          L.light(x, y, pr.radius * (pr.visual === 'burn' ? 1.5 : 1.15), pr.visual === 'burn' ? 0.9 : 0.4);
          break;
        case 'orbit':
          L.light(x, y, 13, 0.5);
          break;
        case 'bullet':
          if (pr.visual !== 'ofuda' && pr.visual !== 'arrow') L.light(x, y, 16, 0.6);
          break;
        case 'seeker':
          if (pr.visual === 'crane_gold') L.light(x, y - 6, 13, 0.5);
          break;
        case 'ring':
          L.light(x, y, pr.dist + 8, 0.25);
          break;
        default:
          break;
      }
    }
    for (const s of world.shots.items) L.light(s.x - camX, s.y - camY, 11, 0.7);
    for (const k of world.pickups.items) {
      if (k.kind === 'chest') L.light(k.x - camX, k.y - camY - 6, 30, 0.8);
      else if (k.kind !== 'gem' && k.kind !== 'coin') L.light(k.x - camX, k.y - camY, 14, 0.5);
    }
    for (const fl of this.lights) {
      L.light(fl.x - camX, fl.y - camY, fl.r, fl.life / fl.max);
    }
  }

  // ---- 世界に重ねる表示 -----------------------------------------------------

  private drawBars(world: World): void {
    const g = this.g;
    const p = world.player;
    if (world.phase !== 'dead') {
      // 体力は足元に出す（視線を動かさずに確かめられる）
      const x = Math.round(p.x - this.camX) - 12;
      const y = Math.round(p.y - this.camY) + 4;
      const ratio = Math.max(0, p.hp / p.maxHp);
      g.rect(x - 1, y - 1, 26, 5, '#0b0b16');
      g.rect(x, y, 24, 3, '#551428');
      g.rect(x, y, Math.ceil(24 * ratio), 3, ratio > 0.3 ? '#cf3a2f' : '#f2507a');
      g.rect(x, y, Math.ceil(24 * ratio), 1, ratio > 0.3 ? '#ea6a50' : '#ffa0c2');
    }
    for (const e of world.enemies.items) {
      if (!e.alive || !e.elite) continue;
      const x = Math.round(e.x - this.camX) - 12;
      const y = Math.round(e.y - this.camY) - Math.round(e.radius * 4) - 6;
      if (!this.visible(x, y, 30)) continue;
      const ratio = Math.max(0, e.hp / e.maxHp);
      g.rect(x - 1, y - 1, 26, 4, '#0b0b16');
      g.rect(x, y, Math.ceil(24 * ratio), 2, '#f7c948');
    }
  }

  /** 画面の外にあるつづらと大妖の方向を、縁の矢印で示す */
  private drawIndicators(world: World, tick: number): void {
    const g = this.g;
    const cx = g.w / 2;
    const cy = g.h / 2;
    const point = (wx: number, wy: number, icon: string): void => {
      const x = wx - this.camX;
      const y = wy - this.camY;
      if (this.visible(x, y, -8)) return;
      const angle = Math.atan2(y - cy, x - cx);
      // 画面の縁の少し内側に置く
      const k = Math.min((cx - 14) / Math.abs(Math.cos(angle) || 1e-6), (cy - 14) / Math.abs(Math.sin(angle) || 1e-6));
      const ix = cx + Math.cos(angle) * k;
      const iy = cy + Math.sin(angle) * k;
      const bob = Math.sin(tick * 0.15) * 2;
      g.spriteRot('ui.arrow', 0, ix + Math.cos(angle) * bob, iy + Math.sin(angle) * bob, angle);
      g.sprite(icon, 0, ix - Math.cos(angle) * 12, iy - Math.sin(angle) * 12 + (icon === 'item.chest' ? 6 : 0));
    };
    for (const k of world.pickups.items) {
      if (k.kind === 'chest') point(k.x, k.y, 'item.chest');
    }
    for (const e of world.enemies.items) {
      if (e.alive && e.boss) point(e.x, e.y, 'ui.skull');
    }
  }
}

