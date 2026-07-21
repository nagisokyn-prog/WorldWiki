import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: [
      'test/**/*.test.ts',
      'apps/spa/src/ts/**/*.test.ts',
      'packages/components/test/**/*.test.ts'
    ],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'packages/components/src/ts/services/settings.service.ts',
        'packages/components/src/components/Vue/Settings.vue'
      ],
      exclude: [
        'packages/components/src/ts/**/*.d.ts'
      ]
    }
  },
  resolve: {
    alias: {
      '@': '/apps/spa/src/ts',
      '@services': '/apps/spa/src/ts/services',
      '@components': '/apps/spa/src/ts/components',
      '@utils': '/apps/spa/src/ts/utils',
      '@types': '/apps/spa/src/ts/types',
      '@/ts': resolve(__dirname, 'packages/components/src/ts'),
      '@/components': resolve(__dirname, 'packages/components/src/components'),
      '@worldwiki/components': resolve(__dirname, 'packages/components/src'),
      '@worldwiki/resources': resolve(__dirname, 'packages/resources/src')
    }
  }
});