/**
 * @file useEditorViewListeners.ts
 * @description Глобальные слушатели событий документа для синхронизации и закрытия вкладок EditorView
 */

import { onMounted, onUnmounted } from 'vue';
import type { useShellStore } from '@/stores/shell';

export interface UseEditorViewListenersDeps {
  shell: ReturnType<typeof useShellStore>;
}

export function useEditorViewListeners(deps: UseEditorViewListenersDeps) {
  const { shell } = deps;

  const matchesEntityId = (
    tab: { id: string; rawId?: string; entityType: string },
    entityType: string,
    targetId: string
  ): boolean => {
    if (tab.entityType !== entityType) return false;
    const cleanTarget = String(targetId).replace(new RegExp(`^(entity:)?(${entityType}s?):`), '');
    const tabCleanRaw = String(tab.rawId || '').replace(new RegExp(`^(entity:)?(${entityType}s?):`), '');
    const tabCleanId = String(tab.id).replace(new RegExp(`^(entity:)?(${entityType}s?):`), '');
    return (
      tabCleanRaw === cleanTarget ||
      tabCleanId === cleanTarget ||
      tab.rawId === targetId ||
      tab.id === targetId ||
      tab.id.endsWith(cleanTarget) ||
      tab.id === `entity:${entityType}:${cleanTarget}`
    );
  };

  const toggleWowilonHandler = () => {
    if (!__FEATURE_AI__) {
      return;
    }
    shell.isWowilonOpen = !shell.isWowilonOpen;
  };

  const planetRenamedListener = (e: Event) => {
    const { id, name } = (e as CustomEvent<{ id: string; name: string }>).detail;
    for (const group of shell.editorGroups) {
      for (const tab of group.tabs) {
        if (matchesEntityId(tab, 'planet', id)) {
          if (typeof shell.updateTabTitle === 'function') {
            shell.updateTabTitle(tab.id, name);
          }
          tab.title = name;
        }
      }
    }
  };

  const calendarRenamedListener = (e: Event) => {
    const { id, name } = (e as CustomEvent<{ id: string; name: string }>).detail;
    for (const group of shell.editorGroups) {
      for (const tab of group.tabs) {
        if (matchesEntityId(tab, 'calendar', id)) {
          if (typeof shell.updateTabTitle === 'function') {
            shell.updateTabTitle(tab.id, name);
          }
          tab.title = name;
        }
      }
    }
  };

  const calendarDeletedListener = (e: Event) => {
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    if (!id) return;
    for (const group of shell.editorGroups) {
      const tabsToClose = group.tabs.filter((tab) => matchesEntityId(tab, 'calendar', id));
      for (const tab of tabsToClose) {
        void shell.closeEditor(tab.id);
      }
    }
  };

  const planetDeletedListener = (e: Event) => {
    const { id } = (e as CustomEvent<{ id: string }>).detail;
    if (!id) return;
    for (const group of shell.editorGroups) {
      const tabsToClose = group.tabs.filter((tab) => matchesEntityId(tab, 'planet', id));
      for (const tab of tabsToClose) {
        void shell.closeEditor(tab.id);
      }
    }
  };

  onMounted(() => {
    document.addEventListener('ww:toggle-wowilon', toggleWowilonHandler);
    document.addEventListener('ww:planet-renamed', planetRenamedListener as EventListener);
    document.addEventListener('ww:calendar-renamed', calendarRenamedListener as EventListener);
    document.addEventListener('ww:planet-deleted', planetDeletedListener as EventListener);
    document.addEventListener('ww:calendar-deleted', calendarDeletedListener as EventListener);
  });

  onUnmounted(() => {
    document.removeEventListener('ww:toggle-wowilon', toggleWowilonHandler);
    document.removeEventListener('ww:planet-renamed', planetRenamedListener as EventListener);
    document.removeEventListener('ww:calendar-renamed', calendarRenamedListener as EventListener);
    document.removeEventListener('ww:planet-deleted', planetDeletedListener as EventListener);
    document.removeEventListener('ww:calendar-deleted', calendarDeletedListener as EventListener);
  });

  return {
    matchesEntityId,
    planetRenamedListener,
    calendarRenamedListener,
    calendarDeletedListener,
    planetDeletedListener,
  };
}
