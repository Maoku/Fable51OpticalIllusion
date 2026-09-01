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
  },
});
