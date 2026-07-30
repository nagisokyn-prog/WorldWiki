/**
 * @file ui_editor.ts
 * @description Точка входа для плавающего редактора (загружается в iframe FloatingEntityEditor)
 */

import { createApp, ref, onMounted } from 'vue';

import '@worldwiki/resources/styles/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/glass-theme.css';
import '@worldwiki/resources/styles/new-ui-theme.css';

import { settingsService } from '@worldwiki/components';
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
        if (editorRef.value && editorRef.value.save) {
          await editorRef.value.save();
          isUnsaved.value = false;
          // Обновляем историю после сохранения
          if (showHistory.value) loadHistory();
          
          try {
            const { emit } = await import('@tauri-apps/api/event');
            await emit('ww-entity-saved', { type: entityType, id: entityId });
          } catch(e) {
            console.warn('Tauri emit failed', e);
          }
        }
      };

      onMounted(() => {
        loadData();
        // Уведомляем родительское окно, что фрейм загрузился
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'EDITOR_LOADED', id: entityId }, '*');
        }
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

  app.mount('#app');
}

init();

