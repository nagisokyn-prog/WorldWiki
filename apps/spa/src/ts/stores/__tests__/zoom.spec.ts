// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useZoomStore } from '../zoom';

describe('zoom store', () => {
  let store: ReturnType<typeof useZoomStore>;
  let appEl: HTMLDivElement;

  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    appEl = document.getElementById('app') as HTMLDivElement;
    store = useZoomStore();
  });

  it('clamps zoom level between 0.5 and 2', () => {
    store.applyZoom(3.5);
    expect(store.zoomLevel).toBe(2);
    expect(localStorage.getItem('app-zoom')).toBe('2');

    store.applyZoom(0.1);
    expect(store.zoomLevel).toBe(0.5);
    expect(localStorage.getItem('app-zoom')).toBe('0.5');

    store.applyZoom(1.25);
    expect(store.zoomLevel).toBe(1.25);
    expect(localStorage.getItem('app-zoom')).toBe('1.25');
  });

  it('applies styles and CSS variables on document and app element', () => {
    store.applyZoom(1.5);

    expect(document.documentElement.style.getPropertyValue('--app-zoom')).toBe('1.5');
    expect(appEl.style.transform).toBe('scale(1.5)');
    expect(appEl.style.transformOrigin).toBe('top left');
  });
});
