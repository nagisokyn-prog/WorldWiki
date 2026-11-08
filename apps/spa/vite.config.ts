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
const withAi = process.argv.includes('--with-ai');

const inputEntries: Record<string, string> = {
  app: resolve(__dirname, 'app.html'),
  settings: resolve(__dirname, 'settings.html'),
  ui_editor: resolve(__dirname, 'ui_editor.html'),
  character_journey: resolve(__dirname, 'character_journey.html')
};

if (withAi) {
  inputEntries.ai = resolve(__dirname, 'ai.html');
}

export default defineConfig(({ command, mode }) => {
  const isBuild = command === 'build';
  const isTest = mode === 'test' || Boolean(process.env.VITEST);

  return {
    define: {
      __FEATURE_AI__: JSON.stringify(withAi)
    },
    plugins: [
      vue({
        script: {
          fs: compilerFs
        }
      }),

      !isBuild && VueDevTools(),
      AutoImport({
        imports: ['vue', 'vue-router', 'pinia'],
        dts: 'src/auto-imports.d.ts',
        dirs: ['src/ts/composables']
      }),
      Components({
        dirs: ['src/ts/components'],
        dts: 'src/components.d.ts'
      })
    ].filter(Boolean),

    root: '.',
    base: './',

    resolve: {
      alias: [
        // Для in-DOM шаблонов (ui_editor.html) необходим компилятор vue.esm-bundler.js
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

    // ⚡ АГРЕССИВНАЯ МИНИМИЗАЦИЯ ДЛЯ TAURI WEBVIEW2
    build: {
      outDir: '../../dist',
      emptyOutDir: true,
      target: 'esnext',              // 1. Нативный современный JS без даунгрейда и полифилов
      cssMinify: 'esbuild',          // 2. Надежный компрессор CSS без искажения позиционирования и calc()
      minify: 'esbuild',
      sourcemap: isBuild ? 'hidden' : true, // 3. Карты скрыты в проде: не светятся в вебвью, но пригодны для отладки
      assetsInlineLimit: 4096,       // 4. Инлайн мелких иконок до 4 КБ в Base64 для исключения лишних IPC-запросов
      modulePreload: {
        polyfill: false              // 5. WebView2 нативно поддерживает modulepreload с Chromium 66
      },
      cssCodeSplit: true,
      reportCompressedSize: false,   // Ускоряет билд

      rollupOptions: {
        input: inputEntries,
        output: {
          // 6. Дедупликация вендор-зависимостей между мультистраничными окнами (совместимо с Rolldown и Rollup)
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('@tiptap')) {
                return 'vendor-tiptap';
              }
              if (id.includes('vue') || id.includes('pinia') || id.includes('@tanstack')) {
                return 'vendor-core';
              }
            }
          }
        }
      }
    },

    // 7. Вырезание отладочного кода в продакшене с сохранением лицензий open-source
    esbuild: isBuild
      ? {
          drop: ['console', 'debugger'],
          legalComments: 'inline'
        }
      : undefined,

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
      force: true,
      // 8. Защита WASM-модулей от искажения сборщиком esbuild
      exclude: [
        '@worldwiki/calendar-wasm',
        '@worldwiki/manuscript-wasm',
        '@worldwiki/ast-diff-wasm'
      ]
    },

    test: {
      globals: true,
      environment: 'happy-dom',
      pool: 'vmThreads',
      server: {
        deps: {
          // tiptap-pagination-plus — ESM-код в .js без "type": "module",
          // требует inline-обработки в vitest
          inline: ['tiptap-pagination-plus']
        }
      }
    }
  };
});
