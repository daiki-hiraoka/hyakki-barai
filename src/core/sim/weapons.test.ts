import { describe, expect, it } from 'vitest';
import type { Enemy, WeaponId, WeaponState, World } from '../types';
import { refreshPlayer } from './stats';
import { eventsOf, makeWorld, run } from './testkit';
import { applyUpgrade } from './upgrades';
import { grantWeapon, spawnEnemy, spawnPickup, spawnProp } from './world';

/** 能力値に補正のない祓い手（剛海）で、指定の武器だけを持たせる。次の tick に撃つ */
function setup(id: WeaponId, level = 1): { world: World; weapon: WeaponState } {
  const world = makeWorld({ character: 'goukai' });
  world.player.weapons.length = 0;
  const weapon = grantWeapon(world, id);
  weapon.level = level;
  refreshPlayer(world.player);
  weapon.timer = 1;
  return { world, weapon };
}

/** その場から動かず、ノックバックも受けない的（体力 300・半径 10） */
function dummy(world: World, x: number, y: number): Enemy {
  const e = spawnEnemy(world, 'nurikabe', x, y);
  e.cx = x;
  e.cy = y;
  return e;
}

/** 動かないが、ノックバックや引き寄せは受ける的（体力 55・半径 7） */
function frozen(world: World, x: number, y: number): Enemy {
  const e = spawnEnemy(world, 'tanuki', x, y);
  e.frozen = 1e9;
  return e;
}

/** 覚醒武器の検証用に、倒れないだけの体力を持たせる */
function sturdy(e: Enemy): Enemy {
  e.maxHp = 100000;
  e.hp = e.maxHp;
  return e;
}

const lost = (e: Enemy): number => e.maxHp - e.hp;

describe('霊符（追尾）', () => {
  it('最も近い敵へ札を放ち、当たるとダメージを与えて消える', () => {
    const { world } = setup('reifu');
    const near = dummy(world, 80, 0);
    const far = dummy(world, -200, 0);
    const events = run(world, 3);
    expect(eventsOf(events, 'fire')).toHaveLength(1);
    expect(world.projectiles.items).toHaveLength(1);
    expect(world.projectiles.items[0]!.vx).toBeGreaterThan(0);
    run(world, 40);
    expect(lost(near)).toBe(10);
    expect(lost(far)).toBe(0);
    expect(world.projectiles.items).toHaveLength(0);
  });

  it('敵がいなければ撃たない', () => {
    const { world } = setup('reifu');
    const events = run(world, 30);
    expect(world.projectiles.items).toHaveLength(0);
    expect(eventsOf(events, 'fire')).toHaveLength(0);
  });

  it('弾数ぶん連射する', () => {
    const { world } = setup('reifu', 2);
    const target = dummy(world, 80, 0);
    run(world, 45);
    expect(lost(target)).toBe(20);
  });

  it('クールダウンごとに撃ち続ける', () => {
    const { world } = setup('reifu');
    dummy(world, 80, 0);
    // 冷却 1.2 秒 → 5 秒で 5 回（0, 1.2, 2.4, 3.6, 4.8 秒）
    expect(eventsOf(run(world, 300), 'fire')).toHaveLength(5);
  });

  it('神符・八百万は途切れなく撃ち続ける', () => {
    const { world } = setup('yaoyorozu');
    const target = dummy(world, 80, 0);
    run(world, 120);
    expect(lost(target)).toBeGreaterThan(18 * 8);
  });
});

