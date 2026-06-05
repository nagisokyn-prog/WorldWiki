import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  
  plugins: [vue()],
  
  server: {
    port: 5000,
    strictPort: false,
    host: '127.0.0.1',
    middlewareMode: false
  },
  
  build: {
    rollupOptions: {
      input: resolve(__dirname, 'autho.html')
    }
  },
  
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../js'),
      '@components': resolve(__dirname, '../../js/components'),
      '@services': resolve(__dirname, '../../js/services'),
      '@types': resolve(__dirname, '../../js/types'),
      '@css': resolve(__dirname, '../../css')
    }
  }
})
