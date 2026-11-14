import type { SfxId } from '../../audio/port';
import { botInput } from '../../core/bot/bot';
import { ENEMIES } from '../../core/data/enemies';
import { WEAPONS } from '../../core/data/weapons';
import type { SimEvent } from '../../core/events';
import type { RunSummary } from '../../core/meta/save';
import { skipTo } from '../../core/sim/debug';
import { step } from '../../core/sim/step';
import { applyUpgrade, availableEvolutions } from '../../core/sim/upgrades';
import { createWorld, edgePoint, grantPassive, grantWeapon, spawnEnemy, spawnPickup } from '../../core/sim/world';
import { refreshPlayer } from '../../core/sim/stats';
import type { CharacterId, EnemyId, PassiveId, SimInput, WeaponId, WeaponKind, World } from '../../core/types';
import { WorldView } from '../../render/worldView';
import { drawHud, drawStick, type Banner } from '../../ui/hud';
import { ChestPanel, LevelUpPanel, PausePanel } from '../../ui/overlays';
import { C, shade } from '../../ui/widgets';
import type { Game, Scene } from '../game';
import { ResultScene } from './result';

/** 武器の型ごとの発射音 */
const FIRE_SFX: Record<WeaponKind, SfxId | null> = {
  homing: 'w_ofuda',
  arrow: 'w_arrow',
  sweep: 'w_staff',
  orbit: 'w_bead',
  lob: 'w_fire',
  aura: null,
  zone: 'w_salt',
  boomerang: 'w_wind',
  strike: 'w_thunder',
  seeker: 'w_crane',
  ring: 'w_bell',
  slash: 'w_slash',
};

const WARNINGS: Record<string, [string, string]> = {
  stream: ['鬼火の流れ', '青い火の群れが横切る'],
  ring: ['塗り壁の包囲', '壁が輪になって迫る'],
  rush: ['輪入道の暴走', '赤い線から離れろ'],
  parade: ['百鬼夜行', '大行列が通り過ぎる'],
  swarm: ['餓鬼の大群', '四方から押し寄せる'],
  dark: ['丑三つ時', '闇が深まり、妖怪が活気づく'],
  elite: ['精鋭 出現', '倒すとつづらを落とす'],
};

/** 力尽きてから・夜が明けてから結果画面へ移るまでの tick */
const DEATH_WAIT = 110;
const VICTORY_WAIT = 170;

/** 一夜のプレイ画面 */
export class RunScene implements Scene {
  private readonly world: World;
  private readonly view: WorldView;
  private readonly levelUp = new LevelUpPanel();
  private readonly chest = new ChestPanel();
  private readonly pause = new PausePanel();
  private readonly move: SimInput = { mx: 0, my: 0 };
  private banner: Banner | null = null;
  private paused = false;
  private endTimer = 0;
  private intensity = -1;
  /** デバッグ用：自動操縦と無敵 */
  private auto = false;
  private god = false;

  constructor(
    private readonly game: Game,
    character: CharacterId,
  ) {
    const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
    this.world = createWorld({ seed, character, shop: game.save.shop });
    this.view = new WorldView(game.gfx, () => game.save.settings);
    game.audio.setPaused(false);
    game.audio.music('stage', 1.2);
    this.setIntensity(0);
    // タイトルにいる間に別のウィンドウへ移っていた、という古い記録は捨てておく
    game.input.takeBlur();
    // 初めての人が何をすればよいか分かるよう、出だしに操作を一言だけ伝える
    this.say('逢魔が時', '移動だけを操れ。武器はひとりでに妖怪を祓う', C.gold, 240);
    if (game.debug) this.installDebug();
  }

  // ---------------------------------------------------------------------------
  // 更新
  // ---------------------------------------------------------------------------

