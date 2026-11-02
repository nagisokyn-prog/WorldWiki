import { onScopeDispose, type Ref } from 'vue';
import type { useEditorGroups } from '@worldwiki/components';
import * as api from '../../services/api.client';
import { entityApi } from '../../services/Entity/entity.api';
import type { useShellLayout } from './shell.layout';
import type { useShellEntityOps } from './shell.entityOps';

export interface ShellEventsDeps {
  eg: ReturnType<typeof useEditorGroups>;
  projectName: Ref<string>;
  layout: ReturnType<typeof useShellLayout>;
  entityOps: ReturnType<typeof useShellEntityOps>;
  chapterTreeRef: Ref<{ load?: (id?: string) => Promise<void>; refresh?: () => void; [key: string]: unknown } | null>;
}

export function setupShellTauriEvents(deps: ShellEventsDeps) {
  if (typeof window === 'undefined' || !window.__TAURI__) return;

  import('@tauri-apps/api/event').then(({ listen }) => {
    listen<{ type: string; id: string }>('ww-entity-saved', (event) => {
      const { type, id } = event.payload;
      const cleanTargetId = (id || '').replace(/^entities:/, '');

      deps.eg.groups.value.forEach((group) => {
        group.tabs.forEach((tab) => {
          const tabCleanRawId = (tab.rawId || '').replace(/^entities:/, '');
          const tabCleanId = (tab.id || '').replace(/^entity:[^:]+:/, '').replace(/^entities:/, '');
          if (tab.entityType === type && (tabCleanRawId === cleanTargetId || tabCleanId === cleanTargetId)) {
            if (type === 'chapter') {
              api.getChapter(tab.rawId).then((data) => {
                if (data) {
                  tab.data = { ...(data as unknown as Record<string, unknown>) };
                  tab.unsaved = false;
                  if (data.title) {
                    tab.title = data.title;
                    deps.eg.updateTabData(tab.id, { data: tab.data, title: data.title, unsaved: false });
                  } else {
                    deps.eg.updateTabData(tab.id, { data: tab.data, unsaved: false });
                  }
                }
              });
            } else if (type !== 'schema-editor') {
              entityApi.getEntity(deps.projectName.value, type, tab.rawId).then((data) => {
                if (data) {
                  tab.data = { ...(data as Record<string, unknown>) };
                  tab.unsaved = false;
                  const newTitle = (data.Name || data.name || data.title) as string | undefined;
                  if (newTitle) {
                    tab.title = newTitle;
                    deps.eg.updateTabData(tab.id, { data: tab.data, title: newTitle, unsaved: false });
                  } else {
                    deps.eg.updateTabData(tab.id, { data: tab.data, unsaved: false });
                  }
                }
              });
            }
          }
        });
      });

      if (deps.layout.currentSidebarTab.value === type) deps.entityOps.loadEntityList(type);
      if (deps.chapterTreeRef.value?.load) deps.chapterTreeRef.value.load();
      document.dispatchEvent(new CustomEvent('ww:entity-saved', { detail: { type, id } }));
    })?.catch?.(() => {});

    listen<{ type: string; id: string; data: Record<string, unknown>; sender?: string }>('ww-entity-live-sync', (event) => {
      if (event.payload.sender === 'main') {
        return;
      }
      const { type, id, data } = event.payload;
      const cleanTargetId = (id || '').replace(/^entities:/, '');

      deps.eg.groups.value.forEach((group) => {
        group.tabs.forEach((tab) => {
          const tabCleanRawId = (tab.rawId || '').replace(/^entities:/, '');
          const tabCleanId = (tab.id || '').replace(/^entity:[^:]+:/, '').replace(/^entities:/, '');
          if (tab.entityType === type && (tabCleanRawId === cleanTargetId || tabCleanId === cleanTargetId)) {
            console.log('[LiveSync] Received in shell from', event.payload.sender, data);
            deps.entityOps.setIsLiveSyncing(true);
            deps.entityOps.handleUpdateData(tab.id, data, true);
            tab.data = { ...(tab.data as Record<string, unknown>) };
            deps.eg.updateTabData(tab.id, { data: tab.data });
            setTimeout(() => {
              deps.entityOps.setIsLiveSyncing(false);
            }, 100);
          }
        });
      });
    })?.catch?.(() => {});
  }).catch(() => {});

  if (typeof document !== 'undefined') {
    const handleChapterRenamed = (e: Event) => {
      const detail = (e as CustomEvent<{ id: string; title: string }>).detail;
      if (!detail?.id || detail.title === undefined) return;
      const cleanTargetId = String(detail.id).replace(/^(chapters|chapter):/, '');
      deps.eg.groups.value.forEach((group) => {
        group.tabs.forEach((tab) => {
          const tabCleanRawId = (tab.rawId || '').replace(/^(chapters|chapter):/, '');
          const tabCleanId = (tab.id || '').replace(/^(chapters|chapter):/, '');
          if (tabCleanRawId === cleanTargetId || tabCleanId === cleanTargetId) {
            tab.title = detail.title;
            deps.eg.updateTabData(tab.id, { title: detail.title });
          }
        });
      });
    };

    document.addEventListener('ww:chapter-renamed', handleChapterRenamed as EventListener);

    onScopeDispose(() => {
      document.removeEventListener('ww:chapter-renamed', handleChapterRenamed as EventListener);
    });
  }
}