describe('破魔矢（貫通）', () => {
  it('向いている方向へ飛び、貫通数まで当たる', () => {
    const { world } = setup('hamaya');
    const row = [40, 70, 100, 130].map((x) => dummy(world, x, 0));
    run(world, 40);
    expect(row.map(lost)).toEqual([12, 12, 12, 0]);
    expect(world.projectiles.items).toHaveLength(0);
  });

  it('敵がいれば、背を向けていても最も近い敵を狙う', () => {
    const { world } = setup('hamaya');
    world.player.faceX = 1;
    world.player.faceY = 0;
    const behind = dummy(world, -90, 0);
    dummy(world, 200, 0);
    run(world, 30);
    expect(lost(behind)).toBe(12);
  });

  it('敵がいなければ、向いている方向へ飛ぶ', () => {
    const { world } = setup('hamaya');
    world.player.faceX = 0;
    world.player.faceY = -1;
    run(world, 3);
    expect(world.projectiles.items[0]!.vy).toBeLessThan(0);
    expect(world.projectiles.items[0]!.vx).toBeCloseTo(0);
  });

  it('通り道の石灯籠を壊す', () => {
    const { world } = setup('hamaya');
    spawnProp(world, 60, 0);
    const events = run(world, 20);
    expect(eventsOf(events, 'propBreak')).toHaveLength(1);
    expect(world.props.items).toHaveLength(0);
  });

  it('天羽々矢は何体でも貫く', () => {
    const { world } = setup('habaya');
    const row = [40, 70, 100, 130, 160, 190].map((x) => dummy(world, x, 0));
    run(world, 40);
    for (const e of row) expect(lost(e)).toBeGreaterThanOrEqual(45);
  });
});

describe('錫杖（なぎ払い）', () => {
  it('最も近い敵のいる側だけをなぎ払う', () => {
    const { world } = setup('shakujo');
    const near = dummy(world, 40, 0);
    const other = dummy(world, -60, 0);
    run(world, 20);
    expect(lost(near)).toBe(14);
    expect(lost(other)).toBe(0);
  });

  it('背後の敵のほうが近ければ、振り向かなくても背後をなぎ払う', () => {
    const { world } = setup('shakujo');
    world.player.dir = 1;
    const behind = dummy(world, -40, 0);
    const far = dummy(world, 200, 0);
    run(world, 20);
    expect(lost(behind)).toBe(14);
    expect(lost(far)).toBe(0);
  });

  it('レベルが上がると、続けて背後もなぎ払う', () => {
    const { world } = setup('shakujo', 2);
    const front = dummy(world, 40, 0);
    const back = dummy(world, -40, 0);
    run(world, 30);
    expect(lost(front)).toBe(14);
    expect(lost(back)).toBe(14);
  });

  it('当たった敵を弾き飛ばす', () => {
    const { world } = setup('shakujo');
    const e = frozen(world, 30, 0);
    run(world, 40);
    expect(e.x).toBeGreaterThan(40);
  });

  it('金剛杖は全周をなぎ払い、倒すと体力が戻る', () => {
    const { world } = setup('kongo');
    world.player.hp = 50;
    const front = dummy(world, 40, 0);
    const back = dummy(world, -40, 0);
    spawnEnemy(world, 'chochin', 0, 30).frozen = 1e9;
    run(world, 20);
    expect(lost(front)).toBe(44);
    expect(lost(back)).toBe(44);
    expect(world.player.hp).toBe(51);
  });
});

describe('数珠（周回）', () => {
  it('珠が周回して触れた敵を繰り返し打ち、効果時間が過ぎると消える', () => {
    const { world } = setup('juzu');
    const target = dummy(world, 44, 0);
    run(world, 10);
    expect(world.projectiles.items).toHaveLength(2);
    run(world, 175);
    const hits = lost(target) / 8;
    expect(hits).toBeGreaterThanOrEqual(2);
    expect(hits).toBeLessThanOrEqual(8);
    expect(world.projectiles.items).toHaveLength(0);
  });

  it('百八煩悩珠は二重の輪が途切れずに回り続ける', () => {
    const { world } = setup('bonno');
    for (let i = 0; i < 600; i++) {
      run(world, 1);
      expect(world.projectiles.items.length).toBeGreaterThanOrEqual(12);
    }
    const radii = new Set(world.projectiles.items.map((p) => Math.round(p.dist)));
    expect(radii.size).toBe(2);
  });

  it('覚醒すると、元の武器の珠は消える', () => {
    const { world } = setup('juzu');
    run(world, 10);
    applyUpgrade(world, { kind: 'evolve', from: 'juzu', id: 'bonno' });
    run(world, 1);
    expect(world.projectiles.items.some((p) => p.weapon === 'juzu')).toBe(false);
    expect(world.player.weapons[0]!.def.id).toBe('bonno');
  });
});

