import { defineConfig } from 'vite';
import { resolve } from 'path';

// dts временно отключен из-за несовместимости с TypeScript 7
// Используем tsconfig paths для типизации

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WorldWikiResources',
      fileName: 'index',
      formats: ['es']
    },
    outDir: 'dist',
    minify: false
  }
});