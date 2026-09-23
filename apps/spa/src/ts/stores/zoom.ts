/**
 * @file zoom.ts
 * @description Pinia store для управления зумом приложения
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';

export const useZoomStore = defineStore('zoom', () => {
  const zoomLevel = ref(parseFloat(localStorage.getItem('app-zoom') || '1'));

  const applyZoom = async (level: number) => {
    const clamped = Math.max(0.5, Math.min(2, Math.round(level * 100) / 100));
    zoomLevel.value = clamped;
    localStorage.setItem('app-zoom', String(clamped));

    // Native Webview Zoom in Tauri (scales entire application rendering)
    if (typeof window !== 'undefined' && (window as unknown as { __TAURI__?: unknown }).__TAURI__) {
      try {
        await getCurrentWebview().setZoom(clamped);
        // Clear HTML/body style zoom to avoid dual-scaling/layout distortions
        (document.documentElement.style as unknown as Record<string, string>).zoom = '';
        (document.body.style as unknown as Record<string, string>).zoom = '';
        document.documentElement.style.removeProperty('--app-zoom');
        return;
      } catch (err) {
        console.warn('[zoomStore] Failed to set native webview zoom, falling back to CSS:', err);
      }
    }

    // Web / Browser Fallback
    document.documentElement.style.setProperty('--app-zoom', String(clamped));
    (document.documentElement.style as unknown as Record<string, string>).zoom = String(clamped);
    (document.body.style as unknown as Record<string, string>).zoom = String(clamped);
  };

  return {
    zoomLevel,
    applyZoom,
  };
});