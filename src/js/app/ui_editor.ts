/**
 * @file ui_editor.ts
 * @description Точка входа для плавающего редактора (загружается в iframe FloatingEntityEditor)
 */

import { createApp, ref, onMounted } from 'vue';
import { settingsService } from '../services/settings.service';
import { apiService } from '../services/api.service';
import EntityEditorVue from '../components/Vue/EntityEditor.vue';

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
  await settingsService.loadSettings().catch(e => console.warn('Failed to load settings:', e));

  const app = createApp({
    components: {
      'entity-editor-vue': EntityEditorVue
    },
    setup() {
      const isLoadingData = ref(true);
      const initialData = ref({});
      const isUnsaved = ref(false);
      const editorRef = ref<any>(null);

      const loadData = async () => {
        try {
          if (project && entityType && entityId) {
            const detail = await apiService.getEntity(project, entityType, entityId);
            if (detail) initialData.value = detail;
          }
        } catch(e) {
          console.error('Ошибка загрузки данных сущности:', e);
        } finally {
          isLoadingData.value = false;
        }
      };

      const save = async () => {
        if (editorRef.value && editorRef.value.save) {
          await editorRef.value.save();
          isUnsaved.value = false;
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
        save
      };
    }
  });

  app.mount('#app');
}

init();