  update(): void {
    const { input, audio, gfx } = this.game;
    const world = this.world;
    if (this.banner && this.banner.life > 0) this.banner.life--;
    input.stickEnabled = world.phase === 'playing' && !this.paused;
    // 妖怪は「画面のすぐ外」に湧く。ウィンドウの形で映る範囲が変わるので、毎回合わせておく
    world.view.hw = gfx.w / 2;
    world.view.hh = gfx.h / 2;
    const lostFocus = input.takeBlur();

    if (this.paused) {
      const result = this.pause.update(input, audio, gfx);
      if (result === 'resume') {
        this.paused = false;
        audio.setPaused(false);
        audio.sfx('ui_confirm');
      } else if (result === 'quit') {
        audio.setPaused(false);
        this.finish(false);
      }
      return;
    }

    this.view.update();
    switch (world.phase) {
      case 'playing': {
        const b = this.pauseButton();
        if (input.pressed('pause') || input.clicked(b.x, b.y, b.w, b.h) || lostFocus) {
          this.paused = true;
          audio.setPaused(true);
          audio.sfx('ui_cancel');
          return;
        }
        if (this.god) world.player.hp = world.player.maxHp;
        let move = this.move;
        if (this.auto) {
          move = botInput(world);
        } else {
          move.mx = input.moveX;
          move.my = input.moveY;
        }
        step(world, move);
        this.consume();
        this.setIntensity(Math.min(3, Math.floor(world.time / 300)));
        break;
      }
      case 'levelup':
        if (this.levelUp.update(world, input, audio, gfx, this.auto)) this.consume();
        break;
      case 'chest':
        if (this.chest.update(world, input, audio, this.auto)) this.consume();
        break;
      case 'dawn':
        step(world, this.move);
        this.consume();
        break;
      case 'dead':
        if (++this.endTimer > DEATH_WAIT || (this.endTimer > 40 && input.anyConfirm())) this.finish(false);
        break;
      case 'victory':
        if (++this.endTimer > VICTORY_WAIT || (this.endTimer > 60 && input.anyConfirm())) this.finish(true);
        break;
    }
  }

  /** 画面右上の一時停止ボタン（タッチやマウスだけでも止められるように） */
  private pauseButton(): { x: number; y: number; w: number; h: number } {
    return { x: this.game.gfx.w - 20, y: 52, w: 16, h: 16 };
  }

  private setIntensity(level: number): void {
    if (level === this.intensity) return;
    this.intensity = level;
    this.game.audio.setIntensity(level);
  }

  private say(title: string, sub: string, color: string = C.danger, life = 190): void {
    this.banner = { title, sub, life, max: life, color };
  }

  /** シミュレーションが出した出来事を、演出・音・告知に変える */
  private consume(): void {
    const world = this.world;
    const audio = this.game.audio;
    const events = world.events;
    this.view.onEvents(world, events);
    const px = world.player.x;
    const pan = (x: number): number => Math.max(-1, Math.min(1, (x - px) / 320)) * 0.7;

    for (const ev of events) {
      switch (ev.t) {
        case 'hit':
          audio.sfx(ev.crit ? 'crit' : 'hit', { pan: pan(ev.x) });
          break;
        case 'kill':
          audio.sfx('kill', { pan: pan(ev.x) });
          break;
        case 'fire': {
          const id = FIRE_SFX[WEAPONS[ev.weapon].kind];
          if (id) audio.sfx(id);
          break;
        }
        case 'fx':
          if (ev.kind === 'explosion') audio.sfx('w_explode', { pan: pan(ev.x), volume: 0.8 });
          else if (ev.kind === 'shockwave') audio.sfx('w_explode', { pan: pan(ev.x), pitch: 0.7 });
          break;
        case 'playerHit':
          audio.sfx('player_hurt');
          break;
        case 'heal':
          audio.sfx('heal');
          break;
        case 'pickup':
          if (ev.kind === 'gem') audio.sfx('gem');
          else if (ev.kind === 'coin' || ev.kind === 'bag') audio.sfx('coin');
          else if (ev.kind !== 'chest') audio.sfx('item');
          break;
        case 'levelUp':
          audio.sfx('level_up');
          break;
        case 'upgrade':
          this.onUpgrade(ev);
          break;
        case 'propBreak':
          audio.sfx('break', { pan: pan(ev.x) });
          break;
        case 'nuke':
          audio.sfx('nuke');
          break;
        case 'freeze':
          audio.sfx('freeze');
          break;
        case 'revive':
          audio.sfx('revive');
          this.say('身代わり人形', '一度だけ蘇った', C.gold);
          break;
        case 'bossSpawn':
          audio.sfx('boss_warn');
          this.say(`大妖 ${ENEMIES[ev.enemy].name}`, '現る', C.danger, 230);
          audio.music('boss', 1.5);
          break;
        case 'bossKill':
          audio.sfx('boss_kill');
          this.say(`${ENEMIES[ev.enemy].name} 討伐`, 'つづらを落とした', C.gold);
          if (!world.enemies.items.some((e) => e.alive && e.boss)) {
            audio.music('stage', 2);
          }
          break;
        case 'warn': {
          const text = WARNINGS[ev.kind];
          if (text) this.say(text[0], text[1], ev.kind === 'elite' ? C.gold : C.danger);
          audio.sfx('event_warn');
          break;
        }
        case 'death':
          audio.sfx('death');
          audio.music('defeat', 0.6);
          break;
        case 'dawn':
          audio.sfx('dawn');
          audio.music('victory', 2);
          this.say('夜明け', '朝日が百鬼夜行を祓う', C.gold, 260);
          break;
      }
    }
    events.length = 0;
  }

