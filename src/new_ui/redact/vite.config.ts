import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  // Корень — текущая папка (src/new_ui/redact)
  root: '.',
  
  plugins: [vue()],
  
  server: {
    port: 5500,
    strictPort: false,
    host: '0.0.0.0'
  },
  
  build: {
    rollupOptions: {
      input: './redact.html'
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
