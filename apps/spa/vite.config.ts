import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import VueDevTools from 'vite-plugin-vue-devtools';

/**
 * tiptap-pagination-plus работает на tiptap v2 (как и rk-editor-core),
 * а приложение — на v3. Плагин перенаправляет его импорты @tiptap/core
 * и @tiptap/pm/* на v2-копии (алиасы @tiptap/core-v2 / @tiptap/pm-v2),
 * чтобы extension жил в том же ядре, что и внутренний редактор WordEditor.
 */
function paginationV2Resolver() {
  return {
    name: 'pagination-plus-tiptap-v2',
    enforce: 'pre' as const,
    resolveId(id: string, importer?: string) {
      if (!importer) return null;
      const isPagination = importer.includes('tiptap-pagination-plus');
      // v2-копия ядра (@tiptap/core-v2) должна жить на том же @tiptap/pm@2.27,
      // что и rk-editor-core (у pnpm она слинкована с pm 3.x — перенаправляем)
      const isV2Core = importer.includes('@tiptap+core@2.27.2') || importer.includes('@tiptap/core-v2');
      if (!isPagination && !isV2Core) return null;
      if (isPagination && id === '@tiptap/core') return '@tiptap/core-v2';
      if (id.startsWith('@tiptap/pm/')) return '@tiptap/pm-v2/' + id.slice('@tiptap/pm/'.length);
      return null;
    }
  };
}
export default defineConfig({
  plugins: [
    paginationV2Resolver(),
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
    alias: [
      { find: 'vue', replacement: 'vue/dist/vue.esm-bundler.js' },
      { find: 'vue-i18n', replacement: 'vue-i18n/dist/vue-i18n.esm-bundler.js' },
      { find: '@worldwiki/components', replacement: resolve(__dirname, '../../packages/components/src') },
      { find: '@worldwiki/resources', replacement: resolve(__dirname, '../../packages/resources/src') },
      { find: '@services', replacement: resolve(__dirname, 'src/ts/services') },
      { find: '@components', replacement: resolve(__dirname, 'src/ts/components') },
      { find: '@utils', replacement: resolve(__dirname, 'src/ts/utils') },
      { find: '@types', replacement: resolve(__dirname, 'src/ts/types') },
      // v2-копии tiptap-ядра для tiptap-pagination-plus (см. paginationV2Resolver).
      // Строковые алиасы: в vitest импорт переписывается в "/@id/@tiptap/core-v2"
      { find: '/@id/@tiptap/core-v2', replacement: resolve(__dirname, 'node_modules/@tiptap/core-v2/dist/index.js') },
      { find: '/@id/@tiptap/pm-v2/', replacement: resolve(__dirname, 'node_modules/@tiptap/pm-v2/') },
      { find: '@tiptap/core-v2', replacement: resolve(__dirname, 'node_modules/@tiptap/core-v2/dist/index.js') },
      { find: '@tiptap/pm-v2/', replacement: resolve(__dirname, 'node_modules/@tiptap/pm-v2/') },
      // "@" — последним: он префиксный и перебивает более длинные алиасы
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
  },
  test: {
    globals: true,
    environment: 'jsdom',
    server: {
      deps: {
        // tiptap-pagination-plus — ESM-код в .js без "type": "module",
        // требует inline-обработки в vitest
        inline: ['tiptap-pagination-plus']
      }
    }
  }
});