import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFloatingStore } from '../floating';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

vi.mock('@tauri-apps/api/webviewWindow', () => {
  const mockWebview = vi.fn().mockImplementation(function (this: any, label: string, opts: any) {
    this.label = label;
    this.options = opts;
    this.once = vi.fn();
  });
  (mockWebview as any).getByLabel = vi.fn();

  return {
    WebviewWindow: mockWebview,
  };
});

describe('floating store', () => {
  let store: ReturnType<typeof useFloatingStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    store = useFloatingStore();
  });

  describe('openFloatingEditor', () => {
    it('creates WebviewWindow with sanitized label', async () => {
      await store.openFloatingEditor('my_project', 'custom-type:special', 'id:123');

      expect(WebviewWindow).toHaveBeenCalledWith(
        'editor_custom-typespecial_id123',
        expect.objectContaining({
          title: 'Редактор: custom-type:special',
          width: 1000,
          height: 800,
        })
      );
    });
  });

  describe('closeFloatingEditor', () => {
    it('filters out editor by id', () => {
      store.floatingEditors = [
        { id: 'win_1', type: 'char', entityId: '1' },
        { id: 'win_2', type: 'char', entityId: '2' },
      ];

      store.closeFloatingEditor('win_1');
      expect(store.floatingEditors).toHaveLength(1);
      expect(store.floatingEditors[0].id).toBe('win_2');
    });
  });
});
