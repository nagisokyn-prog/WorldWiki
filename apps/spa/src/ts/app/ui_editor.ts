/**
 * @file ui_editor.ts
 * @description Точка входа для отдельного плавающего окна «Редактор сущности»
 */

import { createApp, h } from 'vue';
import { createPinia } from 'pinia';
import type { Plugin } from 'vue';

import '@worldwiki/resources/styles/tokens/fonts.css';
import '@worldwiki/resources/styles/font-awesome.min.css';
import '@worldwiki/resources/styles/styles.css';

import { settingsService, i18n } from '@worldwiki/components';
import EntityEditorWindow from '../features/entities/EntityEditorWindow/EntityEditorWindow.vue';

async function init() {
  const params = new URLSearchParams(window.location.search);
  const project = params.get('project') || 'default';
  const entityType = params.get('type') || '';
  const entityId = params.get('id') || '';

  // Применяем настройки темы и дизайн-системы (Glass UI)
  settingsService.applySettings();
  await settingsService
    .loadSettings()
    .catch((e: unknown) => console.warn('Failed to load settings in ui_editor:', e));

  const pinia = createPinia();

  const app = createApp({
    name: 'EntityEditorStandaloneApp',
    render: () =>
      h(EntityEditorWindow, {
        project,
        entityType,
        entityId,
      }),
  });

  app.use(pinia);
  app.use(i18n as unknown as Plugin);
  app.mount('#app');
}

init();
