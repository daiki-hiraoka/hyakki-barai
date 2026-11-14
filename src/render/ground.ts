const CHUNK = 256;
/** 地面は 2px のブロック単位で塗る（1px 単位より軽く、ドット絵らしい粗さも出る） */
const BLOCK = 2;
const MAX_CHUNKS = 48;

/** 地面の飾り 1 つ（当たり判定なし。妖怪やプレイヤーと同じく y 順に描く） */
export interface Decor {
  sprite: string;
  frame: number;
  x: number;
  y: number;
  flip: boolean;
}

interface Chunk {
  canvas: HTMLCanvasElement;
  decor: Decor[];
  used: number;
}

// 灯りの下での「本当の色」。夜の闇は描画の最後に色を掛けて表現する
const GRASS = ['#284439', '#2e4f40', '#365b46', '#3f6a4d'];
const PATH = ['#55503f', '#615b47'];
const TUFT = ['#4c8257', '#5c9a5e', '#3f7350'];

/** 整数座標から 0〜1 の擬似乱数を作る（地形はゲームの乱数と独立に決める） */
function hash(x: number, y: number, s: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** なめらかに変化するノイズ */
function noise(x: number, y: number, s: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s);
  const b = hash(ix + 1, iy, s);
  const c = hash(ix, iy + 1, s);
  const d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** 道からの近さ（0 に近いほど道の中心）。ノイズの等高線に沿わせると、途切れない曲がり道になる */
function pathDistance(wx: number, wy: number): number {
  return Math.abs(noise(wx / 270, wy / 270, 3) - 0.5);
}

const PATH_HALF = 0.02;
const PATH_EDGE = 0.028;

/** チャンクごとの連番乱数 */
function chunkRng(cx: number, cy: number): () => number {
  let i = 0;
  return () => hash(cx * 7919 + i++, cy * 104729 + i, 11);
}

/**
 * どこまでも続く地面。256px 四方のチャンクを必要になったときに 1 度だけ描いて使い回す
 * （毎フレームはその画像を数枚貼るだけなので軽い）。
 */
export class Ground {
  private readonly chunks = new Map<string, Chunk>();
  private clock = 0;

  /** カメラに映る範囲の地面を描く */
  draw(ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number): void {
    this.clock++;
    const cx0 = Math.floor(camX / CHUNK);
    const cy0 = Math.floor(camY / CHUNK);
    const cx1 = Math.floor((camX + w) / CHUNK);
    const cy1 = Math.floor((camY + h) / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        const chunk = this.chunk(cx, cy);
        ctx.drawImage(chunk.canvas, cx * CHUNK - camX, cy * CHUNK - camY);
      }
    }
  }

  /** カメラに映る範囲（＋背の高い飾りのぶんの余白）にある飾りを out に足す */
  collectDecor(camX: number, camY: number, w: number, h: number, out: Decor[]): void {
    const margin = 56;
    const cx0 = Math.floor((camX - margin) / CHUNK);
    const cy0 = Math.floor((camY - margin) / CHUNK);
    const cx1 = Math.floor((camX + w + margin) / CHUNK);
    const cy1 = Math.floor((camY + h + margin) / CHUNK);
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        for (const d of this.chunk(cx, cy).decor) {
          if (
            d.x > camX - margin && d.x < camX + w + margin &&
            d.y > camY - 8 && d.y < camY + h + margin
          ) {
            out.push(d);
          }
        }
      }
    }
  }

  private chunk(cx: number, cy: number): Chunk {
    const key = `${cx},${cy}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      if (this.chunks.size >= MAX_CHUNKS) this.evict();
      chunk = build(cx, cy);
      this.chunks.set(key, chunk);
    }
    chunk.used = this.clock;
    return chunk;
  }

  /** いちばん長く使っていないチャンクを捨てる */
  private evict(): void {
    let oldest = '';
    let age = Infinity;
    for (const [key, chunk] of this.chunks) {
      if (chunk.used < age) {
        age = chunk.used;
        oldest = key;
      }
    }
    this.chunks.delete(oldest);
  }
}

function build(cx: number, cy: number): Chunk {
  const canvas = document.createElement('canvas');
  canvas.width = CHUNK;
  canvas.height = CHUNK;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  const ox = cx * CHUNK;
  const oy = cy * CHUNK;

  // ---- 下地：草むらの濃淡と、うねる道
  for (let by = 0; by < CHUNK; by += BLOCK) {
    for (let bx = 0; bx < CHUNK; bx += BLOCK) {
      const wx = ox + bx;
      const wy = oy + by;
      const checker = ((bx + by) / BLOCK) % 2 === 0;
      const pd = pathDistance(wx, wy);
      let color: string;
      if (pd < PATH_HALF || (pd < PATH_EDGE && checker)) {
        color = PATH[hash(wx, wy, 5) < 0.2 ? 1 : 0]!;
      } else {
        const shade = noise(wx / 150, wy / 150, 1) * 0.65 + noise(wx / 40, wy / 40, 2) * 0.35;
        // 階調の境目は市松に混ぜて、段差をなじませる
        const level = shade * 4.4 - 0.4 + (checker ? 0.25 : -0.25);
        color = GRASS[Math.max(0, Math.min(3, Math.floor(level)))]!;
      }
      ctx.fillStyle = color;
      ctx.fillRect(bx, by, BLOCK, BLOCK);
    }
  }

  // ---- 細かな模様：草の葉、小石、落ち葉
  const rnd = chunkRng(cx, cy);
  for (let i = 0; i < 150; i++) {
    const x = Math.floor(rnd() * CHUNK);
    const y = Math.floor(rnd() * CHUNK);
    const onPath = pathDistance(ox + x, oy + y) < PATH_EDGE;
    const pick = rnd();
    if (onPath) {
      ctx.fillStyle = pick < 0.5 ? '#77705a' : '#454031';
      ctx.fillRect(x, y, 2, 1);
      continue;
    }
    if (pick < 0.72) {
      // 草の葉（V 字か 1 本）
      ctx.fillStyle = TUFT[Math.floor(rnd() * TUFT.length)]!;
      ctx.fillRect(x, y, 1, 3);
      if (pick < 0.4) {
        ctx.fillRect(x - 1, y - 1, 1, 2);
        ctx.fillRect(x + 1, y - 1, 1, 2);
      }
    } else if (pick < 0.86) {
      ctx.fillStyle = '#6c6c7f';
      ctx.fillRect(x, y, 2, 1);
      ctx.fillStyle = '#9c9cab';
      ctx.fillRect(x, y - 1, 1, 1);
    } else if (pick < 0.95) {
      ctx.fillStyle = pick < 0.9 ? '#b65a20' : '#8c2030';
      ctx.fillRect(x, y, 2, 1);
    } else {
      // 小さな白い花
      ctx.fillStyle = '#c9d7f0';
      ctx.fillRect(x, y, 1, 1);
      ctx.fillRect(x + 2, y + 1, 1, 1);
    }
  }

  return { canvas, decor: decorate(cx, cy, rnd), used: 0 };
}

/** チャンクに置く飾りを決める */
function decorate(cx: number, cy: number, rnd: () => number): Decor[] {
  const ox = cx * CHUNK;
  const oy = cy * CHUNK;
  const out: Decor[] = [];
  const put = (sprite: string, x: number, y: number, frame = 0, flip = rnd() < 0.5): void => {
    // 出発地点のすぐ近くと、道の上には置かない
    if (Math.hypot(x, y) < 56) return;
    if (pathDistance(x, y) < PATH_EDGE + 0.006) return;
    out.push({ sprite, frame, x: Math.round(x), y: Math.round(y), flip });
  };
  const at = (): [number, number] => [ox + 20 + rnd() * (CHUNK - 40), oy + 20 + rnd() * (CHUNK - 40)];

  // このチャンクの「趣向」。たいていは木立ちだけ、ときどき社や墓地がある
  const theme = hash(cx, cy, 21);
  if (theme < 0.1) {
    // 小さな社：鳥居の奥に祠、脇にすすき
    const [x, y] = at();
    put('decor.torii', x, y + 30, 0, false);
    put('decor.hokora', x, y - 14, 0, false);
    put('decor.susuki', x - 30, y - 6);
    put('decor.susuki', x + 32, y - 2);
  } else if (theme < 0.22) {
    // 墓地：墓石と卒塔婆が並ぶ
    const [x, y] = at();
    const n = 4 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) {
      const gx = x + ((i % 3) - 1) * 22 + rnd() * 4;
      const gy = y + Math.floor(i / 3) * 26 + rnd() * 4;
      put('decor.grave', gx, gy, 0, false);
      if (rnd() < 0.6) put('decor.sotoba', gx + 9, gy - 2, 0, false);
    }
    put('decor.dead_tree', x - 44, y + 10);
  } else if (theme < 0.32) {
    // 六地蔵
    const [x, y] = at();
    const n = 3 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) put('decor.jizo', x + i * 15, y + (i % 2), 0, false);
  } else if (theme < 0.44) {
    // 竹やぶ
    const [x, y] = at();
    const n = 4 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) put('decor.bamboo', x + (rnd() - 0.5) * 60, y + (rnd() - 0.5) * 40);
  }

  // 木立ち
  const trees = Math.floor(rnd() * 3);
  for (let i = 0; i < trees; i++) {
    const [x, y] = at();
    put(rnd() < 0.72 ? 'decor.pine' : 'decor.dead_tree', x, y);
  }
  // 岩
  if (rnd() < 0.55) put('decor.rock', ...at());
  // すすき
  const reeds = Math.floor(rnd() * 4);
  for (let i = 0; i < reeds; i++) put('decor.susuki', ...at());

  // 彼岸花の群れ（ノイズで偏らせ、咲く場所と咲かない場所を作る）
  if (noise(cx * 0.9, cy * 0.9, 31) > 0.48) {
    const clusters = 1 + Math.floor(rnd() * 2);
    for (let c = 0; c < clusters; c++) {
      const [x, y] = at();
      const n = 5 + Math.floor(rnd() * 7);
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const d = rnd() * 24;
        put('decor.higan', x + Math.cos(a) * d, y + Math.sin(a) * d * 0.6, rnd() < 0.5 ? 0 : 1);
      }
    }
  }
  return out;
}
