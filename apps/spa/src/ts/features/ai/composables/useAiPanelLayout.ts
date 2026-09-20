import { ref, watch } from 'vue';
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

  watch(panelWidth, (w) => localStorage.setItem('worldwiki_ai_panel_width', String(w)));
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
    const startX = e.clientX;
    const startWidth = panelWidth.value;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newWidth = Math.max(300, Math.min(800, startWidth + delta));
      panelWidth.value = newWidth;
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

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
