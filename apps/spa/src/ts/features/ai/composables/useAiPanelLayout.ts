import { ref, watch, onUnmounted } from 'vue';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import type { Ref } from 'vue';

export function useAiPanelLayout(options: {
  emitClose: () => void;
  activeChatId: Ref<string>;
  currentProject: string;
  onSettingsClosed?: () => void;
}) {
  const savedWidth = Number(localStorage.getItem('worldwiki_ai_panel_width') || '400');
  const panelWidth = ref(Number.isNaN(savedWidth) ? 400 : Math.max(300, Math.min(1200, savedWidth)));
  const showSidebar = ref(localStorage.getItem('worldwiki_ai_show_sidebar') === 'true');
  const isSettingsOpen = ref(localStorage.getItem('worldwiki_ai_settings_open') === 'true');
  const isToolInspectorOpen = ref(false);

  let cleanupResize: (() => void) | null = null;

  watch(showSidebar, (v) => localStorage.setItem('worldwiki_ai_show_sidebar', String(v)));
  watch(isSettingsOpen, (v) => {
    localStorage.setItem('worldwiki_ai_settings_open', String(v));
    if (!v && options.onSettingsClosed) {
      options.onSettingsClosed();
    }
  });

  const toggleSidebar = () => {
    showSidebar.value = !showSidebar.value;
  };

  const startResize = (e: MouseEvent) => {
    if (cleanupResize) {
      cleanupResize();
    }
    const startX = e.clientX;
    const startWidth = panelWidth.value;
    let latestWidth = startWidth;
    let rafId: number | null = null;

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'ew-resize';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      latestWidth = Math.max(300, Math.min(800, startWidth + delta));
      panelWidth.value = latestWidth;
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          rafId = null;
        });
      }
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      panelWidth.value = latestWidth;
      localStorage.setItem('worldwiki_ai_panel_width', String(latestWidth));
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (cleanupResize) {
        cleanupResize();
        cleanupResize = null;
      }
    };

    cleanupResize = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  onUnmounted(() => {
    if (cleanupResize) {
      cleanupResize();
      cleanupResize = null;
    }
  });

  const detachWindow = async () => {
    options.emitClose();
    try {
      const params = new URLSearchParams();
      if (options.activeChatId.value) params.set('chatId', options.activeChatId.value);
      if (options.currentProject) params.set('project', options.currentProject);
      const url = `ai.html?${params.toString()}`;

      const webview = new WebviewWindow('wowilon-ai', {
        url,
        title: 'WoWiLon AI',
        width: 800,
        height: 600,
        resizable: true,
        minWidth: 400,
        minHeight: 400,
        center: true
      });

      webview.once('tauri://error', (err) => {
        console.error('Error creating AI window:', err);
      });
    } catch (e) {
      console.error('Failed to create AI window:', e);
    }
  };

  return {
    panelWidth,
    showSidebar,
    isSettingsOpen,
    isToolInspectorOpen,
    toggleSidebar,
    startResize,
    detachWindow
  };
}
