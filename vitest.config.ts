import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['test/**/*.test.ts', 'apps/spa/src/ts/**/*.test.ts'],
    setupFiles: ['./test/setup.ts']
  },
  resolve: {
    alias: {
      '@': '/apps/spa/src/ts',
      '@services': '/apps/spa/src/ts/services',
      '@components': '/apps/spa/src/ts/components',
      '@utils': '/apps/spa/src/ts/utils',
      '@types': '/apps/spa/src/ts/types',
      '@worldwiki/components': resolve(__dirname, 'packages/components/src'),
      '@worldwiki/resources': resolve(__dirname, 'packages/resources/src')
    }
  }
});