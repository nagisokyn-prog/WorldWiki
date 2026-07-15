import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts', 'src/js/__tests__/**/*.test.ts'],
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