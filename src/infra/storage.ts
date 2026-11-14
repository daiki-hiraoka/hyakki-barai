import type { SaveStorage } from '../core/ports';

/**
 * ブラウザの localStorage を保存先として返す。
 * 使えない環境（プライベートブラウズ等）では、メモリ上の代用を返す（閉じると消える）。
 */
export function browserStorage(): SaveStorage {
  try {
    const probe = '__hyakki_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const memory = new Map<string, string>();
    return {
      getItem: (key) => memory.get(key) ?? null,
      setItem: (key, value) => {
        memory.set(key, value);
      },
    };
  }
}
