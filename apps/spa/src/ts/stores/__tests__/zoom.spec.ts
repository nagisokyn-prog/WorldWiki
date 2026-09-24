// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useZoomStore } from '../zoom';

describe('zoom store', () => {
  let store: ReturnType<typeof useZoomStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    store = useZoomStore();
  });

  it('clamps zoom level between 0.5 and 2', async () => {
    await store.applyZoom(3.5);
    expect(store.zoomLevel).toBe(2);
    expect(localStorage.getItem('app-zoom')).toBe('2');

    await store.applyZoom(0.1);
    expect(store.zoomLevel).toBe(0.5);
    expect(localStorage.getItem('app-zoom')).toBe('0.5');

    await store.applyZoom(1.25);
    expect(store.zoomLevel).toBe(1.25);
    expect(localStorage.getItem('app-zoom')).toBe('1.25');
  });

  it('applies styles and CSS variables on document in web mode', async () => {
    delete (window as unknown as { __TAURI__?: unknown }).__TAURI__;
    await store.applyZoom(1.5);

    expect(document.documentElement.style.getPropertyValue('--app-zoom')).toBe('1.5');
    expect((document.documentElement.style as unknown as Record<string, string>).zoom).toBe('1.5');
  });

  it('calls native webview setZoom when running in Tauri', async () => {
    (window as unknown as { __TAURI__: unknown }).__TAURI__ = { core: {} };
    await store.applyZoom(1.3);

    expect(store.zoomLevel).toBe(1.3);
    expect((document.documentElement.style as unknown as Record<string, string>).zoom).toBe('');
  });
});
