import { defineConfig, configDefaults } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

const withAi =
  process.argv.includes('--ai') ||
  process.argv.includes('--with-ai') ||
  process.env.WITH_AI === '1' ||
  process.env.VITE_WITH_AI === 'true';

export default defineConfig({
  plugins: [vue()],
  define: {
    __FEATURE_AI__: withAi
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    pool: 'vmThreads',
    exclude: [
      ...configDefaults.exclude,
      ...(!withAi ? ['**/features/ai/**', '**/FloatingWindowAI/**'] : [])
    ],
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
      ignoreNode(node, type) {
        if (type === 'branch') {
          if (node.type === 'ChainExpression') {
            return true;
          }
          if (node.type === 'LogicalExpression' && node.operator === '??') {
            return true;
          }
          if (node.type === 'AssignmentPattern') {
            return true;
          }
        }
      },
      reporter: ['text', 'json', 'html', 'lcov', ['markdown-coverage-reporter', { file: './coverage/coverage-report.md' }]],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
        '**/services/**': { branches: 83 },
        '**/stores/**': { branches: 83 },
        '**/*.utils.ts': { branches: 83 },
        '**/use*.ts': {
          lines: 90,
          statements: 90,
          branches: 75,
        },
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
        '**/vite-env.d.ts',
        // Type-only / re-export files — no runtime logic to test
        '**/*.types.ts',
        '**/*.model.ts',
        'apps/spa/src/ts/services/api.service.ts',
        // Thin Tauri invoke wrappers — no unit-testable business logic
        'apps/spa/src/ts/services/api/api.chapters.ts',
        'apps/spa/src/ts/services/api/manuscript.ts',
        'apps/spa/src/ts/services/api/api.entities.ts',
        'apps/spa/src/ts/services/api/entities.ts',
        'apps/spa/src/ts/services/api/projects.ts',
        'apps/spa/src/ts/services/api/plot_calendar.ts',
        'apps/spa/src/ts/services/api/api.projects.ts',
        'apps/spa/src/ts/services/api/api.system.ts',
        'apps/spa/src/ts/services/api/api.calendars.ts',
        'apps/spa/src/ts/stores/index.ts',
        'packages/resources/src/index.ts',
        ...(!withAi
          ? [
            '**/features/ai/**',
            '**/FloatingWindowAI/**',
            'apps/spa/src/ts/services/api/ai.ts',
            'apps/spa/src/ts/services/api/api.ai.ts'
          ]
          : [])
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
