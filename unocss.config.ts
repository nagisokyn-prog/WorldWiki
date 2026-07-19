import { defineConfig, presetUno, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetAttributify()
  ],
  shortcuts: [
    ['glass-btn', 'px-4 py-2 rounded-lg bg-white/10 backdrop-blur hover:bg-white/20 transition'],
    ['glass-card', 'bg-white/5 backdrop-blur rounded-xl border border-white/10'],
  ]
});