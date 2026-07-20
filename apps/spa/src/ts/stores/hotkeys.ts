import { defineStore } from 'pinia';
import { useShellStore } from './shell';
import { useZoomStore } from './zoom';

export const useHotkeysStore = defineStore('hotkeys', () => {
  const shell = useShellStore();
  const zoom = useZoomStore();

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
      const tauri = (window as any).__TAURI__;
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
          shell.saveAll();
          return;
        case 'Comma':
          shell.toggleSettings();
          return;
        case 'KeyF': {
          const input = document.querySelector('.sidebar-search input') as HTMLInputElement | null;
          input?.focus();
          return;
        }
        case 'KeyW':
          if (shell.activeEditorId) shell.closeEditor(shell.activeEditorId);
          return;
        case 'KeyB':
          shell.sidebarVisible = !shell.sidebarVisible;
          return;
        case 'KeyP':
          if (shell.quickOpenRef && typeof (shell.quickOpenRef as any).open === 'function') {
            (shell.quickOpenRef as any).open();
          }
          return;
        case 'KeyN': {
          const type = shell.currentSidebarTab;
          if (type) shell.addNewEntity(type);
          return;
        }
        case 'Equal':
          shell.applyZoom(zoom.zoomLevel + 0.1);
          return;
        case 'Minus':
          shell.applyZoom(zoom.zoomLevel - 0.1);
          return;
        case 'Digit0':
          shell.applyZoom(1);
          return;
        case 'Backquote':
          shell.activePanelTab = shell.activePanelTab === '' ? 'console' : '';
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
          shell.splitRight();
          return;
        }
      }
    }

    // Ctrl+Shift
    if (e.ctrlKey && e.shiftKey && !e.altKey) {
      if (['KeyP', 'KeyN', 'KeyS', 'Tab'].includes(e.code)) e.preventDefault();
      switch (e.code) {
        case 'KeyP':
          if (shell.commandPaletteRef && typeof (shell.commandPaletteRef as any).open === 'function') {
            (shell.commandPaletteRef as any).open();
          }
          return;
        case 'KeyN':
          shell.createChapterIn({});
          return;
        case 'KeyS':
          shell.saveAll();
          return;
        case 'Tab':
          // handled via template refs
          return;
        case 'KeyT':
          if (shell.tagsManagerRef && typeof (shell.tagsManagerRef as any).open === 'function') {
            (shell.tagsManagerRef as any).open();
          }
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
      if (shell.showSettings) {
        shell.showSettings = false;
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
});
