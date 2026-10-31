/**
 * @file zoom.ts
 * @description Pinia store для глобального управления зумом приложения
 */
import { defineStore } from 'pinia';
import { ref, onUnmounted, onScopeDispose } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';

export const useZoomStore = defineStore('zoom', () => {
  const initialZoom = parseFloat(localStorage.getItem('app-zoom') || '1');
  const zoomLevel = ref(isNaN(initialZoom) ? 1 : initialZoom);
  let lastApplied = -1;

  const applyZoom = async (level: number) => {
    const clamped = Math.max(0.5, Math.min(2, Math.round(level * 100) / 100));
    if (Math.abs(clamped - lastApplied) < 0.005) {
      return;
    }
    lastApplied = clamped;
    zoomLevel.value = clamped;

    try {
      if (localStorage.getItem('app-zoom') !== String(clamped)) {
        localStorage.setItem('app-zoom', String(clamped));
      }
    } catch (err: unknown) {
      console.debug('[zoomStore] Failed to write to localStorage:', err);
    }

    // Direct CSS Zoom on documentElement
    document.documentElement.style.setProperty('--app-zoom', String(clamped));
    (document.body.style as unknown as Record<string, string>).zoom = '';

    // Native Webview Zoom in Tauri
    if (typeof window !== 'undefined' && ((window as unknown as { __TAURI__?: unknown }).__TAURI__ || (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)) {
      (document.documentElement.style as unknown as Record<string, string>).zoom = '';
      try {
        await getCurrentWebview().setZoom(clamped);
      } catch (err: unknown) {
        console.debug('[zoomStore] Native webview zoom set:', err);
      }
    } else {
      (document.documentElement.style as unknown as Record<string, string>).zoom = String(clamped);
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === 'app-zoom' && e.newValue) {
      const val = parseFloat(e.newValue);
      if (!isNaN(val) && Math.abs(val - zoomLevel.value) >= 0.01) {
        applyZoom(val);
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', handleStorage);
  }

  const cleanup = () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', handleStorage);
    }
  };

  try {
    onUnmounted(cleanup);
  } catch (err: unknown) {
    console.debug('[zoomStore] onUnmounted hook registration skipped:', err);
  }

  try {
    if (typeof onScopeDispose === 'function') {
      onScopeDispose(cleanup);
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
