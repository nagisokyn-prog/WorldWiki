import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AiGhostTextExtension } from '../AiGhostTextExtension';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('AiGhostTextExtension', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates extension with options', () => {
    expect(AiGhostTextExtension.name).toBe('aiGhostText');
    const ext = AiGhostTextExtension.configure({ projectId: 'my-proj' });
    expect(ext.options.projectId).toBe('my-proj');
  });

  it('provides default options', () => {
    const opts = (AiGhostTextExtension as any).config.addOptions();
    expect(opts).toEqual({ projectId: '' });
  });

  describe('ProseMirror plugin behavior', () => {
    let extensionInstance: any;
    let plugin: any;

    beforeEach(() => {
      extensionInstance = {
        options: { projectId: 'test-project' },
      };
      const plugins = (AiGhostTextExtension as any).config.addProseMirrorPlugins.call(extensionInstance);
      plugin = plugins[0];
    });

    it('initializes state correctly', () => {
      const state = plugin.spec.state.init();
      expect(state).toEqual({ ghostText: '', pos: null });
    });

    it('handles state.apply with meta', () => {
      const tr = {
        getMeta: vi.fn((_key) => ({ ghostText: 'suggested', pos: 10 })),
        docChanged: false,
      };
      const newState = plugin.spec.state.apply(tr, { ghostText: '', pos: null });
      expect(newState).toEqual({ ghostText: 'suggested', pos: 10 });
    });

    it('clears state on docChanged if no meta is provided', () => {
      const tr = {
        getMeta: vi.fn(() => null),
        docChanged: true,
      };
      const newState = plugin.spec.state.apply(tr, { ghostText: 'old', pos: 5 });
      expect(newState).toEqual({ ghostText: '', pos: null });
    });

    it('returns previous value if no meta and doc did not change', () => {
      const prev = { ghostText: 'keep', pos: 5 };
      const tr = {
        getMeta: vi.fn(() => null),
        docChanged: false,
      };
      const newState = plugin.spec.state.apply(tr, prev);
      expect(newState).toBe(prev);
    });

    it('returns empty decorations when there is no ghost text', () => {
      const mockState = {};
      plugin.spec.key.getState = vi.fn(() => ({ ghostText: '', pos: null }));
      const decos = plugin.spec.props.decorations(mockState);
      expect(decos).toBeDefined();
    });

    it('creates decoration widget when ghost text is present', () => {
      const mockDoc = {
        forEach: vi.fn(),
        content: { size: 100 },
      };
      const mockState = { doc: mockDoc };
      plugin.spec.key.getState = vi.fn(() => ({ ghostText: 'completion text', pos: 12 }));

      const decos = plugin.spec.props.decorations(mockState);
      expect(decos).toBeDefined();
    });

    describe('handleKeyDown', () => {
      it('returns false for non-Tab keys', () => {
        const view: any = { state: {} };
        const event: any = { key: 'Enter', preventDefault: vi.fn() };
        const handled = plugin.spec.props.handleKeyDown(view, event);
        expect(handled).toBe(false);
      });

      it('inserts ghost text and clears meta on Tab key press', () => {
        const tr = {
          insertText: vi.fn().mockReturnThis(),
          setMeta: vi.fn().mockReturnThis(),
        };
        const view: any = {
          state: { tr },
          dispatch: vi.fn(),
        };
        plugin.spec.key.getState = vi.fn(() => ({ ghostText: 'auto complete', pos: 15 }));

        const event: any = { key: 'Tab', preventDefault: vi.fn() };
        const handled = plugin.spec.props.handleKeyDown(view, event);

        expect(handled).toBe(true);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(tr.insertText).toHaveBeenCalledWith('auto complete', 15);
        expect(tr.setMeta).toHaveBeenCalled();
        expect(view.dispatch).toHaveBeenCalledWith(tr);
      });

      it('returns false on Tab if no ghost text present', () => {
        const view: any = { state: {} };
        plugin.spec.key.getState = vi.fn(() => null);

        const event: any = { key: 'Tab', preventDefault: vi.fn() };
        const handled = plugin.spec.props.handleKeyDown(view, event);
        expect(handled).toBe(false);
      });
    });

    describe('view lifecycle and completion fetching', () => {
      it('skips update if doc and selection are unchanged', () => {
        const viewObj = plugin.spec.view({});
        const sameDoc = { eq: vi.fn(() => true) };
        const sameSel = { eq: vi.fn(() => true) };

        const prevView = { doc: sameDoc, selection: sameSel };
        const currentView = { state: { doc: sameDoc, selection: sameSel } };

        viewObj.update(currentView, prevView);
        expect(invoke).not.toHaveBeenCalled();
      });

      it('clears active ghost text and skips when not at block end', () => {
        const viewObj = plugin.spec.view({});
        const tr = { setMeta: vi.fn().mockReturnThis() };
        const dispatch = vi.fn();
        plugin.spec.key.getState = vi.fn(() => ({ ghostText: 'old' }));

        const currentView: any = {
          state: {
            tr,
            doc: { eq: () => false },
            selection: {
              eq: () => false,
              $head: {
                parentOffset: 5,
                parent: { content: { size: 10 }, textContent: '12345' },
              },
            },
          },
          dispatch,
        };

        viewObj.update(currentView, { doc: { eq: () => false }, selection: { eq: () => false } });
        expect(dispatch).toHaveBeenCalled();
        expect(invoke).not.toHaveBeenCalled();
      });

      it('skips if text before is shorter than 10 characters', () => {
        const viewObj = plugin.spec.view({});
        plugin.spec.key.getState = vi.fn(() => null);

        const currentView: any = {
          state: {
            doc: { eq: () => false },
            selection: {
              eq: () => false,
              $head: {
                parentOffset: 5,
                parent: { content: { size: 5 }, textContent: 'short' },
              },
            },
          },
          dispatch: vi.fn(),
        };

        viewObj.update(currentView, { doc: { eq: () => false }, selection: { eq: () => false } });
        vi.advanceTimersByTime(1500);
        expect(invoke).not.toHaveBeenCalled();
      });

      it('fetches completion and dispatches ghost text when at end of line with enough context', async () => {
        (invoke as any).mockResolvedValueOnce(' completed text');
        const viewObj = plugin.spec.view({});
        plugin.spec.key.getState = vi.fn(() => null);

        const tr = { setMeta: vi.fn().mockReturnThis() };
        const currentView: any = {
          state: {
            tr,
            doc: { eq: () => false },
            selection: {
              eq: () => false,
              $head: {
                pos: 25,
                parentOffset: 25,
                parent: {
                  content: { size: 25 },
                  textContent: 'This is a long sentence with context',
                },
              },
            },
          },
          dispatch: vi.fn(),
        };

        viewObj.update(currentView, { doc: { eq: () => false }, selection: { eq: () => false } });
        
        vi.advanceTimersByTime(1000);
        await Promise.resolve();

        expect(invoke).toHaveBeenCalledWith('get_ai_completion', {
          textBefore: 'This is a long sentence w',
          projectId: 'test-project',
        });
        expect(currentView.dispatch).toHaveBeenCalledWith(tr);
      });

      it('handles invoke failure gracefully', async () => {
        const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
        (invoke as any).mockRejectedValueOnce(new Error('Network error'));
        const viewObj = plugin.spec.view({});
        plugin.spec.key.getState = vi.fn(() => null);

        const currentView: any = {
          state: {
            tr: { setMeta: vi.fn().mockReturnThis() },
            doc: { eq: () => false },
            selection: {
              eq: () => false,
              $head: {
                pos: 20,
                parentOffset: 20,
                parent: {
                  content: { size: 20 },
                  textContent: '12345678901234567890',
                },
              },
            },
          },
          dispatch: vi.fn(),
        };

        viewObj.update(currentView, { doc: { eq: () => false }, selection: { eq: () => false } });
        vi.advanceTimersByTime(1000);
        await Promise.resolve();

        expect(spyError).toHaveBeenCalled();
        spyError.mockRestore();
      });

      it('destroys and cleans up timer', () => {
        const viewObj = plugin.spec.view({});
        expect(() => viewObj.destroy()).not.toThrow();
      });
    });
  });
});
