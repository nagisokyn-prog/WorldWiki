/**
 * @file zoom.ts
 * @description Pinia store для управления зумом приложения
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useZoomStore = defineStore('zoom', () => {
  const zoomLevel = ref(parseFloat(localStorage.getItem('app-zoom') || '1'));

  const applyZoom = (level: number) => {
    const clamped = Math.max(0.5, Math.min(2, level));
    zoomLevel.value = clamped;
    
    document.documentElement.style.setProperty('--app-zoom', String(clamped));
    
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.style.transform = `scale(${clamped})`;
      appEl.style.transformOrigin = 'top left';
      appEl.style.width = `${100 / clamped}%`;
      appEl.style.height = `${100 / clamped}%`;
    }
    
    localStorage.setItem('app-zoom', String(clamped));
  };

  return {
    zoomLevel,
    applyZoom,
  };
});