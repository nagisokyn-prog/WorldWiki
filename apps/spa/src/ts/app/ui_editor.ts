/**
 * @file ui_editor.ts
 * @description Точка входа для плавающего редактора (загружается в iframe FloatingEntityEditor)
 */

import { createApp, ref, onMounted } from 'vue';

import '@worldwiki/resources/styles/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/app.css';

import { settingsService, i18n } from '@worldwiki/components';
import type { Plugin } from 'vue';
import * as api from '../services/api.client';
import { entityApi } from '../services/Entity/entity.api';
import EntityEditorVue from '../features/entities/EntityEditor/EntityEditor.vue';
import type { EntityRevision } from '../features/entities/EntityEditor/EntityEditor.model';
import type { Entity } from '../types/generated/Entity';

// Глобальный доступ к Vue для legacy скриптов (если нужно)
if (typeof window !== 'undefined') {
  (window as unknown as { Vue?: unknown }).Vue = (window as unknown as { Vue?: unknown }).Vue || {};
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const project = params.get('project') || 'default';
  const entityType = params.get('type') || '';
  const entityId = params.get('id') || '';

  // Загрузка настроек для применения CSS переменных (Glass UI)
  settingsService.applySettings();
  await settingsService.loadSettings().catch((e: unknown) => console.warn('Failed to load settings:', e));

  const app = createApp({
    components: {
      'entity-editor-vue': EntityEditorVue
    },
    setup() {
      const isLoadingData = ref(true);
      const initialData = ref<Record<string, unknown>>({});
      const isUnsaved = ref(false);
      const editorRef = ref<{ getFormData: () => Record<string, unknown>; getForeignUpdates?: () => Record<string, unknown> } | null>(null);

      // История версий
      const showHistory = ref(false);
      const isLoadingHistory = ref(false);
      const revisions = ref<EntityRevision[]>([]);
      
      const isPreviewingHistory = ref(false);
      const previewingRevId = ref<string | null>(null);
      const previewData = ref<unknown>(null);
      const previewKey = ref(0);

      const loadData = async () => {
        try {
          if (project && entityType && entityId) {
            const detail = await entityApi.getEntity(project, entityType, entityId);
            if (detail) initialData.value = detail as Record<string, unknown>;
          }
        } catch(e) {
          console.error('Ошибка загрузки данных сущности:', e);
        } finally {
          isLoadingData.value = false;
        }
      };

      const loadHistory = async () => {
        if (!project || !entityId || !window.__TAURI__) return;
        isLoadingHistory.value = true;
        try {
          // Вызываем нашу новую команду
          const rawRevisions = await window.__TAURI__.core.invoke<EntityRevision[]>('get_entity_revisions', {
            project,
            entityId
          });
          revisions.value = rawRevisions.map(rev => ({
            ...rev,
            formattedDate: new Date(rev.created_at).toLocaleString()
          }));
        } catch (e) {
          console.error('Ошибка загрузки истории:', e);
        } finally {
          isLoadingHistory.value = false;
        }
      };

      const toggleHistory = () => {
        showHistory.value = !showHistory.value;
        if (showHistory.value && revisions.value.length === 0) {
          loadHistory();
        }
      };

      const previewHistory = (rev: EntityRevision) => {
        isPreviewingHistory.value = true;
        previewingRevId.value = rev.id;
        previewData.value = rev.content;
        previewKey.value++; // Перемонтируем редактор с новыми данными
      };

      const exitHistoryPreview = () => {
        isPreviewingHistory.value = false;
        previewingRevId.value = null;
        previewData.value = null;
        previewKey.value++;
      };

      const restoreHistory = () => {
        // Мы просто выключаем режим "превью", но оставляем данные как "несохраненные" в редакторе!
        initialData.value = JSON.parse(JSON.stringify(previewData.value || {}));
        isPreviewingHistory.value = false;
        previewingRevId.value = null;
        previewData.value = null;
        previewKey.value++;
        isUnsaved.value = true;
      };

      const save = async () => {
        if (editorRef.value && editorRef.value.getFormData) {
          const formData = editorRef.value.getFormData();
          const foreignUpdates = editorRef.value.getForeignUpdates ? editorRef.value.getForeignUpdates() : {};
          
          try {
            const mainPayload = entityApi.formatEntityPayload(
                project, 
                entityType, 
                formData, 
                entityId.startsWith('entities:') ? entityId : `entities:${entityId}`, 
                (formData.name as string) || 'Сущность'
            );
            await api.saveEntityWithRelations(project, mainPayload as unknown as Entity, Object.values(foreignUpdates) as unknown as Entity[]);
            isUnsaved.value = false;
            // Обновляем историю после сохранения
            if (showHistory.value) loadHistory();
            
            const { emit } = await import('@tauri-apps/api/event');
            await emit('ww-entity-saved', { type: entityType, id: entityId });
          } catch(e) {
            console.error('Ошибка сохранения:', e);
            const { appAlert } = await import('@worldwiki/components');
            appAlert('Ошибка сохранения');
          }
        }
      };

      let isLiveSyncing = false;
      let liveSyncTimer: ReturnType<typeof setTimeout> | null = null;

      const merge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
        for (const key in source) {
          if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            merge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
          } else if (Array.isArray(source[key])) {
            if (!Array.isArray(target[key])) target[key] = [];
            const tArr = target[key] as unknown[];
            const sArr = source[key] as unknown[];
            for (let i = 0; i < sArr.length; i++) {
              if (i < tArr.length) {
                if (typeof sArr[i] === 'object' && sArr[i] !== null) merge(tArr[i] as Record<string, unknown>, sArr[i] as Record<string, unknown>);
                else tArr[i] = sArr[i];
              } else {
                tArr.push(sArr[i]);
              }
            }
            tArr.length = sArr.length;
          } else {
            target[key] = source[key];
          }
        }
      };

      const handleUpdateData = (data: Record<string, unknown>) => {
        if (isLiveSyncing) return;
        if (liveSyncTimer) clearTimeout(liveSyncTimer);
        liveSyncTimer = setTimeout(async () => {
          try {
            console.log('[LiveSync] Emitting ww-entity-live-sync from ui_editor', { entityType, entityId });
            const { emit } = await import('@tauri-apps/api/event');
            await emit('ww-entity-live-sync', { type: entityType, id: entityId, data });
          } catch(e) {
            console.error('[LiveSync] Error emitting', e);
          }
        }, 150);
      };

      onMounted(() => {
        loadData();
        // Уведомляем родительское окно, что фрейм загрузился
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'EDITOR_LOADED', id: entityId }, '*');
        }
        
        // Слушаем событие сохранения из главного окна
        import('@tauri-apps/api/event').then(({ listen }) => {
          listen<{ type: string; id: string }>('ww-entity-saved', (event) => {
            const { type, id } = event.payload;
            const rawId = id.replace('entities:', '');
            if (type === entityType && (rawId === entityId || id === entityId)) {
              // Если сохранили не мы (или даже мы), перезагружаем данные для синхронизации
              loadData();
            }
          });
          
          listen<{ type: string; id: string; data: Record<string, unknown> }>('ww-entity-live-sync', (event) => {
            const { type, id, data } = event.payload;
            const rawId = id.replace('entities:', '');
            if (type === entityType && (rawId === entityId || id === entityId)) {
              if (initialData.value) {
                console.log('[LiveSync] Received in ui_editor', data);
                isLiveSyncing = true;
                merge(initialData.value, data);
                setTimeout(() => { isLiveSyncing = false; }, 50);
              }
            }
          });
        }).catch(e => console.warn('Tauri listen not available in ui_editor', e));
      });

      return {
        project,
        entityType,
        entityId,
        isLoadingData,
        initialData,
        isUnsaved,
        editorRef,
        save,
        handleUpdateData,
        // История
        showHistory,
        isLoadingHistory,
        revisions,
        toggleHistory,
        isPreviewingHistory,
        previewingRevId,
        previewData,
        previewKey,
        previewHistory,
        exitHistoryPreview,
        restoreHistory
      };
    }
  });

  app.use(i18n as unknown as Plugin);
  app.mount('#app');
}

init();
