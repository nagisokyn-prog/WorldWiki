/**
 * @file floating.ts
 * @description Pinia store для управления плавающими окнами
 */
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useFloatingStore = defineStore('floating', () => {
  const floatingEditors = ref<Array<{ id: string; type: string; entityId: string }>>([]);

  const openFloatingEditor = async (project: string, entityType: string, entityId: string) => {
    // Label окна должен быть уникальным и состоять только из a-zA-Z0-9_-
    const safeType = entityType.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeId = String(entityId).replace(/[^a-zA-Z0-9_-]/g, '');
    const label = `editor_${safeType}_${safeId}`;

    try {
      // Dynamic import for Tauri API (works in web mode too)
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      
      const win = new WebviewWindow(label, {
        url: `/ui_editor.html?project=${encodeURIComponent(project)}&type=${encodeURIComponent(entityType)}&id=${encodeURIComponent(entityId)}`,
        title: `Редактор: ${entityType}`,
        width: 1000,
        height: 800,
        center: true,
        focus: true,
        decorations: true,
        resizable: true,
      });

      win.once('tauri://created', () => {
        console.log(`[FloatingStore] Окно ${label} создано`);
      });

      win.once('tauri://error', async (e: unknown) => {
        console.warn(`[FloatingStore] Окно ${label} уже существует или произошла ошибка:`, e);
        try {
          const existingWin = await WebviewWindow.getByLabel(label);
          if (existingWin) {
            existingWin.setFocus();
          }
        } catch (err) {
          console.error('[FloatingStore] Не удалось сфокусироваться на окне', err);
        }
      });

      return win;
    } catch (e) {
      console.error('[FloatingStore] Ошибка при создании окна:', e);
      return null;
    }
  };

  const closeFloatingEditor = (label: string) => {
    // Implementation can be enhanced later
    floatingEditors.value = floatingEditors.value.filter(f => f.id !== label);
  };

  return {
    floatingEditors,
    openFloatingEditor,
    closeFloatingEditor,
  };
});