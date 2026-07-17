import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': '/src/ts',
      '@services': '/src/ts/services',
      '@components': '/src/ts/components',
      '@utils': '/src/ts/utils',
      '@types': '/src/ts/types'
    }
  }
});
