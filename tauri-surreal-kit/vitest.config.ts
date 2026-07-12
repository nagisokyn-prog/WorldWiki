import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['frontend/test/**/*.test.ts', 'frontend/src/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'frontend/src')
    }
  }
});
