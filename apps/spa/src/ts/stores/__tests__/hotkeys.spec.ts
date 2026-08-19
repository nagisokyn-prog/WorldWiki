// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useHotkeysStore } from '../hotkeys';
import { useShellStore } from '../shell';
import { useZoomStore } from '../zoom';

describe('hotkeys store', () => {
  let hotkeys: ReturnType<typeof useHotkeysStore>;
  let shell: ReturnType<typeof useShellStore>;
  let zoom: ReturnType<typeof useZoomStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
    hotkeys = useHotkeysStore();
    shell = useShellStore();
    zoom = useZoomStore();
    hotkeys.register();
  });

  afterEach(() => {
    hotkeys.unregister();
  });

  const triggerKey = (code: string, opts: Partial<KeyboardEventInit> = {}) => {
    const evt = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...opts,
    });
    window.dispatchEvent(evt);
    return evt;
  };

  it('handles Ctrl+S by saving all', () => {
    const spy = vi.spyOn(shell, 'saveAll').mockImplementation(() => {});
    triggerKey('KeyS', { ctrlKey: true });
    expect(spy).toHaveBeenCalled();
  });

  it('handles Ctrl+, by toggling settings', () => {
    const spy = vi.spyOn(shell, 'toggleSettings').mockImplementation(() => {});
    triggerKey('Comma', { ctrlKey: true });
    expect(spy).toHaveBeenCalled();
  });

  it('handles Ctrl+W by closing active editor', () => {
    shell.activeEditorId = 'ed_1';
    const spy = vi.spyOn(shell, 'closeEditor').mockImplementation(() => {});
    triggerKey('KeyW', { ctrlKey: true });
    expect(spy).toHaveBeenCalledWith('ed_1');
  });

  it('handles Ctrl+B by toggling sidebar visibility', () => {
    shell.sidebarVisible = true;
    triggerKey('KeyB', { ctrlKey: true });
    expect(shell.sidebarVisible).toBe(false);
  });

  it('handles Ctrl+P by opening quick open ref', () => {
    const mockOpen = vi.fn();
    shell.quickOpenRef = { open: mockOpen } as any;
    triggerKey('KeyP', { ctrlKey: true });
    expect(mockOpen).toHaveBeenCalled();
  });

  it('handles Ctrl+N by adding new entity for current tab', () => {
    shell.currentSidebarTab = 'character';
    const spy = vi.spyOn(shell, 'addNewEntity').mockImplementation(() => {});
    triggerKey('KeyN', { ctrlKey: true });
    expect(spy).toHaveBeenCalledWith('character');
  });

  it('handles Ctrl+= and Ctrl+- zoom controls', () => {
    const spy = vi.spyOn(shell, 'applyZoom').mockImplementation(() => {});
    zoom.zoomLevel = 1.0;
    triggerKey('Equal', { ctrlKey: true });
    expect(spy).toHaveBeenCalledWith(1.1);

    triggerKey('Minus', { ctrlKey: true });
    expect(spy).toHaveBeenCalledWith(0.9);

    triggerKey('Digit0', { ctrlKey: true });
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('handles Ctrl+` by toggling console panel tab', () => {
    shell.activePanelTab = '';
    triggerKey('Backquote', { ctrlKey: true });
    expect(shell.activePanelTab).toBe('console');

    triggerKey('Backquote', { ctrlKey: true });
    expect(shell.activePanelTab).toBe('');
  });

  it('handles Ctrl+\\ by splitting right', () => {
    const spy = vi.spyOn(shell, 'splitRight').mockImplementation(() => {});
    triggerKey('Backslash', { ctrlKey: true });
    expect(spy).toHaveBeenCalled();
  });

  it('handles Ctrl+Shift+P (command palette)', () => {
    const mockOpen = vi.fn();
    shell.commandPaletteRef = { open: mockOpen } as any;
    triggerKey('KeyP', { ctrlKey: true, shiftKey: true });
    expect(mockOpen).toHaveBeenCalled();
  });

  it('handles Ctrl+Shift+N (create chapter)', () => {
    const spy = vi.spyOn(shell, 'createChapterIn').mockImplementation(() => {});
    triggerKey('KeyN', { ctrlKey: true, shiftKey: true });
    expect(spy).toHaveBeenCalledWith({});
  });

  it('handles Ctrl+Shift+T (tags manager)', () => {
    const mockOpen = vi.fn();
    shell.tagsManagerRef = { open: mockOpen } as any;
    triggerKey('KeyT', { ctrlKey: true, shiftKey: true });
    expect(mockOpen).toHaveBeenCalled();
  });

  it('handles Ctrl+Shift+B and Ctrl+Shift+A CustomEvents', () => {
    const rightPanelSpy = vi.fn();
    const wowilonSpy = vi.fn();
    document.addEventListener('ww:toggle-chapter-right-panel', rightPanelSpy);
    document.addEventListener('ww:toggle-wowilon', wowilonSpy);

    triggerKey('KeyB', { ctrlKey: true, shiftKey: true });
    expect(rightPanelSpy).toHaveBeenCalled();

    triggerKey('KeyA', { ctrlKey: true, shiftKey: true });
    expect(wowilonSpy).toHaveBeenCalled();
  });

  it('handles Alt+1..9 section switching', () => {
    const sectionSpy = vi.fn();
    document.addEventListener('ww:switch-section', sectionSpy);

    triggerKey('Digit2', { altKey: true });
    expect(sectionSpy).toHaveBeenCalled();
  });

  it('handles Ctrl+Alt+B and Ctrl+R for split view structure', () => {
    const rightSpy = vi.fn();
    const structSpy = vi.fn();
    document.addEventListener('ww:toggle-right-panel', rightSpy);
    document.addEventListener('ww:toggle-structure', structSpy);

    triggerKey('KeyB', { ctrlKey: true, altKey: true });
    expect(rightSpy).toHaveBeenCalled();

    triggerKey('KeyR', { ctrlKey: true });
    expect(structSpy).toHaveBeenCalled();
  });

  it('handles Escape closing settings', () => {
    shell.showSettings = true;
    triggerKey('Escape');
    expect(shell.showSettings).toBe(false);
  });
});
