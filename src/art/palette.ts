/**
 * 共通パレット。すべてのスプライトはここにある記号だけで描く。
 * 色数を絞って 1 か所で管理することで、誰が描いても画面全体の統一感が保たれる。
 * '.' は透明を表す予約記号で、ここには含めない。
 */
export const PALETTE: Record<string, string> = {
  // 墨・藍（輪郭線と夜の色）
  '0': '#0b0b16',
  '1': '#1a1930',
  '2': '#2b2b4c',
  '3': '#3f4573',
  '4': '#5c6ca3',
  '5': '#8fa5d2',
  '6': '#c9d7f0',
  '7': '#ffffff',
  // 朱・紅
  r: '#cf3a2f',
  R: '#8c2030',
  s: '#ea6a50',
  S: '#551428',
  // 橙・金
  o: '#f08c30',
  O: '#b65a20',
  y: '#f7c948',
  Y: '#c2902c',
  l: '#fff3b0',
  // 緑
  g: '#4f9a4c',
  G: '#2f6b40',
  h: '#93d05c',
  H: '#1c4431',
  m: '#3d8273',
  M: '#234f4b',
  // 水色（霊的な光）
  c: '#52d2da',
  C: '#2b8fab',
  i: '#b8f5ef',
  // 紫
  p: '#8b58ba',
  P: '#5b3688',
  v: '#c394e2',
  V: '#39245a',
  // 桃
  k: '#ea8db2',
  K: '#b0507c',
  // 茶・木
  b: '#8c5c36',
  B: '#603c24',
  t: '#ba8c54',
  T: '#3c2518',
  n: '#dcbc8c',
  // 肌
  f: '#f3caa2',
  F: '#d29a72',
  e: '#a86c4c',
  // 和紙
  w: '#f5edd9',
  W: '#d9ccb1',
  x: '#a99b85',
  // 石
  a: '#9c9cab',
  A: '#6c6c7f',
  d: '#48485a',
  D: '#2f2f3e',
  // 骨
  z: '#e9e5ca',
  Z: '#b9b192',
  // 青
  u: '#5ba2ea',
  U: '#2f60b2',
  // 桃紅（警告色）
  q: '#f2507a',
  Q: '#ffa0c2',
  // 薄緑（回復）
  j: '#7be2a2',
  J: '#39a96a',
};

/** '#rrggbb' を [r, g, b] に変換する */
export function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}
