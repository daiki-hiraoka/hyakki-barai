/**
 * オブジェクトプール。
 * 敵・弾・霊玉は毎秒大量に生まれて消えるので、消えたオブジェクトを使い回して
 * ガベージコレクションによる引っかかりを避ける。
 * 削除は alive = false にしておき、tick の終わりに compact でまとめて詰める
 * （走査中に配列が動かないので、ループを単純に書ける）。
 */
export class Pool<T extends { alive: boolean }> {
  readonly items: T[] = [];
  private readonly free: T[] = [];

  constructor(private readonly factory: () => T) {}

  /** 生きた要素を 1 つ取り出す。各フィールドの初期化は呼び出し側が行う */
  alloc(): T {
    const item = this.free.pop() ?? this.factory();
    item.alive = true;
    this.items.push(item);
    return item;
  }

  /** alive でない要素を取り除く（順序は保つ） */
  compact(): void {
    const items = this.items;
    let write = 0;
    for (let read = 0; read < items.length; read++) {
      const item = items[read]!;
      if (item.alive) {
        items[write++] = item;
      } else {
        this.free.push(item);
      }
    }
    items.length = write;
  }

  clear(): void {
    for (const item of this.items) {
      item.alive = false;
      this.free.push(item);
    }
    this.items.length = 0;
  }
}
