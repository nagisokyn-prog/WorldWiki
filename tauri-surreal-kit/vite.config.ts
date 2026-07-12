import { defineConfig } from 'vite';
import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  root: 'frontend/src',
  base: './',
  resolve: {
    alias: {
      'vue': 'vue/dist/vue.esm-browser.js',
      '@': resolve(__dirname, 'frontend/src')
    }
  },
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        splash: resolve(__dirname, 'frontend/src/shell/splash.html'),
        main: resolve(__dirname, 'frontend/src/shell/main.html'),
        settings: resolve(__dirname, 'frontend/src/shell/settings.html')
      }
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true
  }
});
