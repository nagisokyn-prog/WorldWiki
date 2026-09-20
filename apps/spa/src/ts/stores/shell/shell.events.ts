import type { Ref } from 'vue';
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
      const rawId = id.replace('entities:', '');

      deps.eg.groups.value.forEach((group) => {
        group.tabs.forEach((tab) => {
          if (tab.entityType === type && (tab.rawId === rawId || tab.id === rawId)) {
            if (type === 'chapter') {
              api.getChapter(tab.rawId).then((data) => {
                if (data) {
                  tab.data = data as unknown as Record<string, unknown>;
                }
              });
            } else if (type !== 'schema-editor') {
              entityApi.getEntity(deps.projectName.value, type, tab.rawId).then((data) => {
                if (data) {
                  tab.data = data as Record<string, unknown>;
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

    listen<{ type: string; id: string; data: Record<string, unknown> }>('ww-entity-live-sync', (event) => {
      const { type, id, data } = event.payload;
      const rawId = id.replace('entities:', '');

      deps.eg.groups.value.forEach((group) => {
        group.tabs.forEach((tab) => {
          if (tab.entityType === type && (tab.rawId === rawId || tab.id === rawId)) {
            console.log('[LiveSync] Received in shell', data);
            deps.entityOps.setIsLiveSyncing(true);
            deps.entityOps.handleUpdateData(tab.id, data, true);
            setTimeout(() => {
              deps.entityOps.setIsLiveSyncing(false);
            }, 50);
          }
        });
      });
    })?.catch?.(() => {});
  }).catch(() => {});
}
