/**
 * @file useHotkeys.ts
 * @description Глобальные горячие клавиши приложения
 */
export function useHotkeys(ctx: {
  projectName: string;
  saveAll: () => void;
  toggleSettings: () => void;
  quickOpenRef: { value: { open?: () => void } | null };
  commandPaletteRef: { value: { open?: () => void } | null };
  tagsManagerRef: { value: { open?: () => void } | null };
  applyZoom: (level: number) => void;
  sidebarVisible: { value: boolean };
  activePanelTab: { value: string };
  activeEditorId: { value: string | null };
  closeEditor: (id: string, force?: boolean) => void;
  addNewEntity: (type: string, name?: string) => void;
  createChapterIn: (opts: { arcId?: string; volumeId?: string }) => void;
  splitRight: () => void;
  currentSidebarTab: { value: string | null };
  zoomLevel: { value: number };
  showSettings: { value: boolean };
}) {
  const handleKeydown = (e: KeyboardEvent) => {
    // Блокируем браузерные дефолты для всех Ctrl-шорткатов которые мы перехватываем
    if (e.ctrlKey) {
      const BROWSER_OVERRIDES = new Set([
        'KeyS', 'KeyP', 'KeyN', 'KeyW', 'KeyF', 'KeyB',
        'Comma', 'Minus', 'Equal', 'Digit0', 'Backquote',
        'Tab', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5',
        'Digit6', 'Digit7', 'Digit8', 'Digit9', 'F11', 'KeyT',
        'Backslash',
      ]);
      if (BROWSER_OVERRIDES.has(e.code)) {
        e.preventDefault();
      }
    }

    // F11 (Полноэкранный режим)
    if (e.code === 'F11') {
      e.preventDefault();
      const tauri = window.__TAURI__;
      if (tauri) {
        tauri.core.invoke('toggle_fullscreen').catch((err: unknown) => {
          console.error('Fullscreen toggle error:', err);
        });
      } else {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch((err: Error) => {
            console.warn(`Error attempting to enable full-screen mode: ${err.message}`);
          });
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
      }
      return;
    }

    // Ctrl (без Shift, без Alt)
    if (e.ctrlKey && !e.shiftKey && !e.altKey) {
      switch (e.code) {
        case 'KeyS':
          ctx.saveAll();
          return;
        case 'Comma':
          ctx.toggleSettings();
          return;
        case 'KeyF': {
          const input = document.querySelector('.sidebar-search input') as HTMLInputElement | null;
          input?.focus();
          return;
        }
        case 'KeyW':
          if (ctx.activeEditorId.value) ctx.closeEditor(ctx.activeEditorId.value);
          return;
        case 'KeyB':
          ctx.sidebarVisible.value = !ctx.sidebarVisible.value;
          return;
        case 'KeyP':
          ctx.quickOpenRef.value?.open?.();
          return;
        case 'KeyN': {
          const type = ctx.currentSidebarTab.value;
          if (type) ctx.addNewEntity(type);
          return;
        }
        case 'Equal':
          ctx.applyZoom(ctx.zoomLevel.value + 0.1);
          return;
        case 'Minus':
          ctx.applyZoom(ctx.zoomLevel.value - 0.1);
          return;
        case 'Digit0':
          ctx.applyZoom(1);
          return;
        case 'Backquote':
          ctx.activePanelTab.value = ctx.activePanelTab.value === '' ? 'console' : '';
          return;
        case 'Tab':
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7':
        case 'Digit8':
        case 'Digit9':
          // handled via template refs
          return;
        case 'Backslash': {
          e.preventDefault();
          ctx.splitRight();
          return;
        }
      }
    }

    // Ctrl+Shift
    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      if (['KeyP', 'KeyN', 'KeyS', 'Tab'].includes(e.code)) e.preventDefault();
      switch (e.code) {
        case 'KeyP':
          ctx.commandPaletteRef.value?.open?.();
          return;
        case 'KeyN':
          ctx.createChapterIn({});
          return;
        case 'KeyS':
          ctx.saveAll();
          return;
        case 'Tab':
          // handled via template refs
          return;
        case 'KeyT':
          ctx.tagsManagerRef.value?.open?.();
          return;
        case 'KeyB':
          document.dispatchEvent(new CustomEvent('ww:toggle-chapter-right-panel'));
          return;
      }
    }

    // Alt+1..9
    if (e.altKey && !e.ctrlKey && !e.shiftKey) {
      const match = e.code.match(/^Digit([1-9])$/);
      if (match) {
        e.preventDefault();
        document.dispatchEvent(new CustomEvent('ww:switch-section', { detail: parseInt(match[1]) - 1 }));
        return;
      }
    }

    // Ctrl+Alt
    if (e.ctrlKey && e.altKey && !e.shiftKey) {
      if (e.code === 'KeyB') {
        e.preventDefault();
        const isHidden = localStorage.getItem('chapters-right-panel-visible') === 'false';
        localStorage.setItem('chapters-right-panel-visible', (!isHidden).toString());
        document.dispatchEvent(new CustomEvent('ww:toggle-right-panel'));
        return;
      }
    }

    // Ctrl+R
    if (e.ctrlKey && !e.altKey && !e.shiftKey && e.code === 'KeyR') {
      e.preventDefault();
      const storedValue = localStorage.getItem('split-view-show-structure');
      const shouldShow = storedValue !== 'false';
      const newState = !shouldShow;
      localStorage.setItem('split-view-show-structure', newState.toString());
      document.dispatchEvent(new CustomEvent('ww:toggle-structure'));
      return;
    }

    // Escape
    if (e.code === 'Escape') {
      if (ctx.showSettings.value) {
        ctx.showSettings.value = false;
        return;
      }
    }
  };

  const register = () => {
    window.addEventListener('keydown', handleKeydown);
  };

  const unregister = () => {
    window.removeEventListener('keydown', handleKeydown);
  };

  return { register, unregister };
}