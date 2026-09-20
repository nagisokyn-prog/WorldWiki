import { ref } from 'vue';

export interface FloatingEditor {
  id: string;
  entityType: string;
  entityId: string;
  zIndex: number;
}

export function useShellFloating(appId: string = 'app') {
  const floatingEditors = ref<FloatingEditor[]>([]);
  const nextZIndex = ref(20000);

  const openFloatingEditor = (entityType: string, entityId: string) => {
    const id = `${entityType}:${entityId}`;

    try {
      const tauri = window.__TAURI__ as unknown as {
        webviewWindow?: { WebviewWindow: new (label: string, opts: Record<string, unknown>) => void };
      };
      if (tauri?.webviewWindow?.WebviewWindow) {
        const label = `${appId}-editor-${entityType}-${entityId}`.replace(/[^a-z0-9]/gi, '-');
        new tauri.webviewWindow.WebviewWindow(label, {
          url: `ui_editor.html?type=${entityType}&id=${entityId}`,
          title: `Edit: ${entityType} [${entityId}]`,
          width: 950,
          height: 750,
          resizable: true,
          center: true,
          decorations: true
        });
        return;
      }
    } catch (e) {
      console.warn('[useShellFloating] Native window failed:', e);
    }

    const existing = floatingEditors.value.find(fe => fe.id === id);
    if (existing) {
      existing.zIndex = nextZIndex.value++;
    } else {
      floatingEditors.value.push({ id, entityType, entityId, zIndex: nextZIndex.value++ });
    }
  };

  const focusFloatingEditor = (id: string) => {
    const fe = floatingEditors.value.find(e => e.id === id);
    if (fe) fe.zIndex = nextZIndex.value++;
  };

  const closeFloatingEditor = (id: string) => {
    floatingEditors.value = floatingEditors.value.filter(e => e.id !== id);
  };

  if (typeof window !== 'undefined') {
    (window as unknown as { openFloatingEditor: typeof openFloatingEditor }).openFloatingEditor = openFloatingEditor;
  }

  return {
    floatingEditors,
    openFloatingEditor,
    focusFloatingEditor,
    closeFloatingEditor
  };
}
