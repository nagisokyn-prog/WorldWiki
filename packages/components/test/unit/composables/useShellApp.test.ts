import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useShellApp } from '../../../src/ts/composables/useShellApp';
import type { EditorTab } from '../../../src/ts/composables/useEditorGroups';

const createTab = (tab: Partial<EditorTab> & { id: string; title: string }): EditorTab => ({
  rawId: tab.id,
  entityType: 'chapter',
  tabType: 'chapter',
  data: {},
  unsaved: false,
  ...tab,
});

describe('useShellApp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes default state and layout values from localStorage', () => {
    localStorage.setItem('my-app:zoom', '1.2');
    localStorage.setItem('my-app:panel-height', '200');
    localStorage.setItem('my-app:sidebar-width', '320');

    const shell = useShellApp({ storagePrefix: 'my-app' });

    expect(shell.zoomLevel.value).toBe(1.2);
    expect(shell.panelHeight.value).toBe(200);
    expect(shell.sidebarWidth.value).toBe(320);
    expect(shell.showSettings.value).toBe(false);
    expect(shell.sidebarVisible.value).toBe(true);
  });

  it('manages toasts and icon helpers with auto-cleanup', () => {
    const shell = useShellApp({ storagePrefix: 'my-app', toastDuration: 2000 });

    shell.addToast('Saved successfully', 'success');
    shell.addToast('Warning alert', 'warn');
    shell.addToast('Error occurred', 'error');
    shell.addToast('Info notice', 'info');

    expect(shell.toasts.value.length).toBe(4);
    expect(shell.getToastIcon('success')).toBe('fas fa-check-circle');
    expect(shell.getToastIcon('warn')).toBe('fas fa-exclamation-triangle');
    expect(shell.getToastIcon('error')).toBe('fas fa-times-circle');
    expect(shell.getToastIcon('info')).toBe('fas fa-info-circle');

    vi.advanceTimersByTime(2100);
    expect(shell.toasts.value.length).toBe(0);
  });

  it('manages console logs and limits capacity to 100 items', () => {
    const shell = useShellApp({ storagePrefix: 'my-app' });

    shell.addLog('First log', 'info');
    shell.addLog('Second log', 'warn');

    expect(shell.consoleLogs.value.length).toBe(2);
    expect(shell.consoleLogs.value[0].text).toBe('Second log');

    for (let i = 0; i < 110; i++) {
      shell.addLog(`Log #${i}`, 'info');
    }
    expect(shell.consoleLogs.value.length).toBe(100);
  });

  it('applies zoom with clamping and styles the app container', () => {
    const shell = useShellApp({ storagePrefix: 'my-app' });

    shell.applyZoom(1.5);
    expect(shell.zoomLevel.value).toBe(1.5);
    expect(localStorage.getItem('my-app:zoom')).toBe('1.5');

    const appEl = document.getElementById('app');
    expect(appEl?.style.transform).toBe('scale(1.5)');

    // Clamping min and max
    shell.applyZoom(0.1);
    expect(shell.zoomLevel.value).toBe(0.5);

    shell.applyZoom(3.5);
    expect(shell.zoomLevel.value).toBe(2);
  });

  it('toggles and resets settings', () => {
    const shell = useShellApp({ storagePrefix: 'my-app' });

    shell.toggleSettings();
    expect(shell.showSettings.value).toBe(true);
    shell.toggleSettings();
    expect(shell.showSettings.value).toBe(false);

    shell.resetSettings();
    expect(shell.consoleLogs.value.some(l => l.text.includes('Settings → Reset'))).toBe(true);
  });

  it('saves and restores state with serializeExtra and restoreExtra', async () => {
    const serializeExtra = vi.fn(() => ({ customKey: 'customVal' }));
    const restoreExtra = vi.fn().mockResolvedValue(undefined);

    const shell = useShellApp({
      storagePrefix: 'my-app',
      serializeExtra,
      restoreExtra,
    });

    shell.activePanelTab.value = 'console';
    shell.eg.openTab(createTab({ id: 'tab1', title: 'T1' }));
    shell.saveState();

    const raw = localStorage.getItem('my-app:state');
    expect(raw).not.toBeNull();
    expect(raw).toContain('customVal');

    const restored = await shell.restoreState();
    expect(restored).toBe(true);
    expect(restoreExtra).toHaveBeenCalled();
  });

  it('restoreState returns false if no saved state exists or parse fails', async () => {
    const shell = useShellApp({ storagePrefix: 'empty-app' });
    expect(await shell.restoreState()).toBe(false);

    localStorage.setItem('empty-app:state', 'invalid json{');
    expect(await shell.restoreState()).toBe(false);
  });

  it('resizes bottom panel and sidebar with mouse events', () => {
    const shell = useShellApp({ storagePrefix: 'my-app' });

    // Panel resize
    shell.startResize({ clientY: 100 } as any);
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 50 }));
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(shell.panelHeight.value).toBe(200);

    // Sidebar resize
    shell.startSidebarResize({ clientX: 100 } as any);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    document.dispatchEvent(new MouseEvent('mouseup'));
    expect(shell.sidebarWidth.value).toBe(330);
  });

  it('resizes between editor groups', () => {
    const shell = useShellApp({ storagePrefix: 'my-app' });
    shell.eg.openTab(createTab({ id: 't1', title: 'T1' }));
    shell.splitRight();

    const container = document.createElement('div');
    container.className = 'editor-groups-container';
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({ width: 1000 } as any);

    const handle = document.createElement('div');
    container.appendChild(handle);
    document.body.appendChild(container);

    shell.startGroupResize({ currentTarget: handle, clientX: 100 } as any, 0);
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 150 }));
    document.dispatchEvent(new MouseEvent('mouseup'));
  });

  it('manages floating windows (open, focus, close)', () => {
    const shell = useShellApp({ storagePrefix: 'my-app' });

    shell.openFloatingEditor('character', 'c1');
    expect(shell.floatingEditors.value.length).toBe(1);
    expect(shell.floatingEditors.value[0].id).toBe('character:c1');

    const firstZIndex = shell.floatingEditors.value[0].zIndex;
    // Re-opening existing raises z-index
    shell.openFloatingEditor('character', 'c1');
    expect(shell.floatingEditors.value.length).toBe(1);
    expect(shell.floatingEditors.value[0].zIndex).toBeGreaterThan(firstZIndex);

    shell.focusFloatingEditor('character:c1');
    shell.closeFloatingEditor('character:c1');
    expect(shell.floatingEditors.value.length).toBe(0);
  });

  it('attempts native Tauri WebviewWindow when available', () => {
    const mockWebviewConstructor = vi.fn();
    (window as any).__TAURI__ = {
      webviewWindow: {
        WebviewWindow: mockWebviewConstructor,
      },
    };

    const shell = useShellApp({ storagePrefix: 'my-app', appId: 'test-app' });
    shell.openFloatingEditor('location', 'loc_1');

    expect(mockWebviewConstructor).toHaveBeenCalledWith(
      'test-app-editor-location-loc-1',
      expect.objectContaining({
        url: 'ui_editor.html?type=location&id=loc_1',
        title: 'Edit: location [loc_1]',
      })
    );
    delete (window as any).__TAURI__;
  });

  // Line 293: catch when native WebviewWindow constructor throws → fallback to inline
  it('falls back to inline floating editor when native Tauri window throws', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const throwingCtor = vi.fn(() => { throw new Error('Native window failed'); });
    (window as any).__TAURI__ = { webviewWindow: { WebviewWindow: throwingCtor } };

    const shell = useShellApp({ storagePrefix: 'my-app', appId: 'test-app' });
    shell.openFloatingEditor('character', 'c42');

    expect(throwingCtor).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    // Встроенный fallback добавлен
    expect(shell.floatingEditors.value.length).toBe(1);
    expect(shell.floatingEditors.value[0].id).toBe('character:c42');
    expect(shell.floatingEditors.value[0].entityId).toBe('c42');

    warnSpy.mockRestore();
    delete (window as any).__TAURI__;
  });

  // Line 339: F11 invokes toggle_fullscreen via Tauri core
  it('F11 invokes toggle_fullscreen through Tauri core when available', async () => {
    const invoke = vi.fn().mockResolvedValue(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (window as any).__TAURI__ = { core: { invoke } };

    const { mount } = await import('@vue/test-utils');
    const { defineComponent } = await import('vue');

    const Comp = defineComponent({
      setup() {
        useShellApp({ storagePrefix: 'test-f11' });
        return () => null;
      },
    });
    const wrapper = mount(Comp);
    await Promise.resolve();

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F11' }));
    expect(invoke).toHaveBeenCalledWith('toggle_fullscreen');

    errSpy.mockRestore();
    wrapper.unmount();
    delete (window as any).__TAURI__;
  });

  // Lines 446-447: settings.value is updated from settingsService.onChange
  it('synchronizes settings.value via settingsService.onChange (lines 446-447)', async () => {
    const { settingsService } = await import('../../../src/ts/services/settings.service');
    let captured: ((s: unknown) => void) | null = null;
    const onChangeSpy = vi.spyOn(settingsService, 'onChange').mockImplementation((cb: any) => { captured = cb; });

    const { mount } = await import('@vue/test-utils');
    const { defineComponent } = await import('vue');

    let shellInstance: any;
    const Comp = defineComponent({
      setup() {
        shellInstance = useShellApp({ storagePrefix: 'test-settings-sync' });
        return () => null;
      },
    });
    const wrapper = mount(Comp);
    await Promise.resolve();

    expect(onChangeSpy).toHaveBeenCalled();
    expect(captured).not.toBeNull();

    const newSettings = { theme: 'light', colors: { accent: '#abcdef' } };
    captured!(newSettings);
    // ref() оборачивает значение в reactive-прокси, поэтому сравниваем по значению
    expect(shellInstance.settings.value).toStrictEqual(newSettings);

    onChangeSpy.mockRestore();
    wrapper.unmount();
  });

  // Line 459: deep watch on getSettings triggers saveSettings
  it('persists settings through the deep watch (line 459)', async () => {
    const { settingsService } = await import('../../../src/ts/services/settings.service');
    const saveSpy = vi.spyOn(settingsService, 'saveSettings').mockImplementation(() => {});

    // Источник watch — стабильный ref; его замена триггерит глубокий watcher
    const { ref } = await import('vue');
    const settingsRef = ref<any>({ ...(settingsService.getSettings() as any) });
    const getSpy = vi.spyOn(settingsService, 'getSettings').mockImplementation(() => settingsRef.value);

    const { mount } = await import('@vue/test-utils');
    const { defineComponent, nextTick } = await import('vue');

    const Comp = defineComponent({
      setup() {
        useShellApp({ storagePrefix: 'test-watch-save' });
        return () => null;
      },
    });
    const wrapper = mount(Comp);
    await Promise.resolve();

    // Полная замена объекта настроек → источник watcher возвращает новое значение
    settingsRef.value = { ...settingsRef.value, colors: { ...(settingsRef.value.colors || {}), accent: '#654321' } };
    await nextTick();
    // flush watcher queue
    await vi.runAllTicks();

    expect(saveSpy).toHaveBeenCalled();

    saveSpy.mockRestore();
    getSpy.mockRestore();
    wrapper.unmount();
  });

  it('group management helper methods delegate to editorGroups', () => {
    const shell = useShellApp({ storagePrefix: 'my-app' });

    shell.eg.openTab(createTab({ id: 't1', title: 'T1' }));
    shell.eg.openTab(createTab({ id: 't2', title: 'T2' }));
    shell.splitRight();

    expect(shell.editorGroups.value.length).toBe(2);

    const secondGid = shell.editorGroups.value[1].id;
    shell.activateTabInGroup(secondGid, 't1');
    expect(shell.activeGroupId.value).toBe(secondGid);

    shell.focusGroup(secondGid);
    expect(shell.activeGroupId.value).toBe(secondGid);

    shell.moveTab({ tabId: 't1', toGroupId: secondGid, toIndex: 0 });
    shell.reorderTab({ groupId: secondGid, fromIdx: 0, toIdx: 0 });

    shell.closeGroup(secondGid);
    expect(shell.editorGroups.value.length).toBe(1);
  });

  describe('Keyboard shortcuts & lifecycle in mounted component', () => {
    it('handles keyboard shortcuts', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const quickOpenRef = { value: { open: vi.fn() } };
      const commandPaletteRef = { value: { open: vi.fn() } };

      const { mount } = await import('@vue/test-utils');
      const { defineComponent } = await import('vue');

      let shellInstance: any;
      const Comp = defineComponent({
        setup() {
          shellInstance = useShellApp({
            storagePrefix: 'test-shortcuts',
            onSave,
            quickOpenRef: quickOpenRef as any,
            commandPaletteRef: commandPaletteRef as any,
          });
          return () => null;
        },
      });

      const wrapper = mount(Comp);
      await Promise.resolve();

      shellInstance.eg.openTab(createTab({ id: 't1', title: 'T1' }));
      shellInstance.eg.openTab(createTab({ id: 't2', title: 'T2' }));

      // Ctrl+S
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true }));
      expect(onSave).toHaveBeenCalled();

      // Ctrl+Shift+S
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', ctrlKey: true, shiftKey: true }));
      expect(onSave).toHaveBeenCalledTimes(2);

      // Ctrl+, (toggle settings)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Comma', ctrlKey: true }));
      expect(shellInstance.showSettings.value).toBe(true);

      // Escape (closes settings)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));
      expect(shellInstance.showSettings.value).toBe(false);

      // Escape when settings already closed
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape' }));

      // Ctrl+B (toggle sidebar)
      const prevSidebar = shellInstance.sidebarVisible.value;
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', ctrlKey: true }));
      expect(shellInstance.sidebarVisible.value).toBe(!prevSidebar);

      // Ctrl+P (quickOpen)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', ctrlKey: true }));
      expect(quickOpenRef.value.open).toHaveBeenCalled();

      // Ctrl+Shift+P (commandPalette)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyP', ctrlKey: true, shiftKey: true }));
      expect(commandPaletteRef.value.open).toHaveBeenCalled();

      // Ctrl+Equal, Ctrl+Minus, Ctrl+Digit0
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Equal', ctrlKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Minus', ctrlKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit0', ctrlKey: true }));
      expect(shellInstance.zoomLevel.value).toBe(1);

      // Ctrl+Backquote
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backquote', ctrlKey: true }));
      expect(shellInstance.activePanelTab.value).toBe('console');

      // Ctrl+Backslash (splitRight)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Backslash', ctrlKey: true }));

      // Ctrl+Tab & Ctrl+Shift+Tab
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', ctrlKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Tab', ctrlKey: true, shiftKey: true }));

      // Ctrl+Digit1..9
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1', ctrlKey: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit9', ctrlKey: true }));

      // F11 (fullscreen without fullscreenElement, then with fullscreenElement)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F11' }));
      Object.defineProperty(document, 'fullscreenElement', { value: document.documentElement, configurable: true });
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'F11' }));
      Object.defineProperty(document, 'fullscreenElement', { value: null, configurable: true });

      // Ctrl+W (close tab)
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', ctrlKey: true }));

      wrapper.unmount();
    });
  });
});
