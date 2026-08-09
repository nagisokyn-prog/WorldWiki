import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import VueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig({
  plugins: [
    vue(),
    VueDevTools(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
      dirs: ['src/ts/composables']
    }),
    Components({
      dirs: ['src/ts/components'],
      dts: 'src/components.d.ts'
    })
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
        app: resolve(__dirname, 'app.html'),
        settings: resolve(__dirname, 'settings.html'),
        ui_editor: resolve(__dirname, 'ui_editor.html'),
        ai: resolve(__dirname, 'ai.html')
      },
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: false,
    strictPort: true,
    fs: {
      allow: ['../..']
    }
  },
  optimizeDeps: {
    force: true
  }
});