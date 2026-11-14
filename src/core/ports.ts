/**
 * コアが外の世界に求めるもの（ポート）。実装は外側の層が用意して注入する。
 */

/** セーブデータの保存先。ブラウザでは localStorage をそのまま渡せる形にしてある */
export interface SaveStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
