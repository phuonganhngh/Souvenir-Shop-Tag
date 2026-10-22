import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  base: './',
  define: { __PORTABLE_BUILD__: 'true' },
  plugins: [viteSingleFile()],
  build: { outDir: 'portable', assetsInlineLimit: Infinity },
});
