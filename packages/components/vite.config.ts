import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

// dts временно отключен из-за несовместимости с TypeScript 7
// Используем tsconfig paths для типизации

export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'WorldWikiComponents',
      fileName: 'index',
      formats: ['es']
    },
    rollupOptions: {
      external: ['vue', 'vue-i18n', '@vueuse/motion', '@formkit/auto-animate'],
      output: {
        globals: {
          vue: 'Vue'
        }
      }
    },
    outDir: 'dist'
  }
});