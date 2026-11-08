import { onMounted, onUnmounted } from 'vue';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import * as api from '@/services/api.client';
import { appConfirm, appAlert } from '@worldwiki/components';

export function useAppSwitcher() {
  let unlisten: UnlistenFn | null = null;
  let isPromptOpen = false;

  async function handleWwikiPath(filePath: string): Promise<boolean> {
    if (isPromptOpen) return false;
    const cleanPath = filePath.trim();
    if (!cleanPath.endsWith('.wwiki')) return false;

    const fileName = cleanPath.split(/[/\\]/).pop() || cleanPath;
    isPromptOpen = true;

    try {
      const confirmed = await appConfirm(
        `Обнаружен файл резервной копии:\n"${fileName}"\n\nВосстановить проект из этого архива?`,
        'Открытие резервной копии WorldWiki'
      );
      if (confirmed) {
        await api.restoreFromBackup(cleanPath);
        await appAlert(
          `Проект из архива "${fileName}" успешно восстановлен!`,
          'Восстановление завершено'
        );
        if (typeof window !== 'undefined' && window.location) {
          window.location.reload();
        }
        return true;
      }
      return false;
    } catch (err: unknown) {
      console.error('Ошибка восстановления из .wwiki:', err);
      const msg = typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : err instanceof Error ? err.message : JSON.stringify(err);
      await appAlert(`Не удалось восстановить проект: ${msg}`, 'Ошибка восстановления');
      return false;
    } finally {
      isPromptOpen = false;
    }
  }

  onMounted(async () => {
    // 1. Проверяем аргументы командной строки при холодном старте
    try {
      const initialPath = await api.getLaunchArgs();
      if (initialPath) {
        await handleWwikiPath(initialPath);
      }
    } catch (err) {
      console.warn('Не удалось получить аргументы запуска:', err);
    }

    // 2. Слушаем события открытия файла от single-instance при уже работающем приложении
    try {
      unlisten = await listen<string>('open-wwiki-file', (event) => {
        if (event.payload) {
          void handleWwikiPath(event.payload);
        }
      });
    } catch (err) {
      console.warn('Не удалось подписаться на событие open-wwiki-file:', err);
    }
  });

  onUnmounted(() => {
    if (unlisten) {
      unlisten();
      unlisten = null;
    }
  });

  return {
    handleWwikiPath
  };
}
