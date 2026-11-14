/**
 * ボットに一夜を通しで遊ばせ、分ごとの様子を表にするバランス検証スクリプト。
 *
 *   npm run sim -- [--char <id>] [--seeds <n>] [--god] [--shop] [--minutes <n>]
 *
 * --god   倒れないようにして、20 分間の敵の量と成長の釣り合いだけを見る
 * --shop  社の加護をすべて最大にした状態で始める
 */
import { botChoose, botInput } from '../src/core/bot/bot';
import { SHOP } from '../src/core/data/shop';
import { WEAPONS } from '../src/core/data/weapons';
import { step } from '../src/core/sim/step';
import { chooseUpgrade, closeChest } from '../src/core/sim/upgrades';
import { createWorld } from '../src/core/sim/world';
import { CHARACTER_IDS, SHOP_IDS, type CharacterId, type ShopLevels, type WeaponId, type World } from '../src/core/types';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

const characters = (arg('char') ? [arg('char') as CharacterId] : ['haruma']) as CharacterId[];
const seeds = Number(arg('seeds') ?? 1);
const god = flag('god');
const minutes = Number(arg('minutes') ?? 20);
const shop: ShopLevels = {};
if (flag('shop')) for (const id of SHOP_IDS) shop[id] = SHOP[id].maxRank;

for (const id of characters) {
  if (!CHARACTER_IDS.includes(id)) {
    console.error(`知らない祓い手です: ${id}（${CHARACTER_IDS.join(', ')}）`);
    process.exit(1);
  }
}

interface Minute {
  level: number;
  hp: number;
  alive: number;
  kills: number;
  hurt: number;
  dps: number;
}

function run(character: CharacterId, seed: number): { world: World; rows: Minute[]; ms: number } {
  const world = createWorld({ seed, character, shop, duration: minutes * 60 });
  const rows: Minute[] = [];
  const started = performance.now();
  let aliveSum = 0;
  let ticks = 0;
  let lastKills = 0;
  let lastHurt = 0;
  let lastDamage = 0;
  const totalDamage = (): number => Object.values(world.run.damage).reduce((s, v) => s + (v ?? 0), 0);

  for (;;) {
    if (world.phase === 'levelup') chooseUpgrade(world, botChoose(world));
    else if (world.phase === 'chest') closeChest(world);
    else if (world.phase === 'dead' || world.phase === 'victory') break;
    if (god) world.player.hp = world.player.maxHp;
    step(world, botInput(world));
    if (world.phase !== 'playing') continue;
    aliveSum += world.enemies.items.length;
    ticks++;
    if (world.tick % 3600 === 0) {
      const damage = totalDamage();
      rows.push({
        level: world.player.level,
        hp: Math.round((world.player.hp / world.player.maxHp) * 100),
        alive: Math.round(aliveSum / ticks),
        kills: world.run.kills - lastKills,
        hurt: world.run.damageTaken - lastHurt,
        dps: Math.round((damage - lastDamage) / 60),
      });
      aliveSum = 0;
      ticks = 0;
      lastKills = world.run.kills;
      lastHurt = world.run.damageTaken;
      lastDamage = damage;
    }
  }
  return { world, rows, ms: performance.now() - started };
}

const pad = (v: string | number, n: number): string => String(v).padStart(n);

for (const character of characters) {
  for (let s = 0; s < seeds; s++) {
    const seed = 1000 + s * 77;
    const { world, rows, ms } = run(character, seed);
    const t = world.time;
    const end = world.phase === 'victory' ? '夜明け' : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')} で力尽きた`;
    console.log(`\n=== ${character}  seed ${seed}  → ${end}  （Lv${world.player.level}・${world.run.kills} 体・小判 ${world.run.gold}・計算 ${Math.round(ms)}ms）`);
    console.log('  分 | Lv | 体力% | 敵の数 | 撃破/分 | 被ダメ/分 | 与ダメ/秒');
    rows.forEach((r, i) => {
      console.log(
        `  ${pad(i + 1, 2)} | ${pad(r.level, 2)} | ${pad(r.hp, 5)} | ${pad(r.alive, 6)} | ${pad(r.kills, 7)} | ${pad(r.hurt, 9)} | ${pad(r.dps, 9)}`,
      );
    });
    const weapons = (Object.keys(world.run.damage) as WeaponId[])
      .map((id) => ({ id, damage: world.run.damage[id] ?? 0 }))
      .sort((a, b) => b.damage - a.damage)
      .map((w) => `${WEAPONS[w.id].name} ${Math.round(w.damage / 1000)}k`)
      .join(' / ');
    console.log(`  武器: ${weapons}`);
    console.log(`  装備: ${world.player.weapons.map((w) => `${w.def.name}${w.def.evolved ? '★' : w.level}`).join(' ')} ｜ ${world.player.passives.map((p) => `${p.def.name}${p.level}`).join(' ')}`);
    console.log(`  大妖: ${world.run.bossKills.join(', ') || 'なし'}　つづら: ${world.run.chests}　敵の最大数: ${world.run.peakEnemies}`);
  }
}
