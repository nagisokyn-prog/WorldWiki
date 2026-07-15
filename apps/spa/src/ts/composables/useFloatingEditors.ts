import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export function useFloatingEditors() {
  const openFloatingEditor = async (project: string, entityType: string, entityId: string) => {
    // Label окна должен быть уникальным и состоять только из a-zA-Z0-9_-
    const safeType = entityType.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeId = entityId.replace(/[^a-zA-Z0-9_-]/g, '');
    const label = `editor_${safeType}_${safeId}`;
    
    try {
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
        console.log(`[FloatingEditors] Окно ${label} создано`);
      });
      
      win.once('tauri://error', async (e) => {
        console.warn(`[FloatingEditors] Окно ${label} уже существует или произошла ошибка:`, e);
        // Если окно существует, просто фокусируемся на нем
        try {
          const existingWin = await WebviewWindow.getByLabel(label);
          if (existingWin) {
            existingWin.setFocus();
          }
        } catch (err) {
          console.error('[FloatingEditors] Не удалось сфокусироваться на окне', err);
        }
      });

      return win;
    } catch (e) {
      console.error('[FloatingEditors] Исключение при создании окна:', e);
      return null;
    }
  };
  
  return {
    openFloatingEditor
  };
}