describe('狐火（着弾して爆発）', () => {
  it('敵のいる場所へ飛び、爆発で周囲を巻き込む', () => {
    const { world } = setup('kitsunebi');
    const a = dummy(world, 100, 0);
    const b = dummy(world, 115, 0);
    const events = run(world, 50);
    expect(lost(a)).toBe(16);
    expect(lost(b)).toBe(16);
    expect(eventsOf(events, 'fx').some((f) => f.kind === 'explosion')).toBe(true);
  });

  it('画面内に敵がいなければ撃たない', () => {
    const { world } = setup('kitsunebi');
    dummy(world, 2000, 0);
    run(world, 30);
    expect(world.projectiles.items).toHaveLength(0);
  });

  it('九尾の業火は、着弾点に燃え続ける炎を残す', () => {
    const { world } = setup('kyubi');
    const target = sturdy(dummy(world, 100, 0));
    run(world, 70);
    expect(world.projectiles.items.some((p) => p.kind === 'zone')).toBe(true);
    const before = lost(target);
    run(world, 40);
    expect(lost(target)).toBeGreaterThan(before);
  });
});

describe('結界（常時ダメージ場）', () => {
  it('範囲内の敵を一定間隔で祓い、範囲外は無傷', () => {
    const { world } = setup('kekkai');
    const inside = dummy(world, 30, 0);
    const outside = dummy(world, 120, 0);
    run(world, 60);
    expect(lost(inside)).toBeGreaterThanOrEqual(10);
    expect(lost(inside)).toBeLessThanOrEqual(15);
    expect(lost(outside)).toBe(0);
  });

  it('四神結界は中の敵の足を鈍らせる', () => {
    const { world } = setup('shijin');
    const inside = dummy(world, 60, 0);
    run(world, 5);
    expect(inside.slow).toBeGreaterThan(0);
  });
});

describe('清め塩（設置する陣）', () => {
  it('敵の近くに陣を敷き、中の敵を祓い続け、時間が来ると消える', () => {
    const { world } = setup('shio');
    const target = dummy(world, 60, 0);
    run(world, 3);
    const zone = world.projectiles.items[0]!;
    expect(zone.kind).toBe('zone');
    expect(Math.hypot(zone.x - 60, zone.y)).toBeLessThan(12);
    run(world, 190);
    expect(lost(target) / 7).toBeGreaterThanOrEqual(3);
    expect(world.projectiles.items).toHaveLength(0);
  });

  it('禊の大陣は敵を中心へ引き寄せる', () => {
    const { world, weapon } = setup('misogi');
    // 陣を 1 つに絞る（複数あると引き合って打ち消し合うため）
    weapon.stats.amount = 1;
    const a = sturdy(frozen(world, 100, 0));
    const b = sturdy(frozen(world, 130, 0));
    run(world, 120);
    // どちらかの足元に陣が敷かれ、もう一方が引き寄せられて間隔が詰まる
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(24);
  });
});

describe('鎌鼬（行って戻る）', () => {
  it('敵を貫いて飛び、戻ってきて消える', () => {
    const { world } = setup('kamaitachi');
    const target = dummy(world, 60, 0);
    run(world, 100);
    const hits = lost(target) / 11;
    expect(hits).toBeGreaterThanOrEqual(1);
    expect(hits).toBeLessThanOrEqual(3);
    expect(world.projectiles.items).toHaveLength(0);
  });

  it('颪は全方位に刃を放つ', () => {
    const { world } = setup('oroshi');
    run(world, 3);
    expect(world.projectiles.items).toHaveLength(6);
    const angles = world.projectiles.items.map((p) => Math.round((p.angle * 180) / Math.PI));
    expect(new Set(angles).size).toBe(6);
  });
});

