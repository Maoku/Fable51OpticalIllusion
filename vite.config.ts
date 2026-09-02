import { defineConfig } from 'vite';

export default defineConfig({
  /**
   * 出力を相対パスにして、サブディレクトリ配下(GitHub Pages の
   * /<repo>/ など)にそのまま置けるようにする。dev サーバーでは
   * Vite が '/' として扱うのでローカルの挙動は変わらない。
   */
  base: './',
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
  },
});
