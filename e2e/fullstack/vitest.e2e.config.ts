import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['e2e/fullstack/**/*.spec.ts'],
    setupFiles: [resolve(__dirname, './setup.ts')],
    testTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../apps/spa/src/ts'),
      '@worldwiki/components': resolve(__dirname, '../../packages/components/src'),
      '@worldwiki/resources': resolve(__dirname, '../../packages/resources/src'),
    },
    dedupe: ['vue', 'pinia', '@tauri-apps/api', '@tauri-apps/api/core'],
  },
});
