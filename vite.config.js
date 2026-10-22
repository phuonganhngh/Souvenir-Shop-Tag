import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  define: { __PORTABLE_BUILD__: 'false' },
  build: { rollupOptions: { input: { main: 'index.html', restaurant: 'restaurant.html' } } },
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
});
