/**
 * @file zoom.ts
 * @description Pinia store для управления зумом приложения
 */
import { defineStore } from 'pinia';
import { ref, onUnmounted, onScopeDispose } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';

export const useZoomStore = defineStore('zoom', () => {
  const zoomLevel = ref(parseFloat(localStorage.getItem('app-zoom') || '1'));

  const applyZoom = async (level: number) => {
    const clamped = Math.max(0.5, Math.min(2, Math.round(level * 100) / 100));
    zoomLevel.value = clamped;
    localStorage.setItem('app-zoom', String(clamped));

    // Native Webview Zoom in Tauri (scales entire application rendering)
    if (typeof window !== 'undefined' && ((window as unknown as { __TAURI__?: unknown }).__TAURI__ || (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)) {
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

    // Web / Browser Fallback - apply strictly once to documentElement, not body
    document.documentElement.style.setProperty('--app-zoom', String(clamped));
    (document.documentElement.style as unknown as Record<string, string>).zoom = String(clamped);
    (document.body.style as unknown as Record<string, string>).zoom = '';
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'app-zoom' && e.newValue) {
      const val = parseFloat(e.newValue);
      if (!isNaN(val) && val !== zoomLevel.value) {
        applyZoom(val);
      }
    }
  };

  // Sync zoom changes across tabs/windows with symmetric cleanup
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  try {
    onUnmounted(() => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
    });
  } catch (err: unknown) {
    console.debug('[zoomStore] onUnmounted hook registration skipped:', err);
  }

  try {
    if (typeof onScopeDispose === 'function') {
      onScopeDispose(() => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('storage', handleStorage);
        }
      });
    }
  } catch (err: unknown) {
    console.debug('[zoomStore] onScopeDispose hook registration skipped:', err);
  }

  // Initial apply
  applyZoom(zoomLevel.value);

  return {
    zoomLevel,
    applyZoom,
  };
});
