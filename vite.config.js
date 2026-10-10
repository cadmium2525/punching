import { defineConfig } from 'vite';

// GitHub Pages のサブパスでも動くよう相対パスでビルドする
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  server: { host: true },
});