describe('雷太鼓（落雷）', () => {
  it('画面内の敵に雷を落とす', () => {
    const { world } = setup('taiko');
    const target = dummy(world, 100, 50);
    const events = run(world, 10);
    expect(lost(target)).toBe(22);
    const bolt = eventsOf(events, 'fx').find((f) => f.kind === 'lightning');
    expect(bolt).toMatchObject({ x: 100, y: 50 });
  });

  it('画面の外の敵は狙わない', () => {
    const { world } = setup('taiko');
    const target = dummy(world, 2000, 0);
    run(world, 30);
    expect(lost(target)).toBe(0);
  });

  it('神鳴りは近くの敵へ連鎖する', () => {
    const { world } = setup('kannari');
    const row = [100, 150, 200].map((x) => dummy(world, x, 0));
    const events = run(world, 30);
    for (const e of row) expect(lost(e)).toBeGreaterThan(0);
    expect(eventsOf(events, 'fx').some((f) => f.kind === 'chain')).toBe(true);
  });
});

describe('折り鶴（式神）', () => {
  it('敵を追って体当たりし、時間が来ると消える', () => {
    const { world } = setup('orizuru');
    const target = dummy(world, 90, 30);
    run(world, 180);
    expect(lost(target)).toBeGreaterThanOrEqual(9);
    expect(world.projectiles.items).toHaveLength(1);
    run(world, 140);
    expect(world.projectiles.items).toHaveLength(0);
  });

  it('千羽鶴は通りがかりに霊玉を拾い集める', () => {
    const { world } = setup('senbazuru');
    dummy(world, 150, 0);
    const gem = spawnPickup(world, 'gem', 150, 0, 1);
    run(world, 240);
    expect(gem.pulled || !gem.alive).toBe(true);
  });
});

describe('神楽鈴（広がる輪）', () => {
  it('輪が広がり、通過した敵を 1 度だけ打って押し返す', () => {
    const { world } = setup('suzu');
    const near = frozen(world, 50, 0);
    const far = frozen(world, 300, 0);
    run(world, 60);
    expect(lost(near)).toBe(9);
    expect(near.x).toBeGreaterThan(60);
    expect(lost(far)).toBe(0);
    expect(world.projectiles.items).toHaveLength(0);
  });

  it('岩戸神楽は触れた敵を凍らせる', () => {
    const { world } = setup('iwato');
    const e = spawnEnemy(world, 'tanuki', 60, 0);
    run(world, 20);
    expect(e.frozen).toBeGreaterThan(0);
  });
});

describe('退魔刀（斬撃）', () => {
  it('最も近い敵へ向けて、扇形に斬る（会心なら 2 倍）', () => {
    const { world } = setup('katana');
    world.player.faceX = 1;
    world.player.faceY = 0;
    const near = dummy(world, 0, 30);
    const right = dummy(world, 42, 0);
    const left = dummy(world, -42, 0);
    run(world, 10);
    expect([18, 36]).toContain(lost(near));
    // 斬る向きから 90 度それた敵には当たらない
    expect(lost(right)).toBe(0);
    expect(lost(left)).toBe(0);
  });

  it('近くに敵がいなければ、向いている方向を斬る', () => {
    const { world } = setup('katana');
    world.player.faceX = Math.SQRT1_2;
    world.player.faceY = Math.SQRT1_2;
    dummy(world, -300, 0);
    run(world, 3);
    const slash = world.projectiles.items.find((p) => p.kind === 'sweep')!;
    expect(slash.angle).toBeCloseTo(Math.PI / 4);
  });

  it('妖刀・朧は、刃の届かない先へ斬撃を飛ばす', () => {
    const { world } = setup('oboro');
    const target = dummy(world, 150, 0);
    run(world, 40);
    expect(lost(target)).toBeGreaterThan(0);
  });
});
