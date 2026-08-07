/**
 * @file ui_editor.ts
 * @description Точка входа для плавающего редактора (загружается в iframe FloatingEntityEditor)
 */

import { createApp, ref, onMounted } from 'vue';

import '@worldwiki/resources/styles/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/glass-theme.css';
import '@worldwiki/resources/styles/new-ui-theme.css';

import { settingsService, i18n } from '@worldwiki/components';
import type { Plugin } from 'vue';
import * as api from '../services/api.client';
import { entityApi } from '../services/Entity/entity.api';
import EntityEditorVue from '../features/entities/EntityEditor/EntityEditor.vue';

// Глобальный доступ к Vue для legacy скриптов (если нужно)
if (typeof window !== 'undefined') {
  (window as any).Vue = (window as any).Vue || {};
}

async function init() {
  const params = new URLSearchParams(window.location.search);
  const project = params.get('project') || 'default';
  const entityType = params.get('type') || '';
  const entityId = params.get('id') || '';

  // Загрузка настроек для применения CSS переменных (Glass UI)
  settingsService.applySettings();
  await settingsService.loadSettings().catch((e: any) => console.warn('Failed to load settings:', e));

  const app = createApp({
    components: {
      'entity-editor-vue': EntityEditorVue
    },
    setup() {
      const isLoadingData = ref(true);
      const initialData = ref({});
      const isUnsaved = ref(false);
      const editorRef = ref<any>(null);

      // История версий
      const showHistory = ref(false);
      const isLoadingHistory = ref(false);
      const revisions = ref<any[]>([]);
      
      const isPreviewingHistory = ref(false);
      const previewingRevId = ref<string | null>(null);
      const previewData = ref<any>(null);
      const previewKey = ref(0);

      const loadData = async () => {
        try {
          if (project && entityType && entityId) {
            const detail = await entityApi.getEntity(project, entityType, entityId);
            if (detail) initialData.value = detail;
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
          const rawRevisions: any[] = await window.__TAURI__.core.invoke('get_entity_revisions', {
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

      const previewHistory = (rev: any) => {
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
        initialData.value = JSON.parse(JSON.stringify(previewData.value));
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
                formData.name || 'Сущность'
            );
            await api.saveEntityWithRelations(project, mainPayload as any, Object.values(foreignUpdates));
            isUnsaved.value = false;
            // Обновляем историю после сохранения
            if (showHistory.value) loadHistory();
            
            const { emit } = await import('@tauri-apps/api/event');
            await emit('ww-entity-saved', { type: entityType, id: entityId });
          } catch(e) {
            console.error('Ошибка сохранения:', e);
            alert('Ошибка сохранения');
          }
        }
      };

      let isLiveSyncing = false;
      let liveSyncTimer: any = null;

      const merge = (target: any, source: any) => {
        for (const key in source) {
          if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {};
            merge(target[key], source[key]);
          } else if (Array.isArray(source[key])) {
            if (!Array.isArray(target[key])) target[key] = [];
            for (let i = 0; i < source[key].length; i++) {
              if (i < target[key].length) {
                if (typeof source[key][i] === 'object' && source[key][i] !== null) merge(target[key][i], source[key][i]);
                else target[key][i] = source[key][i];
              } else {
                target[key].push(source[key][i]);
              }
            }
            target[key].length = source[key].length;
          } else {
            target[key] = source[key];
          }
        }
      };

      const handleUpdateData = (data: any) => {
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
          listen('ww-entity-saved', (event: any) => {
            const { type, id } = event.payload;
            const rawId = id.replace('entities:', '');
            if (type === entityType && (rawId === entityId || id === entityId)) {
              // Если сохранили не мы (или даже мы), перезагружаем данные для синхронизации
              loadData();
            }
          });
          
          listen('ww-entity-live-sync', (event: any) => {
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

