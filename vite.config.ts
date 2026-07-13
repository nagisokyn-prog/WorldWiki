import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  root: 'src',
  base: './',
  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm-browser.js',
      'vue-i18n': resolve(__dirname, 'node_modules/vue-i18n/dist/vue-i18n.esm-browser.js'),
      '@': resolve(__dirname, 'src/ts'),
      '@services': resolve(__dirname, 'src/ts/services'),
      '@components': resolve(__dirname, 'src/ts/components'),
      '@utils': resolve(__dirname, 'src/ts/utils'),
      '@types': resolve(__dirname, 'src/ts/types')
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    cssMinify: 'esbuild',
    rollupOptions: {
      input: {
        splash: resolve(__dirname, 'src/splash.html'),
        project_launcher: resolve(__dirname, 'src/project_launcher.html'),
        app: resolve(__dirname, 'src/app.html'),
        settings: resolve(__dirname, 'src/settings.html'),
        ui_editor: resolve(__dirname, 'src/ui_editor.html')
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: false,
    strictPort: true,
    fs: {
      allow: ['..']
    }
  },
  test: {
    globals: true,
    include: ['../test/**/*.test.ts', 'js/__tests__/**/*.test.ts', 'ts/__tests__/**/*.test.ts'],
  },
  logLevel: 'info',
  clearScreen: false
});