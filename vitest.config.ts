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
      'apps/spa/src/ts/**/*.spec.ts',
      'apps/spa/src/ts/**/*.test.ts',
      'packages/components/test/**/*.test.ts',
      'packages/components/src/**/*.spec.ts',
      'packages/resources/**/*.spec.ts'
    ],
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov', 'vc-api-coverage'],
      thresholds: {
        lines: 85,
        functions: 85,
        branches: 85,
        statements: 85
      },
      include: [
        'apps/spa/src/ts/stores/**/*.ts',
        'apps/spa/src/ts/services/**/*.ts',
        'apps/spa/src/ts/utils/**/*.ts',
        'apps/spa/src/ts/features/**/*.ts',
        'packages/resources/src/**/*.ts',
        'packages/components/src/ts/**/*.ts'
      ],
      exclude: [
        'apps/spa/src/ts/**/*.d.ts',
        'apps/spa/src/ts/**/*.vue',
        'packages/components/src/ts/**/*.d.ts',
        'packages/components/src/**/*.vue',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/test/**',
        '**/__tests__/**',
        '**/generated/**',
        '**/auto-imports.d.ts',
        '**/components.d.ts',
        '**/vite-env.d.ts'
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