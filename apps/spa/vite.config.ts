import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import * as fs from 'node:fs';
import vue from '@vitejs/plugin-vue';

import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import VueDevTools from 'vite-plugin-vue-devtools';

const compilerFs = {
  fileExists: (file: string) => fs.existsSync(file),
  readFile: (file: string) => {
    try {
      return fs.readFileSync(file, 'utf-8');
    } catch {
      return undefined;
    }
  },
  realpath: (file: string) => {
    try {
      return fs.realpathSync(file);
    } catch {
      return file;
    }
  }
};

/**
 * Word-редактор (rk-editor-core + tiptap-pagination-plus на tiptap v2)
 * изолирован в workspace-пакете @worldwiki/word-vibe, у которого СВОИ
 * v2-депсы. Vite-хак с перенаправлением импортов (paginationV2Resolver)
 * больше не нужен: pnpm резолвит v2-копии внутри пакета.
 */
export default defineConfig({
  plugins: [
    vue({
      script: {
        fs: compilerFs
      }
    }),

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
    alias: [
      { find: 'vue', replacement: 'vue/dist/vue.esm-bundler.js' },
      { find: 'vue-i18n', replacement: 'vue-i18n/dist/vue-i18n.esm-bundler.js' },
      { find: '@worldwiki/components', replacement: resolve(__dirname, '../../packages/components/src') },
      { find: '@worldwiki/resources', replacement: resolve(__dirname, '../../packages/resources/src') },
      { find: '@worldwiki/calendar-wasm', replacement: resolve(__dirname, '../../packages/calendar-wasm/src') },
      { find: '@services', replacement: resolve(__dirname, 'src/ts/services') },
      { find: '@components', replacement: resolve(__dirname, 'src/ts/components') },
      { find: '@utils', replacement: resolve(__dirname, 'src/ts/utils') },
      { find: '@types', replacement: resolve(__dirname, 'src/ts/types') },
      // "@worldwiki/word-vibe" — workspace-пакет, резолвится через node_modules
      // "@\" — последним: он префиксный и перебивает более длинные алиасы
      { find: '@', replacement: resolve(__dirname, 'src/ts') }
    ]
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
        ai: resolve(__dirname, 'ai.html'),
        character_journey: resolve(__dirname, 'character_journey.html')
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
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    isolate: false,
    server: {
      deps: {
        // tiptap-pagination-plus — ESM-код в .js без "type": "module",
        // требует inline-обработки в vitest
        inline: ['tiptap-pagination-plus']
      }
    }
  }
});