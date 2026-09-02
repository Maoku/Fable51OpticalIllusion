import { defineConfig } from 'vite';

/**
 * GitHub Pages ではリポジトリ名がパスの先頭に付く。
 * deploy.yml から BASE_PATH を渡し、ローカルでは '/' で動かす。
 */
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    host: true,
    // ポートは PORT で外から指定できる(未指定なら Vite の既定 5173)。
    // 同じポートを使う別プロセスがいるときに、開発サーバーを別ポートへ逃がすため。
    port: process.env.PORT ? Number(process.env.PORT) : undefined,
  },
});
