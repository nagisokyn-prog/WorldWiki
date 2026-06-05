import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts', 'src/js/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': '/src/js',
      '@services': '/src/js/services',
      '@components': '/src/js/components',
      '@utils': '/src/js/utils',
      '@types': '/src/js/types'
    }
  }
});