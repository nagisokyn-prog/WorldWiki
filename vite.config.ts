import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  root: 'src',
  base: './',
  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm-browser.js',
      '@': resolve(__dirname, 'src/js'),
      '@services': resolve(__dirname, 'src/js/services'),
      '@components': resolve(__dirname, 'src/js/components'),
      '@utils': resolve(__dirname, 'src/js/utils'),
      '@types': resolve(__dirname, 'src/js/types')
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
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
    strictPort: true
  },
  logLevel: 'info',
  clearScreen: false
});