  private onUpgrade(ev: Extract<SimEvent, { t: 'upgrade' }>): void {
    // つづらから出た覚醒は、つづらの画面が見せるので告知を重ねない
    if (ev.upgrade.kind === 'evolve' && this.world.phase !== 'chest') {
      this.say(`覚醒　${WEAPONS[ev.upgrade.id].name}`, `${WEAPONS[ev.upgrade.from].name} が真の姿を現した`, C.gold, 220);
    }
  }

  private finish(victory: boolean): void {
    const world = this.world;
    const summary: RunSummary = {
      character: world.player.char.id,
      time: Math.min(world.time, world.config.duration),
      kills: world.run.kills,
      level: world.player.level,
      gold: world.run.gold,
      bossKills: [...world.run.bossKills],
      victory,
    };
    this.game.input.stickEnabled = false;
    this.game.goto(new ResultScene(this.game, summary, world));
  }

  // ---------------------------------------------------------------------------
  // 描画
  // ---------------------------------------------------------------------------

  draw(): void {
    const { gfx: g, input, tick } = this.game;
    const world = this.world;
    this.view.draw(world, tick);
    drawHud(g, world, tick, this.view.hurt, this.banner);
    if (world.phase === 'playing' && !this.paused) {
      const b = this.pauseButton();
      g.ctx.globalAlpha = input.hover(b.x, b.y, b.w, b.h) ? 1 : 0.6;
      g.rect(b.x, b.y, b.w, b.h, C.ink);
      g.rect(b.x + 1, b.y + 1, b.w - 2, b.h - 2, C.night2);
      g.rect(b.x + 4, b.y + 4, 3, 8, C.pale);
      g.rect(b.x + 9, b.y + 4, 3, 8, C.pale);
      g.ctx.globalAlpha = 1;
    }

    if (this.paused) {
      this.pause.draw(g, world, tick);
    } else if (world.phase === 'levelup') {
      this.levelUp.draw(g, world, tick);
    } else if (world.phase === 'chest') {
      this.chest.draw(g, world, tick);
    } else if (world.phase === 'dead') {
      const k = Math.min(1, this.endTimer / 60);
      shade(g, k * 0.72, '#2a0812');
      if (this.endTimer > 30) {
        g.print('力尽きた', g.w / 2, 140, { align: 'center', color: C.danger, scale: 3 });
      }
    } else if (world.phase === 'victory') {
      const k = Math.min(1, this.endTimer / 50);
      g.ctx.globalAlpha = k;
      g.print('夜明け', g.w / 2, 120, { align: 'center', color: C.gold, outline: C.crimson, scale: 4 });
      g.print('百鬼夜行を祓いきった', g.w / 2, 196, { align: 'center', color: C.paper });
      g.ctx.globalAlpha = 1;
    }
    drawStick(g, input);

    if (this.game.debug) {
      const text = `${world.enemies.items.length}`;
      g.num(text, 4, g.h - 12, C.dim);
    }
  }

  // ---------------------------------------------------------------------------
  // デバッグ用の操作口（?debug=1 のときだけ window.__hb に生やす）
  // ---------------------------------------------------------------------------

  private installDebug(): void {
    const world = this.world;
    const game = this.game;
    const api = {
      world,
      game,
      /** 経過時間を秒で指定して飛ばす */
      skip: (seconds: number): void => skipTo(world, seconds),
      auto: (on: boolean): void => {
        this.auto = on;
      },
      god: (on: boolean): void => {
        this.god = on;
      },
      speed: (n: number): void => {
        game.speed = n;
      },
      weapon: (id: WeaponId, level = 1): void => {
        const owned = world.player.weapons.find((w) => w.def.id === id) ?? grantWeapon(world, id);
        owned.level = Math.min(level, owned.def.maxLevel);
        refreshPlayer(world.player);
      },
      passive: (id: PassiveId, level = 1): void => {
        const owned = world.player.passives.find((p) => p.def.id === id) ?? grantPassive(world, id);
        owned.level = Math.min(level, owned.def.maxLevel);
        refreshPlayer(world.player);
      },
      evolve: (): void => {
        for (const u of availableEvolutions(world)) applyUpgrade(world, u);
      },
      spawn: (id: EnemyId, count = 1, elite = false): void => {
        for (let i = 0; i < count; i++) {
          const pt = edgePoint(world, -80);
          spawnEnemy(world, id, pt.x, pt.y, { elite });
        }
      },
      xp: (amount: number): void => {
        spawnPickup(world, 'gem', world.player.x, world.player.y, amount);
      },
      chest: (): void => {
        spawnPickup(world, 'chest', world.player.x + 20, world.player.y);
      },
      /** n tick だけ進めて 1 回描く（タブが裏にあっても動かせる） */
      advance: (n: number): void => game.advance(n),
    };
    (window as unknown as { __hb: unknown }).__hb = api;
  }
}
