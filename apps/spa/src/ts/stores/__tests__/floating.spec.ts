import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useFloatingStore } from '../floating';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const mockSetFocus = vi.fn();
const mockGetByLabel = vi.fn();

vi.mock('@tauri-apps/api/webviewWindow', () => {
  const mockWebview = vi.fn().mockImplementation(function (this: any, label: string, opts: any) {
    this.label = label;
    this.options = opts;
    this.once = vi.fn().mockImplementation((event: string, cb: any) => {
      if (event === 'tauri://created') cb();
      if (event === 'tauri://error') this._errorCb = cb;
    });
    this.triggerError = async (err: any) => {
      if (this._errorCb) await this._errorCb(err);
    };
  });
  (mockWebview as any).getByLabel = (...args: any[]) => mockGetByLabel(...args);

  return {
    WebviewWindow: mockWebview,
  };
});

describe('floating store', () => {
  let store: ReturnType<typeof useFloatingStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockGetByLabel.mockReset();
    mockSetFocus.mockReset();
    store = useFloatingStore();
  });

  describe('openFloatingEditor', () => {
    it('creates WebviewWindow with sanitized label', async () => {
      const win: any = await store.openFloatingEditor('my_project', 'custom-type:special', 'id:123');

      expect(WebviewWindow).toHaveBeenCalledWith(
        'editor_custom-typespecial_id123',
        expect.objectContaining({
          title: 'Редактор: custom-type:special',
          width: 1000,
          height: 800,
        })
      );
      expect(win).toBeDefined();
    });

    it('focuses existing window on tauri://error event', async () => {
      const existingWin = { setFocus: mockSetFocus };
      mockGetByLabel.mockResolvedValue(existingWin);

      const win: any = await store.openFloatingEditor('proj', 'char', '1');
      await win.triggerError(new Error('Window exists'));

      expect(mockGetByLabel).toHaveBeenCalledWith('editor_char_1');
      expect(mockSetFocus).toHaveBeenCalled();
    });

    it('handles exception when creating window', async () => {
      vi.mocked(WebviewWindow).mockImplementationOnce(() => {
        throw new Error('Instantiation error');
      });

      const res = await store.openFloatingEditor('proj', 'char', '1');
      expect(res).toBeNull();
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
