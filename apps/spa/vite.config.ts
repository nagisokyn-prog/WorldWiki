import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import checker from 'vite-plugin-checker';
import vueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig({
  plugins: [
    vue(),
    // checker({
    //   typescript: true,
    //   vueTsc: true
    // })
  ],
  root: '.',
  base: './',
  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm-bundler.js',
      'vue-i18n': 'vue-i18n/dist/vue-i18n.esm-bundler.js',
      '@worldwiki/components': resolve(__dirname, '../../packages/components/src'),
      '@worldwiki/resources': resolve(__dirname, '../../packages/resources/src'),
      '@': resolve(__dirname, 'src/ts'),
      '@services': resolve(__dirname, 'src/ts/services'),
      '@components': resolve(__dirname, 'src/ts/components'),
      '@utils': resolve(__dirname, 'src/ts/utils'),
      '@types': resolve(__dirname, 'src/ts/types')
    }
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    cssMinify: 'esbuild',
    rollupOptions: {
      input: {
        splash: resolve(__dirname, 'splash.html'),
        project_launcher: resolve(__dirname, 'project_launcher.html'),
        app: resolve(__dirname, 'app.html'),
        settings: resolve(__dirname, 'settings.html'),
        ui_editor: resolve(__dirname, 'ui_editor.html')
      },
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