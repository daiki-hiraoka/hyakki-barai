import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 相対パスで出力し、dist/ をどこに置いても動くようにする
  base: './',
  server: { port: 5173, strictPort: true },
  build: { target: 'es2022' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
